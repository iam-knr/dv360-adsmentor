import { afterAll, describe, expect, it } from 'vitest';
import { generatePassword } from '@/lib/auth/argon';
import { changePassword } from '@/lib/auth/password-change';
import { evaluateSession } from '@/lib/auth/session-check';
import { DEFAULT_POLICY } from '@/lib/auth/policy';
import { authenticate } from '@/lib/auth/signin';
import { prisma } from '@/lib/db';
import { cleanup, createAccount } from './fixtures';

const userIds: string[] = [];
const T0 = new Date('2026-11-02T04:30:00Z');
const min = (n: number) => new Date(T0.getTime() + n * 60_000);
async function account(opts: Parameters<typeof createAccount>[1]) {
  const a = await createAccount(prisma, opts);
  userIds.push(a.user.id);
  return a;
}
afterAll(() => cleanup(prisma, { userIds }));

describe('forced password change (M18-AC3)', () => {
  it('changes the password without the current one, bumps sessionVersion and ends old sessions', async () => {
    const a = await account({ tag: 'force', mustChangePassword: true });
    const signedIn = await authenticate({ email: a.user.email, password: a.password }, { now: T0 });
    expect(signedIn.ok && signedIn.user.mustChangePassword).toBe(true);
    if (!signedIn.ok) return;
    const oldClaims = {
      sv: signedIn.user.sessionVersion,
      sid: signedIn.user.sid,
      loginAt: Math.floor(T0.getTime() / 1000),
    };

    const next = generatePassword();
    const r = await changePassword({ userId: a.user.id, next, confirm: next }, { now: min(1) });
    expect(r).toEqual({ ok: true, email: a.user.email });

    const row = await prisma.user.findUniqueOrThrow({ where: { id: a.user.id } });
    expect(row).toMatchObject({
      mustChangePassword: false,
      sessionVersion: 1,
      activeSessionId: null,
      failedLoginCount: 0,
    });
    expect(row.passwordChangedAt?.toISOString()).toBe(min(1).toISOString());
    // the old session no longer passes the check
    expect(
      evaluateSession(
        oldClaims,
        {
          appRole: 'user',
          status: row.status,
          sessionVersion: row.sessionVersion,
          activeSessionId: row.activeSessionId,
          lastSeenAt: T0,
        },
        DEFAULT_POLICY,
        min(2),
      ),
    ).toBe('revoked');
    // the shared password stops working, the new one works and is not forced again
    expect(
      (await authenticate({ email: a.user.email, password: a.password }, { now: min(3) })).ok,
    ).toBe(false);
    const again = await authenticate({ email: a.user.email, password: next }, { now: min(4) });
    expect(again.ok && again.user).toMatchObject({ mustChangePassword: false, sessionVersion: 1 });
  });

  it('audits the change without any secret', async () => {
    const a = await account({ tag: 'audit', mustChangePassword: true });
    const next = generatePassword();
    await changePassword({ userId: a.user.id, next, confirm: next });
    const rows = await prisma.auditLog.findMany({ where: { targetUserId: a.user.id } });
    expect(rows.map((r) => r.action)).toEqual(['PASSWORD_CHANGED']);
    expect(rows[0]).toMatchObject({ actorUserId: a.user.id, result: 'OK' });
    const dump = JSON.stringify(rows);
    expect(dump).not.toContain(next);
    expect(dump).not.toContain(a.password);
    expect(dump).not.toMatch(/argon2/);
  });
});

describe('voluntary change', () => {
  it('needs the current password; a wrong one is ACC-015 and counts toward the lockout', async () => {
    const a = await account({ tag: 'vol' });
    const next = generatePassword();
    const bad = await changePassword(
      { userId: a.user.id, current: 'Wrong-pass-1', next, confirm: next },
      { now: T0 },
    );
    expect(bad).toEqual({
      ok: false,
      code: 'ACC-015',
      message: 'Your current password is incorrect.',
    });
    expect(
      (await prisma.user.findUniqueOrThrow({ where: { id: a.user.id } })).failedLoginCount,
    ).toBe(1);
    const missing = await changePassword({ userId: a.user.id, next, confirm: next }, { now: T0 });
    expect(missing).toMatchObject({ ok: false, code: 'ACC-015' });

    // five wrong guesses lock the account, the same way as the sign in form
    for (let i = 0; i < 3; i++)
      await changePassword(
        { userId: a.user.id, current: 'Wrong-pass-1', next, confirm: next },
        { now: T0 },
      );
    const fifth = await changePassword(
      { userId: a.user.id, current: 'Wrong-pass-1', next, confirm: next },
      { now: T0 },
    );
    expect(fifth).toEqual({
      ok: false,
      code: 'LOCKED',
      message: 'Too many attempts. Try again in 15 minutes.',
    });
    const locked = await changePassword(
      { userId: a.user.id, current: a.password, next, confirm: next },
      { now: min(2) },
    );
    expect(locked).toMatchObject({ ok: false, code: 'LOCKED' });
    expect(
      (await authenticate({ email: a.user.email, password: a.password }, { now: min(2) })).ok,
    ).toBe(false);
  });

  it('starts a fresh count after an expired lock instead of locking again on the first typo', async () => {
    const a = await account({ tag: 'stale' });
    for (let i = 0; i < 5; i++)
      await authenticate({ email: a.user.email, password: 'Wrong-pass-1' }, { now: min(i / 10) });
    const next = generatePassword();
    // 20 minutes later the lock has run out; the counter must not still stand at 5
    const typo = await changePassword(
      { userId: a.user.id, current: 'Wrong-pass-1', next, confirm: next },
      { now: min(20) },
    );
    expect(typo).toMatchObject({ ok: false, code: 'ACC-015' });
    const row = await prisma.user.findUniqueOrThrow({ where: { id: a.user.id } });
    expect(row).toMatchObject({ failedLoginCount: 1, lockedUntil: null, status: 'ACTIVE' });
  });

  it('accepts the right current password', async () => {
    const a = await account({ tag: 'vol2' });
    const next = generatePassword();
    expect(
      await changePassword({ userId: a.user.id, current: a.password, next, confirm: next }),
    ).toMatchObject({ ok: true });
    expect((await prisma.user.findUniqueOrThrow({ where: { id: a.user.id } })).sessionVersion).toBe(
      1,
    );
  });
});

describe('policy checks on the new password', () => {
  it.each([
    ['ACC-010', 'Ab1!', 'Use at least 10 characters.'],
    ['ACC-011', 'abcdefghijkl', 'Use at least 3 of: lowercase, uppercase, number, symbol.'],
    ['ACC-012', 'Password@123', 'Choose a password that is harder to guess.'],
  ])('%s', async (code, weak, message) => {
    const a = await account({ tag: 'pol', mustChangePassword: true });
    expect(await changePassword({ userId: a.user.id, next: weak, confirm: weak })).toEqual({
      ok: false,
      code,
      message,
    });
    expect((await prisma.user.findUniqueOrThrow({ where: { id: a.user.id } })).sessionVersion).toBe(
      0,
    );
  });

  it('ACC-013 when the confirmation differs', async () => {
    const a = await account({ tag: 'conf', mustChangePassword: true });
    const next = generatePassword();
    expect(await changePassword({ userId: a.user.id, next, confirm: `${next}x` })).toEqual({
      ok: false,
      code: 'ACC-013',
      message: 'The passwords do not match.',
    });
  });

  it('ACC-014 when the new password equals the current one, also on a forced change', async () => {
    const a = await account({ tag: 'same', mustChangePassword: true });
    expect(
      await changePassword({ userId: a.user.id, next: a.password, confirm: a.password }),
    ).toEqual({
      ok: false,
      code: 'ACC-014',
      message: 'Your new password must be different from the current one.',
    });
  });

  it('rejects the email as a password and its local part', async () => {
    const a = await account({ tag: 'mailpw', mustChangePassword: true });
    expect(
      await changePassword({ userId: a.user.id, next: a.user.email, confirm: a.user.email }),
    ).toMatchObject({ code: 'ACC-012' });
  });

  it('a disabled, archived or unknown account cannot change a password', async () => {
    const d = await account({ tag: 'dis', status: 'DISABLED', mustChangePassword: true });
    const next = generatePassword();
    expect(await changePassword({ userId: d.user.id, next, confirm: next })).toMatchObject({
      ok: false,
      code: 'NOT_FOUND',
    });
    expect(await changePassword({ userId: 'nobody', next, confirm: next })).toMatchObject({
      ok: false,
      code: 'NOT_FOUND',
    });
  });
});
