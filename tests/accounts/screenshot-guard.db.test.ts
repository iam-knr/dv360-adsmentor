import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Actor } from '@/lib/accounts/permissions';
import { AccountError } from '@/lib/accounts/rules';
import {
  bulkSecurity,
  EVENT_RATE_LIMIT,
  eventRateLimited,
  listSecurityEvents,
  markSecurityEventsSeen,
  recordScreenshotEvent,
  restoreAccess,
  securitySummary,
  setScreenshotsAllowed,
} from '@/lib/accounts/screenshot-guard';
import { getAccount, listAccounts } from '@/lib/accounts/service';
import { ACC_SUSPENDED } from '@/lib/auth/messages';
import { resolveSessionUser } from '@/lib/auth/session-core';
import { authenticate, signInMessage } from '@/lib/auth/signin';
import { prisma } from '@/lib/db';
import { cleanup, createAccount, createClassroom, createStudent } from '../auth/fixtures';

const userIds: string[] = [];
const classroomIds: string[] = [];
let sa: Awaited<ReturnType<typeof createAccount>>;
let actor: Actor;
let cohort: string;
let savedSupers: string[] = [];

async function student(tag: string, over: { screenshotsAllowed?: boolean } = {}) {
  const s = await createStudent(prisma, { tag, classroomId: cohort });
  userIds.push(s.user.id);
  if (over.screenshotsAllowed !== undefined)
    await prisma.user.update({
      where: { id: s.user.id },
      data: { screenshotsAllowed: over.screenshotsAllowed },
    });
  return s;
}

/** A signed in student: a session id and the claims the cookie would carry. */
async function signedIn(id: string) {
  const sid = `sid-${id}`;
  const u = await prisma.user.update({
    where: { id },
    data: { activeSessionId: sid, lastSeenAt: new Date() },
  });
  return { sv: u.sessionVersion, sid, loginAt: Math.floor(Date.now() / 1000) };
}

const code = async (p: Promise<unknown>) => {
  try {
    await p;
  } catch (e) {
    if (e instanceof AccountError) return e.code;
    throw e;
  }
  return 'NO_ERROR';
};

beforeAll(async () => {
  savedSupers = (
    await prisma.user.findMany({ where: { appRole: 'SUPER_ADMIN' }, select: { id: true } })
  ).map((u) => u.id);
  await prisma.user.updateMany({
    where: { id: { in: savedSupers } },
    data: { status: 'DISABLED' },
  });
  sa = await createAccount(prisma, { tag: 'sg-super', role: 'SUPER_ADMIN' });
  userIds.push(sa.user.id);
  actor = { id: sa.user.id, role: 'SUPER_ADMIN' };
  const c = await createClassroom(prisma, { tag: 'sg', ownerAdminId: sa.user.id });
  classroomIds.push(c.id);
  cohort = c.id;
  await prisma.securityEvent.deleteMany({});
});

afterAll(async () => {
  await cleanup(prisma, { userIds, classroomIds });
  await prisma.user.updateMany({ where: { id: { in: savedSupers } }, data: { status: 'ACTIVE' } });
  await prisma.authThrottle.deleteMany({});
});

describe('screenshot guard: a recognised event', () => {
  it('students are guarded by default', async () => {
    const s = await student('sg-default');
    expect(s.user.screenshotsAllowed).toBe(false);
  });

  it('suspends the account, kills the sessions, audits twice and raises the alert', async () => {
    const s = await student('sg-suspend');
    const claims = await signedIn(s.user.id);
    const before = await resolveSessionUser({ userId: s.user.id, claims, now: new Date() });
    expect(before.ok).toBe(true);

    const out = await recordScreenshotEvent(s.user.id, {
      method: 'PRINT_SCREEN',
      path: '/p/123/a/9/c?secret=1#x',
    });
    expect(out.status).toBe('SUSPENDED');

    const row = await prisma.user.findUniqueOrThrow({ where: { id: s.user.id } });
    expect(row.accessSuspendedAt).toBeInstanceOf(Date);
    expect(row.accessSuspendedReason).toBe('SCREENSHOT');
    expect(row.accessSuspendedMethod).toBe('PRINT_SCREEN');
    expect(row.accessSuspendedPath).toBe('/p/123/a/9/c'); // no query string
    expect(row.accessSuspendedById).toBeNull();
    expect(row.activeSessionId).toBeNull();
    expect(row.sessionVersion).toBe(claims.sv + 1);

    // the old cookie now says "suspended" (session resolution, not the client)
    const after = await resolveSessionUser({ userId: s.user.id, claims, now: new Date() });
    expect(after).toEqual({ ok: false, reason: 'suspended' });
    // a cookie from before the bump, or a brand new claim set, is refused the same way
    const fresh = await resolveSessionUser({
      userId: s.user.id,
      claims: { ...claims, sv: row.sessionVersion, sid: 'new' },
      now: new Date(),
    });
    expect(fresh).toEqual({ ok: false, reason: 'suspended' });

    const audit = await prisma.auditLog.findMany({
      where: { targetUserId: s.user.id },
      orderBy: { createdAt: 'asc' },
    });
    expect(audit.map((a) => a.action).sort()).toEqual(['ACCOUNT_SUSPENDED', 'SCREENSHOT_DETECTED']);
    const detected = audit.find((a) => a.action === 'SCREENSHOT_DETECTED');
    expect(detected?.actorUserId).toBe(s.user.id);
    expect(detected?.payload).toEqual({ method: 'PRINT_SCREEN', path: '/p/123/a/9/c' });
    expect(audit.find((a) => a.action === 'ACCOUNT_SUSPENDED')?.actorUserId).toBeNull();

    const events = await prisma.securityEvent.findMany({ where: { userId: s.user.id } });
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ method: 'PRINT_SCREEN', restoredAt: null, seenAt: null });
  });

  it('is idempotent: repeats change nothing', async () => {
    const s = await student('sg-idem');
    const first = await recordScreenshotEvent(s.user.id, { method: 'PRINT_SCREEN', path: '/a' });
    const again = await recordScreenshotEvent(s.user.id, { method: 'WIN_SHIFT_S', path: '/b' });
    expect(first.status).toBe('SUSPENDED');
    expect(again.status).toBe('ALREADY_SUSPENDED');
    // concurrent events: exactly one wins
    const t = await student('sg-race');
    const outs = await Promise.all(
      [1, 2, 3, 4].map(() =>
        recordScreenshotEvent(t.user.id, { method: 'PRINT_EVENT', path: '/' }),
      ),
    );
    expect(outs.filter((o) => o.status === 'SUSPENDED')).toHaveLength(1);
    for (const id of [s.user.id, t.user.id]) {
      expect(await prisma.securityEvent.count({ where: { userId: id } })).toBe(1);
      expect(
        await prisma.auditLog.count({ where: { targetUserId: id, action: 'SCREENSHOT_DETECTED' } }),
      ).toBe(1);
    }
    const row = await prisma.user.findUniqueOrThrow({ where: { id: s.user.id } });
    expect(row.accessSuspendedMethod).toBe('PRINT_SCREEN'); // the first event is kept
  });

  it('ignores a Super admin and a student whose screenshots are allowed', async () => {
    const allowed = await student('sg-allowed', { screenshotsAllowed: true });
    expect(
      (await recordScreenshotEvent(sa.user.id, { method: 'PRINT_SCREEN', path: '/' })).status,
    ).toBe('EXEMPT');
    expect(
      (await recordScreenshotEvent(allowed.user.id, { method: 'PRINT_SCREEN', path: '/' })).status,
    ).toBe('ALLOWED');
    for (const id of [sa.user.id, allowed.user.id]) {
      const row = await prisma.user.findUniqueOrThrow({ where: { id } });
      expect(row.accessSuspendedAt).toBeNull();
      expect(await prisma.securityEvent.count({ where: { userId: id } })).toBe(0);
    }
    expect(
      (await recordScreenshotEvent('nobody', { method: 'PRINT_SCREEN', path: '/' })).status,
    ).toBe('NOT_FOUND');
  });

  it('rejects a method outside the enum', async () => {
    const s = await student('sg-method');
    await expect(
      recordScreenshotEvent(s.user.id, { method: 'KEYLOG', path: '/' }),
    ).rejects.toThrow();
    await expect(
      recordScreenshotEvent(s.user.id, { method: undefined, path: '/' }),
    ).rejects.toThrow();
    expect(
      (await prisma.user.findUniqueOrThrow({ where: { id: s.user.id } })).accessSuspendedAt,
    ).toBeNull();
  });

  it('has a rate limit per account', async () => {
    const s = await student('sg-rate');
    let limited = false;
    for (let i = 0; i < EVENT_RATE_LIMIT + 2; i++) limited = await eventRateLimited(s.user.id);
    expect(limited).toBe(true);
    expect(await eventRateLimited((await student('sg-rate2')).user.id)).toBe(false);
  });
});

describe('screenshot guard: sign in and restore', () => {
  it('refuses sign in after the right password with the plain message; a wrong password stays generic', async () => {
    const s = await student('sg-login');
    await recordScreenshotEvent(s.user.id, { method: 'PRINT_SCREEN', path: '/' });
    const ok = await authenticate({ email: s.user.email, password: s.password });
    expect(ok).toEqual({ ok: false, code: 'suspended' });
    expect(signInMessage({ ok: false, code: 'suspended' })).toBe(ACC_SUSPENDED);
    expect(ACC_SUSPENDED).toBe(
      'Access suspended. A screenshot attempt was detected. Contact your administrator.',
    );
    const wrong = await authenticate({ email: s.user.email, password: 'definitely-wrong-1' });
    expect(wrong).toEqual({ ok: false, code: 'invalid' });
    expect(
      (await prisma.user.findUniqueOrThrow({ where: { id: s.user.id } })).activeSessionId,
    ).toBeNull();
  });

  it('restore: the student signs in again, the toggle stays, the alert closes, audit is written', async () => {
    const s = await student('sg-restore');
    await recordScreenshotEvent(s.user.id, { method: 'MAC_SHORTCUT', path: '/p/1' });
    await restoreAccess(actor, s.user.id);
    const row = await prisma.user.findUniqueOrThrow({ where: { id: s.user.id } });
    expect(row.accessSuspendedAt).toBeNull();
    expect(row.accessSuspendedMethod).toBeNull();
    expect(row.accessSuspendedPath).toBeNull();
    expect(row.screenshotsAllowed).toBe(false); // the switch remains as it was
    const ev = await prisma.securityEvent.findFirstOrThrow({ where: { userId: s.user.id } });
    expect(ev.restoredAt).toBeInstanceOf(Date);
    expect(ev.restoredById).toBe(actor.id);
    const audit = await prisma.auditLog.findFirstOrThrow({
      where: { targetUserId: s.user.id, action: 'ACCOUNT_RESTORED' },
    });
    expect(audit.actorUserId).toBe(actor.id);
    expect(audit.payload).toEqual({ reason: 'SCREENSHOT_SUSPENSION' });

    const login = await authenticate({ email: s.user.email, password: s.password });
    expect(login.ok).toBe(true);
    // the cookie from before the suspension stays dead
    const old = await resolveSessionUser({
      userId: s.user.id,
      claims: { sv: 0, sid: 'old', loginAt: Math.floor(Date.now() / 1000) },
      now: new Date(),
    });
    expect(old.ok).toBe(false);
    // and a second restore says the account is not suspended
    expect(await code(restoreAccess(actor, s.user.id))).toBe('SEC-001');
  });

  it('keeps the allowed switch when an allowed student is restored (switch untouched)', async () => {
    const s = await student('sg-keep');
    await recordScreenshotEvent(s.user.id, { method: 'PRINT_SCREEN', path: '/' });
    await setScreenshotsAllowed(actor, s.user.id, true);
    await restoreAccess(actor, s.user.id);
    expect(
      (await prisma.user.findUniqueOrThrow({ where: { id: s.user.id } })).screenshotsAllowed,
    ).toBe(true);
  });

  it('only a Super admin can restore or switch', async () => {
    const s = await student('sg-perm');
    const nobody: Actor = { id: s.user.id, role: 'USER' };
    await expect(restoreAccess(nobody, s.user.id)).rejects.toThrow();
    await expect(setScreenshotsAllowed(nobody, s.user.id, true)).rejects.toThrow();
  });
});

describe('screenshot guard: the switch', () => {
  it('allows and disallows with an audit row each, and does nothing when unchanged', async () => {
    const s = await student('sg-switch');
    expect(await setScreenshotsAllowed(actor, s.user.id, true)).toBe(true);
    expect(await setScreenshotsAllowed(actor, s.user.id, true)).toBe(false);
    expect(await setScreenshotsAllowed(actor, s.user.id, false)).toBe(true);
    const actions = (
      await prisma.auditLog.findMany({
        where: { targetUserId: s.user.id },
        orderBy: { createdAt: 'asc' },
      })
    ).map((a) => a.action);
    expect(actions).toEqual(['SCREENSHOTS_ALLOWED', 'SCREENSHOTS_DISALLOWED']);
  });

  it('refuses a Super admin target and a missing id', async () => {
    expect(await code(setScreenshotsAllowed(actor, sa.user.id, true))).toBe('SEC-002');
    expect(await code(setScreenshotsAllowed(actor, 'missing', true))).toBe('ACC-022');
    expect(await code(restoreAccess(actor, sa.user.id))).toBe('SEC-002');
  });

  it('an allowed student who presses the key is not suspended', async () => {
    const s = await student('sg-allow-key');
    await setScreenshotsAllowed(actor, s.user.id, true);
    expect(
      (await recordScreenshotEvent(s.user.id, { method: 'PRINT_SCREEN', path: '/' })).status,
    ).toBe('ALLOWED');
  });
});

describe('screenshot guard: bulk, lists, alerts', () => {
  it('bulk allow, disallow and restore with skipped reasons', async () => {
    const a = await student('sg-bulk-a');
    const b = await student('sg-bulk-b');
    await recordScreenshotEvent(b.user.id, { method: 'PRINT_SCREEN', path: '/' });
    const allow = await bulkSecurity(actor, [a.user.id, b.user.id, a.user.id], 'ALLOW_SCREENSHOTS');
    expect(allow.done.sort()).toEqual([a.user.id, b.user.id].sort());
    const again = await bulkSecurity(actor, [a.user.id], 'ALLOW_SCREENSHOTS');
    expect(again.done).toEqual([a.user.id]); // unchanged still counts as done
    const dis = await bulkSecurity(
      actor,
      [a.user.id, sa.user.id, 'missing'],
      'DISALLOW_SCREENSHOTS',
    );
    expect(dis.done).toEqual([a.user.id]);
    expect(dis.skipped.map((s) => s.code).sort()).toEqual(['ACC-022', 'SEC-002']);
    const restore = await bulkSecurity(actor, [a.user.id, b.user.id], 'RESTORE_ACCESS');
    expect(restore.done).toEqual([b.user.id]);
    expect(restore.skipped).toEqual([expect.objectContaining({ id: a.user.id, code: 'SEC-001' })]);
    const tooMany = Array.from({ length: 101 }, (_, i) => `x${i}`);
    expect(await code(bulkSecurity(actor, tooMany, 'RESTORE_ACCESS'))).toBe('ACC-060');
  });

  it('the accounts list shows the flags and filters suspended accounts', async () => {
    const s = await student('sg-list');
    const other = await student('sg-list-other');
    await recordScreenshotEvent(s.user.id, { method: 'PRINT_SCREEN', path: '/' });
    const only = await listAccounts(actor, { suspended: true, search: 'sg-list' });
    expect(only.rows.map((r) => r.id)).toEqual([s.user.id]);
    expect(only.rows[0]).toMatchObject({ suspended: true, screenshotsAllowed: false });
    const not = await listAccounts(actor, { suspended: false, search: 'sg-list' });
    expect(not.rows.map((r) => r.id)).toEqual([other.user.id]);
    const detail = await getAccount(actor, s.user.id);
    expect(detail.account.accessSuspendedMethod).toBe('PRINT_SCREEN');
  });

  it('summary, event list and the unread badge', async () => {
    await prisma.securityEvent.deleteMany({});
    await prisma.user.updateMany({
      where: { id: { in: userIds } },
      data: { accessSuspendedAt: null },
    });
    const s = await student('sg-summary');
    await recordScreenshotEvent(s.user.id, { method: 'WIN_SHIFT_S', path: '/p/9' });
    const sum = await securitySummary(actor);
    expect(sum.open).toBe(1);
    expect(sum.unread).toBe(1);
    expect(sum.latest).toMatchObject({ userName: s.user.name, method: 'WIN_SHIFT_S' });
    const list = await listSecurityEvents(actor);
    expect(list.rows[0]).toMatchObject({
      userId: s.user.id,
      status: 'OPEN',
      path: '/p/9',
      unread: true,
      restoredByName: null,
    });
    await markSecurityEventsSeen(actor);
    expect((await securitySummary(actor)).unread).toBe(0);
    await restoreAccess(actor, s.user.id);
    const after = await listSecurityEvents(actor);
    expect(after.rows[0]).toMatchObject({
      status: 'RESTORED',
      restoredByName: sa.user.name,
      unread: false,
    });
    expect(await securitySummary(actor)).toMatchObject({ open: 0, latest: null });
    expect(await code(securitySummary({ id: s.user.id, role: 'USER' }))).toBe('FORBIDDEN');
  });
});
