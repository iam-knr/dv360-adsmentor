// SimJob rows: fast-forward and reset (engine.md 10.2, 10.3). Progress is written between 24-tick chunks so the UI can
// show a bar with the sim date.
import type { Prisma } from '@prisma/client';
import type { Tx } from '@/lib/db';
import { newId } from '@/lib/db';

export type StopCondition = { untilAlert?: string; untilDate?: string };

/**
 * History mode (backfill of a new or reset sandbox): the job writes once per chunk, keeps hourly rows only for the last
 * `hourlyDays` and daily slices only for the last `sliceDays` before the end of the job. `today` is the sim date the
 * seed treats as today, used to finish the seed once the history is there.
 */
export interface HistoryParams {
  hourlyDays: number;
  sliceDays: number;
  today?: string;
}

export interface FastForwardParams extends StopCondition {
  simHours: number;
  history?: HistoryParams;
}

export interface JobProgress {
  doneTicks: number;
  totalTicks: number;
  /** Sim date (YYYY-MM-DD, UTC) the sandbox has reached. */
  simDate: string;
  stoppedBy?: string;
}

export interface JobView {
  id: string;
  sandboxId: string;
  kind: 'FAST_FORWARD' | 'RESET';
  status: 'QUEUED' | 'RUNNING' | 'DONE' | 'FAILED' | 'CANCELLED';
  params: FastForwardParams | Record<string, never>;
  progress: JobProgress | null;
  error: string | null;
}

const toView = (r: {
  id: string;
  sandboxId: string;
  kind: JobView['kind'];
  status: JobView['status'];
  params: Prisma.JsonValue;
  progress: Prisma.JsonValue | null;
  error: string | null;
}): JobView => ({
  id: r.id,
  sandboxId: r.sandboxId,
  kind: r.kind,
  status: r.status,
  params: r.params as unknown as JobView['params'],
  progress: r.progress as unknown as JobProgress | null,
  error: r.error,
});

export async function createJob(
  tx: Tx,
  sandboxId: string,
  kind: JobView['kind'],
  params: FastForwardParams | Record<string, never>,
): Promise<JobView> {
  const row = await tx.simJob.create({
    data: { id: newId(), sandboxId, kind, params: params as Prisma.InputJsonValue },
  });
  return toView(row);
}

export async function getJob(tx: Tx, id: string): Promise<JobView | null> {
  const row = await tx.simJob.findUnique({ where: { id } });
  return row ? toView(row) : null;
}

export async function setJob(
  tx: Tx,
  id: string,
  patch: { status?: JobView['status']; progress?: JobProgress; error?: string | null },
  now: Date,
): Promise<void> {
  await tx.simJob.update({
    where: { id },
    data: {
      ...(patch.status ? { status: patch.status } : {}),
      ...(patch.progress ? { progress: patch.progress as unknown as Prisma.InputJsonValue } : {}),
      ...(patch.error !== undefined ? { error: patch.error } : {}),
      ...(patch.status === 'RUNNING' ? { startedAt: now } : {}),
      ...(patch.status === 'DONE' || patch.status === 'FAILED' || patch.status === 'CANCELLED'
        ? { finishedAt: now }
        : {}),
    },
  });
}

/** Unfinished fast-forward jobs, oldest first; of one sandbox when `sandboxId` is given. */
export async function openJobs(tx: Tx, limit: number, sandboxId?: string): Promise<JobView[]> {
  const rows = await tx.simJob.findMany({
    where: {
      kind: 'FAST_FORWARD',
      status: { in: ['QUEUED', 'RUNNING'] },
      ...(sandboxId ? { sandboxId } : {}),
    },
    orderBy: { createdAt: 'asc' },
    take: limit,
  });
  return rows.map(toView);
}
