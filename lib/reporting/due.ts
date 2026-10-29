// Scheduled reports on the sim clock (module 16 4.5, engine hook Δ16-11). Called at the end of a tick batch, inside
// its transaction, with the sim clock after the batch. Idempotent per (report, occurrence): the unique key on
// `ReportRun` and the lookup below mean a replayed batch creates nothing twice.
import type { Prisma } from '@prisma/client';
import type { Tx } from '@/lib/db';
import { executeRun } from './run';
import { MAX_CATCH_UP, nextOccurrence, occurrences } from './schedule';
import type { ReportDefinition, ReportDelivery, ReportSchedule } from './types';

const MS_DAY = 86_400_000;

async function notify(
  tx: Tx,
  sandboxId: string,
  userIds: string[],
  kind: 'REPORT_READY' | 'REPORT_FAILED',
  name: string,
  runId: string,
  simNow: Date,
  detail: string,
): Promise<void> {
  if (userIds.length === 0) return;
  await tx.inboxMessage.createMany({
    data: userIds.map((userId) => ({
      sandboxId,
      userId,
      kind,
      title: kind === 'REPORT_READY' ? `Report ready: ${name}` : `Report failed: ${name}`,
      body: detail,
      reportRunId: runId,
      createdAtSim: simNow,
    })),
  });
}

export async function runDueReports(
  tx: Tx,
  sandboxId: string,
  simNow: Date,
): Promise<{ runs: number }> {
  const due = await tx.report.findMany({
    where: { sandboxId, nextRunSimAt: { lte: simNow, not: null } },
    include: { shares: true },
    orderBy: { id: 'asc' },
  });
  let runs = 0;
  for (const r of due) {
    const schedule = r.schedule as unknown as ReportSchedule | null;
    if (!schedule?.active || !r.nextRunSimAt) continue;
    const delivery = (r.delivery as unknown as ReportDelivery | null) ?? undefined;
    const def = r.definition as unknown as ReportDefinition;
    const from = r.lastScheduledRunSimAt ?? new Date(r.nextRunSimAt.getTime() - 1);
    const all = occurrences(schedule, from, simNow);
    const skipped = Math.max(0, all.length - MAX_CATCH_UP);
    const todo = all.slice(skipped);
    await tx.$executeRawUnsafe('SAVEPOINT report_due');
    try {
      let last = r.lastScheduledRunSimAt;
      let made = 0;
      for (const at of todo) {
        const exists = await tx.reportRun.findFirst({
          where: { reportId: r.id, occurrenceSimAt: at },
          select: { id: true },
        });
        if (exists) {
          last = at;
          continue;
        }
        const out = await executeRun(tx, {
          sandboxId,
          partnerId: r.partnerId,
          reportId: r.id,
          reportName: r.name,
          def: { ...def, name: r.name },
          createdById: r.ownerUserId,
          allowPartnerCost: true,
          simNow: at,
          clockNow: simNow,
          scheduled: true,
          occurrenceSimAt: at,
          format: delivery?.format ?? 'CSV',
          ...(delivery?.fileName ? { fileStem: delivery.fileName } : {}),
        });
        made++;
        last = at;
        if (delivery?.emailOwner) {
          const who = [r.ownerUserId, ...r.shares.map((s) => s.userId)];
          await notify(
            tx,
            sandboxId,
            who,
            out.status === 'DONE' ? 'REPORT_READY' : 'REPORT_FAILED',
            r.name,
            out.runId,
            simNow,
            out.status === 'DONE'
              ? delivery.attachment === false
                ? 'Your scheduled report is ready. Open the file list to download it.'
                : 'Your scheduled report is ready. The file is attached.'
              : (out.error ?? 'The scheduled run failed.'),
          );
        }
      }
      const next = nextOccurrence(schedule, new Date(Math.max(simNow.getTime(), from.getTime())));
      await tx.report.update({
        where: { id: r.id },
        data: {
          lastScheduledRunSimAt: last,
          lastRunAt: new Date(),
          scheduleRunCount: { increment: made },
          scheduleSkipped: { increment: skipped },
          nextRunSimAt: next,
        } satisfies Prisma.ReportUpdateInput,
      });
      await tx.$executeRawUnsafe('RELEASE SAVEPOINT report_due');
      runs += made;
    } catch (e) {
      await tx.$executeRawUnsafe('ROLLBACK TO SAVEPOINT report_due');
      console.error('scheduled report failed', r.id, e);
      // do not retry every tick: park the schedule one day ahead
      await tx.report.update({
        where: { id: r.id },
        data: { nextRunSimAt: new Date(simNow.getTime() + MS_DAY) },
      });
    }
  }
  return { runs };
}
