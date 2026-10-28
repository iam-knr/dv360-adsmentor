import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { checkPassword } from '@/lib/auth/password-policy';
import { ProvisionError, provisionStudent } from '@/lib/auth/provision';
import { authenticate } from '@/lib/auth/signin';
import { prisma } from '@/lib/db';
import { cleanup, createAccount, createClassroom, uniq } from './fixtures';

const userIds: string[] = [];
const classroomIds: string[] = [];
let admin: Awaited<ReturnType<typeof createAccount>>;
let cls: Awaited<ReturnType<typeof createClassroom>>;
const email = (tag: string) => `${uniq(tag)}@example.test`;

beforeAll(async () => {
  admin = await createAccount(prisma, { tag: 'prov-admin', role: 'ADMIN' });
  userIds.push(admin.user.id);
  cls = await createClassroom(prisma, { tag: 'prov', ownerAdminId: admin.user.id, capacity: 50 });
  classroomIds.push(cls.id);
});
afterAll(() => cleanup(prisma, { userIds, classroomIds }));

describe('provisionStudent', () => {
  it('creates a USER with membership and a generated password, returned once', async () => {
    const e = email('gen');
    const r = await provisionStudent(prisma, cls.id, {
      email: `  ${e.toUpperCase()}  `,
      name: ' Asha Rao ',
      createdById: admin.user.id,
    });
    userIds.push(r.user.id);
    expect(r.user).toMatchObject({ email: e, name: 'Asha Rao' });
    expect(r.password).toHaveLength(16);
    expect(checkPassword(r.password!).ok).toBe(true);

    const row = await prisma.user.findUniqueOrThrow({
      where: { id: r.user.id },
      include: { memberships: true },
    });
    expect(row).toMatchObject({
      appRole: 'USER',
      status: 'ACTIVE',
      mustChangePassword: true,
      cohortId: cls.id,
      ownerAdminId: admin.user.id,
      createdById: admin.user.id,
    });
    expect(row.memberships).toHaveLength(1);
    expect(row.passwordHash).toMatch(/^\$argon2id\$/);
    expect(row.passwordHash).not.toContain(r.password!);

    // the password works, and it is forced to change
    const signIn = await authenticate({ email: e, password: r.password! });
    expect(signIn.ok && signIn.user.mustChangePassword).toBe(true);
  });

  it('uses a typed password when it passes the policy, and does not return it', async () => {
    const e = email('typed');
    const r = await provisionStudent(prisma, cls.id, {
      email: e,
      name: 'Typed',
      password: 'Zebra4tiger9-x',
      mustChangePassword: false,
    });
    userIds.push(r.user.id);
    expect(r.password).toBeUndefined();
    expect(
      (await prisma.user.findUniqueOrThrow({ where: { id: r.user.id } })).mustChangePassword,
    ).toBe(false);
    expect((await authenticate({ email: e, password: 'Zebra4tiger9-x' })).ok).toBe(true);
  });

  it('keeps the plaintext out of the database and the audit log', async () => {
    const e = email('plain');
    const r = await provisionStudent(prisma, cls.id, {
      email: e,
      name: 'Plain',
      createdById: admin.user.id,
    });
    userIds.push(r.user.id);
    const audits = await prisma.auditLog.findMany({ where: { targetUserId: r.user.id } });
    expect(audits.map((a) => a.action)).toEqual(['ACCOUNT_CREATED']);
    expect(JSON.stringify(audits)).not.toContain(r.password!);
    expect(
      JSON.stringify(await prisma.user.findUniqueOrThrow({ where: { id: r.user.id } })),
    ).not.toContain(r.password!);
  });

  it('refuses the same email in any case, and tells an archived account apart', async () => {
    const e = email('dup');
    const first = await provisionStudent(prisma, cls.id, { email: e, name: 'A' });
    userIds.push(first.user.id);
    await expect(
      provisionStudent(prisma, cls.id, { email: e.toUpperCase(), name: 'B' }),
    ).rejects.toMatchObject({
      code: 'ACC-002',
      message: 'An account with this email already exists.',
    });
    await prisma.user.update({ where: { id: first.user.id }, data: { status: 'ARCHIVED' } });
    await expect(provisionStudent(prisma, cls.id, { email: e, name: 'B' })).rejects.toMatchObject({
      message: 'This email belongs to an archived account. Restore it instead.',
    });
  });

  it('validates email, name and password with the ACC messages', async () => {
    await expect(
      provisionStudent(prisma, cls.id, { email: 'nope', name: 'A' }),
    ).rejects.toMatchObject({ code: 'ACC-001' });
    await expect(
      provisionStudent(prisma, cls.id, { email: email('n'), name: '   ' }),
    ).rejects.toMatchObject({ code: 'ACC-003' });
    await expect(
      provisionStudent(prisma, cls.id, { email: email('n'), name: 'x'.repeat(101) }),
    ).rejects.toMatchObject({ code: 'ACC-003' });
    await expect(
      provisionStudent(prisma, cls.id, { email: email('n'), name: 'A', password: 'short' }),
    ).rejects.toMatchObject({ code: 'ACC-010' });
    await expect(
      provisionStudent(prisma, cls.id, { email: email('n'), name: 'A', password: 'Password@123' }),
    ).rejects.toMatchObject({ code: 'ACC-012' });
    await expect(
      provisionStudent(prisma, cls.id, { email: email('n'), name: 'A', password: 'Password@123' }),
    ).rejects.toBeInstanceOf(ProvisionError);
  });

  it('stops at the cohort capacity (ACC-032) and for an unknown cohort (ACC-031)', async () => {
    const small = await createClassroom(prisma, {
      tag: 'prov-small',
      ownerAdminId: admin.user.id,
      capacity: 2,
    });
    classroomIds.push(small.id);
    for (let i = 0; i < 2; i++) {
      const r = await provisionStudent(prisma, small.id, { email: email('fill'), name: 'F' });
      userIds.push(r.user.id);
    }
    await expect(
      provisionStudent(prisma, small.id, { email: email('over'), name: 'O' }),
    ).rejects.toMatchObject({
      code: 'ACC-032',
      message: 'This cohort is full (2 of 2).',
    });
    // an archived account no longer takes a seat
    await prisma.user.updateMany({ where: { cohortId: small.id }, data: { status: 'ARCHIVED' } });
    const again = await provisionStudent(prisma, small.id, { email: email('again'), name: 'A' });
    userIds.push(again.user.id);
    await expect(
      provisionStudent(prisma, 'nope', { email: email('x'), name: 'X' }),
    ).rejects.toMatchObject({ code: 'ACC-031' });
    await prisma.classroom.update({ where: { id: small.id }, data: { archivedAt: new Date() } });
    await expect(
      provisionStudent(prisma, small.id, { email: email('x'), name: 'X' }),
    ).rejects.toMatchObject({ code: 'ACC-031' });
  });

  it('two requests cannot both take the last seat', async () => {
    const one = await createClassroom(prisma, {
      tag: 'prov-race',
      ownerAdminId: admin.user.id,
      capacity: 1,
    });
    classroomIds.push(one.id);
    const results = await Promise.allSettled([
      provisionStudent(prisma, one.id, { email: email('race1'), name: 'R1' }),
      provisionStudent(prisma, one.id, { email: email('race2'), name: 'R2' }),
    ]);
    for (const r of results) if (r.status === 'fulfilled') userIds.push(r.value.user.id);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    const failed = results.find((r) => r.status === 'rejected') as PromiseRejectedResult;
    expect(failed.reason).toMatchObject({ code: 'ACC-032' });
    expect(await prisma.user.count({ where: { cohortId: one.id } })).toBe(1);
  });

  it('is atomic inside a transaction: a failure leaves no account behind', async () => {
    const e = email('tx');
    await expect(
      prisma.$transaction(async (tx) => {
        const r = await provisionStudent(tx, cls.id, { email: e, name: 'Tx' });
        userIds.push(r.user.id);
        throw new Error('rollback');
      }),
    ).rejects.toThrow('rollback');
    expect(await prisma.user.findUnique({ where: { email: e } })).toBeNull();
  });
});
