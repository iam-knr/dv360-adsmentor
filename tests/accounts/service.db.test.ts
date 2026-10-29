import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { purgeOldAudit } from '@/lib/accounts/audit';
import type { Actor } from '@/lib/accounts/permissions';
import { AccountError } from '@/lib/accounts/rules';
import {
  bulkAccounts,
  createAccount,
  createCohort,
  deleteAccount,
  getAccount,
  listAccounts,
  listAudit,
  listCohorts,
  resetPassword,
  restoreAccount,
  revokeSessions,
  setAccountStatus,
  unlockAccount,
} from '@/lib/accounts/service';
import { generatePassword, verifyPassword } from '@/lib/auth/argon';
import { prisma } from '@/lib/db';
import {
  cleanup,
  createAccount as fixture,
  createClassroom,
  createStudent,
  uniq,
} from '../auth/fixtures';

const userIds: string[] = [];
const classroomIds: string[] = [];
let saved: string[] = [];

let superA: Actor;
let adminA: Actor;
let adminB: Actor;
let cohortA: string;
let cohortB: string;

const asAdmin = (id: string): Actor => ({ id, role: 'ADMIN' });
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
  saved = (
    await prisma.user.findMany({ where: { appRole: 'SUPER_ADMIN' }, select: { id: true } })
  ).map((u) => u.id);
  await prisma.user.updateMany({ where: { id: { in: saved } }, data: { status: 'DISABLED' } });
  const s = await fixture(prisma, { tag: 'sa', role: 'SUPER_ADMIN' });
  const a = await fixture(prisma, { tag: 'ada', role: 'ADMIN' });
  const b = await fixture(prisma, { tag: 'adb', role: 'ADMIN' });
  userIds.push(s.user.id, a.user.id, b.user.id);
  superA = { id: s.user.id, role: 'SUPER_ADMIN' };
  adminA = asAdmin(a.user.id);
  adminB = asAdmin(b.user.id);
  const ca = await createClassroom(prisma, { tag: 'ca', ownerAdminId: a.user.id });
  const cb = await createClassroom(prisma, { tag: 'cb', ownerAdminId: b.user.id });
  cohortA = ca.id;
  cohortB = cb.id;
  classroomIds.push(ca.id, cb.id);
});

afterAll(async () => {
  const created = await prisma.user.findMany({
    where: { email: { endsWith: '@acc.example.test' } },
    select: { id: true },
  });
  const all = [...userIds, ...created.map((u) => u.id)];
  await prisma.classroomMember.deleteMany({
    where: { OR: [{ userId: { in: all } }, { classroomId: { in: classroomIds } }] },
  });
  const made = await prisma.classroom.findMany({
    where: { ownerAdminId: { in: all } },
    select: { id: true },
  });
  await cleanup(prisma, {
    classroomIds: [...classroomIds, ...made.map((c) => c.id)],
    userIds: all,
  });
  await prisma.user.updateMany({ where: { id: { in: saved } }, data: { status: 'ACTIVE' } });
});

const newUser = async (
  actor: Actor,
  cohortId: string,
  tag: string,
  mode: 'GENERATE' | 'SET' = 'GENERATE',
) => {
  const email = `${uniq(tag)}@acc.example.test`;
  const pw = generatePassword();
  const r = await createAccount(actor, {
    email,
    name: `User ${tag}`,
    role: 'USER',
    cohortId,
    password: mode === 'GENERATE' ? { mode: 'GENERATE' } : { mode: 'SET', value: pw },
  });
  return { ...r, typed: pw };
};

describe('create (M19-AC1 to AC3, AC10, AC11)', () => {
  it('Super admin creates an Admin; Admin creates a User; generated password is shown once and stored hashed', async () => {
    const email = `${uniq('newadmin')}@acc.example.test`;
    const admin = await createAccount(superA, {
      email,
      name: 'New Admin',
      role: 'ADMIN',
      password: { mode: 'GENERATE' },
    });
    expect(admin.initialPassword).toHaveLength(16);
    const row = await prisma.user.findUniqueOrThrow({ where: { id: admin.id } });
    expect(row.appRole).toBe('ADMIN');
    expect(row.mustChangePassword).toBe(true);
    expect(row.passwordHash).not.toContain(admin.initialPassword!);
    expect(await verifyPassword(row.passwordHash!, admin.initialPassword!)).toBe(true);

    const u = await newUser(adminA, cohortA, 'u1');
    expect(u.initialPassword).toBeTruthy();
    const urow = await prisma.user.findUniqueOrThrow({ where: { id: u.id } });
    expect(urow.ownerAdminId).toBe(adminA.id);
    expect(urow.cohortId).toBe(cohortA);
  });

  it('typed password is not returned and weak passwords are refused', async () => {
    const ok = await newUser(adminA, cohortA, 'typed', 'SET');
    expect(ok.initialPassword).toBeUndefined();
    const email = `${uniq('weak')}@acc.example.test`;
    const c = await code(
      createAccount(adminA, {
        email,
        name: 'Weak',
        role: 'USER',
        cohortId: cohortA,
        password: { mode: 'SET', value: 'password1' },
      }),
    );
    expect(c).toMatch(/^ACC-01[012]$/);
  });

  it('forged request: Admin cannot create Admin or Super admin; refused and audited as Denied', async () => {
    for (const role of ['ADMIN', 'SUPER_ADMIN'] as const) {
      const email = `${uniq('forged')}@acc.example.test`;
      expect(
        await code(
          createAccount(adminA, { email, name: 'X', role, password: { mode: 'GENERATE' } }),
        ),
      ).toBe('ACC-020');
      expect(await prisma.user.findUnique({ where: { email } })).toBeNull();
    }
    const denied = await prisma.auditLog.findMany({
      where: { actorUserId: adminA.id, action: 'AUTHZ_DENIED', result: 'DENIED' },
    });
    expect(denied.length).toBeGreaterThanOrEqual(2);
  });

  it('a User needs a cohort in scope; capacity and duplicates are enforced', async () => {
    const mk = (cohortId?: string, email = `${uniq('c')}@acc.example.test`) =>
      createAccount(adminA, {
        email,
        name: 'N',
        role: 'USER',
        cohortId,
        password: { mode: 'GENERATE' },
      });
    expect(await code(mk(undefined))).toBe('ACC-030');
    expect(await code(mk(cohortB))).toBe('ACC-031'); // another admin's cohort
    const dup = `${uniq('dup')}@acc.example.test`;
    await mk(cohortA, dup);
    expect(await code(mk(cohortA, dup.toUpperCase()))).toBe('ACC-002');
    const small = await createClassroom(prisma, {
      tag: 'small',
      ownerAdminId: adminA.id,
      capacity: 1,
    });
    classroomIds.push(small.id);
    await mk(small.id);
    expect(await code(mk(small.id))).toBe('ACC-032');
  });
});

describe('scope (M19-AC4, ACC-022)', () => {
  it('an Admin lists and opens only their own users; other ids look missing', async () => {
    const mine = await fixture(prisma, {
      tag: 'mine',
      role: 'USER',
      cohortId: cohortA,
      ownerAdminId: adminA.id,
    });
    const theirs = await fixture(prisma, {
      tag: 'theirs',
      role: 'USER',
      cohortId: cohortB,
      ownerAdminId: adminB.id,
    });
    userIds.push(mine.user.id, theirs.user.id);
    const { rows } = await listAccounts(adminA, { pageSize: 100 });
    const ids = rows.map((r) => r.id);
    expect(ids).toContain(mine.user.id);
    expect(ids).not.toContain(theirs.user.id);
    expect(ids).not.toContain(superA.id);
    expect(await code(getAccount(adminA, theirs.user.id))).toBe('ACC-022');
    expect(await code(getAccount(adminA, 'does-not-exist'))).toBe('ACC-022');
    expect(await code(setAccountStatus(adminA, theirs.user.id, 'disable'))).toBe('ACC-022');
    const all = (await listAccounts(superA, { pageSize: 100, search: 'theirs' })).rows.map(
      (r) => r.id,
    );
    expect(all).toContain(theirs.user.id);
  });

  it('cohort scope and search', async () => {
    expect((await listCohorts(adminA)).map((c) => c.id)).toContain(cohortA);
    expect((await listCohorts(adminA)).map((c) => c.id)).not.toContain(cohortB);
    const hit = await listAccounts(superA, { search: 'MINE' });
    expect(hit.rows.some((r) => r.name.toLowerCase().includes('mine'))).toBe(true);
  });
});

describe('status (M19-AC7, AC8, AC9, AC15)', () => {
  it('disable ends sessions, freezes the sandbox with reason ACCOUNT; enable thaws it when the class is open', async () => {
    const st = await createStudent(prisma, {
      tag: 'dis',
      classroomId: cohortA,
      ownerAdminId: adminA.id,
    });
    userIds.push(st.user.id);
    const before = (await prisma.user.findUniqueOrThrow({ where: { id: st.user.id } }))
      .sessionVersion;
    await setAccountStatus(adminA, st.user.id, 'disable');
    const u = await prisma.user.findUniqueOrThrow({ where: { id: st.user.id } });
    expect(u.status).toBe('DISABLED');
    expect(u.sessionVersion).toBe(before + 1);
    const sb = await prisma.sandbox.findUniqueOrThrow({ where: { id: st.sandbox.id } });
    expect(sb.status).toBe('FROZEN');
    expect(sb.frozenReason).toBe('ACCOUNT');
    expect((await prisma.simClock.findUniqueOrThrow({ where: { sandboxId: sb.id } })).state).toBe(
      'PAUSED',
    );

    await setAccountStatus(adminA, st.user.id, 'enable');
    expect((await prisma.user.findUniqueOrThrow({ where: { id: st.user.id } })).status).toBe(
      'ACTIVE',
    );
    const back = await prisma.sandbox.findUniqueOrThrow({ where: { id: st.sandbox.id } });
    expect(back.status).toBe('ACTIVE'); // createClassroom default window is open
    expect(back.frozenReason).toBeNull();
  });

  it('no self harm and Admin cannot disable another Admin', async () => {
    expect(await code(setAccountStatus(adminA, adminA.id, 'disable'))).toBe('ACC-023');
    expect(await code(setAccountStatus(superA, superA.id, 'disable'))).toBe('ACC-023');
    expect(await code(setAccountStatus(adminA, adminB.id, 'disable'))).toBe('ACC-022');
  });

  it('last active Super admin is protected, including under concurrency', async () => {
    const other = await fixture(prisma, { tag: 'sa2', role: 'SUPER_ADMIN' });
    userIds.push(other.user.id);
    const otherActor: Actor = { id: other.user.id, role: 'SUPER_ADMIN' };
    // Two Super admins disable each other at once: exactly one may win.
    const results = await Promise.allSettled([
      setAccountStatus(superA, otherActor.id, 'disable'),
      setAccountStatus(otherActor, superA.id, 'disable'),
    ]);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    const rejected = results.find((r) => r.status === 'rejected') as PromiseRejectedResult;
    expect((rejected.reason as AccountError).code).toBe('ACC-024');
    const active = await prisma.user.count({
      where: { appRole: 'SUPER_ADMIN', status: 'ACTIVE', id: { in: [superA.id, otherActor.id] } },
    });
    expect(active).toBe(1);
    await prisma.user.updateMany({
      where: { id: { in: [superA.id, otherActor.id] } },
      data: { status: 'ACTIVE' },
    });
  });

  it('unlock and sign out everywhere', async () => {
    const locked = await fixture(prisma, {
      tag: 'lk',
      role: 'USER',
      cohortId: cohortA,
      ownerAdminId: adminA.id,
      status: 'LOCKED',
    });
    userIds.push(locked.user.id);
    await prisma.user.update({
      where: { id: locked.user.id },
      data: { lockedUntil: new Date(Date.now() + 600_000), failedLoginCount: 5 },
    });
    await unlockAccount(adminA, locked.user.id);
    const u = await prisma.user.findUniqueOrThrow({ where: { id: locked.user.id } });
    expect([u.status, u.failedLoginCount, u.lockedUntil]).toEqual(['ACTIVE', 0, null]);
    await revokeSessions(adminA, locked.user.id);
    expect(
      (await prisma.user.findUniqueOrThrow({ where: { id: locked.user.id } })).sessionVersion,
    ).toBe(u.sessionVersion + 1);
  });
});

describe('reset password (M19-AC13) and plaintext (M19-AC26)', () => {
  it('returns the new secret once, ends sessions, forces a change, clears the lock', async () => {
    const st = await fixture(prisma, {
      tag: 'rp',
      role: 'USER',
      cohortId: cohortA,
      ownerAdminId: adminA.id,
      status: 'LOCKED',
      mustChangePassword: false,
    });
    userIds.push(st.user.id);
    const r = await resetPassword(adminA, st.user.id, { password: { mode: 'GENERATE' } });
    expect(r.newPassword).toHaveLength(16);
    const u = await prisma.user.findUniqueOrThrow({ where: { id: st.user.id } });
    expect(u.mustChangePassword).toBe(true);
    expect(u.status).toBe('ACTIVE');
    expect(u.sessionVersion).toBeGreaterThan(0);
    expect(await verifyPassword(u.passwordHash!, r.newPassword!)).toBe(true);
    expect(await verifyPassword(u.passwordHash!, st.password)).toBe(false);

    // Nothing in the audit log, the database row or the payload holds the plaintext.
    const audit = await prisma.auditLog.findMany({ where: { targetUserId: st.user.id } });
    expect(JSON.stringify(audit)).not.toContain(r.newPassword!);
    expect(JSON.stringify(u)).not.toContain(r.newPassword!);
  });

  it('Admin cannot reset an Admin; nobody resets another Super admin', async () => {
    expect(await code(resetPassword(adminA, adminB.id, { password: { mode: 'GENERATE' } }))).toBe(
      'ACC-022',
    );
    const other = await fixture(prisma, { tag: 'sa3', role: 'SUPER_ADMIN' });
    userIds.push(other.user.id);
    expect(
      await code(resetPassword(superA, other.user.id, { password: { mode: 'GENERATE' } })),
    ).toBe('FORBIDDEN');
  });
});

describe('delete and restore (M19-AC8, AC9)', () => {
  it('archives a User with typed DELETE, archives the sandbox, and restores to Disabled', async () => {
    const st = await createStudent(prisma, {
      tag: 'del',
      classroomId: cohortA,
      ownerAdminId: adminA.id,
    });
    userIds.push(st.user.id);
    expect(await code(deleteAccount(adminA, st.user.id, { confirm: 'delete' }))).toBe('ACC-061');
    await deleteAccount(adminA, st.user.id, { confirm: 'DELETE' });
    const u = await prisma.user.findUniqueOrThrow({ where: { id: st.user.id } });
    expect([u.status, !!u.archivedAt]).toEqual(['ARCHIVED', true]);
    expect((await prisma.sandbox.findUniqueOrThrow({ where: { id: st.sandbox.id } })).status).toBe(
      'ARCHIVED',
    );
    // archived rows are hidden by default
    expect((await listAccounts(adminA, { pageSize: 100 })).rows.map((r) => r.id)).not.toContain(
      st.user.id,
    );
    expect(
      (await listAccounts(adminA, { pageSize: 100, status: ['ARCHIVED'] })).rows.map((r) => r.id),
    ).toContain(st.user.id);
    await restoreAccount(adminA, st.user.id);
    expect((await prisma.user.findUniqueOrThrow({ where: { id: st.user.id } })).status).toBe(
      'DISABLED',
    );
  });

  it('Super admin accounts cannot be deleted; an Admin who owns users needs transferTo', async () => {
    const sa = await fixture(prisma, { tag: 'sa4', role: 'SUPER_ADMIN' });
    userIds.push(sa.user.id);
    expect(await code(deleteAccount(superA, sa.user.id, { confirm: 'DELETE' }))).toBe('ACC-026');
    expect(await code(deleteAccount(superA, superA.id, { confirm: 'DELETE' }))).toBe('ACC-023');

    const owner = await fixture(prisma, { tag: 'own', role: 'ADMIN' });
    userIds.push(owner.user.id);
    const oc = await createCohort(
      { id: owner.user.id, role: 'ADMIN' },
      { name: `Own ${uniq('c')}` },
    );
    expect(await code(deleteAccount(superA, owner.user.id, { confirm: 'DELETE' }))).toBe('ACC-025');
    await deleteAccount(superA, owner.user.id, { confirm: 'DELETE', transferTo: adminA.id });
    expect((await prisma.classroom.findUniqueOrThrow({ where: { id: oc.id } })).ownerAdminId).toBe(
      adminA.id,
    );
    expect((await prisma.user.findUniqueOrThrow({ where: { id: owner.user.id } })).status).toBe(
      'ARCHIVED',
    );
  });
});

describe('bulk (M19-AC19 to AC21)', () => {
  it('disables with skipped rows reported, resets with secrets, deletes only with DELETE, caps at 100', async () => {
    const a = await fixture(prisma, {
      tag: 'b1',
      role: 'USER',
      cohortId: cohortA,
      ownerAdminId: adminA.id,
    });
    const b = await fixture(prisma, {
      tag: 'b2',
      role: 'USER',
      cohortId: cohortA,
      ownerAdminId: adminA.id,
    });
    const foreign = await fixture(prisma, {
      tag: 'b3',
      role: 'USER',
      cohortId: cohortB,
      ownerAdminId: adminB.id,
    });
    userIds.push(a.user.id, b.user.id, foreign.user.id);

    const res = await bulkAccounts(adminA, [a.user.id, b.user.id, foreign.user.id], {
      type: 'DISABLE',
    });
    expect(res.done).toEqual([a.user.id, b.user.id]);
    expect(res.skipped).toEqual([
      { id: foreign.user.id, code: 'ACC-022', message: 'Account not found.' },
    ]);

    const en = await bulkAccounts(adminA, [a.user.id, b.user.id], { type: 'ENABLE' });
    expect(en.done).toHaveLength(2);

    const rp = await bulkAccounts(adminA, [a.user.id, b.user.id], {
      type: 'RESET_PASSWORD',
      mode: 'GENERATE',
    });
    expect(rp.secrets.map((s) => s.id).sort()).toEqual([a.user.id, b.user.id].sort());

    expect(await code(bulkAccounts(adminA, [a.user.id], { type: 'DELETE', confirm: 'nope' }))).toBe(
      'ACC-061',
    );
    expect(
      await code(
        bulkAccounts(
          adminA,
          Array.from({ length: 101 }, (_, i) => `id${i}`),
          { type: 'DISABLE' },
        ),
      ),
    ).toBe('ACC-060');
    expect(
      await code(
        bulkAccounts(
          adminA,
          Array.from({ length: 26 }, (_, i) => `id${i}`),
          { type: 'RESET_PASSWORD', mode: { set: 'x' } },
        ),
      ),
    ).toBe('ACC-063');
  });
});

describe('cohorts and audit', () => {
  it('Admin creates own cohort; names are unique per owner; capacity above 25 needs a Super admin', async () => {
    const name = `Batch ${uniq('n')}`;
    const c = await createCohort(adminA, { name });
    classroomIds.push(c.id);
    expect(await code(createCohort(adminA, { name }))).toBe('ACC-033B');
    expect(await code(createCohort(adminA, { name: `${name}2`, capacity: 40 }))).toBe('ACC-034');
    const big = await createCohort(superA, {
      name: `${name}3`,
      capacity: 40,
      ownerAdminId: adminB.id,
    });
    classroomIds.push(big.id);
    expect((await prisma.classroom.findUniqueOrThrow({ where: { id: big.id } })).ownerAdminId).toBe(
      adminB.id,
    );
  });

  it('audit is scoped: an Admin sees own actions and own users, never another Admin', async () => {
    const mine = await listAudit(adminA);
    expect(mine.length).toBeGreaterThan(0);
    for (const r of mine) {
      const ok =
        r.actorUserId === adminA.id ||
        (r.targetUserId &&
          (await prisma.user.findUnique({ where: { id: r.targetUserId } }))?.ownerAdminId ===
            adminA.id);
      expect(ok).toBeTruthy();
    }
    const all = await listAudit(superA, prisma, 500);
    expect(all.length).toBeGreaterThanOrEqual(mine.length);
  });

  it('every audit payload is free of secrets', async () => {
    const rows = await prisma.auditLog.findMany({
      where: { actorUserId: { in: [superA.id, adminA.id] } },
    });
    for (const r of rows)
      expect(JSON.stringify(r.payload ?? {})).not.toMatch(/\$argon2|password"|passwordHash|token/);
  });

  it('retention deletes rows older than 365 days', async () => {
    const old = await prisma.auditLog.create({
      data: {
        action: 'ACCOUNT_UPDATED',
        targetType: 'User',
        createdAt: new Date(Date.now() - 400 * 86400_000),
      },
    });
    const n = await purgeOldAudit(new Date(), prisma);
    expect(n).toBeGreaterThanOrEqual(1);
    expect(await prisma.auditLog.findUnique({ where: { id: old.id } })).toBeNull();
  });
});
