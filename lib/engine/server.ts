// Engine runtime API (engine.md 1.6): lazy catch-up, the cron entry point, fast-forward, reset and the clock controls.
// Everything here runs through withBypass (role app_engine). It is the only module that app/api/** imports from the
// engine besides the types in lib/engine/index.ts.
import { prisma, withBypass, type Tx } from '@/lib/db';
import { finishBackfill } from '@/lib/seed/after-history';
import { MAX_DUE_TICKS, SPEED_PRESETS, speedAllowed } from './clock/clock';
import {
  createHistoryJobOnce,
  createJob,
  getJob,
  openJobs,
  setJob,
  type FastForwardParams,
  type HistoryParams,
  type JobProgress,
  type JobView,
} from './io/jobs';
import { countDueSandboxes, listDueSandboxes, logFailure } from './io/locks';
import { BATCH_TICKS, runBatch, type BatchResult } from './io/runBatch';
import { trimHourly } from './io/retention';
import { isTransientError, withTransientRetry } from './io/transient';
import { nowMs } from './io/time';
import { MS_HOUR } from './calendar';

export type { JobView, FastForwardParams, HistoryParams } from './io/jobs';
export { SPEED_PRESETS } from './clock/clock';

const TX = { timeout: 55_000, maxWait: 10_000 };
/** Ticks a sandbox may run in one cron call (engine.md 1.4, maxCatchUpTicks). */
export const MAX_TICKS_PER_CALL = MAX_DUE_TICKS;
export const DEFAULT_BUDGET_MS = 45_000;
export const MAX_SANDBOXES_PER_CALL = 25;
const CONCURRENCY = 4;
/** Consecutive failures after which a sandbox is locked (engine.md 1.4). */
const MAX_FAILURES = 3;

export interface RunDueResult {
  /** Sandboxes that ran at least one tick. */
  processed: number;
  ticks: number;
  /** Sandboxes that failed in this call. */
  failed: number;
  /** Sandboxes skipped because another run held their lock. */
  busy: number;
  /** Sandboxes that still owe ticks after this call. */
  stillDue: number;
  /** Fast-forward jobs advanced. */
  jobs: number;
}

/** Longest debt a running clock keeps: 7 simulated days. Time beyond it, while nobody used the sandbox, is not owed. */
export const MAX_OWED_TICKS = 7 * 24;

/**
 * An abandoned sandbox must not come back owing months of ticks (load protection, docs/gaps/sim-clock-runs.md): debt
 * above `MAX_OWED_TICKS` is forgiven by moving the accounting point forward, like paused time. What remains is caught up
 * in chunks of at most `MAX_TICKS_PER_CALL` per call.
 */
export async function forgiveStaleDebt(sandboxId: string, now: number): Promise<boolean> {
  const n = await withBypass(
    (tx) =>
      tx.$executeRaw`
        UPDATE "SimClock"
        SET "lastAdvanceRealAt" = ${new Date(now)}::timestamp
              - ("minutesPerSimDay" * 2.5 * ${MAX_OWED_TICKS}) * interval '1 second',
            "remainderMs" = 0
        WHERE "sandboxId" = ${sandboxId} AND "state" = 'RUNNING' AND "lastAdvanceRealAt" IS NOT NULL
          AND (EXTRACT(EPOCH FROM (${new Date(now)}::timestamp - "lastAdvanceRealAt")) * 1000 + "remainderMs")
              > "minutesPerSimDay" * 2500 * ${MAX_OWED_TICKS}`,
    TX,
  );
  return n > 0;
}

async function runSandboxDue(
  sandboxId: string,
  now: number,
  maxTicks: number,
  deadline: number,
): Promise<{ ticks: number; busy: boolean }> {
  let ticks = 0;
  await forgiveStaleDebt(sandboxId, now).catch(() => false);
  while (ticks < maxTicks && nowMs() < deadline) {
    const r: BatchResult = await withBypass(
      (tx) =>
        runBatch(
          tx,
          sandboxId,
          { kind: 'due', nowMs: now, max: Math.min(BATCH_TICKS, maxTicks - ticks) },
          { outOfTime: () => nowMs() >= deadline },
        ),
      TX,
    );
    if (!r.locked) return { ticks, busy: ticks === 0 };
    ticks += r.ticks;
    if (r.ticks === 0) break;
  }
  return { ticks, busy: false };
}

async function recordFailure(sandboxId: string, error: unknown): Promise<void> {
  await withBypass(async (tx) => {
    const failures = await logFailure(tx, sandboxId, error, nowMs());
    if (failures >= MAX_FAILURES) {
      await tx.simClock.update({ where: { sandboxId }, data: { state: 'LOCKED' } });
    }
  });
}

/**
 * Cron entry point. Advances the sandboxes that owe ticks, most overdue first, at most `maxSandboxes` per call,
 * stopping when `deadline` (epoch ms) is reached. Whatever is left is reported in `stillDue` for the next call.
 */
export async function runDueTicks(
  deadline: number,
  opts: {
    now?: number;
    maxSandboxes?: number;
    concurrency?: number;
    /** Only sandboxes whose owner was seen within this many ms (load protection); undefined = every sandbox. */
    activeWithinMs?: number;
  } = {},
): Promise<RunDueResult> {
  const now = opts.now ?? nowMs();
  const ids = await withBypass(
    (tx) =>
      listDueSandboxes(tx, now, opts.maxSandboxes ?? MAX_SANDBOXES_PER_CALL, opts.activeWithinMs),
    TX,
  );
  const result: RunDueResult = { processed: 0, ticks: 0, failed: 0, busy: 0, stillDue: 0, jobs: 0 };
  const queue = [...ids];
  const worker = async () => {
    for (;;) {
      const id = queue.shift();
      if (!id || nowMs() >= deadline) return;
      try {
        const r = await runSandboxDue(id, now, MAX_TICKS_PER_CALL, deadline);
        if (r.busy) result.busy++;
        if (r.ticks > 0) {
          result.processed++;
          result.ticks += r.ticks;
        }
      } catch (err) {
        result.failed++;
        await recordFailure(id, err).catch(() => undefined);
      }
    }
  };
  await Promise.all(Array.from({ length: opts.concurrency ?? CONCURRENCY }, worker));
  // queued fast-forwards continue with the time that is left
  if (nowMs() < deadline) result.jobs = await advanceJobs(deadline);
  result.stillDue = await withBypass((tx) => countDueSandboxes(tx, now, opts.activeWithinMs), TX);
  return result;
}

/**
 * Lazy freshness (engine.md 1.4): a page load runs the ticks that are owed, a few at a time, and never waits longer
 * than `budgetMs`. A sandbox that another run holds is left alone.
 */
export async function ensureCaughtUp(
  sandboxId: string,
  opts: { maxTicks?: number; budgetMs?: number; now?: number } = {},
): Promise<{ ticks: number }> {
  const start = nowMs();
  const r = await runSandboxDue(
    sandboxId,
    opts.now ?? start,
    opts.maxTicks ?? 6,
    start + (opts.budgetMs ?? 800),
  );
  return { ticks: r.ticks };
}

// ---- fast-forward ---------------------------------------------------------------------------------------------------

/** Runs a job; an error ends it as FAILED (a history job also fails its sandbox) so the next call does not retry forever. */
async function runJob(job: JobView, deadline: number): Promise<JobView> {
  try {
    return await runJobChunks(job, deadline);
  } catch (err) {
    // transient (see io/transient.ts): the job stays open, the next call continues it; the caller decides when to give up
    if (isTransientError(err)) throw err;
    const message = (err instanceof Error ? err.message : String(err)).slice(0, 300);
    const params = job.params as FastForwardParams;
    await withBypass(async (tx) => {
      await setJob(tx, job.id, { status: 'FAILED', error: message }, new Date(nowMs()));
      if (params.history)
        await tx.sandbox.updateMany({
          where: { id: job.sandboxId, provisionState: 'BACKFILLING' },
          data: { provisionState: 'FAILED', provisionError: message },
        });
    }).catch(() => undefined);
    throw err;
  }
}

/** What one locked batch of a job did (see `runJobChunks`). */
type JobStep =
  | { kind: 'busy' } // another runner holds the job or the clock
  | { kind: 'closed' } // the job is no longer open (DONE by someone else, FAILED, CANCELLED)
  | { kind: 'ran'; progress: JobProgress; ticks: number; finished: boolean };

async function runJobChunks(job: JobView, deadline: number): Promise<JobView> {
  const params = job.params as FastForwardParams;
  const startedAt = nowMs();
  const sandbox = await withBypass(
    (tx) => tx.sandbox.findUnique({ where: { id: job.sandboxId }, select: { status: true } }),
    TX,
  );
  // A class window closing freezes a sandbox, but its history is not student activity: that job goes on.
  const runnable = sandbox?.status === 'ACTIVE' || (params.history && sandbox?.status === 'FROZEN');
  if (!sandbox || !runnable) {
    await withBypass((tx) =>
      tx.simJob.updateMany({
        where: { id: job.id, status: { in: ['QUEUED', 'RUNNING'] } },
        data: { status: 'FAILED', error: 'Sandbox is not active', finishedAt: new Date(startedAt) },
      }),
    );
    return (await withBypass((tx) => getJob(tx, job.id), TX)) as JobView;
  }
  let finished = false;
  // Several callers may drive one job (the timer, the welcome page, the account page, a page load). Each batch is one
  // transaction that first locks the JOB row, then reads the progress that is stored NOW (not the copy this caller was
  // handed, which may be old) and writes the new progress in the same transaction. So two callers never run the same
  // ticks twice, never run past `simHours` and never move a finished job back to RUNNING (docs/gaps/prov-race2.md).
  for (;;) {
    if (nowMs() >= deadline) break;
    const step: JobStep = await withTransientRetry(() =>
      withBypass(async (tx): Promise<JobStep> => {
        const rows = await tx.$queryRaw<{ status: JobView['status']; progress: unknown }[]>`
        SELECT "status", "progress" FROM "SimJob" WHERE "id" = ${job.id} FOR UPDATE SKIP LOCKED`;
        const row = rows[0];
        if (!row) return { kind: 'busy' };
        if (row.status !== 'QUEUED' && row.status !== 'RUNNING') return { kind: 'closed' };
        const progress: JobProgress = (row.progress as JobProgress | null) ?? {
          doneTicks: 0,
          totalTicks: params.simHours,
          simDate: '',
        };
        if (row.status === 'QUEUED')
          await setJob(tx, job.id, { status: 'RUNNING' }, new Date(nowMs()));
        if (progress.doneTicks >= params.simHours) {
          await setJob(tx, job.id, { status: 'DONE', progress }, new Date(nowMs()));
          return { kind: 'ran', progress, ticks: 0, finished: true };
        }
        const count = Math.min(BATCH_TICKS, params.simHours - progress.doneTicks);
        const history = params.history
          ? await historyWindow(tx, job.sandboxId, params, progress)
          : undefined;
        const r: BatchResult = await runBatch(
          tx,
          job.sandboxId,
          { kind: 'fixed', count },
          {
            ...(history ? { history } : {}),
            stopAfterTick: ({ simDate, raised }) => {
              if (params.untilAlert && raised.includes(params.untilAlert))
                return `alert:${params.untilAlert}`;
              if (params.untilDate && simDate >= params.untilDate)
                return `date:${params.untilDate}`;
              return undefined;
            },
          },
        );
        if (!r.locked) return { kind: 'busy' };
        const simDate = r.clock
          ? new Date(r.clock.simStartMs + (r.tickIndex - 1) * MS_HOUR).toISOString().slice(0, 10)
          : progress.simDate;
        const next: JobProgress = {
          ...progress,
          doneTicks: progress.doneTicks + r.ticks,
          simDate,
          ...(r.stoppedBy ? { stoppedBy: r.stoppedBy } : {}),
        };
        const done = r.stoppedBy !== undefined || next.doneTicks >= params.simHours;
        await setJob(
          tx,
          job.id,
          done ? { status: 'DONE', progress: next } : { progress: next },
          new Date(nowMs()),
        );
        return { kind: 'ran', progress: next, ticks: r.ticks, finished: done };
      }, TX),
    );
    // another run holds the job: try again on the next call
    if (step.kind === 'busy' || step.kind === 'closed') break;
    finished = step.finished;
    if (step.finished || step.ticks === 0) break;
  }
  if (finished) {
    // a sandbox waiting for its history is finished here when the job ran in several calls (idempotent, locked)
    if (params.history?.today) await finishBackfill(prisma, job.sandboxId, params.history.today);
  }
  return (await withBypass((tx) => getJob(tx, job.id), TX)) as JobView;
}

async function historyWindow(
  tx: Tx,
  sandboxId: string,
  params: FastForwardParams,
  progress: JobProgress,
): Promise<{ hourlyFromMs: number; sliceFromDay: string }> {
  const h = params.history as HistoryParams;
  const clock = await tx.simClock.findUniqueOrThrow({
    where: { sandboxId },
    select: { simStart: true, tickIndex: true },
  });
  const endMs =
    clock.simStart.getTime() +
    (Number(clock.tickIndex) + params.simHours - progress.doneTicks) * MS_HOUR;
  return {
    hourlyFromMs: endMs - h.hourlyDays * 24 * MS_HOUR,
    sliceFromDay: new Date(endMs - h.sliceDays * 24 * MS_HOUR).toISOString().slice(0, 10),
  };
}

/**
 * Fast-forward `simHours` ticks, 24 per chunk, writing progress after each chunk. Ignores clock speed and state. With
 * `untilAlert` or `untilDate` it stops early. When `deadline` passes first the job stays RUNNING and the next cron call
 * continues it (advanceJobs).
 */
export async function fastForward(
  sandboxId: string,
  simHours: number,
  opts: {
    untilAlert?: string;
    untilDate?: string;
    deadline?: number;
    history?: HistoryParams;
  } = {},
): Promise<JobView> {
  if (!Number.isInteger(simHours) || simHours < 1 || simHours > 24 * 120) {
    throw new Error('simHours must be a whole number between 1 and 2880');
  }
  const params: FastForwardParams = {
    simHours,
    ...(opts.untilAlert ? { untilAlert: opts.untilAlert } : {}),
    ...(opts.untilDate ? { untilDate: opts.untilDate } : {}),
    ...(opts.history ? { history: opts.history } : {}),
  };
  const job = await withBypass(
    (tx) =>
      params.history
        ? createHistoryJobOnce(tx, sandboxId, params)
        : createJob(tx, sandboxId, 'FAST_FORWARD', params),
    TX,
  );
  return runJob(job, opts.deadline ?? Number.MAX_SAFE_INTEGER);
}

/** Continues unfinished fast-forward jobs; returns how many were touched. */
export async function advanceJobs(deadline: number): Promise<number> {
  const jobs = await withBypass((tx) => openJobs(tx, 5), TX);
  let n = 0;
  for (const j of jobs) {
    if (nowMs() >= deadline) break;
    // a failed job is recorded by runJob; the others still get their turn
    await runJob(j, deadline).catch(() => undefined);
    n++;
  }
  return n;
}

/** Continues the unfinished fast-forward jobs of one sandbox (provisioning, welcome page). Errors are thrown. */
export async function advanceSandboxJobs(sandboxId: string, deadline: number): Promise<JobView[]> {
  const jobs = await withBypass((tx) => openJobs(tx, 5, sandboxId), TX);
  const out: JobView[] = [];
  for (const j of jobs) {
    if (nowMs() >= deadline) break;
    out.push(await runJob(j, deadline));
  }
  return out;
}

export async function getJobProgress(jobId: string): Promise<JobView | null> {
  return withBypass((tx) => getJob(tx, jobId), TX);
}

// ---- reset ----------------------------------------------------------------------------------------------------------

const SIM_TABLES = [
  'SimHourlyMetric',
  'SimDailyMetric',
  'DeliveryDiagnostic',
  'SimConversionDaily',
  'SimPacingSnapshot',
  'SimReachSnapshot',
  'SimState',
  'SimTickLog',
  'Alert',
] as const;
const DELETE_CHUNK = 50_000;

/**
 * Minimal reset (engine.md 10.2): lock the clock, delete the sandbox's simulation rows in chunks, set the tick index to
 * 0 and leave the clock PAUSED. Entities and seeds are kept; restoring the entity tree is the seed generator's job.
 */
export async function resetSandbox(sandboxId: string): Promise<JobView> {
  const job = await withBypass((tx) => createJob(tx, sandboxId, 'RESET', {}), TX);
  await withBypass((tx) => setJob(tx, job.id, { status: 'RUNNING' }, new Date(nowMs())));
  try {
    await withBypass(
      (tx) => tx.simClock.update({ where: { sandboxId }, data: { state: 'LOCKED' } }),
      TX,
    );
    for (const table of SIM_TABLES) {
      for (;;) {
        const n = await withBypass(
          (tx) =>
            tx.$executeRawUnsafe(
              `DELETE FROM "${table}" WHERE "id" IN (SELECT "id" FROM "${table}" WHERE "sandboxId" = $1 LIMIT ${DELETE_CHUNK})`,
              sandboxId,
            ),
          TX,
        );
        if (n < DELETE_CHUNK) break;
      }
    }
    await withBypass(async (tx) => {
      await tx.simClock.update({
        where: { sandboxId },
        data: {
          tickIndex: 0n,
          state: 'PAUSED',
          lastAdvanceRealAt: new Date(nowMs()),
          remainderMs: 0,
        },
      });
      await tx.sandbox.update({
        where: { id: sandboxId },
        data: { resetCount: { increment: 1 }, lastResetAt: new Date(nowMs()) },
      });
      await setJob(tx, job.id, { status: 'DONE' }, new Date(nowMs()));
    }, TX);
  } catch (err) {
    await withBypass((tx) =>
      setJob(tx, job.id, { status: 'FAILED', error: String(err).slice(0, 300) }, new Date(nowMs())),
    );
    throw err;
  }
  return (await withBypass((tx) => getJob(tx, job.id), TX)) as JobView;
}

// ---- clock controls -------------------------------------------------------------------------------------------------

export async function setSpeed(sandboxId: string, minutesPerSimDay: number): Promise<void> {
  if (
    !Number.isInteger(minutesPerSimDay) ||
    minutesPerSimDay < 1 ||
    !speedAllowed(minutesPerSimDay)
  ) {
    throw new Error(
      `Speed not allowed: ${minutesPerSimDay} minutes per sim day (presets: ${SPEED_PRESETS.join(', ')})`,
    );
  }
  await withBypass(
    (tx) => tx.simClock.update({ where: { sandboxId }, data: { minutesPerSimDay } }),
    TX,
  );
}

export async function pause(sandboxId: string): Promise<void> {
  await withBypass(
    (tx) => tx.simClock.update({ where: { sandboxId }, data: { state: 'PAUSED', remainderMs: 0 } }),
    TX,
  );
}

/** Paused time is not owed: the accounting point moves to now (engine.md 1.2). */
export async function resume(sandboxId: string, now: number = nowMs()): Promise<void> {
  await withBypass(
    (tx) =>
      tx.simClock.update({
        where: { sandboxId },
        data: { state: 'RUNNING', lastAdvanceRealAt: new Date(now), remainderMs: 0 },
      }),
    TX,
  );
}

/** Run exactly `n` ticks on a paused clock, then stay paused. */
export async function stepTicks(sandboxId: string, n: number): Promise<{ ticks: number }> {
  if (!Number.isInteger(n) || n < 1 || n > MAX_TICKS_PER_CALL) {
    throw new Error(`n must be a whole number between 1 and ${MAX_TICKS_PER_CALL}`);
  }
  return withBypass(async (tx) => {
    const clock = await tx.simClock.findUnique({ where: { sandboxId }, select: { state: true } });
    if (!clock) throw new Error('Sandbox has no clock');
    if (clock.state !== 'PAUSED' && clock.state !== 'STEPPING') {
      throw new Error(`Stepping needs a paused clock (state is ${clock.state})`);
    }
    const r = await runBatch(tx, sandboxId, { kind: 'fixed', count: n });
    if (!r.locked) throw new Error('Sandbox is busy; try again');
    await tx.simClock.update({ where: { sandboxId }, data: { state: 'PAUSED' } });
    return { ticks: r.ticks };
  }, TX);
}

// ---- retention ------------------------------------------------------------------------------------------------------

/** Nightly job: trims hourly rows older than 14 sim days in every sandbox. Returns rows deleted. */
export async function runRetention(): Promise<number> {
  const clocks = await withBypass(
    (tx) => tx.simClock.findMany({ select: { sandboxId: true, simStart: true, tickIndex: true } }),
    TX,
  );
  let total = 0;
  for (const c of clocks) {
    const simNow = c.simStart.getTime() + Number(c.tickIndex) * MS_HOUR;
    total += await withBypass((tx) => trimHourly(tx, c.sandboxId, simNow), TX);
  }
  return total;
}
