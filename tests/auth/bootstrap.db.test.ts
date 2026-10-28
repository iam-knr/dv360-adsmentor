import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { bootstrapSuperAdmin, run } from '../../prisma/bootstrap/10-admin.bootstrap';
import { needsRehash, verifyPassword } from '@/lib/auth/argon';
import { authenticate } from '@/lib/auth/signin';
import { prisma } from '@/lib/db';
import { uniq } from './fixtures';

const created: string[] = [];
const saved: Array<{ id: string; status: string }> = [];

const env = (over: Record<string, string | undefined> = {}) => ({
  SEED_SUPER_ADMIN_EMAIL: `${uniq('boot')}@example.test`,
  SEED_SUPER_ADMIN_PASSWORD: 'bootstrap-secret-value',
  NODE_ENV: 'test',
  ...over,
});

async function noSuperAdmins() {
  // park the rows of other tests; they come back after the file
  const rows = await prisma.user.findMany({
    where: { appRole: 'SUPER_ADMIN' },
    select: { id: true, status: true },
  });
  saved.push(...rows);
  await prisma.user.updateMany({
    where: { id: { in: rows.map((r) => r.id) } },
    data: { appRole: 'ADMIN' },
  });
}

beforeEach(async () => {
  await noSuperAdmins();
});
afterEach(() => vi.restoreAllMocks());
afterAll(async () => {
  await prisma.user.deleteMany({ where: { id: { in: created } } });
  for (const row of saved)
    await prisma.user
      .update({ where: { id: row.id }, data: { appRole: 'SUPER_ADMIN' } })
      .catch(() => undefined);
});

async function superAdmins() {
  return prisma.user.findMany({ where: { appRole: 'SUPER_ADMIN' } });
}

describe('first Super admin bootstrap (module 19 4.6.4, RC-071)', () => {
  it('creates one Super admin with a forced password change and an argon2id hash', async () => {
    const e = env();
    expect(await bootstrapSuperAdmin(e)).toBe('created');
    const [row] = await superAdmins();
    created.push(row!.id);
    expect(row).toMatchObject({
      email: e.SEED_SUPER_ADMIN_EMAIL,
      name: 'Super admin',
      appRole: 'SUPER_ADMIN',
      status: 'ACTIVE',
      mustChangePassword: true,
    });
    expect(row!.passwordHash).toMatch(/^\$argon2id\$/);
    expect(needsRehash(row!.passwordHash!)).toBe(false);
    expect(await verifyPassword(row!.passwordHash!, e.SEED_SUPER_ADMIN_PASSWORD)).toBe(true);
    const signIn = await authenticate({
      email: e.SEED_SUPER_ADMIN_EMAIL,
      password: e.SEED_SUPER_ADMIN_PASSWORD,
    });
    expect(signIn.ok && signIn.user.mustChangePassword).toBe(true);
  });

  it('uses the optional name', async () => {
    expect(await bootstrapSuperAdmin(env({ SEED_SUPER_ADMIN_NAME: ' Kautilya ' }))).toBe('created');
    const [row] = await superAdmins();
    created.push(row!.id);
    expect(row!.name).toBe('Kautilya');
  });

  it('runs again and again without changing anything, even when the variables changed', async () => {
    const e = env();
    expect(await bootstrapSuperAdmin(e)).toBe('created');
    const [first] = await superAdmins();
    created.push(first!.id);
    expect(await bootstrapSuperAdmin(e)).toBe('exists');
    expect(
      await bootstrapSuperAdmin(
        env({
          SEED_SUPER_ADMIN_EMAIL: 'attacker@example.test',
          SEED_SUPER_ADMIN_PASSWORD: 'a-new-password-1',
        }),
      ),
    ).toBe('exists');
    expect(await bootstrapSuperAdmin({ NODE_ENV: 'production' })).toBe('exists'); // variables removed after the first sign in
    const rows = await superAdmins();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      id: first!.id,
      email: first!.email,
      passwordHash: first!.passwordHash,
    });
    expect(await prisma.user.findUnique({ where: { email: 'attacker@example.test' } })).toBeNull();
  });

  it('does not touch a disabled Super admin or recreate one next to it', async () => {
    const e = env();
    await bootstrapSuperAdmin(e);
    const [first] = await superAdmins();
    created.push(first!.id);
    await prisma.user.update({ where: { id: first!.id }, data: { status: 'DISABLED' } });
    expect(await bootstrapSuperAdmin(env())).toBe('exists');
    expect(await superAdmins()).toHaveLength(1);
  });

  it('in production, fails with a message that names the variable and no value, when it is needed', async () => {
    const e = env({ NODE_ENV: 'production', SEED_SUPER_ADMIN_PASSWORD: undefined });
    await expect(bootstrapSuperAdmin(e)).rejects.toThrow('SEED_SUPER_ADMIN_PASSWORD');
    await expect(bootstrapSuperAdmin(e)).rejects.not.toThrow(e.SEED_SUPER_ADMIN_EMAIL);
    await expect(bootstrapSuperAdmin({ NODE_ENV: 'production' })).rejects.toThrow(
      'SEED_SUPER_ADMIN_EMAIL and SEED_SUPER_ADMIN_PASSWORD',
    );
    await expect(bootstrapSuperAdmin({ VERCEL_ENV: 'production' })).rejects.toThrow(
      'SEED_SUPER_ADMIN_EMAIL',
    );
    expect(await superAdmins()).toHaveLength(0);
  });

  it('outside production a missing variable only warns', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    expect(await bootstrapSuperAdmin({ NODE_ENV: 'test' })).toBe('skipped');
    expect(warn).toHaveBeenCalled();
    expect(await superAdmins()).toHaveLength(0);
  });

  it('rejects a bad email or a short password, and an email that already belongs to another account', async () => {
    await expect(
      bootstrapSuperAdmin(env({ SEED_SUPER_ADMIN_EMAIL: 'not-an-email' })),
    ).rejects.toThrow('SEED_SUPER_ADMIN_EMAIL');
    await expect(bootstrapSuperAdmin(env({ SEED_SUPER_ADMIN_PASSWORD: 'short' }))).rejects.toThrow(
      'SEED_SUPER_ADMIN_PASSWORD',
    );
    const other = await prisma.user.create({
      data: { email: `${uniq('taken')}@example.test`, name: 'Existing', appRole: 'USER' },
    });
    created.push(other.id);
    await expect(
      bootstrapSuperAdmin(env({ NODE_ENV: 'production', SEED_SUPER_ADMIN_EMAIL: other.email })),
    ).rejects.toThrow('existing account');
    expect((await prisma.user.findUniqueOrThrow({ where: { id: other.id } })).appRole).toBe('USER');
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    expect(await bootstrapSuperAdmin(env({ SEED_SUPER_ADMIN_EMAIL: other.email }))).toBe('skipped');
    expect(warn.mock.calls.flat().join(' ')).not.toContain(other.email);
  });

  it('prints neither the email, nor the password, nor a hash', async () => {
    const e = env();
    const out: string[] = [];
    for (const m of ['log', 'warn', 'error', 'info'] as const) {
      vi.spyOn(console, m).mockImplementation(
        (...args: unknown[]) => void out.push(args.map(String).join(' ')),
      );
    }
    const original = { ...process.env };
    Object.assign(process.env, e);
    try {
      await run();
      await run();
    } finally {
      process.env = original;
    }
    const [row] = await superAdmins();
    created.push(row!.id);
    const text = out.join('\n');
    expect(text).toContain('Super admin created');
    expect(text).not.toContain(e.SEED_SUPER_ADMIN_EMAIL);
    expect(text).not.toContain(
      e.SEED_SUPER_ADMIN_EMAIL.split('@')[1]!.split('.')[0]!.concat('.test') + '!',
    );
    expect(text).not.toContain(e.SEED_SUPER_ADMIN_PASSWORD);
    expect(text).not.toMatch(/argon2/);
  });
});
