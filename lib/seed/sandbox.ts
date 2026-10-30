// Provisioning of one seeded sandbox: plan, history stub and insert in a single transaction (data-model 3.1 step 2).
import type { Prisma, PrismaClient } from '@prisma/client';
import { seedAudiences } from '../audiences/seed';
import { seedExperiments } from '../experiments/seed';
import { seedPlans } from '../planning/seed';
import { seedAppCatalog, seedResources } from '../resources/seed';
import { seedReports } from '../reporting/seed';
import { seedYoutube, seedYoutubeVideos } from '../youtube/seed';
import { isoDate } from './dates';
import { buildHistory } from './history-stub';
import type { SeedKnobs, TemplateKey } from './knobs';
import { buildSandboxPlan } from './plan';
import { hashString, stableId } from './prng';
import { seedReferenceData } from './reference-db';
import type { SandboxPlan } from './types';
import { clearSandboxData, insertPlan } from './write';

/** Bump when the generator changes what it writes; a sandbox with an older seedVersion is rebuilt by the next seed run. */
export const SEED_VERSION = 1;

/** Sim "today": the UTC calendar date of the real clock (the sandbox clock starts there). */
export function simToday(now: Date = new Date()): string {
  return isoDate(now);
}

export function partnerIdOf(sandboxId: string): string {
  return stableId(sandboxId, 'partner');
}

/** Seed value from a stable label (student code, fixture name): the same label always builds the same world. */
export function seedValueFor(label: string): number {
  return hashString(`seed-value:${label}`) % 2_000_000_000;
}

export interface ProvisionInput {
  classroomId: string;
  ownerUserId: string | null;
  name: string;
  template: TemplateKey;
  kind: 'STUDENT' | 'DEMO' | 'TEMPLATE';
  seedValue: number;
  /** Used for the partner name, "Sandbox {studentCode}" (data-model 3.3). */
  partnerName: string;
  today?: string;
  knobs?: Partial<SeedKnobs>;
  /** Rebuild even when the sandbox is READY at the current seed version. */
  force?: boolean;
}

export interface ProvisionResult {
  sandboxId: string;
  built: boolean;
  rows?: Record<string, number>;
  ms?: number;
}

type Db = PrismaClient;

/** Creates the Sandbox row if needed and (re)builds its data. Idempotent: a READY sandbox at the current version is left alone. */
export async function provisionSandbox(db: Db, input: ProvisionInput): Promise<ProvisionResult> {
  const existing = await db.sandbox.findFirst({
    where: input.ownerUserId
      ? { classroomId: input.classroomId, ownerUserId: input.ownerUserId }
      : { classroomId: input.classroomId, ownerUserId: null, name: input.name },
  });
  if (
    existing &&
    !input.force &&
    existing.provisionState === 'READY' &&
    existing.seedVersion === SEED_VERSION &&
    existing.seedTemplateKey === input.template &&
    existing.seedValue === input.seedValue
  ) {
    return { sandboxId: existing.id, built: false };
  }
  const started = Date.now();
  const sandbox = existing
    ? await db.sandbox.update({
        where: { id: existing.id },
        data: {
          provisionState: 'SEEDING',
          provisionError: null,
          seedTemplateKey: input.template,
          seedValue: input.seedValue,
          seedVersion: SEED_VERSION,
          resetCount: { increment: 1 },
          lastResetAt: new Date(),
        },
      })
    : await db.sandbox.create({
        data: {
          classroomId: input.classroomId,
          ownerUserId: input.ownerUserId,
          name: input.name,
          kind: input.kind,
          status: 'ACTIVE',
          seedTemplateKey: input.template,
          seedValue: input.seedValue,
          seedVersion: SEED_VERSION,
          provisionState: 'SEEDING',
        },
      });
  try {
    const plan = buildSandboxPlan({
      template: input.template,
      seedValue: input.seedValue,
      sandboxId: sandbox.id,
      classroomId: input.classroomId,
      today: input.today ?? simToday(),
      partnerName: input.partnerName,
      knobs: input.knobs,
    });
    const history = buildHistory(plan);
    const result = await db.$transaction(
      async (tx: Prisma.TransactionClient) => {
        await clearSandboxData(tx, sandbox.id);
        const inserted = await insertPlan(tx, plan, history);
        // Module 15 resources (P4-04): Floodlight group, channels, lists, custom bidding rows, YouTube assets.
        await seedAppCatalog(tx);
        await seedResources(tx, {
          sandboxId: sandbox.id,
          template: input.template,
          seedValue: input.seedValue,
        });
        // Module 14 (P4-03): tag rules, uploads, combined and partner lists on top of the plan's audiences.
        await seedAudiences(tx, {
          sandboxId: sandbox.id,
          template: input.template,
          seedValue: input.seedValue,
        });
        // Module 09 (P4-06): the synthetic video catalogue and YouTube line items, ad groups and ads.
        await seedYoutubeVideos(tx);
        await seedYoutube(tx, {
          sandboxId: sandbox.id,
          template: input.template,
          seedValue: input.seedValue,
        });
        // Module 16 reports (P4-07): saved instant reports with runs, one scheduled offline report.
        const partner = await tx.partner.findFirst({
          where: { sandboxId: sandbox.id },
          select: { id: true, publicId: true },
        });
        if (partner)
          await seedReports(tx, {
            sandboxId: sandbox.id,
            partnerId: partner.id,
            partnerPublicId: partner.publicId.toString(),
            ownerUserId: input.ownerUserId,
            template: input.template,
            today: input.today ?? simToday(),
          });
        // Module 04 (P4-08): twelve plans per advertiser with forecast snapshots.
        await seedPlans(tx, {
          sandboxId: sandbox.id,
          template: input.template,
          seedValue: input.seedValue,
          today: input.today ?? simToday(),
        });
        // Module 17 (P4-10b): two A/B tests and three lift studies per advertiser, built on the history above.
        await seedExperiments(tx, {
          sandboxId: sandbox.id,
          template: input.template,
          seedValue: input.seedValue,
          today: input.today ?? simToday(),
        });
        return inserted;
      },
      { timeout: 300_000, maxWait: 30_000 },
    );
    await db.sandbox.update({
      where: { id: sandbox.id },
      data: { provisionState: 'READY', provisionError: null },
    });
    return { sandboxId: sandbox.id, built: true, rows: result.rows, ms: Date.now() - started };
  } catch (err) {
    await db.sandbox.update({
      where: { id: sandbox.id },
      data: {
        provisionState: 'FAILED',
        provisionError: err instanceof Error ? err.message.slice(0, 500) : 'seed failed',
      },
    });
    throw err;
  }
}

export { buildSandboxPlan, buildHistory, seedReferenceData };
export type { SandboxPlan };
