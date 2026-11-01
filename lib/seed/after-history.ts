// Seed steps that read the sandbox's metric history (saved reports, plan forecasts, A/B tests and lift studies, bulk job
// history). With the closed-form stub they run inside the seed transaction. When the engine simulates the last days
// (knobs.engineDays), they run after that history exists: provisionSandbox calls this once the fast-forward is done,
// or the engine runtime calls it when a chunked history job finishes (lib/engine/server.ts).
import type { Prisma, PrismaClient } from '@prisma/client';
import { startSandboxClock } from '../sandbox/clock-run';
import { seedBulk } from '../bulk/seed';
import { seedExperiments } from '../experiments/seed';
import { seedCrossMediaReports, seedPlans } from '../planning/seed';
import { seedReports } from '../reporting/seed';
import type { TemplateKey } from './knobs';
import { stableId } from './prng';

export interface PostHistoryInput {
  sandboxId: string;
  template: TemplateKey;
  seedValue: number;
  ownerUserId: string | null;
  today: string;
}

export async function seedPostHistory(
  tx: Prisma.TransactionClient,
  input: PostHistoryInput,
): Promise<void> {
  const { sandboxId, template, seedValue, today } = input;
  // Module 16 reports (P4-07): saved instant reports with runs, one scheduled offline report.
  const partner = await tx.partner.findFirst({
    where: { sandboxId },
    select: { id: true, publicId: true },
  });
  if (partner)
    await seedReports(tx, {
      sandboxId,
      partnerId: partner.id,
      partnerPublicId: partner.publicId.toString(),
      ownerUserId: input.ownerUserId,
      template,
      today,
    });
  // Module 04 (P4-08): plans per advertiser in every status with forecast snapshots, plus Cross-media reach reports.
  await seedPlans(tx, { sandboxId, template, seedValue, today });
  // Cross-media reach reports with results, built on the same history (gap p4-08 #4 stays: no per-IO reach snapshot).
  await seedCrossMediaReports(tx, { sandboxId, ownerUserId: input.ownerUserId, seedValue, today });
  // Module 11 (P4-10a): bulk job history, saved column views and chart views.
  await seedBulk(tx, { sandboxId, ownerUserId: input.ownerUserId, now: new Date() });
  // Module 17 (P4-10b): two A/B tests and three lift studies per advertiser, built on the history above.
  await seedExperiments(tx, { sandboxId, template, seedValue, today });
}

/**
 * Finishes a sandbox whose history job is done: post-history seeds, then READY. Idempotent and safe to call from several
 * places at once (the job runner that ends the job, a provisioning step that finds the job DONE, the timer): the whole
 * finish is ONE transaction that first locks the Sandbox row and checks it is still BACKFILLING, so the second caller
 * waits, sees READY and does nothing. Before this the post-history seeds ran once per caller and the sandbox ended with
 * two or three copies of every report, plan and experiment (docs/gaps/prov-race2.md).
 */
export async function finishBackfill(
  db: PrismaClient,
  sandboxId: string,
  today: string,
): Promise<boolean> {
  const finished = await db.$transaction(
    async (tx) => {
      const rows = await tx.$queryRaw<{ provisionState: string }[]>`
        SELECT "provisionState"::text AS "provisionState" FROM "Sandbox" WHERE "id" = ${sandboxId} FOR NO KEY UPDATE`;
      if (rows[0]?.provisionState !== 'BACKFILLING') return false;
      const sandbox = await tx.sandbox.findUniqueOrThrow({ where: { id: sandboxId } });
      await seedPostHistory(tx, {
        sandboxId,
        template: sandbox.seedTemplateKey as TemplateKey,
        seedValue: sandbox.seedValue ?? 0,
        ownerUserId: sandbox.ownerUserId,
        today,
      });
      // the student's access goes in with READY, never after it (a student sent to the home page by READY needs it)
      if (sandbox.ownerUserId) {
        const partnerId = stableId(sandboxId, 'partner');
        if (await tx.partner.findUnique({ where: { id: partnerId }, select: { id: true } }))
          await tx.userAccessGrant.createMany({
            data: [{ userId: sandbox.ownerUserId, sandboxId, partnerId, role: 'STANDARD' }],
            skipDuplicates: true,
          });
      }
      await tx.sandbox.update({
        where: { id: sandboxId },
        data: { provisionState: 'READY', provisionError: null },
      });
      return true;
    },
    { timeout: 120_000, maxWait: 30_000 },
  );
  if (!finished) return false;
  // The history is built; from here the sandbox runs (docs/gaps/sim-clock-runs.md). Accounting point = now: no debt.
  await startSandboxClock(db, sandboxId).catch(() => undefined);
  return true;
}
