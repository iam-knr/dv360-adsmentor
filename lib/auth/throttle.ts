import 'server-only';
import { createHash } from 'node:crypto';
import type { PrismaClient } from '@prisma/client';

// Sign in rate limits in AuthThrottle (module 19 4.5, Δ19-7). Serverless instances share no memory, so the
// counters live in Postgres. Keys are hashes: `ip:{sha256(ip)}` and `email:{sha256(lowercase email)}`.
type Db = Pick<PrismaClient, 'authThrottle'>;

export const IP_FAILURE_LIMIT = 10;
export const IP_WINDOW_MS = 60_000;

export function throttleKey(kind: 'ip' | 'email', value: string): string {
  const v = kind === 'email' ? value.trim().toLowerCase() : value.trim();
  return `${kind}:${createHash('sha256').update(v).digest('hex')}`;
}

/** Milliseconds left on a lock, or 0 when the key is free. */
export async function lockRemainingMs(db: Db, key: string, now: Date): Promise<number> {
  const row = await db.authThrottle.findUnique({ where: { key } });
  if (!row?.lockedUntil) return 0;
  return Math.max(0, row.lockedUntil.getTime() - now.getTime());
}

export interface FailureRule {
  /** Failures that trigger a lock. */
  limit: number;
  /** How long the lock lasts. */
  lockMs: number;
  /** Counting window; when set, old failures expire (used for the IP key). */
  windowMs?: number;
}

/**
 * Count one failure for `key`. Returns the lock end when this failure reached the limit.
 * An expired lock or window starts a fresh count first.
 */
export async function recordFailure(
  db: Db,
  key: string,
  rule: FailureRule,
  now: Date,
): Promise<Date | null> {
  const expired: Array<Record<string, unknown>> = [{ lockedUntil: { lte: now } }];
  if (rule.windowMs)
    expired.push({ windowStart: { lte: new Date(now.getTime() - rule.windowMs) } });
  await db.authThrottle.updateMany({
    where: { key, OR: expired },
    data: { count: 0, windowStart: now, lockedUntil: null },
  });
  const row = await db.authThrottle.upsert({
    where: { key },
    create: { key, count: 1, windowStart: now },
    update: { count: { increment: 1 } },
  });
  if (row.count >= rule.limit && !row.lockedUntil) {
    const lockedUntil = new Date(now.getTime() + rule.lockMs);
    await db.authThrottle.update({ where: { key }, data: { lockedUntil } });
    return lockedUntil;
  }
  return row.lockedUntil && row.lockedUntil > now ? row.lockedUntil : null;
}

export async function clearThrottle(db: Db, key: string): Promise<void> {
  await db.authThrottle.deleteMany({ where: { key } });
}
