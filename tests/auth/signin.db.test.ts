import { verify } from '@node-rs/argon2';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { hash } from '@node-rs/argon2';
import { needsRehash } from '@/lib/auth/argon';
import { clearLockout } from '@/lib/auth/lockout';
import { authenticate, signInMessage, type SignInFailure } from '@/lib/auth/signin';
import { throttleKey } from '@/lib/auth/throttle';
import { prisma } from '@/lib/db';
import { cleanup, createAccount, createClassroom, createStudent, uniq } from './fixtures';

vi.mock('@node-rs/argon2', async (importOriginal) => {
  const real = await importOriginal<typeof import('@node-rs/argon2')>();
  return {
    ...real,
    verify: vi.fn((...args: Parameters<typeof real.verify>) => real.verify(...args)),
  };
});

const verifyCalls = () => vi.mocked(verify).mock.calls.length;
const userIds: string[] = [];
const classroomIds: string[] = [];
const T0 = new Date('2026-11-02T04:30:00Z');
const min = (n: number) => new Date(T0.getTime() + n * 60_000);
const ip = () =>
  `10.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}`;

async function account(opts: Parameters<typeof createAccount>[1]) {
  const a = await createAccount(prisma, opts);
  userIds.push(a.user.id);
  return a;
}
const msg = (r: Awaited<ReturnType<typeof authenticate>>) => (r.ok ? 'OK' : signInMessage(r));

describe('sign in', () => {
  beforeEach(() => {
    vi.mocked(verify).mockClear();
  });
  afterAll(async () => {
    await cleanup(prisma, { userIds, classroomIds });
    await prisma.authThrottle.deleteMany({});
  });

  it('signs in with the right password and records the session', async () => {
    const a = await account({ tag: 'ok', mustChangePassword: true });
    const r = await authenticate(
      { email: `  ${a.user.email.toUpperCase()} `, password: a.password },
      { now: T0 },
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.user).toMatchObject({
      id: a.user.id,
      appRole: 'user',
      sessionVersion: 0,
      mustChangePassword: true,
    });
    expect(r.user.sid).toMatch(/^[0-9a-f-]{36}$/);
    const row = await prisma.user.findUniqueOrThrow({ where: { id: a.user.id } });
    expect(row.activeSessionId).toBe(r.user.sid);
    expect(row.lastLoginAt?.toISOString()).toBe(T0.toISOString());
    expect(row.failedLoginCount).toBe(0);
  });

  it('finds an account whose email was stored with capital letters (citext)', async () => {
    const t = uniq('Mixed');
    const a = await account({ tag: 'mixed' });
    await prisma.user.update({ where: { id: a.user.id }, data: { email: `${t}@Example.Test` } });
    const r = await authenticate(
      { email: `${t}@example.test`.toLowerCase(), password: a.password },
      { now: T0 },
    );
    expect(r.ok).toBe(true);
  });

  it('gives one message for unknown email, wrong password, archived and password-less accounts (M18-AC2)', async () => {
    const wrong = await account({ tag: 'wrong' });
    const archived = await account({ tag: 'arch', status: 'ARCHIVED' });
    const noHash = await account({ tag: 'nohash' });
    await prisma.user.update({ where: { id: noHash.user.id }, data: { passwordHash: null } });
    const results = await Promise.all([
      authenticate({ email: 'nobody-here@example.test', password: 'Whatever-123' }, { now: T0 }),
      authenticate({ email: wrong.user.email, password: 'Whatever-123' }, { now: T0 }),
      authenticate({ email: archived.user.email, password: archived.password }, { now: T0 }),
      authenticate({ email: noHash.user.email, password: 'Whatever-123' }, { now: T0 }),
    ]);
    for (const r of results) expect(r).toEqual({ ok: false, code: 'invalid' });
    expect(msg(results[0])).toBe('Incorrect email or password.');
  });

  it('runs exactly one hash verification for unknown, archived, password-less and wrong-password sign ins', async () => {
    const wrong = await account({ tag: 'wrong2' });
    const archived = await account({ tag: 'arch2', status: 'ARCHIVED' });
    for (const email of ['ghost@example.test', wrong.user.email, archived.user.email]) {
      vi.mocked(verify).mockClear();
      await authenticate({ email, password: 'Whatever-123' }, { now: T0 });
      expect(verifyCalls(), email).toBe(1);
    }
  });

  it('does not take much longer for a real account than for an unknown one (loose bound)', async () => {
    const a = await account({ tag: 'timing' });
    const time = async (email: string) => {
      const t = performance.now();
      await authenticate({ email, password: 'Whatever-123' }, { now: new Date() });
      return performance.now() - t;
    };
    await time('warm-up@example.test'); // builds the dummy hash once
    const real: number[] = [];
    const ghost: number[] = [];
    for (let i = 0; i < 3; i++) {
      real.push(await time(a.user.email));
      ghost.push(await time(`ghost${i}@example.test`));
      await prisma.user.update({
        where: { id: a.user.id },
        data: { failedLoginCount: 0, lockedUntil: null, status: 'ACTIVE' },
      });
    }
    const median = (xs: number[]) => [...xs].sort((x, y) => x - y)[1]!;
    const ratio = median(real) / median(ghost);
    expect(ratio).toBeGreaterThan(0.25);
    expect(ratio).toBeLessThan(4);
  });

  describe('lockout (SIM-002)', () => {
    it('locks on the 5th failure for 15 minutes, refuses even the right password, and unlocks by itself', async () => {
      const a = await account({ tag: 'lock' });
      const attempt = (password: string, at: Date) =>
        authenticate({ email: a.user.email, password }, { now: at });

      for (let i = 1; i <= 4; i++) {
        expect(await attempt('Wrong-pass-1', min(i / 10))).toEqual({ ok: false, code: 'invalid' });
      }
      expect(
        (await prisma.user.findUniqueOrThrow({ where: { id: a.user.id } })).failedLoginCount,
      ).toBe(4);

      const fifth = await attempt('Wrong-pass-1', min(0.5));
      expect(fifth).toEqual({ ok: false, code: 'locked', minutes: 15 });
      expect(msg(fifth)).toBe('Too many attempts. Try again in 15 minutes.');
      const locked = await prisma.user.findUniqueOrThrow({ where: { id: a.user.id } });
      expect(locked.status).toBe('LOCKED');
      expect(locked.lockedUntil?.toISOString()).toBe(
        new Date(min(0.5).getTime() + 15 * 60_000).toISOString(),
      );

      // the right password during the lock is refused, and costs no hash verification
      vi.mocked(verify).mockClear();
      const during = await attempt(a.password, min(5));
      expect(during.ok).toBe(false);
      expect(msg(during)).toBe('Too many attempts. Try again in 11 minutes.');
      expect(verifyCalls()).toBe(0);

      // only the lock itself is audited, once
      const audits = await prisma.auditLog.findMany({
        where: { targetUserId: a.user.id, action: 'ACCOUNT_LOCKED' },
      });
      expect(audits).toHaveLength(1);
      expect(JSON.stringify(audits[0]?.payload)).not.toMatch(/pass|hash/i);

      // after 15 minutes the lock is gone, the counter starts again
      const after = await attempt(a.password, min(16));
      expect(after.ok).toBe(true);
      const row = await prisma.user.findUniqueOrThrow({ where: { id: a.user.id } });
      expect(row).toMatchObject({ status: 'ACTIVE', failedLoginCount: 0, lockedUntil: null });
    });

    it('starts a fresh count after an expired lock', async () => {
      const a = await account({ tag: 'lock2' });
      for (let i = 0; i < 5; i++)
        await authenticate({ email: a.user.email, password: 'Wrong-pass-1' }, { now: min(i / 10) });
      const r = await authenticate(
        { email: a.user.email, password: 'Wrong-pass-1' },
        { now: min(20) },
      );
      expect(r).toEqual({ ok: false, code: 'invalid' });
      expect(
        (await prisma.user.findUniqueOrThrow({ where: { id: a.user.id } })).failedLoginCount,
      ).toBe(1);
    });

    it('a correct password resets the counter', async () => {
      const a = await account({ tag: 'lock3' });
      for (let i = 0; i < 3; i++)
        await authenticate({ email: a.user.email, password: 'Wrong-pass-1' }, { now: min(i) });
      await authenticate({ email: a.user.email, password: a.password }, { now: min(4) });
      expect(
        (await prisma.user.findUniqueOrThrow({ where: { id: a.user.id } })).failedLoginCount,
      ).toBe(0);
    });

    it('an unknown email locks exactly like a real one (same lock text, same duration)', async () => {
      const ghost = `ghost-${uniq('lock')}@example.test`;
      const real = await account({ tag: 'lock4' });
      const out: Array<{ ghost: string; real: string }> = [];
      for (let i = 0; i < 6; i++) {
        const at = min(i / 10);
        const g = await authenticate({ email: ghost, password: 'Wrong-pass-1' }, { now: at });
        const r = await authenticate(
          { email: real.user.email, password: 'Wrong-pass-1' },
          { now: at },
        );
        out.push({ ghost: msg(g), real: msg(r) });
      }
      for (const row of out) expect(row.ghost).toBe(row.real);
      expect(out[3]!.ghost).toBe('Incorrect email or password.');
      expect(out[4]!.ghost).toBe('Too many attempts. Try again in 15 minutes.');
      expect(out[5]!.ghost).toBe('Too many attempts. Try again in 15 minutes.');
      // and it ends the same way
      const later = await authenticate(
        { email: ghost, password: 'Wrong-pass-1' },
        { now: min(16) },
      );
      expect(later).toEqual({ ok: false, code: 'invalid' });
    });

    it('a locked DISABLED account stays DISABLED', async () => {
      const a = await account({ tag: 'lock5', status: 'DISABLED' });
      for (let i = 0; i < 5; i++)
        await authenticate({ email: a.user.email, password: 'Wrong-pass-1' }, { now: min(i / 10) });
      const row = await prisma.user.findUniqueOrThrow({ where: { id: a.user.id } });
      expect(row.status).toBe('DISABLED');
      expect(row.lockedUntil).not.toBeNull();
    });

    it('unlock and reset clear the lock and the counter (clearLockout)', async () => {
      const a = await account({ tag: 'lock6' });
      for (let i = 0; i < 5; i++)
        await authenticate({ email: a.user.email, password: 'Wrong-pass-1' }, { now: min(i / 10) });
      await clearLockout(prisma, a.user.id);
      const row = await prisma.user.findUniqueOrThrow({ where: { id: a.user.id } });
      expect(row).toMatchObject({ status: 'ACTIVE', failedLoginCount: 0, lockedUntil: null });
      expect(
        (await authenticate({ email: a.user.email, password: a.password }, { now: min(1) })).ok,
      ).toBe(true);
    });

    it('unlocking an unknown or disabled email keeps the status', async () => {
      const a = await account({ tag: 'lock7', status: 'DISABLED' });
      await clearLockout(prisma, a.user.id);
      expect((await prisma.user.findUniqueOrThrow({ where: { id: a.user.id } })).status).toBe(
        'DISABLED',
      );
      await clearLockout(prisma, 'does-not-exist');
    });
  });

  describe('specific messages come only after the right password', () => {
    it('DISABLED: ACC-070', async () => {
      const a = await account({ tag: 'dis', status: 'DISABLED' });
      const r = await authenticate({ email: a.user.email, password: a.password }, { now: T0 });
      expect(r).toEqual({ ok: false, code: 'disabled' });
      expect(msg(r)).toBe('Your account is disabled. Contact your admin.');
      // with the wrong password nothing is revealed
      expect(
        await authenticate({ email: a.user.email, password: 'Wrong-pass-1' }, { now: T0 }),
      ).toEqual({
        ok: false,
        code: 'invalid',
      });
    });

    it('an access period on an account is ignored: there are no time controls (ADM-FIX)', async () => {
      const notStarted = await account({ tag: 'ns', accessStartsAt: new Date('2026-11-12T20:00:00Z') });
      const ended = await account({ tag: 'end', accessEndsAt: new Date('2026-10-30T10:00:00Z') });
      for (const a of [notStarted, ended]) {
        expect(
          (await authenticate({ email: a.user.email, password: a.password }, { now: T0 })).ok,
        ).toBe(true);
      }
    });

    it('the retired ADMIN level cannot sign in and looks like an unknown account', async () => {
      const a = await account({ tag: 'retired', role: 'ADMIN' });
      const r = await authenticate({ email: a.user.email, password: a.password }, { now: T0 });
      expect(r).toEqual({ ok: false, code: 'invalid' });
      const unknown = await authenticate({ email: 'nobody-here@example.test', password: 'x' }, { now: T0 });
      expect(unknown).toEqual({ ok: false, code: 'invalid' });
    });
  });

  describe('per IP limit', () => {
    it('blocks an address after 10 failures in a minute, whatever the email, and spares others', async () => {
      const address = ip();
      const a = await account({ tag: 'ipa' });
      const b = await account({ tag: 'ipb' });
      for (let i = 0; i < 10; i++) {
        await authenticate(
          { email: `ghost-${i}-${uniq('ip')}@example.test`, password: 'x', ip: address },
          { now: min(i / 100) },
        );
      }
      const blocked = await authenticate(
        { email: a.user.email, password: a.password, ip: address },
        { now: min(0.2) },
      );
      expect(blocked.ok).toBe(false);
      expect((blocked as SignInFailure).code).toBe('locked');
      expect(
        (
          await authenticate(
            { email: b.user.email, password: b.password, ip: ip() },
            { now: min(0.2) },
          )
        ).ok,
      ).toBe(true);
      // a minute later the address is free again
      expect(
        (
          await authenticate(
            { email: a.user.email, password: a.password, ip: address },
            { now: min(2) },
          )
        ).ok,
      ).toBe(true);
    });

    it('successful sign ins do not count (a class sharing one address can sign in together)', async () => {
      const address = ip();
      for (let i = 0; i < 12; i++) {
        const a = await account({ tag: `cls${i}` });
        expect(
          (
            await authenticate(
              { email: a.user.email, password: a.password, ip: address },
              { now: min(i / 100) },
            )
          ).ok,
        ).toBe(true);
      }
      const row = await prisma.authThrottle.findUnique({
        where: { key: throttleKey('ip', address) },
      });
      expect(row).toBeNull();
    });
  });

  it('replaces an older password hash with the current parameters on sign in', async () => {
    const a = await account({ tag: 'rehash' });
    const weak = await hash(a.password, {
      algorithm: 2,
      memoryCost: 4096,
      timeCost: 1,
      parallelism: 1,
    });
    await prisma.user.update({ where: { id: a.user.id }, data: { passwordHash: weak } });
    expect(needsRehash(weak)).toBe(true);
    expect(
      (await authenticate({ email: a.user.email, password: a.password }, { now: T0 })).ok,
    ).toBe(true);
    const row = await prisma.user.findUniqueOrThrow({ where: { id: a.user.id } });
    expect(row.passwordHash).not.toBe(weak);
    expect(needsRehash(row.passwordHash!)).toBe(false);
    expect(
      (await authenticate({ email: a.user.email, password: a.password }, { now: T0 })).ok,
    ).toBe(true);
  });

  it('a second sign in replaces the session id (single session)', async () => {
    const owner = await account({ tag: 'own2', role: 'ADMIN' });
    const cls = await createClassroom(prisma, { tag: 'ss', ownerAdminId: owner.user.id });
    classroomIds.push(cls.id);
    const s = await createStudent(prisma, { tag: 'ss', classroomId: cls.id });
    userIds.push(s.user.id);
    const first = await authenticate({ email: s.user.email, password: s.password }, { now: T0 });
    const second = await authenticate(
      { email: s.user.email, password: s.password },
      { now: min(1) },
    );
    expect(first.ok && second.ok).toBe(true);
    if (first.ok && second.ok) expect(first.user.sid).not.toBe(second.user.sid);
  });

  it('rejects absurd input without hashing a megabyte', async () => {
    const r = await authenticate(
      { email: 'a@example.test', password: 'x'.repeat(5000) },
      { now: T0 },
    );
    expect(r.ok).toBe(false);
    expect(await authenticate({ email: undefined, password: undefined }, { now: T0 })).toEqual({
      ok: false,
      code: 'invalid',
    });
    expect(await authenticate({ email: 'x'.repeat(400), password: 'y' }, { now: T0 })).toEqual({
      ok: false,
      code: 'invalid',
    });
  });
});

beforeAll(async () => {
  await prisma.accountPolicy.upsert({ where: { id: 1 }, create: { id: 1 }, update: {} });
});
