import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { devBypassUser, isDevBypassEnabled } from '@/lib/auth/dev-bypass';
import { decide } from '@/lib/auth/guard';

describe('AUTH_DEV_BYPASS can never be on in production', () => {
  it.each(['1', 'true', 'TRUE', ' 1 '])('production ignores AUTH_DEV_BYPASS=%j', (flag) => {
    expect(isDevBypassEnabled({ NODE_ENV: 'production', AUTH_DEV_BYPASS: flag })).toBe(false);
  });
  it('a Vercel production deployment ignores it whatever NODE_ENV says', () => {
    expect(
      isDevBypassEnabled({
        NODE_ENV: 'development',
        AUTH_DEV_BYPASS: '1',
        VERCEL_ENV: 'production',
      }),
    ).toBe(false);
  });
  it('an unset or odd NODE_ENV does not turn it on', () => {
    expect(isDevBypassEnabled({ AUTH_DEV_BYPASS: '1' })).toBe(false);
    expect(isDevBypassEnabled({ NODE_ENV: 'staging', AUTH_DEV_BYPASS: '1' })).toBe(false);
  });
  it('is on only for 1 or true in development and test', () => {
    expect(isDevBypassEnabled({ NODE_ENV: 'development', AUTH_DEV_BYPASS: '1' })).toBe(true);
    expect(isDevBypassEnabled({ NODE_ENV: 'test', AUTH_DEV_BYPASS: 'true' })).toBe(true);
    expect(isDevBypassEnabled({ NODE_ENV: 'development', AUTH_DEV_BYPASS: '0' })).toBe(false);
    expect(isDevBypassEnabled({ NODE_ENV: 'development' })).toBe(false);
  });
  it('the bypass user is a Super admin only under test', () => {
    expect(devBypassUser({ NODE_ENV: 'test' }).appRole).toBe('super_admin');
    expect(devBypassUser({ NODE_ENV: 'development' }).appRole).toBe('admin');
  });
  it('without a session the middleware logic still redirects (it never sees a bypass user in production)', () => {
    expect(decide({ pathname: '/sim/me', search: '', session: null }).type).toBe('redirect');
  });
});

// The real entry points: with NODE_ENV=production and the flag set, no user comes back.
describe('getSessionUser in production', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.doMock('@/lib/auth/index', () => ({ auth: () => Promise.resolve(null) }));
    vi.doMock('next/headers', () => ({ headers: () => Promise.resolve(new Headers()) }));
    vi.doMock('next/navigation', () => ({ redirect: () => undefined }));
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.doUnmock('@/lib/auth/index');
    vi.doUnmock('next/headers');
    vi.doUnmock('next/navigation');
  });

  it('returns null and requireUser throws when NODE_ENV is production, even with AUTH_DEV_BYPASS=1', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('AUTH_DEV_BYPASS', '1');
    const { getSessionUser, requireUser } = await import('@/lib/auth/session');
    await expect(getSessionUser()).resolves.toBeNull();
    await expect(requireUser()).rejects.toThrow('UNAUTHENTICATED');
  });

  it('returns the fixed dev user under test with the flag set', async () => {
    vi.stubEnv('NODE_ENV', 'test');
    vi.stubEnv('AUTH_DEV_BYPASS', '1');
    const { getSessionUser } = await import('@/lib/auth/session');
    const user = await getSessionUser();
    expect(user?.id).toBe('dev-user');
    expect(user?.appRole).toBe('super_admin');
  });

  it('returns null under test without the flag', async () => {
    vi.stubEnv('NODE_ENV', 'test');
    vi.stubEnv('AUTH_DEV_BYPASS', '');
    const { getSessionUser } = await import('@/lib/auth/session');
    await expect(getSessionUser()).resolves.toBeNull();
  });
});
