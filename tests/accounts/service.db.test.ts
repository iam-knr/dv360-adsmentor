import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { purgeOldAudit } from '@/lib/accounts/audit';
import type { Actor } from '@/lib/accounts/permissions';
import { AccountError } from '@/lib/accounts/rules';
import {
  bulkAccounts,
  createAccount,
  archiveCohort,
  auditSummary,
  createCohort,
  deleteAccount,
  DEFAULT_COHORT_CODE,
  getAccount,
  getCohort,
  listAccounts,
  listAudit,
  listCohorts,
  resetPassword,
  restoreAccount,
  revokeSessions,
  setAccountStatus,
  unlockAccount,
  updateCohort,
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
let retired: Actor;
let cohortA: string;

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
  // a row of the retired level, as old data may still hold one
  const a = await fixture(prisma, { tag: 'ret', role: 'ADMIN' });
  userIds.push(s.user.id, a.user.id);
  superA = { id: s.user.id, role: 'SUPER_ADMIN' };
  retired = { id: a.user.id, role: 'ADMIN' };
  const ca = await createClassroom(prisma, { tag: 'ca', ownerAdminId: s.user.id });
  cohortA = ca.id;
  classroomIds.push(ca.id);
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
  // the default cohort may have been created by these tests and owned by one of the test accounts
  const made = await prisma.classroom.findMany({
    where: { ownerAdminId: { in: all } },
    select: { id: true },
  });
  await prisma.sandbox.deleteMany({ where: { ownerUserId: { in: all } } });
  await cleanup(prisma, {
    classroomIds: [...classroomIds, ...made.map((c) => c.id)],
    userIds: all,
  });
  await prisma.user.updateMany({ where: { id: { in: saved } }, data: { status: 'ACTIVE' } });
});

const newUser = async (
  actor: Actor,
  cohortId: string | undefined,
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
  it('the Super admin adds a student; the generated password is shown once and stored hashed', async () => {
    const u = await newUser(superA, cohortA, 'u1');
    expect(u.initialPassword).toHaveLength(16);
    const row = await prisma.user.findUniqueOrThrow({ where: { id: u.id } });
    expect(row.appRole).toBe('USER');
    expect(row.mustChangePassword).toBe(true);
    expect(row.cohortId).toBe(cohortA);
    expect(row.passwordHash).not.toContain(u.initialPassword!);
    expect(await verifyPassword(row.passwordHash!, u.initialPassword!)).toBe(true);
    // the sandbox is queued for the student
    expect(await prisma.sandbox.count({ where: { ownerUserId: u.id } })).toBe(1);
  });

  it('a student added without a cohort joins the default cohort, which is never listed', async () => {
    const u = await newUser(superA, undefined, 'nocohort');
    const row = await prisma.user.findUniqueOrThrow({
      where: { id: u.id },
      include: { cohort: true },
    });
    expect(row.cohort?.code).toBe(DEFAULT_COHORT_CODE);
    expect(await prisma.sandbox.count({ where: { ownerUserId: u.id } })).toBe(1);
    const listed = (await listCohorts(superA)).map((c) => c.id);
    expect(listed).not.toContain(row.cohortId);
    expect(await code(getCohort(superA, row.cohortId!))).toBe('ACC-031');
    // a second student reuses the same default cohort
    const v = await newUser(superA, undefined, 'nocohort2');
    expect((await prisma.user.findUniqueOrThrow({ where: { id: v.id } })).cohortId).toBe(
      row.cohortId,
    );
  });

  it('typed password is not returned and weak passwords are refused', async () => {
    const ok = await newUser(superA, cohortA, 'typed', 'SET');
    expect(ok.initialPassword).toBeUndefined();
    const email = `${uniq('weak')}@acc.example.test`;
    const c = await code(
      createAccount(superA, {
        email,
        name: 'Weak',
        role: 'USER',
        cohortId: cohortA,
        password: { mode: 'SET', value: 'password1' },
      }),
    );
    expect(c).toMatch(/^ACC-01[012]$/);
  });

  it('the Admin level cannot be created by anyone, and the retired level and students cannot create', async () => {
    const email = `${uniq('forged')}@acc.example.test`;
    expect(
      await code(
        createAccount(superA, { email, name: 'X', role: 'ADMIN', password: { mode: 'GENERATE' } }),
      ),
    ).toBe('ACC-020');
    expect(await prisma.user.findUnique({ where: { email } })).toBeNull();
    for (const actor of [retired, { id: 'stu', role: 'USER' } as Actor]) {
      for (const role of ['USER', 'SUPER_ADMIN', 'ADMIN'] as const) {
        expect(
          await code(
            createAccount(actor, {
              email: `${uniq('forged')}@acc.example.test`,
              name: 'X',
              role,
              password: { mode: 'GENERATE' },
            }),
          ),
        ).toBe('ACC-020');
      }
    }
    const denied = await prisma.auditLog.findMany({
      where: { actorUserId: retired.id, action: 'AUTHZ_DENIED', result: 'DENIED' },
    });
    expect(denied.length).toBeGreaterThanOrEqual(3);
  });

  it('a Super admin can be added; capacity and duplicates are enforced', async () => {
    const sa = await createAccount(superA, {
      email: `${uniq('sa-new')}@acc.example.test`,
      name: 'Second Super',
      role: 'SUPER_ADMIN',
      password: { mode: 'GENERATE' },
    });
    expect((await prisma.user.findUniqueOrThrow({ where: { id: sa.id } })).appRole).toBe(
      'SUPER_ADMIN',
    );
    expect(await prisma.sandbox.count({ where: { ownerUserId: sa.id } })).toBe(0);
    // keep the "last active Super admin" tests below exact
    await prisma.user.update({ where: { id: sa.id }, data: { status: 'DISABLED' } });
    const mk = (cohortId?: string, email = `${uniq('c')}@acc.example.test`) =>
      createAccount(superA, {
        email,
        name: 'N',
        role: 'USER',
        cohortId,
        password: { mode: 'GENERATE' },
      });
    expect(await code(mk('no-such-cohort'))).toBe('ACC-031');
    const dup = `${uniq('dup')}@acc.example.test`;
    await mk(cohortA, dup);
    expect(await code(mk(cohortA, dup.toUpperCase()))).toBe('ACC-002');
    const small = await createClassroom(prisma, {
      tag: 'small',
      ownerAdminId: superA.id,
      capacity: 1,
    });
    classroomIds.push(small.id);
    await mk(small.id);
    expect(await code(mk(small.id))).toBe('ACC-032');
  });
});

describe('scope (M19-AC4, ACC-022)', () => {
  it('lists students and Super admins, never the retired level; the retired level sees nothing', async () => {
    const mine = await fixture(prisma, { tag: 'mine', role: 'USER', cohortId: cohortA });
    userIds.push(mine.user.id);
    const { rows } = await listAccounts(superA, { pageSize: 100 });
    const ids = rows.map((r) => r.id);
    expect(ids).toContain(mine.user.id);
    expect(ids).toContain(superA.id);
    expect(ids).not.toContain(retired.id);
    expect((await listAccounts(superA, { pageSize: 100, role: ['ADMIN'] })).rows).toHaveLength(0);
    expect(await code(getAccount(superA, 'does-not-exist'))).toBe('ACC-022');
    expect(await code(getAccount(retired, mine.user.id))).toBe('FORBIDDEN');
    expect(await code(setAccountStatus(retired, mine.user.id, 'disable'))).toBe('FORBIDDEN');
  });

  it('search matches name and email, case-insensitively', async () => {
    const hit = await listAccounts(superA, { search: 'MINE' });
    expect(hit.rows.some((r) => r.name.toLowerCase().includes('mine'))).toBe(true);
    expect((await listAccounts(superA, { search: 'no-such-person-xyz' })).rows).toHaveLength(0);
  });
});

describe('status (M19-AC7, AC8, AC9, AC15)', () => {
  it('disable ends sessions and freezes the sandbox with reason ACCOUNT; enable thaws it', async () => {
    const st = await createStudent(prisma, { tag: 'dis', classroomId: cohortA });
    userIds.push(st.user.id);
    const before = (await prisma.user.findUniqueOrThrow({ where: { id: st.user.id } }))
      .sessionVersion;
    await setAccountStatus(superA, st.user.id, 'disable');
    const u = await prisma.user.findUniqueOrThrow({ where: { id: st.user.id } });
    expect(u.status).toBe('DISABLED');
    expect(u.sessionVersion).toBe(before + 1);
    const sb = await prisma.sandbox.findUniqueOrThrow({ where: { id: st.sandbox.id } });
    expect(sb.status).toBe('FROZEN');
    expect(sb.frozenReason).toBe('ACCOUNT');
    expect((await prisma.simClock.findUniqueOrThrow({ where: { sandboxId: sb.id } })).state).toBe(
      'PAUSED',
    );

    await setAccountStatus(superA, st.user.id, 'enable');
    expect((await prisma.user.findUniqueOrThrow({ where: { id: st.user.id } })).status).toBe(
      'ACTIVE',
    );
    const back = await prisma.sandbox.findUniqueOrThrow({ where: { id: st.sandbox.id } });
    expect(back.status).toBe('ACTIVE'); // no class window decides this any more
    expect(back.frozenReason).toBeNull();
  });

  it('no self harm', async () => {
    expect(await code(setAccountStatus(superA, superA.id, 'disable'))).toBe('ACC-023');
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
      status: 'LOCKED',
    });
    userIds.push(locked.user.id);
    await prisma.user.update({
      where: { id: locked.user.id },
      data: { lockedUntil: new Date(Date.now() + 600_000), failedLoginCount: 5 },
    });
    await unlockAccount(superA, locked.user.id);
    const u = await prisma.user.findUniqueOrThrow({ where: { id: locked.user.id } });
    expect([u.status, u.failedLoginCount, u.lockedUntil]).toEqual(['ACTIVE', 0, null]);
    await revokeSessions(superA, locked.user.id);
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
      status: 'LOCKED',
      mustChangePassword: false,
    });
    userIds.push(st.user.id);
    const r = await resetPassword(superA, st.user.id, { password: { mode: 'GENERATE' } });
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

  it('nobody resets another Super admin', async () => {
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
    });
    userIds.push(st.user.id);
    expect(await code(deleteAccount(superA, st.user.id, { confirm: 'delete' }))).toBe('ACC-061');
    await deleteAccount(superA, st.user.id, { confirm: 'DELETE' });
    const u = await prisma.user.findUniqueOrThrow({ where: { id: st.user.id } });
    expect([u.status, !!u.archivedAt]).toEqual(['ARCHIVED', true]);
    expect((await prisma.sandbox.findUniqueOrThrow({ where: { id: st.sandbox.id } })).status).toBe(
      'ARCHIVED',
    );
    // archived rows are hidden by default
    expect((await listAccounts(superA, { pageSize: 100 })).rows.map((r) => r.id)).not.toContain(
      st.user.id,
    );
    expect(
      (await listAccounts(superA, { pageSize: 100, status: ['ARCHIVED'] })).rows.map((r) => r.id),
    ).toContain(st.user.id);
    await restoreAccount(superA, st.user.id);
    expect((await prisma.user.findUniqueOrThrow({ where: { id: st.user.id } })).status).toBe(
      'DISABLED',
    );
  });

  it('Super admin accounts cannot be deleted, and nobody deletes themselves', async () => {
    const sa = await fixture(prisma, { tag: 'sa4', role: 'SUPER_ADMIN' });
    userIds.push(sa.user.id);
    expect(await code(deleteAccount(superA, sa.user.id, { confirm: 'DELETE' }))).toBe('ACC-026');
    expect(await code(deleteAccount(superA, superA.id, { confirm: 'DELETE' }))).toBe('ACC-023');
  });
});

describe('bulk (M19-AC19 to AC21)', () => {
  it('disables with skipped rows reported, resets with secrets, deletes only with DELETE, caps at 100', async () => {
    const a = await fixture(prisma, {
      tag: 'b1',
      role: 'USER',
      cohortId: cohortA,
    });
    const b = await fixture(prisma, {
      tag: 'b2',
      role: 'USER',
      cohortId: cohortA,
    });
    userIds.push(a.user.id, b.user.id);

    const res = await bulkAccounts(superA, [a.user.id, b.user.id, 'missing-id'], {
      type: 'DISABLE',
    });
    expect(res.done).toEqual([a.user.id, b.user.id]);
    expect(res.skipped).toEqual([{ id: 'missing-id', code: 'ACC-022', message: 'Account not found.' }]);

    const en = await bulkAccounts(superA, [a.user.id, b.user.id], { type: 'ENABLE' });
    expect(en.done).toHaveLength(2);

    const rp = await bulkAccounts(superA, [a.user.id, b.user.id], {
      type: 'RESET_PASSWORD',
      mode: 'GENERATE',
    });
    expect(rp.secrets.map((s) => s.id).sort()).toEqual([a.user.id, b.user.id].sort());

    expect(await code(bulkAccounts(superA, [a.user.id], { type: 'DELETE', confirm: 'nope' }))).toBe(
      'ACC-061',
    );
    expect(
      await code(
        bulkAccounts(
          superA,
          Array.from({ length: 101 }, (_, i) => `id${i}`),
          { type: 'DISABLE' },
        ),
      ),
    ).toBe('ACC-060');
    expect(
      await code(
        bulkAccounts(
          superA,
          Array.from({ length: 26 }, (_, i) => `id${i}`),
          { type: 'RESET_PASSWORD', mode: { set: 'x' } },
        ),
      ),
    ).toBe('ACC-063');
  });
});

describe('cohorts (optional grouping)', () => {
  it('the Super admin creates, renames, lists, opens and archives a cohort; names are unique', async () => {
    const name = `Batch ${uniq('n')}`;
    const c = await createCohort(superA, { name });
    classroomIds.push(c.id);
    expect(await code(createCohort(superA, { name }))).toBe('ACC-033B');
    expect(await code(createCohort(superA, { name: `${name}2`, capacity: 61 }))).toBe('ACC-034');
    expect((await listCohorts(superA)).map((x) => x.id)).toContain(c.id);

    const s1 = await newUser(superA, c.id, 'cm1');
    await newUser(superA, c.id, 'cm2');
    const detail = await getCohort(superA, c.id);
    expect(detail.members.map((m) => m.id)).toContain(s1.id);
    expect(detail.members).toHaveLength(2);

    await updateCohort(superA, c.id, { name: `${name} renamed`, capacity: 30 });
    const renamed = await getCohort(superA, c.id);
    expect([renamed.name, renamed.capacity]).toEqual([`${name} renamed`, 30]);
    expect(await code(updateCohort(superA, c.id, { capacity: 1 }))).toBe('ACC-034');
    expect(await code(updateCohort(superA, c.id, { name: '  ' }))).toBe('ACC-033');

    const { moved } = await archiveCohort(superA, c.id);
    expect(moved).toBe(2);
    expect((await listCohorts(superA)).map((x) => x.id)).not.toContain(c.id);
    // the students keep their accounts and their (queued) sandbox, in the default cohort
    const stu = await prisma.user.findUniqueOrThrow({
      where: { id: s1.id },
      include: { cohort: true },
    });
    expect([stu.status, stu.cohort?.code]).toEqual(['ACTIVE', DEFAULT_COHORT_CODE]);
    expect(await prisma.sandbox.count({ where: { ownerUserId: s1.id } })).toBe(1);
    expect(await code(archiveCohort(superA, c.id))).toBe('ACC-031');
  });

  it('only the Super admin may use cohorts', async () => {
    expect(await code(createCohort(retired, { name: `x ${uniq('c')}` }))).toBe('FORBIDDEN');
    expect(await code(listCohorts(retired).then(() => undefined))).not.toBe('NO_ERROR');
  });
});

describe('audit', () => {
  it('shows who did what to whom as readable text, never raw JSON', async () => {
    const u = await newUser(superA, cohortA, 'aud');
    await setAccountStatus(superA, u.id, 'disable');
    const { rows, total } = await listAudit(superA, { q: u.email });
    expect(total).toBeGreaterThanOrEqual(2);
    const disabled = rows.find((r) => r.action === 'ACCOUNT_DISABLED')!;
    expect(disabled.actor?.id).toBe(superA.id);
    expect(disabled.actor?.email).toContain('@example.test');
    expect(disabled.target?.email).toBe(u.email);
    expect(disabled.summary).toBe('Disabled account: active to disabled');
    expect(JSON.stringify(rows.map((r) => r.summary))).not.toContain('{');
    expect((await listAudit(superA, { action: 'ACCOUNT_DISABLED' })).rows.every((r) => r.action === 'ACCOUNT_DISABLED')).toBe(true);
    expect(await code(listAudit(retired).then(() => undefined))).toBe('FORBIDDEN');
  });

  it('writes a summary for every action it knows', () => {
    expect(auditSummary('ACCOUNT_CREATED', 'OK', { newRole: 'USER', cohortId: 'c' })).toBe(
      'Created account: as Student',
    );
    expect(auditSummary('PASSWORD_RESET', 'OK', { mustChangePassword: true })).toBe(
      'Reset password: new password required at next sign-in',
    );
    expect(auditSummary('COHORT_CREATED', 'OK', { cohortName: 'Batch 1', count: 25 })).toBe(
      'Created cohort: cohort "Batch 1", 25 students',
    );
    expect(auditSummary('AUTHZ_DENIED', 'DENIED', { reason: 'ACCOUNT_CREATED:ACC-020' })).toBe(
      'Action refused: refused (ACCOUNT_CREATED:ACC-020)',
    );
    expect(auditSummary('SOMETHING_NEW', 'OK', null)).toBe('something new');
  });

  it('every audit payload is free of secrets', async () => {
    const rows = await prisma.auditLog.findMany({ where: { actorUserId: { in: [superA.id] } } });
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
