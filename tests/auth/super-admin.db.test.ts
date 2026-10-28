import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { LastSuperAdminError, assertNotLastActiveSuperAdmin } from '@/lib/auth/super-admin';
import { prisma } from '@/lib/db';
import { cleanup, createAccount } from './fixtures';

const userIds: string[] = [];
let saved: string[] = [];

beforeAll(async () => {
  // other tests may leave Super admins around; this file needs a known set
  saved = (
    await prisma.user.findMany({ where: { appRole: 'SUPER_ADMIN' }, select: { id: true } })
  ).map((u) => u.id);
  await prisma.user.updateMany({ where: { id: { in: saved } }, data: { status: 'DISABLED' } });
});
afterAll(async () => {
  await cleanup(prisma, { userIds });
  await prisma.user.updateMany({ where: { id: { in: saved } }, data: { status: 'ACTIVE' } });
});

describe('last active Super admin guard (ACC-024, T11)', () => {
  it('refuses a change that would leave no active Super admin', async () => {
    const only = await createAccount(prisma, { tag: 'only', role: 'SUPER_ADMIN' });
    userIds.push(only.user.id);
    await expect(
      prisma.$transaction((tx) => assertNotLastActiveSuperAdmin(tx, only.user.id)),
    ).rejects.toBeInstanceOf(LastSuperAdminError);
    await expect(
      prisma.$transaction((tx) => assertNotLastActiveSuperAdmin(tx, only.user.id)),
    ).rejects.toThrow('At least one active super admin is required.');
  });

  it('allows it when another active Super admin remains, and ignores disabled ones', async () => {
    const a = await createAccount(prisma, { tag: 'sa1', role: 'SUPER_ADMIN' });
    const b = await createAccount(prisma, { tag: 'sa2', role: 'SUPER_ADMIN' });
    const c = await createAccount(prisma, { tag: 'sa3', role: 'SUPER_ADMIN', status: 'DISABLED' });
    userIds.push(a.user.id, b.user.id, c.user.id);
    await prisma.user.updateMany({
      where: { appRole: 'SUPER_ADMIN', id: { notIn: [a.user.id, b.user.id, c.user.id] } },
      data: { status: 'DISABLED' },
    });
    await expect(
      prisma.$transaction((tx) => assertNotLastActiveSuperAdmin(tx, a.user.id)),
    ).resolves.toBeUndefined();
    await prisma.user.update({ where: { id: b.user.id }, data: { status: 'DISABLED' } });
    await expect(
      prisma.$transaction((tx) => assertNotLastActiveSuperAdmin(tx, a.user.id)),
    ).rejects.toBeInstanceOf(LastSuperAdminError);
  });

  it('lets an unrelated change through even when the only Super admin is not active', async () => {
    const user = await createAccount(prisma, { tag: 'bystander', role: 'USER' });
    userIds.push(user.user.id);
    await prisma.user.updateMany({
      where: { appRole: 'SUPER_ADMIN' },
      data: { status: 'DISABLED' },
    });
    await expect(
      prisma.$transaction((tx) => assertNotLastActiveSuperAdmin(tx, user.user.id)),
    ).resolves.toBeUndefined();
  });

  it('two concurrent disables cannot both pass (row lock)', async () => {
    const a = await createAccount(prisma, { tag: 'race1', role: 'SUPER_ADMIN' });
    const b = await createAccount(prisma, { tag: 'race2', role: 'SUPER_ADMIN' });
    userIds.push(a.user.id, b.user.id);
    await prisma.user.updateMany({
      where: { id: { notIn: [a.user.id, b.user.id] }, appRole: 'SUPER_ADMIN' },
      data: { status: 'DISABLED' },
    });
    const disable = (id: string) =>
      prisma.$transaction(async (tx) => {
        await assertNotLastActiveSuperAdmin(tx, id);
        await new Promise((r) => setTimeout(r, 150)); // widen the race window
        await tx.user.update({ where: { id }, data: { status: 'DISABLED' } });
      });
    const results = await Promise.allSettled([disable(a.user.id), disable(b.user.id)]);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter((r) => r.status === 'rejected')).toHaveLength(1);
    expect(
      await prisma.user.count({ where: { id: { in: [a.user.id, b.user.id] }, status: 'ACTIVE' } }),
    ).toBe(1);
  });
});
