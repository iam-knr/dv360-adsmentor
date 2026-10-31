import 'server-only';
import { createHash } from 'node:crypto';
import type { Prisma, PrismaClient } from '@prisma/client';
import { recordFailure } from '@/lib/auth/throttle';
import { prisma } from '@/lib/db';
import {
  isScreenshotMethod,
  normaliseEventPath,
  screenshotMethodLabel,
  type ScreenshotMethod,
} from '@/lib/security/screenshot-detect';
import { writeAccountAudit } from './audit';
import { can, type Actor } from './permissions';
import { AccountError, MAX_BULK } from './rules';
import { scopedUsers } from './scope';

// Screenshot guard, server side (docs/gaps/screenshot-guard.md). The browser can only tell us that a key was
// pressed; everything that matters (who is guarded, the suspension, the sessions, the audit, the alert) is decided
// and stored here. A browser has no screenshot API: this is a tripwire and a deterrent, not prevention.
type Db = PrismaClient;

export const SCREENSHOT_REASON = 'SCREENSHOT';

export type RecordOutcome =
  | { status: 'SUSPENDED'; eventId: string }
  | { status: 'ALREADY_SUSPENDED' }
  | { status: 'EXEMPT' }
  | { status: 'ALLOWED' }
  | { status: 'NOT_FOUND' }
  | { status: 'RATE_LIMITED' };

export const EVENT_RATE_LIMIT = 20;
export const EVENT_RATE_WINDOW_MS = 60_000;

/** Per account request limit for the event endpoint, shared across serverless instances through AuthThrottle. */
export async function eventRateLimited(
  userId: string,
  db: Db = prisma,
  now: Date = new Date(),
): Promise<boolean> {
  const key = `shot:${createHash('sha256').update(userId).digest('hex')}`;
  const lockedUntil = await recordFailure(
    db,
    key,
    { limit: EVENT_RATE_LIMIT, lockMs: EVENT_RATE_WINDOW_MS, windowMs: EVENT_RATE_WINDOW_MS },
    now,
  );
  return !!lockedUntil;
}

/**
 * A recognised screenshot attempt of `userId` (the signed in person, never taken from the body). Idempotent: only
 * the first event of a guarded student suspends the account and writes the audit rows and the alert; repeats
 * (key down and key up, two tabs) change nothing. A Super admin and a student whose screenshots are allowed are
 * ignored.
 */
export async function recordScreenshotEvent(
  userId: string,
  input: { method: unknown; path: unknown },
  db: Db = prisma,
  now: Date = new Date(),
): Promise<RecordOutcome> {
  if (!isScreenshotMethod(input.method)) throw new AccountError('SEC-003', 'Unknown method.');
  const method: ScreenshotMethod = input.method;
  const path = normaliseEventPath(input.path);
  return db.$transaction(async (tx) => {
    const user = await tx.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        appRole: true,
        status: true,
        screenshotsAllowed: true,
        accessSuspendedAt: true,
        cohortId: true,
      },
    });
    if (!user) return { status: 'NOT_FOUND' };
    if (user.appRole !== 'USER') return { status: 'EXEMPT' };
    if (user.screenshotsAllowed) return { status: 'ALLOWED' };
    // The conditional update is the idempotency gate: two concurrent events cannot both pass it.
    const { count } = await tx.user.updateMany({
      where: { id: userId, appRole: 'USER', screenshotsAllowed: false, accessSuspendedAt: null },
      data: {
        accessSuspendedAt: now,
        accessSuspendedReason: SCREENSHOT_REASON,
        accessSuspendedMethod: method,
        accessSuspendedPath: path,
        accessSuspendedById: null,
        // "sign out everywhere": every cookie of this account stops working
        sessionVersion: { increment: 1 },
        activeSessionId: null,
      },
    });
    if (count === 0) return { status: 'ALREADY_SUSPENDED' };
    const event = await tx.securityEvent.create({
      data: { userId, kind: SCREENSHOT_REASON, method, path, occurredAt: now },
      select: { id: true },
    });
    await writeAccountAudit(tx, {
      actorUserId: userId,
      actorRole: 'USER',
      classroomId: user.cohortId,
      action: 'SCREENSHOT_DETECTED',
      targetType: 'User',
      targetId: userId,
      targetUserId: userId,
      payload: { method, path },
    });
    await writeAccountAudit(tx, {
      actorUserId: null,
      classroomId: user.cohortId,
      action: 'ACCOUNT_SUSPENDED',
      targetType: 'User',
      targetId: userId,
      targetUserId: userId,
      payload: { reason: SCREENSHOT_REASON, method, path },
    });
    return { status: 'SUSPENDED', eventId: event.id };
  });
}

async function loadStudent(tx: Prisma.TransactionClient, actor: Actor, id: string) {
  const found = await scopedUsers(tx, actor).findById(id);
  if (!found) throw new AccountError('ACC-022');
  const user = found as {
    id: string;
    appRole: 'USER' | 'ADMIN' | 'SUPER_ADMIN';
    cohortId: string | null;
  };
  return user;
}

/** Allow or disallow screenshots for one student. Returns false when nothing changed (already that value). */
export async function setScreenshotsAllowed(
  actor: Actor,
  id: string,
  allowed: boolean,
  db: Db = prisma,
): Promise<boolean> {
  return db.$transaction(async (tx) => {
    const user = await loadStudent(tx, actor, id);
    if (user.appRole !== 'USER') throw new AccountError('SEC-002');
    if (!can(actor, 'account.screenshots', { id: user.id, role: user.appRole }))
      throw new AccountError('FORBIDDEN');
    const { count } = await tx.user.updateMany({
      where: { id, screenshotsAllowed: !allowed },
      data: { screenshotsAllowed: allowed },
    });
    if (count === 0) return false;
    await writeAccountAudit(tx, {
      actorUserId: actor.id,
      actorRole: actor.role,
      classroomId: user.cohortId,
      action: allowed ? 'SCREENSHOTS_ALLOWED' : 'SCREENSHOTS_DISALLOWED',
      targetType: 'User',
      targetId: id,
      targetUserId: id,
      payload: { screenshotsAllowed: allowed },
    });
    return true;
  });
}

/**
 * Give a suspended student access again. The student signs in again (the old cookies stay dead); the screenshot
 * switch stays as it was. Closes the open alert.
 */
export async function restoreAccess(
  actor: Actor,
  id: string,
  db: Db = prisma,
  now: Date = new Date(),
): Promise<void> {
  await db.$transaction(async (tx) => {
    const user = await loadStudent(tx, actor, id);
    if (user.appRole !== 'USER') throw new AccountError('SEC-002');
    if (!can(actor, 'account.restoreAccess', { id: user.id, role: user.appRole }))
      throw new AccountError('FORBIDDEN');
    const { count } = await tx.user.updateMany({
      where: { id, accessSuspendedAt: { not: null } },
      data: {
        accessSuspendedAt: null,
        accessSuspendedReason: null,
        accessSuspendedMethod: null,
        accessSuspendedPath: null,
        accessSuspendedById: null,
        // a fresh start for the sign in: no leftover lock from the same day
        failedLoginCount: 0,
        lockedUntil: null,
      },
    });
    if (count === 0) throw new AccountError('SEC-001');
    await tx.securityEvent.updateMany({
      where: { userId: id, restoredAt: null },
      data: { restoredAt: now, restoredById: actor.id, seenAt: now },
    });
    await writeAccountAudit(tx, {
      actorUserId: actor.id,
      actorRole: actor.role,
      classroomId: user.cohortId,
      action: 'ACCOUNT_RESTORED',
      targetType: 'User',
      targetId: id,
      targetUserId: id,
      payload: { reason: 'SCREENSHOT_SUSPENSION' },
    });
  });
}

export type SecurityBulkAction = 'ALLOW_SCREENSHOTS' | 'DISALLOW_SCREENSHOTS' | 'RESTORE_ACCESS';

export interface SecurityBulkResult {
  done: string[];
  skipped: { id: string; code: string; message: string }[];
}

/** Each id in its own transaction; a skipped row carries its reason (same shape as the account bulk actions). */
export async function bulkSecurity(
  actor: Actor,
  ids: string[],
  action: SecurityBulkAction,
  db: Db = prisma,
): Promise<SecurityBulkResult> {
  const unique = [...new Set(ids)];
  if (unique.length > MAX_BULK) throw new AccountError('ACC-060');
  const result: SecurityBulkResult = { done: [], skipped: [] };
  for (const id of unique) {
    try {
      if (action === 'RESTORE_ACCESS') await restoreAccess(actor, id, db);
      else await setScreenshotsAllowed(actor, id, action === 'ALLOW_SCREENSHOTS', db);
      result.done.push(id);
    } catch (err) {
      const code = err instanceof AccountError ? err.code : 'ERROR';
      const message =
        err instanceof AccountError ? err.message : 'Something went wrong. Try again.';
      result.skipped.push({ id, code, message });
    }
  }
  return result;
}

// ---------------------------------------------------------------------------------------------------------------
// Reading: the security page, the badge and the poll
// ---------------------------------------------------------------------------------------------------------------

export interface SecurityEventRow {
  id: string;
  occurredAt: Date;
  userId: string;
  userName: string;
  userEmail: string;
  method: string;
  methodLabel: string;
  path: string;
  status: 'OPEN' | 'RESTORED';
  restoredAt: Date | null;
  restoredByName: string | null;
  unread: boolean;
}

export const SECURITY_PAGE_SIZE = 50;

export async function listSecurityEvents(
  actor: Actor,
  page = 1,
  db: Db = prisma,
): Promise<{ rows: SecurityEventRow[]; total: number }> {
  if (!can(actor, 'security.view')) throw new AccountError('FORBIDDEN');
  const [total, events] = await Promise.all([
    db.securityEvent.count(),
    db.securityEvent.findMany({
      orderBy: { occurredAt: 'desc' },
      skip: (Math.max(1, page) - 1) * SECURITY_PAGE_SIZE,
      take: SECURITY_PAGE_SIZE,
      include: { user: { select: { name: true, email: true } } },
    }),
  ]);
  const restorerIds = [
    ...new Set(events.map((e) => e.restoredById).filter((v): v is string => !!v)),
  ];
  const restorers = restorerIds.length
    ? await db.user.findMany({
        where: { id: { in: restorerIds } },
        select: { id: true, name: true },
      })
    : [];
  const restorerName = new Map(restorers.map((r) => [r.id, r.name]));
  return {
    total,
    rows: events.map((e) => ({
      id: e.id,
      occurredAt: e.occurredAt,
      userId: e.userId,
      userName: e.user.name,
      userEmail: e.user.email,
      method: e.method,
      methodLabel: screenshotMethodLabel(e.method),
      path: e.path,
      status: e.restoredAt ? 'RESTORED' : 'OPEN',
      restoredAt: e.restoredAt,
      restoredByName: e.restoredById ? (restorerName.get(e.restoredById) ?? null) : null,
      unread: !e.seenAt,
    })),
  };
}

export interface SecuritySummary {
  /** accounts that are suspended right now */
  open: number;
  /** events no Super admin has opened the security page for yet */
  unread: number;
  /** newest open event, for the toast */
  latest: { id: string; userName: string; method: string; occurredAt: string } | null;
}

export async function securitySummary(actor: Actor, db: Db = prisma): Promise<SecuritySummary> {
  if (!can(actor, 'security.view')) throw new AccountError('FORBIDDEN');
  const [open, unread, latest] = await Promise.all([
    db.securityEvent.count({ where: { restoredAt: null } }),
    db.securityEvent.count({ where: { seenAt: null } }),
    db.securityEvent.findFirst({
      where: { restoredAt: null },
      orderBy: { occurredAt: 'desc' },
      include: { user: { select: { name: true } } },
    }),
  ]);
  return {
    open,
    unread,
    latest: latest
      ? {
          id: latest.id,
          userName: latest.user.name,
          method: latest.method,
          occurredAt: latest.occurredAt.toISOString(),
        }
      : null,
  };
}

/** Opening the security page marks everything as seen (clears the unread badge). */
export async function markSecurityEventsSeen(
  actor: Actor,
  db: Db = prisma,
  now: Date = new Date(),
): Promise<void> {
  if (!can(actor, 'security.view')) throw new AccountError('FORBIDDEN');
  await db.securityEvent.updateMany({ where: { seenAt: null }, data: { seenAt: now } });
}
