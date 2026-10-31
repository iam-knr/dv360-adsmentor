import 'server-only';

// "Maybe advance" (docs/gaps/prov-drive.md): the work the GitHub Actions timer used to be the only one to do, done by
// whoever happens to load a page. It is cheap when nothing is due: one conditional write on AppMeta decides who runs
// (no memory, so it holds across serverless instances), and every caller but the winner returns at once.
//
//   own sandbox   a signed in student's READY sandbox runs the ticks it owes (lazy freshness, engine.md 1.4)
//   everyone      at most once per `GLOBAL_INTERVAL_MS` one caller moves queued and abandoned builds
//                 (`advanceProvisioning`) and then the sandboxes that owe ticks (`runDueTicks`)
//
// Callers run it after the response (`scheduleMaybeAdvance`), so it is never on the critical path.
import { after } from 'next/server';
import { prisma } from '@/lib/db';
import { ensureCaughtUp, runDueTicks } from '@/lib/engine/server';
import { advanceProvisioning } from './provision';

type Db = typeof prisma;

export const GLOBAL_KEY = 'prov-drive:global';
export const GLOBAL_INTERVAL_MS = 60_000;
export const OWN_INTERVAL_MS = 15_000;
/** Time one winner may spend: under the 60 s function limit of Vercel Hobby with room for the response. */
export const GLOBAL_BUDGET_MS = 30_000;

/**
 * Takes the slot `key` when it has not been taken for `intervalMs`. One atomic statement: of any number of concurrent
 * callers exactly one gets `true` (the others wait for the row lock, see the new time and do not match the WHERE).
 */
export async function claimSlot(
  key: string,
  intervalMs: number,
  opts: { db?: Db; now?: number } = {},
): Promise<boolean> {
  const db = opts.db ?? prisma;
  const now = opts.now ?? Date.now();
  const rows = await db.$queryRaw<{ key: string }[]>`
    INSERT INTO "AppMeta" ("key", "value") VALUES (${key}, ${String(now)})
    ON CONFLICT ("key") DO UPDATE SET "value" = EXCLUDED."value"
    WHERE ("AppMeta"."value")::bigint <= ${now - intervalMs}
    RETURNING "key"`;
  return rows.length === 1;
}

export interface MaybeAdvanceResult {
  own: boolean;
  global: boolean;
  provisioning?: { started: number; stepped: number };
  ticks?: number;
}

export interface MaybeAdvanceOptions {
  /** The caller's sandbox, when they are a student whose sandbox is READY. */
  sandboxId?: string | null;
  /** Only builds of this cohort (tests; the page-load callers move every cohort). */
  classroomId?: string;
  db?: Db;
  now?: number;
  globalIntervalMs?: number;
  budgetMs?: number;
}

export async function maybeAdvance(opts: MaybeAdvanceOptions = {}): Promise<MaybeAdvanceResult> {
  const db = opts.db ?? prisma;
  const result: MaybeAdvanceResult = { own: false, global: false };
  if (opts.sandboxId) {
    const key = `prov-drive:own:${opts.sandboxId}`;
    if (await claimSlot(key, OWN_INTERVAL_MS, { db, ...(opts.now ? { now: opts.now } : {}) })) {
      result.own = true;
      await ensureCaughtUp(opts.sandboxId).catch(() => undefined);
    }
  }
  const interval = opts.globalIntervalMs ?? GLOBAL_INTERVAL_MS;
  if (!(await claimSlot(GLOBAL_KEY, interval, { db, ...(opts.now ? { now: opts.now } : {}) })))
    return result;
  result.global = true;
  const deadline = Date.now() + (opts.budgetMs ?? GLOBAL_BUDGET_MS);
  result.provisioning = await advanceProvisioning(deadline, {
    db,
    limit: 2,
    orphans: false,
    ...(opts.classroomId ? { classroomId: opts.classroomId } : {}),
  }).catch(() => undefined);
  if (Date.now() < deadline - 5_000) {
    const ticks = await runDueTicks(deadline, { maxSandboxes: 5 }).catch(() => undefined);
    if (ticks) result.ticks = ticks.ticks;
  }
  return result;
}

/** Runs `maybeAdvance` after the response; outside a request (scripts, tests) it does nothing. */
export function scheduleMaybeAdvance(sandboxId?: string | null): void {
  try {
    after(() => maybeAdvance({ sandboxId }).catch(() => undefined));
  } catch {
    // no request scope
  }
}
