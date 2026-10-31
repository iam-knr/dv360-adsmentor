// Claiming and idempotency (engine.md 1.4). A sandbox is processed by at most one transaction at a time because the
// batch starts with SELECT ... FOR UPDATE SKIP LOCKED on its SimClock row and keeps the lock until commit. The tick
// ledger SimTickLog is the second guard: a tick number that is already there is never applied again.
import type { Tx } from '@/lib/db';
import type { ClockRow } from './types';

interface ClockSqlRow {
  sandboxId: string;
  simStart: Date;
  tickIndex: bigint;
  state: ClockRow['state'];
  minutesPerSimDay: number;
  lastAdvanceRealAt: Date | null;
  remainderMs: number;
  marketSeed: string;
  sandboxSeed: string;
  paramsVersion: string;
  runOutsideSession: boolean;
  classroomId: string;
}

/** Locks the clock row of one sandbox. Returns null when another transaction holds it or the row is missing. */
export async function lockClock(tx: Tx, sandboxId: string): Promise<ClockRow | null> {
  const rows = await tx.$queryRaw<ClockSqlRow[]>`
    SELECT c.*, s."classroomId"
    FROM "SimClock" c
    JOIN "Sandbox" s ON s."id" = c."sandboxId"
    WHERE c."sandboxId" = ${sandboxId}
    FOR UPDATE OF c SKIP LOCKED`;
  const c = rows[0];
  if (!c) return null;
  return {
    sandboxId: c.sandboxId,
    classroomId: c.classroomId,
    simStartMs: c.simStart.getTime(),
    tickIndex: Number(c.tickIndex),
    state: c.state,
    minutesPerSimDay: c.minutesPerSimDay,
    lastAdvanceRealMs: c.lastAdvanceRealAt ? c.lastAdvanceRealAt.getTime() : null,
    remainderMs: c.remainderMs,
    marketSeed: c.marketSeed,
    sandboxSeed: c.sandboxSeed,
    paramsVersion: c.paramsVersion,
    runOutsideSession: c.runOutsideSession,
  };
}

/**
 * Sandboxes whose clock is RUNNING and owes at least one tick, most overdue first. This is a plain read: the lock is
 * taken later, per sandbox, by lockClock. Frozen, resetting and unprovisioned sandboxes are never listed (a closed
 * class window freezes the sandbox and pauses its clock, lib/access/windows.ts).
 */
export async function listDueSandboxes(
  tx: Tx,
  nowMs: number,
  limit: number,
  activeWithinMs?: number,
): Promise<string[]> {
  const now = new Date(nowMs);
  const seenSince = activeSince(nowMs, activeWithinMs);
  const rows = await tx.$queryRaw<{ sandboxId: string }[]>`
    SELECT c."sandboxId"
    FROM "SimClock" c
    JOIN "Sandbox" s ON s."id" = c."sandboxId"
    LEFT JOIN "User" u ON u."id" = s."ownerUserId"
    WHERE c."state" = 'RUNNING'
      AND s."status" = 'ACTIVE'
      AND s."provisionState" = 'READY'
      AND s."frozenAt" IS NULL
      AND c."lastAdvanceRealAt" IS NOT NULL
      AND (${seenSince}::timestamp IS NULL OR u."lastSeenAt" >= ${seenSince}::timestamp)
      AND (EXTRACT(EPOCH FROM (${now}::timestamp - c."lastAdvanceRealAt")) * 1000 + c."remainderMs")
          >= c."minutesPerSimDay" * 2500
    ORDER BY (EXTRACT(EPOCH FROM (${now}::timestamp - c."lastAdvanceRealAt")) * 1000 + c."remainderMs")
             / (c."minutesPerSimDay" * 2500) DESC, c."sandboxId"
    LIMIT ${limit}`;
  return rows.map((r) => r.sandboxId);
}

/**
 * Load protection: with `activeWithinMs` only sandboxes whose owner was seen within that window are listed (the timer
 * never works for abandoned sandboxes; a student's own page load still catches theirs up). Undefined = no filter.
 */
function activeSince(nowMs: number, activeWithinMs?: number): Date | null {
  return activeWithinMs === undefined ? null : new Date(nowMs - activeWithinMs);
}

export async function countDueSandboxes(
  tx: Tx,
  nowMs: number,
  activeWithinMs?: number,
): Promise<number> {
  const now = new Date(nowMs);
  const seenSince = activeSince(nowMs, activeWithinMs);
  const rows = await tx.$queryRaw<{ n: number }[]>`
    SELECT count(*)::int AS n
    FROM "SimClock" c
    JOIN "Sandbox" s ON s."id" = c."sandboxId"
    LEFT JOIN "User" u ON u."id" = s."ownerUserId"
    WHERE c."state" = 'RUNNING' AND s."status" = 'ACTIVE' AND s."provisionState" = 'READY'
      AND s."frozenAt" IS NULL AND c."lastAdvanceRealAt" IS NOT NULL
      AND (${seenSince}::timestamp IS NULL OR u."lastSeenAt" >= ${seenSince}::timestamp)
      AND (EXTRACT(EPOCH FROM (${now}::timestamp - c."lastAdvanceRealAt")) * 1000 + c."remainderMs")
          >= c."minutesPerSimDay" * 2500`;
  return rows[0]?.n ?? 0;
}

/**
 * Records that tick `tickNo` is being applied. False when the ledger already has it: the caller must skip the tick and
 * write nothing (idempotency). The row is completed by finishTickLog in the same transaction.
 */
export async function claimTick(
  tx: Tx,
  sandboxId: string,
  tickNo: number,
  simHourMs: number,
): Promise<boolean> {
  const rows = await tx.$queryRaw<{ id: string }[]>`
    INSERT INTO "SimTickLog" ("id", "sandboxId", "tickNo", "simHour")
    VALUES (${`tl_${sandboxId}_${tickNo}`}, ${sandboxId}, ${tickNo}::bigint, ${new Date(simHourMs)}::timestamp)
    ON CONFLICT ("sandboxId", "tickNo") DO NOTHING
    RETURNING "id"`;
  return rows.length > 0;
}

/**
 * History mode: claims `count` consecutive ticks in one statement. Returns the tick numbers that were not in the ledger
 * yet (the others were applied before and are skipped, as claimTick does one by one).
 */
export async function claimTicks(
  tx: Tx,
  sandboxId: string,
  firstTick: number,
  count: number,
  simStartMs: number,
): Promise<Set<number>> {
  const rows = await tx.$queryRaw<{ tickNo: bigint }[]>`
    INSERT INTO "SimTickLog" ("id", "sandboxId", "tickNo", "simHour")
    SELECT 'tl_' || ${sandboxId} || '_' || g::text, ${sandboxId}, g, ${new Date(simStartMs)}::timestamp + g * interval '1 hour'
    FROM generate_series(${firstTick}::bigint, ${firstTick + count - 1}::bigint) AS g
    ON CONFLICT ("sandboxId", "tickNo") DO NOTHING
    RETURNING "tickNo"`;
  return new Set(rows.map((r) => Number(r.tickNo)));
}

export async function finishTickLog(
  tx: Tx,
  sandboxId: string,
  tickNo: number,
  stats: { durationMs: number; lineItemsProcessed: number; rowsWritten: number },
): Promise<void> {
  await tx.simTickLog.update({
    where: { sandboxId_tickNo: { sandboxId, tickNo: BigInt(tickNo) } },
    data: stats,
  });
}

/** Failed runs are logged with a negative tick number so a retry of the real tick is not mistaken for a repeat. */
export async function logFailure(
  tx: Tx,
  sandboxId: string,
  error: unknown,
  nowMs: number,
): Promise<number> {
  const message = (error instanceof Error ? error.message : String(error)).slice(0, 500);
  await tx.simTickLog.create({
    data: {
      id: `tl_fail_${sandboxId}_${nowMs}_${Math.floor(Math.random() * 1e6)}`,
      sandboxId,
      tickNo: BigInt(-nowMs),
      simHour: new Date(nowMs),
      status: 'FAILED',
      error: message,
    },
  });
  const [last] = await tx.simTickLog.findMany({
    where: { sandboxId, status: 'OK' },
    orderBy: { startedAt: 'desc' },
    take: 1,
    select: { startedAt: true },
  });
  return tx.simTickLog.count({
    where: { sandboxId, status: 'FAILED', ...(last ? { startedAt: { gt: last.startedAt } } : {}) },
  });
}
