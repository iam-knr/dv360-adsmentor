// Seed steps that read the sandbox's metric history (saved reports, plan forecasts, A/B tests and lift studies, bulk job
// history). With the closed-form stub they run inside the seed transaction. When the engine simulates the last days
// (knobs.engineDays), they run after that history exists: provisionSandbox calls this once the fast-forward is done,
// or the engine runtime calls it when a chunked history job finishes (lib/engine/server.ts).
import type { Prisma, PrismaClient } from '@prisma/client';
import { seedBulk } from '../bulk/seed';
import { seedExperiments } from '../experiments/seed';
import { seedCrossMediaReports, seedPlans } from '../planning/seed';
import { seedReports } from '../reporting/seed';
import type { TemplateKey } from './knobs';

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
 * Finishes a sandbox whose history job is done: post-history seeds, then READY. Idempotent: only a sandbox that is
 * BACKFILLING is touched.
 */
export async function finishBackfill(
  db: PrismaClient,
  sandboxId: string,
  today: string,
): Promise<boolean> {
  const sandbox = await db.sandbox.findUnique({ where: { id: sandboxId } });
  if (!sandbox || sandbox.provisionState !== 'BACKFILLING') return false;
  await db.$transaction(
    async (tx) => {
      await seedPostHistory(tx, {
        sandboxId,
        template: sandbox.seedTemplateKey as TemplateKey,
        seedValue: sandbox.seedValue ?? 0,
        ownerUserId: sandbox.ownerUserId,
        today,
      });
    },
    { timeout: 120_000, maxWait: 30_000 },
  );
  await db.sandbox.update({
    where: { id: sandboxId },
    data: { provisionState: 'READY', provisionError: null },
  });
  return true;
}
