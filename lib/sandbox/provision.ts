import 'server-only';

// Sandbox provisioning job (module 18 4.4, M18-05; module 19 4.10). One Sandbox per student, built in steps that each
// fit a 45 second budget (Vercel Hobby allows 60 s):
//
//   enqueue  -> Sandbox row PENDING                              (a few ms, called when the account is created)
//   step 1   -> claim (PENDING -> SEEDING), seed the template, grant the student access, start the history job
//   step 2.. -> BACKFILLING: the engine's history mode runs the SimJob in 24 tick chunks until it is DONE,
//               then the seeds that read the history run and the sandbox is READY
//
// Whoever calls `runProvisionStep` drives it: the engine timer (`advanceProvisioning` from the tick route), the
// student's /sim/welcome page (POST /api/sim/provision), the Super admin's account page (POST
// /api/manage/accounts/:id/provision), "Create / Retry sandbox", and any page load (`maybeAdvance`,
// docs/gaps/prov-drive.md). The timer is not required.
// Every step is re-entrant: the claim is one conditional UPDATE, a crashed step is taken over after STALE_MS, a failed
// one stays FAILED with its message until someone retries. The history comes from `engineDays` of engine ticks
// (docs/gaps/eng-ff.md); the measured cost is about a minute of engine time per sandbox, so a build takes two steps.
import type { PrismaClient, Sandbox } from '@prisma/client';
import { after } from 'next/server';
import { findStudentsWithoutSandbox, getProvisionSource } from '@/lib/accounts/provisioning-source';
import { prisma } from '@/lib/db';
import { advanceSandboxJobs, fastForward } from '@/lib/engine/server';
import {
  isTemplateKey,
  partnerIdOf,
  provisionSandbox,
  seedValueFor,
  simToday,
  type TemplateKey,
} from '@/lib/seed';
import { finishBackfill } from '@/lib/seed/after-history';

type Db = PrismaClient;

export type ProvisionStateView = 'NOT_CREATED' | 'QUEUED' | 'BUILDING' | 'READY' | 'FAILED';

export interface ProvisionView {
  state: ProvisionStateView;
  sandboxId?: string;
  /** 0 to 100, for the progress bar on /sim/welcome. */
  percent: number;
  /** Short text for the bar. */
  message: string;
  /** Sim date the history has reached while BUILDING. */
  simDate?: string;
  error?: string;
}

/** Days before "today" that the engine simulates for a student sandbox (the rest of the 90 days would be the stub). */
export const DEFAULT_ENGINE_DAYS = 90;
/**
 * Days of daily slices (device, exchange, region, creative, ...) a student sandbox keeps from the history. Measured: 14
 * days is about 20 MB per sandbox, 3 days about 10 MB; 25 students on the 500 MB free tier need the small value
 * (RC-057, docs/gaps/eng-ff.md). Day totals and hourly rows (14 days) are kept in full.
 */
export const STUDENT_SLICE_DAYS = 3;
/** Time one step may take: the 60 s function limit minus the seed, the response and a safety margin. */
export const STEP_BUDGET_MS = 40_000;
/**
 * A SEEDING claim whose heartbeat is older than this is taken over (the function that made it was cut off). The step
 * touches the row every `HEARTBEAT_MS` while it works, so a live build is never this old, however long it takes, and a
 * dead one is retaken within a minute (it used to be 5 minutes, which left a student waiting).
 */
export const STALE_MS = 60_000;
export const HEARTBEAT_MS = 10_000;
/** "Create / Retry sandbox" restarts a build whose heartbeat is older than this, without waiting for `STALE_MS`. */
export const FORCE_RESTART_AFTER_MS = 20_000;
const FALLBACK_TEMPLATE: TemplateKey = 'starter-agency';

function engineDays(): number {
  const raw = Number(process.env.SANDBOX_ENGINE_DAYS);
  return Number.isInteger(raw) && raw >= 0 && raw <= 90 ? raw : DEFAULT_ENGINE_DAYS;
}

/**
 * Touches the claimed row so that `updatedAt` says "this build is alive". Runs until the returned function is called;
 * it only writes while the row is still SEEDING or BACKFILLING, so it never revives a FAILED or READY row.
 */
function startHeartbeat(db: Db, sandboxId: string): () => void {
  const timer = setInterval(() => {
    void db.sandbox
      .updateMany({
        where: { id: sandboxId, provisionState: { in: ['SEEDING', 'BACKFILLING'] } },
        data: { updatedAt: new Date() },
      })
      .catch(() => undefined);
  }, HEARTBEAT_MS);
  timer.unref?.();
  return () => clearInterval(timer);
}

const errorText = (err: unknown): string =>
  (err instanceof Error ? err.message : String(err)).slice(0, 500);

// ---- view ------------------------------------------------------------------------------------------------------

type Row = Pick<Sandbox, 'id' | 'provisionState' | 'provisionError'>;

async function viewOf(db: Db, row: Row | null): Promise<ProvisionView> {
  if (!row) return { state: 'NOT_CREATED', percent: 0, message: 'Not created' };
  switch (row.provisionState) {
    case 'READY':
      return { state: 'READY', sandboxId: row.id, percent: 100, message: 'Ready' };
    case 'FAILED':
      return {
        state: 'FAILED',
        sandboxId: row.id,
        percent: 0,
        message: 'Failed',
        ...(row.provisionError ? { error: row.provisionError } : {}),
      };
    case 'PENDING':
      return { state: 'QUEUED', sandboxId: row.id, percent: 0, message: 'Waiting to start' };
    case 'SEEDING':
      return {
        state: 'BUILDING',
        sandboxId: row.id,
        percent: 10,
        message: 'Creating your account',
      };
    default: {
      const job = await db.simJob.findFirst({
        where: { sandboxId: row.id, kind: 'FAST_FORWARD' },
        orderBy: { createdAt: 'desc' },
        select: { progress: true },
      });
      const p = job?.progress as {
        doneTicks?: number;
        totalTicks?: number;
        simDate?: string;
      } | null;
      const share = p?.totalTicks ? Math.min(1, (p.doneTicks ?? 0) / p.totalTicks) : 0;
      return {
        state: 'BUILDING',
        sandboxId: row.id,
        percent: Math.round(10 + share * 85),
        message: 'Loading your history',
        ...(p?.simDate ? { simDate: p.simDate } : {}),
      };
    }
  }
}

/** The student's own sandbox, found by owner so that moving a student to another cohort does not lose it. */
export async function getProvisionView(userId: string, db: Db = prisma): Promise<ProvisionView> {
  const row = await db.sandbox.findFirst({
    where: { ownerUserId: userId, kind: 'STUDENT', status: { not: 'ARCHIVED' } },
    orderBy: { createdAt: 'desc' },
    select: { id: true, provisionState: true, provisionError: true },
  });
  return viewOf(db, row);
}

// ---- enqueue ---------------------------------------------------------------------------------------------------

/** Runs `fn` after the response is sent when there is a request to hang on; otherwise it is dropped (scripts, tests). */
function afterResponse(fn: () => Promise<unknown>): void {
  try {
    after(() => fn().catch(() => undefined));
  } catch {
    // no request scope: the timer or the welcome page drives the job
  }
}

/**
 * Creates the Sandbox row for a student (idempotent: unique `(classroomId, ownerUserId)`) and returns at once. The build
 * itself runs in `runProvisionStep`; it is started after the response when there is one.
 */
export async function enqueueProvisionSandbox(
  cohortId: string,
  userId: string,
  db: Db = prisma,
): Promise<ProvisionView> {
  const existing = await db.sandbox.findFirst({
    where: { ownerUserId: userId, kind: 'STUDENT', status: { not: 'ARCHIVED' } },
    orderBy: { createdAt: 'desc' },
    select: { id: true, provisionState: true, provisionError: true },
  });
  if (existing) return viewOf(db, existing);
  const source = await getProvisionSource(db, cohortId, userId);
  // Admins and Super admins get no student sandbox (module 19 4.10)
  if (!source || source.appRole !== 'USER' || source.classroomArchived) {
    return { state: 'NOT_CREATED', percent: 0, message: 'Not created' };
  }
  const template = isTemplateKey(source.defaultSeedTemplate)
    ? source.defaultSeedTemplate
    : FALLBACK_TEMPLATE;
  const label = source.studentCode ?? userId.slice(-6);
  let row: Row;
  try {
    row = await db.sandbox.create({
      data: {
        classroomId: cohortId,
        ownerUserId: userId,
        name: `Sandbox ${label}`,
        kind: 'STUDENT',
        status: 'ACTIVE',
        seedTemplateKey: template,
        seedValue: seedValueFor(`${cohortId}:${userId}`),
        provisionState: 'PENDING',
      },
      select: { id: true, provisionState: true, provisionError: true },
    });
  } catch (err) {
    // a concurrent enqueue won the unique index: use its row
    const won = await db.sandbox.findFirst({
      where: { classroomId: cohortId, ownerUserId: userId },
      select: { id: true, provisionState: true, provisionError: true },
    });
    if (!won) throw err;
    return viewOf(db, won);
  }
  afterResponse(() => runProvisionStep(row.id, { db }));
  return viewOf(db, row);
}

// ---- steps -----------------------------------------------------------------------------------------------------

/** A student is STANDARD on their own partner (RC-047). */
async function ensureStudentGrant(db: Db, sandboxId: string, userId: string | null): Promise<void> {
  if (!userId) return;
  const partnerId = partnerIdOf(sandboxId);
  const partner = await db.partner.findUnique({ where: { id: partnerId }, select: { id: true } });
  if (!partner) return;
  const grant = await db.userAccessGrant.findFirst({
    where: { userId, sandboxId, partnerId, advertiserId: null },
    select: { id: true },
  });
  if (!grant)
    await db.userAccessGrant.create({ data: { userId, sandboxId, partnerId, role: 'STANDARD' } });
}

/** A BACKFILLING sandbox whose history job is gone (the function died between the two writes) gets a new one. */
async function resumeBackfill(db: Db, sb: Sandbox): Promise<void> {
  const clock = await db.simClock.findUnique({ where: { sandboxId: sb.id } });
  if (!clock) throw new Error('Sandbox has no clock');
  const done = await db.simJob.count({
    where: { sandboxId: sb.id, kind: 'FAST_FORWARD', status: 'DONE' },
  });
  const target = 90 * 24;
  const remaining = target - Number(clock.tickIndex);
  if (done > 0 || remaining <= 0) {
    await finishBackfill(db, sb.id, simToday());
    return;
  }
  await fastForward(sb.id, remaining, {
    history: { hourlyDays: 14, sliceDays: 14, today: simToday() },
    deadline: Date.now() + STEP_BUDGET_MS,
  });
}

export interface StepOptions {
  /** Time this step may take, ms. */
  budgetMs?: number;
  db?: Db;
}

/**
 * Moves one sandbox forward within the budget and reports where it is. Safe to call from several places at once: the
 * claim is atomic and the history job is locked through the sandbox's clock row. Never throws for a build error; that
 * ends as FAILED with the message.
 */
export async function runProvisionStep(
  sandboxId: string,
  opts: StepOptions = {},
): Promise<ProvisionView> {
  const db = opts.db ?? prisma;
  const deadline = Date.now() + (opts.budgetMs ?? STEP_BUDGET_MS);
  const load = () => db.sandbox.findUnique({ where: { id: sandboxId } });
  let sb = await load();
  if (!sb) return viewOf(db, null);

  if (sb.provisionState === 'PENDING' || sb.provisionState === 'SEEDING') {
    const claimed = await db.sandbox.updateMany({
      where: {
        id: sandboxId,
        OR: [
          { provisionState: 'PENDING' },
          { provisionState: 'SEEDING', updatedAt: { lt: new Date(Date.now() - STALE_MS) } },
        ],
      },
      data: { provisionState: 'SEEDING', provisionError: null },
    });
    if (claimed.count === 1) {
      const stopBeat = startHeartbeat(db, sandboxId);
      try {
        await provisionSandbox(db, {
          classroomId: sb.classroomId,
          ownerUserId: sb.ownerUserId,
          name: sb.name,
          template: isTemplateKey(sb.seedTemplateKey) ? sb.seedTemplateKey : FALLBACK_TEMPLATE,
          kind: sb.kind,
          seedValue: sb.seedValue,
          partnerName: sb.name,
          knobs: { engineDays: engineDays(), sliceDays: STUDENT_SLICE_DAYS },
          deadlineMs: deadline,
          force: true,
        });
        await ensureStudentGrant(db, sandboxId, sb.ownerUserId);
      } catch (err) {
        // provisionSandbox sets FAILED itself when its own work fails; this covers an error before it got that far
        await db.sandbox.updateMany({
          where: { id: sandboxId, provisionState: 'SEEDING' },
          data: { provisionState: 'FAILED', provisionError: errorText(err) },
        });
      } finally {
        stopBeat();
      }
    }
    sb = await load();
    if (!sb) return viewOf(db, null);
  }

  if (sb.provisionState === 'BACKFILLING' && Date.now() < deadline) {
    const stopBeat = startHeartbeat(db, sandboxId);
    try {
      await ensureStudentGrant(db, sandboxId, sb.ownerUserId);
      const jobs = await advanceSandboxJobs(sandboxId, deadline);
      if (jobs.length === 0) await resumeBackfill(db, sb);
    } catch (err) {
      await db.sandbox.updateMany({
        where: { id: sandboxId, provisionState: { in: ['BACKFILLING', 'SEEDING'] } },
        data: {
          provisionState: 'FAILED',
          provisionError: errorText(err),
        },
      });
    } finally {
      stopBeat();
    }
    sb = await load();
  }
  return viewOf(db, sb);
}

/**
 * "Create / Retry sandbox": makes sure the student's sandbox is being built and runs a step. A missing row is created, a
 * FAILED one restarts, and a build that stopped (SEEDING with no heartbeat for `FORCE_RESTART_AFTER_MS`, or a
 * BACKFILLING one, which the step simply continues) is taken over at once. A READY sandbox is left alone, and so is
 * a build that is alive.
 */
export async function retryProvisionSandbox(
  cohortId: string,
  userId: string,
  opts: StepOptions = {},
): Promise<ProvisionView> {
  const db = opts.db ?? prisma;
  const row = await db.sandbox.findFirst({
    where: { ownerUserId: userId, kind: 'STUDENT', status: { not: 'ARCHIVED' } },
    orderBy: { createdAt: 'desc' },
    select: { id: true, provisionState: true, provisionError: true },
  });
  if (!row) {
    const created = await enqueueProvisionSandbox(cohortId, userId, db);
    return created.sandboxId ? runProvisionStep(created.sandboxId, opts) : created;
  }
  if (row.provisionState === 'FAILED') {
    await db.sandbox.updateMany({
      where: { id: row.id, provisionState: 'FAILED' },
      data: { provisionState: 'PENDING', provisionError: null },
    });
  } else if (row.provisionState === 'SEEDING') {
    await db.sandbox.updateMany({
      where: {
        id: row.id,
        provisionState: 'SEEDING',
        updatedAt: { lt: new Date(Date.now() - FORCE_RESTART_AFTER_MS) },
      },
      data: { provisionState: 'PENDING', provisionError: null },
    });
  }
  return runProvisionStep(row.id, opts);
}

/**
 * "Rebuild sandbox": puts a READY sandbox back to PENDING (counted as a reset) and runs a step, so the normal job
 * deletes the student's work and builds it again from the template. Anything that is not READY is only reported: a
 * healthy build is never restarted from here (use `retryProvisionSandbox` for a FAILED or stuck one).
 */
export async function rebuildProvisionSandbox(
  userId: string,
  opts: StepOptions = {},
): Promise<ProvisionView> {
  const db = opts.db ?? prisma;
  const row = await db.sandbox.findFirst({
    where: { ownerUserId: userId, kind: 'STUDENT', status: { not: 'ARCHIVED' } },
    orderBy: { createdAt: 'desc' },
    select: { id: true },
  });
  if (!row) return viewOf(db, null);
  const flipped = await db.sandbox.updateMany({
    where: { id: row.id, provisionState: 'READY' },
    data: {
      provisionState: 'PENDING',
      provisionError: null,
      resetCount: { increment: 1 },
      lastResetAt: new Date(),
    },
  });
  if (flipped.count === 0) return getProvisionView(userId, db);
  return runProvisionStep(row.id, opts);
}

// ---- timer -----------------------------------------------------------------------------------------------------

/**
 * Called by the engine timer after the due ticks: starts students who have an account but no sandbox (accounts made
 * before this job existed, or whose enqueue failed), then moves queued and abandoned builds. History jobs that are
 * already running are continued by the engine's own job loop.
 */
export async function advanceProvisioning(
  deadline: number,
  opts: { db?: Db; limit?: number; classroomId?: string; orphans?: boolean } = {},
): Promise<{ started: number; stepped: number }> {
  const db = opts.db ?? prisma;
  const limit = opts.limit ?? 3;
  let started = 0;
  // `orphans: false` (the lazy page-load path) only moves builds that exist; starting students who have no sandbox is
  // left to the timer and to the student's own welcome page
  const orphans =
    opts.orphans === false ? [] : await findStudentsWithoutSandbox(db, limit, opts.classroomId);
  for (const u of orphans) {
    const v = await enqueueProvisionSandbox(u.cohortId, u.id, db).catch(() => undefined);
    if (v?.sandboxId) started++;
  }
  const todo = await db.sandbox.findMany({
    where: {
      kind: 'STUDENT',
      status: { not: 'ARCHIVED' },
      ...(opts.classroomId ? { classroomId: opts.classroomId } : {}),
      OR: [
        { provisionState: 'PENDING' },
        { provisionState: 'SEEDING', updatedAt: { lt: new Date(Date.now() - STALE_MS) } },
        // a history job whose step ended (or whose function died) has no heartbeat any more: continue it here, so the
        // build does not wait for the engine's own job loop (a step is safe to repeat: the clock row locks the job)
        {
          provisionState: 'BACKFILLING',
          updatedAt: { lt: new Date(Date.now() - FORCE_RESTART_AFTER_MS) },
        },
      ],
    },
    select: { id: true },
    orderBy: { createdAt: 'asc' },
    take: limit,
  });
  let stepped = 0;
  for (const s of todo) {
    if (Date.now() >= deadline - 5_000) break;
    await runProvisionStep(s.id, { db, budgetMs: deadline - Date.now() });
    stepped++;
  }
  return { started, stepped };
}
