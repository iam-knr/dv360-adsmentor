import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_POLICY } from '@/lib/auth/policy';
import { MIN_IDLE_MINUTES, evaluateSession, type UserStateIn } from '@/lib/auth/session-check';
import type { AppRole } from '@/lib/auth/types';

const T0 = new Date('2026-11-02T04:30:00Z');
const loginAt = Math.floor(T0.getTime() / 1000);
const claims = { sv: 3, sid: 'sid-1', loginAt };

function user(over: Partial<UserStateIn> = {}): UserStateIn {
  return {
    appRole: 'user',
    status: 'ACTIVE',
    sessionVersion: 3,
    activeSessionId: 'sid-1',
    lastSeenAt: T0,
    ...over,
  };
}
const after = (minutes: number) => new Date(T0.getTime() + minutes * 60_000);

describe('evaluateSession', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(T0);
  });
  afterEach(() => vi.useRealTimers());

  it('accepts a fresh session', () => {
    expect(evaluateSession(claims, user(), DEFAULT_POLICY, after(1))).toBeNull();
  });

  it('revokes when the user is gone, disabled or archived', () => {
    expect(evaluateSession(claims, null, DEFAULT_POLICY, after(1))).toBe('revoked');
    expect(evaluateSession(claims, user({ status: 'DISABLED' }), DEFAULT_POLICY, after(1))).toBe(
      'revoked',
    );
    expect(evaluateSession(claims, user({ status: 'ARCHIVED' }), DEFAULT_POLICY, after(1))).toBe(
      'revoked',
    );
  });

  it('a LOCKED account keeps its sessions (only a guessed password, module 19 4.3)', () => {
    expect(
      evaluateSession(claims, user({ status: 'LOCKED' }), DEFAULT_POLICY, after(1)),
    ).toBeNull();
  });

  it('revokes when sessionVersion moved (password change, disable, role change, sign out everywhere)', () => {
    expect(evaluateSession(claims, user({ sessionVersion: 4 }), DEFAULT_POLICY, after(1))).toBe(
      'revoked',
    );
  });

  it('single session: another sign in replaces the sid (Users on by default)', () => {
    expect(
      evaluateSession(claims, user({ activeSessionId: 'sid-2' }), DEFAULT_POLICY, after(1)),
    ).toBe('other-device');
  });

  it('single session is off for Super admins by default', () => {
    for (const appRole of ['super_admin'] as AppRole[]) {
      expect(
        evaluateSession(
          claims,
          user({ appRole, activeSessionId: 'sid-2' }),
          DEFAULT_POLICY,
          after(1),
        ),
      ).toBeNull();
    }
  });

  it('single session can be switched on for Super admins in the policy', () => {
    const policy = { ...DEFAULT_POLICY, singleSessionSuper: true };
    expect(
      evaluateSession(
        claims,
        user({ appRole: 'super_admin', activeSessionId: 'sid-2' }),
        policy,
        after(1),
      ),
    ).toBe('other-device');
  });

  describe.each<[AppRole, number, number]>([
    ['user', 480, 12],
    ['super_admin', 120, 8],
  ])('%s: idle %i minutes, absolute %i hours', (appRole, idle, absolute) => {
    it('ends after the idle limit', () => {
      const u = user({ appRole });
      expect(evaluateSession(claims, u, DEFAULT_POLICY, after(idle - 1))).toBeNull();
      expect(evaluateSession(claims, u, DEFAULT_POLICY, after(idle + 1))).toBe('idle');
    });

    it('activity moves the idle clock', () => {
      const u = user({ appRole, lastSeenAt: after(idle - 5) });
      expect(evaluateSession(claims, u, DEFAULT_POLICY, after(idle + 60))).toBeNull();
    });

    it('ends after the absolute limit even when active', () => {
      const now = after(absolute * 60 + 1);
      const u = user({ appRole, lastSeenAt: after(absolute * 60 - 1) });
      expect(evaluateSession(claims, u, DEFAULT_POLICY, now)).toBe('absolute');
    });
  });

  it('reads the limits from the policy', () => {
    const policy = { ...DEFAULT_POLICY, idleMinutesUser: 30, absoluteHoursUser: 1 };
    expect(evaluateSession(claims, user(), policy, after(31))).toBe('idle');
    const u = user({ lastSeenAt: after(61) });
    expect(evaluateSession(claims, u, policy, after(62))).toBe('absolute');
  });

  it('never applies an idle limit under 10 minutes (lastSeenAt is written every 5)', () => {
    const policy = { ...DEFAULT_POLICY, idleMinutesUser: 3 };
    expect(MIN_IDLE_MINUTES).toBe(10);
    expect(evaluateSession(claims, user(), policy, after(9))).toBeNull();
    expect(evaluateSession(claims, user(), policy, after(11))).toBe('idle');
  });

  it('uses the sign in time when the user was never seen', () => {
    expect(evaluateSession(claims, user({ lastSeenAt: null }), DEFAULT_POLICY, after(481))).toBe(
      'idle',
    );
  });
});

describe('evaluateSession: screenshot suspension', () => {
  const suspended = { accessSuspendedAt: T0 };
  it('refuses a suspended student with the reason "suspended", even with a stale session version', () => {
    expect(evaluateSession(claims, user(suspended), DEFAULT_POLICY, after(1))).toBe('suspended');
    expect(
      evaluateSession(claims, user({ ...suspended, sessionVersion: 4 }), DEFAULT_POLICY, after(1)),
    ).toBe('suspended');
  });
  it('never applies to a Super admin', () => {
    expect(
      evaluateSession(
        claims,
        user({ ...suspended, appRole: 'super_admin' }),
        DEFAULT_POLICY,
        after(1),
      ),
    ).toBeNull();
  });
  it('a disabled account stays "revoked"', () => {
    expect(
      evaluateSession(claims, user({ ...suspended, status: 'DISABLED' }), DEFAULT_POLICY, after(1)),
    ).toBe('revoked');
  });
});
