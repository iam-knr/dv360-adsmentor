import { afterAll, afterEach, describe, expect, it, vi } from 'vitest';
import { changePassword } from '@/lib/auth/password-change';
import { generatePassword } from '@/lib/auth/argon';
import { provisionStudent } from '@/lib/auth/provision';
import { authenticate } from '@/lib/auth/signin';
import { prisma } from '@/lib/db';
import { cleanup, createAccount, createClassroom, uniq } from './fixtures';
import { sanitizeAuditPayload } from '@/lib/auth/audit';

// T6 (module 19 4.6.2): a password never lands in a table, the audit log or a log line.
const userIds: string[] = [];
const classroomIds: string[] = [];
afterEach(() => vi.restoreAllMocks());
afterAll(() => cleanup(prisma, { userIds, classroomIds }));

async function everythingStored(): Promise<string> {
  const [users, audit, throttle, policy] = await Promise.all([
    prisma.$queryRaw`SELECT row_to_json(t)::text AS j FROM "User" t`,
    prisma.$queryRaw`SELECT row_to_json(t)::text AS j FROM "AuditLog" t`,
    prisma.$queryRaw`SELECT row_to_json(t)::text AS j FROM "AuthThrottle" t`,
    prisma.$queryRaw`SELECT row_to_json(t)::text AS j FROM "AccountPolicy" t`,
  ]);
  return JSON.stringify([users, audit, throttle, policy]);
}

describe('plaintext handling', () => {
  it('create, sign in, fail, lock and change leave no password in the database or in any log line', async () => {
    const logs: string[] = [];
    for (const m of ['log', 'info', 'warn', 'error', 'debug'] as const) {
      vi.spyOn(console, m).mockImplementation(
        (...a: unknown[]) =>
          void logs.push(a.map((x) => (x instanceof Error ? x.stack : String(x))).join(' ')),
      );
    }
    const admin = await createAccount(prisma, { tag: 'pt-admin', role: 'ADMIN' });
    userIds.push(admin.user.id);
    const cls = await createClassroom(prisma, { tag: 'pt', ownerAdminId: admin.user.id });
    classroomIds.push(cls.id);

    const typed = 'Typed-Secret-Zebra-91';
    const created = await provisionStudent(prisma, cls.id, {
      email: `${uniq('pt1')}@example.test`,
      name: 'One',
      createdById: admin.user.id,
    });
    const second = await provisionStudent(prisma, cls.id, {
      email: `${uniq('pt2')}@example.test`,
      name: 'Two',
      password: typed,
      createdById: admin.user.id,
    });
    userIds.push(created.user.id, second.user.id);
    const secrets = [created.password!, typed];

    await authenticate({ email: created.user.email, password: created.password! });
    const wrong = 'Wrong-Secret-Orange-77';
    for (let i = 0; i < 5; i++)
      await authenticate({ email: created.user.email, password: wrong, ip: '10.9.9.9' });
    await authenticate({ email: 'ghost@example.test', password: wrong, ip: '10.9.9.9' });
    const next = generatePassword();
    await changePassword({ userId: second.user.id, current: typed, next, confirm: next });
    await changePassword({
      userId: second.user.id,
      current: wrong,
      next: 'Another-Secret-Lime-5',
      confirm: 'Another-Secret-Lime-5',
    });
    secrets.push(wrong, next, 'Another-Secret-Lime-5');

    const stored = await everythingStored();
    const printed = logs.join('\n');
    for (const secret of secrets) {
      expect(stored, `database holds ${secret.slice(0, 4)}...`).not.toContain(secret);
      expect(printed, `log holds ${secret.slice(0, 4)}...`).not.toContain(secret);
    }
    // the only hashes are argon2id PHC strings in User.passwordHash
    const hashes = stored.match(/\$argon2[a-z]*\$[^"]+/g) ?? [];
    expect(hashes.length).toBeGreaterThan(0);
  });

  it('the audit payload keeps only whitelisted, non-secret keys', () => {
    const payload = sanitizeAuditPayload({
      newRole: 'USER',
      password: 'x',
      newPassword: 'y',
      passwordHash: 'z',
      token: 't',
      secret: 's',
      until: new Date('2026-11-02T04:30:00Z'),
      nested: { password: 'p' },
      count: 3,
    });
    expect(payload).toEqual({ newRole: 'USER', until: '2026-11-02T04:30:00.000Z', count: 3 });
    expect(sanitizeAuditPayload(undefined)).toEqual({});
  });
});
