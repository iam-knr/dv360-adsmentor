// Student sandboxes run (docs/gaps/sim-clock-runs.md). A sandbox ends its build with the clock RUNNING at one global
// speed, so what a student builds delivers and reports move. Nothing here imports the engine or `server-only`: the
// provisioning job, the build-time bootstrap (scripts/bootstrap.ts) and the Super admin controls all use it.
import type { PrismaClient } from '@prisma/client';
import { speedAllowed } from '../engine/clock/clock';

type Db = Pick<PrismaClient, 'simClock' | 'sandbox' | 'appMeta'>;

/** 1 simulated day per 10 real minutes (144x): 6 ticks per real minute, 4 per cron run slot of 5 minutes ~ 12 ticks. */
export const DEFAULT_MINUTES_PER_SIM_DAY = 10;
/** AppMeta key that overrides the environment (Super admin / ops setting). */
export const SPEED_META_KEY = 'sandbox:minutes-per-sim-day';
export const SPEED_ENV = 'SANDBOX_SIM_MINUTES_PER_DAY';
/** Set to 0/false in tests that need a frozen clock; production never sets it. */
export const AUTOSTART_ENV = 'SANDBOX_CLOCK_AUTOSTART';
/** AppMeta key prefix: a Super admin paused this sandbox; nothing resumes it except the Super admin. */
export const ADMIN_PAUSE_PREFIX = 'sandbox-clock:admin-paused:';
/** AppMeta key: the one-off resume of sandboxes that were PAUSED since provisioning has been done. */
export const RESUME_DONE_KEY = 'sandbox-clock:resumed-existing:v1';
/** A sandbox is "recently active" when its owner was seen within this window; only those get timer ticks. */
export const ACTIVE_WINDOW_MS = 7 * 24 * 3_600_000;
export const ACTIVE_WINDOW_ENV = 'SANDBOX_ACTIVE_WINDOW_DAYS';

/** Validates a speed: whole minutes per sim day, at most the tick cap of the engine (2 minutes per day) and a real day. */
export function parseMinutesPerSimDay(raw: unknown): number | null {
  if (raw === undefined || raw === null || raw === '') return null;
  const n = typeof raw === 'number' ? raw : typeof raw === 'string' ? Number(raw.trim()) : NaN;
  if (!Number.isInteger(n) || n < 1 || n > 1440 || !speedAllowed(n)) return null;
  return n;
}

export interface SandboxSpeed {
  minutesPerSimDay: number;
  source: 'setting' | 'env' | 'default';
  /** Display speed: sim days per real day (the header chip shows "144x"). */
  speedX: number;
}

const speedX = (m: number) => Math.round((1440 / m) * 10) / 10;

/** Global speed: AppMeta setting, then the environment, then the default. An invalid value is ignored, never trusted. */
export async function getSandboxSpeed(
  db: Pick<PrismaClient, 'appMeta'>,
  env: Record<string, string | undefined> = process.env,
): Promise<SandboxSpeed> {
  const row = await db.appMeta.findUnique({ where: { key: SPEED_META_KEY } }).catch(() => null);
  const fromSetting = parseMinutesPerSimDay(row?.value);
  if (fromSetting)
    return { minutesPerSimDay: fromSetting, source: 'setting', speedX: speedX(fromSetting) };
  const fromEnv = parseMinutesPerSimDay(env[SPEED_ENV]);
  if (fromEnv) return { minutesPerSimDay: fromEnv, source: 'env', speedX: speedX(fromEnv) };
  const d = DEFAULT_MINUTES_PER_SIM_DAY;
  return { minutesPerSimDay: d, source: 'default', speedX: speedX(d) };
}

export function autostartEnabled(env: Record<string, string | undefined> = process.env): boolean {
  const v = env[AUTOSTART_ENV]?.trim().toLowerCase();
  return !(v === '0' || v === 'false' || v === 'off');
}

/** Days a student must have been seen within for the timer to advance their sandbox. */
export function activeWindowMs(env: Record<string, string | undefined> = process.env): number {
  const d = Number(env[ACTIVE_WINDOW_ENV]);
  return Number.isFinite(d) && d >= 1 && d <= 90 ? d * 24 * 3_600_000 : ACTIVE_WINDOW_MS;
}

export const adminPauseKey = (sandboxId: string) => `${ADMIN_PAUSE_PREFIX}${sandboxId}`;

export async function isAdminPaused(
  db: Pick<PrismaClient, 'appMeta'>,
  sandboxId: string,
): Promise<boolean> {
  return (await db.appMeta.findUnique({ where: { key: adminPauseKey(sandboxId) } })) !== null;
}

/**
 * Sets the clock RUNNING at the global speed with the accounting point at `now` (no catch-up debt: the history was
 * built by the fast-forward job). Only a PAUSED clock is touched (a LOCKED one needs its failures looked at) and never one
 * a Super admin paused. Returns true when the clock was started.
 */
export async function startSandboxClock(
  db: Db,
  sandboxId: string,
  opts: { now?: number; env?: Record<string, string | undefined>; speed?: number } = {},
): Promise<boolean> {
  const env = opts.env ?? process.env;
  if (!autostartEnabled(env)) return false;
  if (await isAdminPaused(db, sandboxId)) return false;
  const minutesPerSimDay = opts.speed ?? (await getSandboxSpeed(db, env)).minutesPerSimDay;
  const r = await db.simClock.updateMany({
    where: { sandboxId, state: 'PAUSED' },
    data: {
      state: 'RUNNING',
      minutesPerSimDay,
      lastAdvanceRealAt: new Date(opts.now ?? Date.now()),
      remainderMs: 0,
    },
  });
  return r.count === 1;
}

/** Super admin pause: the clock stops and the marker keeps every automatic path from resuming it. */
export async function adminPauseSandbox(db: Db, sandboxId: string): Promise<void> {
  await db.appMeta.upsert({
    where: { key: adminPauseKey(sandboxId) },
    create: { key: adminPauseKey(sandboxId), value: String(Date.now()) },
    update: { value: String(Date.now()) },
  });
  await db.simClock.updateMany({
    where: { sandboxId, state: { in: ['RUNNING', 'STEPPING'] } },
    data: { state: 'PAUSED', remainderMs: 0 },
  });
}

/** Super admin resume: removes the marker and runs the clock again; paused time is not owed. */
export async function adminResumeSandbox(
  db: Db,
  sandboxId: string,
  opts: { now?: number; env?: Record<string, string | undefined> } = {},
): Promise<boolean> {
  await db.appMeta.deleteMany({ where: { key: adminPauseKey(sandboxId) } });
  return startSandboxClock(db, sandboxId, {
    ...opts,
    env: { ...(opts.env ?? process.env), [AUTOSTART_ENV]: '1' },
  });
}

/** A rebuild starts from scratch: an earlier pause does not carry over. */
export async function clearAdminPause(
  db: Pick<PrismaClient, 'appMeta'>,
  sandboxId: string,
): Promise<void> {
  await db.appMeta.deleteMany({ where: { key: adminPauseKey(sandboxId) } });
}

export interface ResumeExistingResult {
  skipped: boolean;
  resumed: number;
  respectedAdminPause: number;
}

/**
 * Bootstrap step (every Vercel build): sandboxes that reached READY before clocks ran and are still PAUSED are resumed
 * once. A marker row records that it was done, so a later Super admin pause is never undone by the next deploy, and
 * sandboxes with an admin-pause marker are skipped regardless. Idempotent. Frozen or archived sandboxes are left alone.
 * Also re-applies the global speed to RUNNING clocks so a changed setting takes effect on the next deploy.
 */
export async function resumeExistingSandboxes(
  db: Db,
  opts: {
    now?: number;
    env?: Record<string, string | undefined>;
    log?: (line: string) => void;
  } = {},
): Promise<ResumeExistingResult> {
  const env = opts.env ?? process.env;
  const log = opts.log ?? (() => undefined);
  if (!autostartEnabled(env)) return { skipped: true, resumed: 0, respectedAdminPause: 0 };
  const speed = await getSandboxSpeed(db, env);
  const now = new Date(opts.now ?? Date.now());
  const done = await db.appMeta.findUnique({ where: { key: RESUME_DONE_KEY } });
  let resumed = 0;
  let respectedAdminPause = 0;
  if (!done) {
    const candidates = await db.sandbox.findMany({
      where: {
        kind: 'STUDENT',
        status: 'ACTIVE',
        provisionState: 'READY',
        frozenAt: null,
        clock: { is: { state: 'PAUSED' } },
      },
      select: { id: true },
    });
    for (const c of candidates) {
      if (await isAdminPaused(db, c.id)) {
        respectedAdminPause++;
        continue;
      }
      if (
        await startSandboxClock(db, c.id, {
          now: now.getTime(),
          env,
          speed: speed.minutesPerSimDay,
        })
      )
        resumed++;
    }
    await db.appMeta.upsert({
      where: { key: RESUME_DONE_KEY },
      create: { key: RESUME_DONE_KEY, value: now.toISOString() },
      update: {},
    });
  }
  // a changed setting reaches the clocks that already run (any debt is repriced, bounded by the per-call tick caps)
  const retimed = await db.simClock.updateMany({
    where: { state: 'RUNNING', minutesPerSimDay: { not: speed.minutesPerSimDay } },
    data: { minutesPerSimDay: speed.minutesPerSimDay },
  });
  if (retimed.count > 0)
    log(`  sandbox clocks: ${retimed.count} retimed to ${speed.minutesPerSimDay} min/sim day`);
  log(
    `  sandbox clocks: ${resumed} resumed at ${speed.minutesPerSimDay} min/sim day (${speed.source}), ${respectedAdminPause} admin-paused kept`,
  );
  return { skipped: false, resumed, respectedAdminPause };
}
