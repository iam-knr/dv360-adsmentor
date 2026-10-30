// Provisioning of one seeded sandbox: plan, history stub and insert in a single transaction (data-model 3.1 step 2).
import type { Prisma, PrismaClient, SandboxKind } from '@prisma/client';
import { seedAudiences } from '../audiences/seed';
import { fastForward } from '../engine/server';
import { seedAppCatalog, seedResources } from '../resources/seed';
import { seedYoutube, seedYoutubeVideos } from '../youtube/seed';
import { finishBackfill, seedPostHistory } from './after-history';
import { isoDate } from './dates';
import { buildHistory } from './history-stub';
import type { SeedKnobs, TemplateKey } from './knobs';
import { buildSandboxPlan } from './plan';
import { hashString, stableId } from './prng';
import { ensureReferenceData, referenceDataMissing } from './ensure';
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
  kind: SandboxKind;
  seedValue: number;
  /** Used for the partner name, "Sandbox {studentCode}" (data-model 3.3). */
  partnerName: string;
  today?: string;
  knobs?: Partial<SeedKnobs>;
  /** Rebuild even when the sandbox is READY at the current seed version. */
  force?: boolean;
  /** With knobs.engineDays > 0: epoch ms after which the history job stops and is continued by the runtime. */
  deadlineMs?: number;
}

export interface ProvisionResult {
  sandboxId: string;
  built: boolean;
  rows?: Record<string, number>;
  ms?: number;
  /** With engine days: DONE when the history is complete, PENDING when the runtime has to finish it. */
  backfill?: 'DONE' | 'PENDING';
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
          // only a rebuild of a built sandbox is a reset; the first build, a retry and a stale claim are not
          ...(existing.provisionState === 'READY'
            ? { resetCount: { increment: 1 }, lastResetAt: new Date() }
            : {}),
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
    // Self-heal: a database that never got the global reference data (production before bootstrap ran it).
    if (await referenceDataMissing(db)) await ensureReferenceData(db);
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
        // Reports, plans, bulk history and experiments read the metric history. With engine days they wait for it.
        if (plan.meta.knobs.engineDays === 0)
          await seedPostHistory(tx, {
            sandboxId: sandbox.id,
            template: input.template,
            seedValue: input.seedValue,
            ownerUserId: input.ownerUserId,
            today: input.today ?? simToday(),
          });
        return inserted;
      },
      { timeout: 300_000, maxWait: 30_000 },
    );
    const engineDays = plan.meta.knobs.engineDays;
    if (engineDays === 0) {
      await db.sandbox.update({
        where: { id: sandbox.id },
        data: { provisionState: 'READY', provisionError: null },
      });
      return { sandboxId: sandbox.id, built: true, rows: result.rows, ms: Date.now() - started };
    }
    // The engine simulates the last days in history mode (docs/gaps/eng-ff.md). The job is chunked: when the budget
    // ends first, the job stays RUNNING, the sandbox stays BACKFILLING and the runtime finishes both (advanceJobs).
    const today = input.today ?? simToday();
    await db.sandbox.update({
      where: { id: sandbox.id },
      data: { provisionState: 'BACKFILLING', provisionError: null },
    });
    const job = await fastForward(sandbox.id, engineDays * 24, {
      history: {
        hourlyDays: plan.meta.knobs.hourlyDays,
        sliceDays: plan.meta.knobs.sliceDays,
        today,
      },
      ...(input.deadlineMs !== undefined ? { deadline: input.deadlineMs } : {}),
    });
    if (job.status === 'DONE') await finishBackfill(db, sandbox.id, today);
    return {
      sandboxId: sandbox.id,
      built: true,
      rows: result.rows,
      ms: Date.now() - started,
      backfill: job.status === 'DONE' ? 'DONE' : 'PENDING',
    };
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
