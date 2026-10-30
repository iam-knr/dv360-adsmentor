import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { resolveClassContext } from '@/lib/access/class-context';
import { DEFAULT_POLICY } from '@/lib/auth/policy';
import { resolveSessionUser, TOUCH_INTERVAL_MS } from '@/lib/auth/session-core';
import { canViewAs } from '@/lib/auth/view-as';
import { prisma, withSandbox } from '@/lib/db';
import { can } from '@/lib/rbac/can';
import { cleanup, createAccount, createClassroom, createStudent } from './fixtures';

const userIds: string[] = [];
const classroomIds: string[] = [];
const NOW = new Date('2026-11-02T05:00:00Z');
const claimsFor = (
  u: { sessionVersion: number; activeSessionId: string | null },
  loginAt = NOW,
) => ({
  sv: u.sessionVersion,
  sid: u.activeSessionId ?? 'none',
  loginAt: Math.floor(loginAt.getTime() / 1000),
});

let retired: Awaited<ReturnType<typeof createAccount>>;
let superAdmin: Awaited<ReturnType<typeof createAccount>>;
let cls: Awaited<ReturnType<typeof createClassroom>>;
let student: Awaited<ReturnType<typeof createStudent>>;

async function fresh(id: string) {
  return prisma.user.findUniqueOrThrow({ where: { id } });
}
async function signedIn(id: string, sid = 'sid-1') {
  return prisma.user.update({ where: { id }, data: { activeSessionId: sid, lastSeenAt: NOW } });
}

beforeAll(async () => {
  // a row of the retired ADMIN level, as old data may still hold one
  retired = await createAccount(prisma, { tag: 'sc-retired', role: 'ADMIN' });
  superAdmin = await createAccount(prisma, { tag: 'sc-super', role: 'SUPER_ADMIN' });
  userIds.push(retired.user.id, superAdmin.user.id);
  cls = await createClassroom(prisma, { tag: 'sc', ownerAdminId: superAdmin.user.id, now: NOW });
  classroomIds.push(cls.id);
  student = await createStudent(prisma, {
    tag: 'sc-stu',
    classroomId: cls.id,
  });
  userIds.push(student.user.id);
  await signedIn(student.user.id);
  await signedIn(superAdmin.user.id);
});
afterAll(() => cleanup(prisma, { userIds, classroomIds }));

describe('requireUser checks (M19-14)', () => {
  it('accepts a valid session and builds the session user', async () => {
    const u = await fresh(student.user.id);
    const r = await resolveSessionUser({ userId: u.id, claims: claimsFor(u), now: NOW });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.user).toMatchObject({
      id: u.id,
      email: u.email,
      appRole: 'user',
      dvRole: 'STANDARD',
      classroomId: cls.id,
      sandboxId: student.sandbox.id,
      timeZone: 'Asia/Kolkata',
    });
    expect(r.user.actor).toMatchObject({ id: u.id, appRole: 'user' });
    expect(r.user.viewAs).toBeUndefined();
  });

  it('a sessionVersion bump ends every older session (M18-AC3)', async () => {
    const u = await fresh(student.user.id);
    const claims = claimsFor(u);
    await prisma.user.update({ where: { id: u.id }, data: { sessionVersion: { increment: 1 } } });
    expect(await resolveSessionUser({ userId: u.id, claims, now: NOW })).toEqual({
      ok: false,
      reason: 'revoked',
    });
    const after = await fresh(u.id);
    expect(
      (await resolveSessionUser({ userId: u.id, claims: claimsFor(after), now: NOW })).ok,
    ).toBe(true);
  });

  it.each(['DISABLED', 'ARCHIVED'] as const)(
    '%s ends the session on the next request',
    async (status) => {
      const u = await fresh(student.user.id);
      await prisma.user.update({ where: { id: u.id }, data: { status } });
      expect(await resolveSessionUser({ userId: u.id, claims: claimsFor(u), now: NOW })).toEqual({
        ok: false,
        reason: 'revoked',
      });
      await prisma.user.update({ where: { id: u.id }, data: { status: 'ACTIVE' } });
    },
  );

  it('a deleted user has no session', async () => {
    expect(
      await resolveSessionUser({
        userId: 'gone',
        claims: { sv: 0, sid: 'x', loginAt: 1 },
        now: NOW,
      }),
    ).toEqual({
      ok: false,
      reason: 'revoked',
    });
  });

  it('another sign in replaces the session for single session accounts (ACC-074)', async () => {
    const u = await fresh(student.user.id);
    const claims = claimsFor(u);
    await prisma.user.update({ where: { id: u.id }, data: { activeSessionId: 'sid-2' } });
    expect(await resolveSessionUser({ userId: u.id, claims, now: NOW })).toEqual({
      ok: false,
      reason: 'other-device',
    });
    await prisma.user.update({ where: { id: u.id }, data: { activeSessionId: 'sid-1' } });
  });

  it('applies idle and absolute limits from AccountPolicy', async () => {
    const u = await fresh(student.user.id);
    const claims = claimsFor(u);
    await prisma.user.update({ where: { id: u.id }, data: { lastSeenAt: NOW } });
    const sevenHours = new Date(NOW.getTime() + 7 * 3_600_000);
    expect((await resolveSessionUser({ userId: u.id, claims, now: sevenHours })).ok).toBe(true);
    await prisma.user.update({ where: { id: u.id }, data: { lastSeenAt: NOW } }); // the call above counted as activity
    const nineHours = new Date(NOW.getTime() + 9 * 3_600_000);
    expect(await resolveSessionUser({ userId: u.id, claims, now: nineHours })).toEqual({
      ok: false,
      reason: 'idle',
    });

    await prisma.user.update({
      where: { id: u.id },
      data: { lastSeenAt: new Date(NOW.getTime() + 11.9 * 3_600_000) },
    });
    const thirteenHours = new Date(NOW.getTime() + 13 * 3_600_000);
    expect(await resolveSessionUser({ userId: u.id, claims, now: thirteenHours })).toEqual({
      ok: false,
      reason: 'absolute',
    });

    await prisma.accountPolicy.update({ where: { id: 1 }, data: { idleMinutesUser: 30 } });
    await prisma.user.update({ where: { id: u.id }, data: { lastSeenAt: NOW } });
    const { invalidatePolicyCache } = await import('@/lib/auth/policy');
    invalidatePolicyCache();
    expect(
      await resolveSessionUser({
        userId: u.id,
        claims,
        now: new Date(NOW.getTime() + 31 * 60_000),
      }),
    ).toEqual({ ok: false, reason: 'idle' });
    await prisma.accountPolicy.update({
      where: { id: 1 },
      data: { idleMinutesUser: DEFAULT_POLICY.idleMinutesUser },
    });
    invalidatePolicyCache();
  });

  it('writes lastSeenAt at most every five minutes', async () => {
    const u = await fresh(student.user.id);
    await prisma.user.update({ where: { id: u.id }, data: { lastSeenAt: NOW } });
    await resolveSessionUser({
      userId: u.id,
      claims: claimsFor(u),
      now: new Date(NOW.getTime() + 60_000),
    });
    expect((await fresh(u.id)).lastSeenAt?.toISOString()).toBe(NOW.toISOString());
    const later = new Date(NOW.getTime() + TOUCH_INTERVAL_MS + 1000);
    await resolveSessionUser({ userId: u.id, claims: claimsFor(u), now: later });
    expect((await fresh(u.id)).lastSeenAt?.toISOString()).toBe(later.toISOString());
    await prisma.user.update({ where: { id: u.id }, data: { lastSeenAt: NOW } });
  });

  it('takes the DV360 level from a scenario override on the sandbox partner', async () => {
    const partner = await prisma.partner.create({
      data: { sandboxId: student.sandbox.id, name: 'P' },
    });
    const u = await fresh(student.user.id);
    const r1 = await resolveSessionUser({ userId: u.id, claims: claimsFor(u), now: NOW });
    expect(r1.ok && r1.user.partnerId).toBe(partner.id);
    expect(r1.ok && r1.user.dvRole).toBe('STANDARD');
    await prisma.userAccessGrant.create({
      data: {
        userId: u.id,
        sandboxId: student.sandbox.id,
        partnerId: partner.id,
        role: 'READ_ONLY',
      },
    });
    const r2 = await resolveSessionUser({ userId: u.id, claims: claimsFor(u), now: NOW });
    expect(r2.ok && r2.user.dvRole).toBe('READ_ONLY');
    await prisma.userAccessGrant.deleteMany({ where: { userId: u.id } });
  });

  it('the Super admin is DV360 ADMIN with no sandbox of their own', async () => {
    const a = await fresh(superAdmin.user.id);
    const r = await resolveSessionUser({ userId: a.id, claims: claimsFor(a), now: NOW });
    expect(r.ok && r.user).toMatchObject({ appRole: 'super_admin', dvRole: 'ADMIN' });
  });

  it('the retired ADMIN level has no session at all', async () => {
    await signedIn(retired.user.id);
    const a = await fresh(retired.user.id);
    const r = await resolveSessionUser({ userId: a.id, claims: claimsFor(a), now: NOW });
    expect(r.ok).toBe(false);
  });

  it('a student with a sandbox that is still being built has no sandbox context yet', async () => {
    const st = await createStudent(prisma, { tag: 'sc-build', classroomId: cls.id });
    userIds.push(st.user.id);
    await prisma.sandbox.update({ where: { id: st.sandbox.id }, data: { provisionState: 'SEEDING' } });
    await signedIn(st.user.id);
    const u = await fresh(st.user.id);
    const r = await resolveSessionUser({ userId: u.id, claims: claimsFor(u), now: NOW });
    expect(r.ok && r.user).toMatchObject({ classroomId: cls.id });
    expect(r.ok && r.user.sandboxId).toBeUndefined();
    await prisma.sandbox.update({ where: { id: st.sandbox.id }, data: { provisionState: 'READY' } });
    const r2 = await resolveSessionUser({ userId: u.id, claims: claimsFor(u), now: NOW });
    expect(r2.ok && r2.user.sandboxId).toBe(st.sandbox.id);
  });
});

describe('view-as (M18-AC13)', () => {
  it('lets the Super admin view a student, read only', async () => {
    const a = await fresh(superAdmin.user.id);
    const r = await resolveSessionUser({
      userId: a.id,
      claims: claimsFor(a),
      now: NOW,
      viewAs: { userId: student.user.id, actAs: false },
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.user).toMatchObject({
      id: student.user.id,
      appRole: 'user',
      sandboxId: student.sandbox.id,
      viewAs: { userId: student.user.id, actAs: false },
      actor: { id: a.id, appRole: 'super_admin' },
    });
    expect(can(r.user, 'view')).toBe(true);
    expect(can(r.user, 'write')).toBe(false);
  });

  it('allows writes once "Act as student" is on, and keeps the Super admin as the actor', async () => {
    const a = await fresh(superAdmin.user.id);
    const r = await resolveSessionUser({
      userId: a.id,
      claims: claimsFor(a),
      now: NOW,
      viewAs: { userId: student.user.id, actAs: true },
    });
    expect(r.ok && can(r.user, 'write')).toBe(true);
    expect(r.ok && r.user.actor?.id).toBe(a.id);
  });

  it('ignores view-as for a student', async () => {
    const s = await fresh(student.user.id);
    const rs = await resolveSessionUser({
      userId: s.id,
      claims: claimsFor(s),
      now: NOW,
      viewAs: { userId: superAdmin.user.id, actAs: true },
    });
    expect(rs.ok && rs.user.viewAs).toBeUndefined();
    expect(rs.ok && rs.user.id).toBe(s.id);
  });

  it('only a Super admin may view a student, never another Super admin or themselves', async () => {
    expect(
      await canViewAs({ id: superAdmin.user.id, appRole: 'super_admin' }, student.user.id),
    ).toBe(true);
    expect(
      await canViewAs({ id: superAdmin.user.id, appRole: 'super_admin' }, retired.user.id),
    ).toBe(false);
    expect(
      await canViewAs({ id: superAdmin.user.id, appRole: 'super_admin' }, superAdmin.user.id),
    ).toBe(false);
    expect(await canViewAs({ id: student.user.id, appRole: 'user' }, student.user.id)).toBe(false);
    expect(await canViewAs({ id: student.user.id, appRole: 'user' }, superAdmin.user.id)).toBe(
      false,
    );
    expect(await canViewAs({ id: superAdmin.user.id, appRole: 'super_admin' }, 'nobody')).toBe(
      false,
    );
  });
});

describe('sandbox resolution (no class windows)', () => {
  it('finds the sandbox by its owner, whatever cohort the student is in', async () => {
    const other = await createClassroom(prisma, { tag: 'sc2', ownerAdminId: superAdmin.user.id });
    classroomIds.push(other.id);
    const st = await createStudent(prisma, { tag: 'sc-move', classroomId: cls.id });
    userIds.push(st.user.id);
    await prisma.user.update({ where: { id: st.user.id }, data: { cohortId: other.id } });
    expect(await resolveClassContext(st.user.id)).toMatchObject({
      classroomId: cls.id,
      sandboxId: st.sandbox.id,
    });
  });

  it('a student without a sandbox gets their cohort, a person in no cohort none', async () => {
    const { user } = await createAccount(prisma, { tag: 'sc-nosb', role: 'USER', cohortId: cls.id });
    userIds.push(user.id);
    expect(await resolveClassContext(user.id)).toEqual({
      classroomId: cls.id,
      timeZone: 'Asia/Kolkata',
    });
    expect(await resolveClassContext(superAdmin.user.id)).toEqual({ classroomId: null });
  });
});

describe('RLS still isolates sandboxes for a student session (M18-AC25)', () => {
  it('a student sandbox transaction sees only its own partner, even when asking for another by id', async () => {
    const other = await createStudent(prisma, { tag: 'sc-other', classroomId: cls.id });
    userIds.push(other.user.id);
    const mine = await prisma.partner.findFirstOrThrow({
      where: { sandboxId: student.sandbox.id },
    });
    const theirs = await prisma.partner.create({
      data: { sandboxId: other.sandbox.id, name: 'Theirs' },
    });

    const seen = await withSandbox(student.sandbox.id, (tx) =>
      tx.partner.findMany({ select: { id: true } }),
    );
    expect(seen.map((p) => p.id)).toEqual([mine.id]);
    const byId = await withSandbox(student.sandbox.id, (tx) =>
      tx.partner.findUnique({ where: { id: theirs.id } }),
    );
    expect(byId).toBeNull();
    const write = await withSandbox(student.sandbox.id, (tx) =>
      tx.partner.updateMany({ where: { id: theirs.id }, data: { name: 'hijacked' } }),
    );
    expect(write.count).toBe(0);
    expect((await prisma.partner.findUniqueOrThrow({ where: { id: theirs.id } })).name).toBe(
      'Theirs',
    );
  });

  it('account tables are not reachable from a sandbox transaction', async () => {
    await expect(
      withSandbox(student.sandbox.id, (tx) => tx.user.findMany({ select: { id: true } })),
    ).rejects.toThrow();
  });
});
