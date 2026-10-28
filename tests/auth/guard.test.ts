import { describe, expect, it } from 'vitest';
import { decide, isDvPath, isPublicPath, safeNext } from '@/lib/auth/guard';
import {
  SUPER_ADMIN_LANDING,
  atLeast,
  defaultDvRole,
  landingFor,
  toDbRole,
  toSessionRole,
} from '@/lib/auth/roles';
import type { AppRole, SessionClaims } from '@/lib/auth/types';

const claims = (appRole: AppRole, mcp = false): SessionClaims => ({ id: 'u1', appRole, mcp });
const at = (pathname: string, session: SessionClaims | null, search = '') =>
  decide({ pathname, search, session });

describe('middleware decisions', () => {
  it('redirects /ng_nav/** to /** with 308 and keeps the query', () => {
    expect(at('/ng_nav/p/1/home_v3', null, '?a=1')).toEqual({
      type: 'redirect',
      to: '/p/1/home_v3?a=1',
      status: 308,
    });
    expect(at('/ng_nav', claims('user'))).toEqual({ type: 'redirect', to: '/', status: 308 });
    expect(at('/ng_navigation', claims('user')).type).toBe('window-check'); // not the prefix
  });

  it('never turns /ng_nav into an open redirect', () => {
    for (const path of [
      '/ng_nav//evil.test',
      '/ng_nav///evil.test/x',
      '/ng_nav/\\evil.test',
      '/ng_nav/\\/evil.test',
    ]) {
      const d = at(path, null);
      expect(d.type).toBe('redirect');
      if (d.type === 'redirect') {
        expect(d.to.startsWith('/'), path).toBe(true);
        expect(d.to.startsWith('//'), path).toBe(false);
        expect(d.to.startsWith('/\\'), path).toBe(false);
        expect(new URL(d.to, 'https://sim.example.test').host, path).toBe('sim.example.test');
      }
    }
  });

  it('lets public paths through without a session', () => {
    for (const p of [
      '/',
      '/sim/login',
      '/sim/session-expired',
      '/api/auth/csrf',
      '/api/health',
      '/components',
    ]) {
      expect(at(p, null), p).toEqual({ type: 'next' });
    }
    expect(isPublicPath('/sim/me')).toBe(false);
  });

  it('sends a signed out person to /sim/login?next=', () => {
    expect(at('/sim/me', null)).toEqual({
      type: 'redirect',
      to: '/sim/login?next=%2Fsim%2Fme',
      status: 307,
    });
    expect(at('/p/1/home_v3', null, '?x=1')).toEqual({
      type: 'redirect',
      to: `/sim/login?next=${encodeURIComponent('/p/1/home_v3?x=1')}`,
      status: 307,
    });
    expect(at('/manage/accounts', null).type).toBe('redirect');
  });

  it('answers API calls without a session with 401, not a redirect', () => {
    expect(at('/api/dv/campaigns', null)).toEqual({ type: 'unauthorized' });
    expect(at('/api/sim/access/state', null)).toEqual({ type: 'unauthorized' });
  });

  it('forces the password change first, for pages and APIs', () => {
    const c = claims('user', true);
    expect(at('/sim/welcome', c)).toEqual({
      type: 'redirect',
      to: '/sim/me/password',
      status: 307,
    });
    expect(at('/p/1/home_v3', c)).toEqual({
      type: 'redirect',
      to: '/sim/me/password',
      status: 307,
    });
    expect(at('/api/dv/campaigns', c)).toEqual({ type: 'password-change-required' });
    for (const ok of [
      '/sim/me/password',
      '/sim/logout',
      '/api/auth/session',
      '/sim/session-expired',
    ]) {
      expect(at(ok, c).type, ok).toBe('next');
    }
    expect(at('/sim/me', claims('admin', true))).toEqual({
      type: 'redirect',
      to: '/sim/me/password',
      status: 307,
    });
  });

  it('role guards send people without rights to /sim/forbidden (RC-075)', () => {
    const forbidden = { type: 'redirect', to: '/sim/forbidden', status: 307 };
    expect(at('/sim/instructor', claims('user'))).toEqual(forbidden);
    expect(at('/sim/instructor/classes', claims('user'))).toEqual(forbidden);
    expect(at('/sim/admin', claims('user'))).toEqual(forbidden);
    expect(at('/sim/admin', claims('admin'))).toEqual(forbidden);
    expect(at('/manage', claims('user'))).toEqual(forbidden);
    expect(at('/manage/accounts/new', claims('user'))).toEqual(forbidden);
    expect(at('/manage/settings', claims('admin'))).toEqual(forbidden);

    expect(at('/sim/instructor', claims('admin'))).toEqual({ type: 'next' });
    expect(at('/sim/instructor', claims('super_admin'))).toEqual({ type: 'next' });
    expect(at('/sim/admin', claims('super_admin'))).toEqual({ type: 'next' });
    expect(at('/manage/accounts', claims('admin'))).toEqual({ type: 'next' });
    expect(at('/manage/settings', claims('super_admin'))).toEqual({ type: 'next' });
  });

  it('asks for the class window check for students on DV360 and student pages only', () => {
    expect(at('/p/1/home_v3', claims('user'))).toEqual({ type: 'window-check' });
    expect(at('/ng_nav/x', claims('user')).type).toBe('redirect');
    expect(at('/sim/welcome', claims('user'))).toEqual({ type: 'window-check' });
    expect(at('/sim/scenarios/abc', claims('user'))).toEqual({ type: 'window-check' });
    expect(at('/404', claims('user'))).toEqual({ type: 'window-check' });
    for (const free of [
      '/sim/me',
      '/sim/me/password',
      '/sim/closed',
      '/sim/logout',
      '/sim/forbidden',
      '/api/sim/access/state',
    ]) {
      expect(at(free, claims('user')).type, free).toBe('next');
    }
  });

  it('instructors and admins skip the class window', () => {
    for (const role of ['admin', 'super_admin'] as AppRole[]) {
      expect(at('/p/1/home_v3', claims(role))).toEqual({ type: 'next' });
      expect(at('/sim/welcome', claims(role))).toEqual({ type: 'next' });
    }
  });

  it('knows what a DV360 path is', () => {
    expect(isDvPath('/p/1/home_v3')).toBe(true);
    expect(isDvPath('/a/2/cs')).toBe(true);
    expect(isDvPath('/')).toBe(false);
    for (const p of ['/sim/x', '/manage/x', '/api/x', '/components', '/_next/x'])
      expect(isDvPath(p), p).toBe(false);
  });
});

describe('safeNext', () => {
  it('keeps same-site paths', () => {
    expect(safeNext('/p/1/home_v3?x=1')).toBe('/p/1/home_v3?x=1');
    expect(safeNext('/sim/me')).toBe('/sim/me');
  });
  it('drops everything that could leave the site or loop', () => {
    for (const bad of [
      null,
      undefined,
      '',
      'https://evil.test',
      '//evil.test',
      '/\\evil.test',
      'javascript:alert(1)',
      '/sim/login',
      '/sim/login?next=/x',
      '/a\nb',
      `/${'a'.repeat(2100)}`,
    ]) {
      expect(safeNext(bad), String(bad)).toBeNull();
    }
  });
});

describe('role map', () => {
  it('maps database values to lowercase session values and back (RC-016, RC-068)', () => {
    expect(toSessionRole('USER')).toBe('user');
    expect(toSessionRole('ADMIN')).toBe('admin');
    expect(toSessionRole('SUPER_ADMIN')).toBe('super_admin');
    for (const r of ['user', 'admin', 'super_admin'] as AppRole[])
      expect(toSessionRole(toDbRole(r))).toBe(r);
  });
  it('orders SUPER_ADMIN > ADMIN > USER', () => {
    expect(atLeast('super_admin', 'admin')).toBe(true);
    expect(atLeast('admin', 'super_admin')).toBe(false);
    expect(atLeast('user', 'user')).toBe(true);
  });
  it('gives Users STANDARD and admins DV360 ADMIN (RC-047)', () => {
    expect(defaultDvRole('user')).toBe('STANDARD');
    expect(defaultDvRole('admin')).toBe('ADMIN');
    expect(defaultDvRole('super_admin')).toBe('ADMIN');
  });
  it('lands each level on its own page', () => {
    expect(landingFor('user')).toBe('/sim/welcome');
    expect(landingFor('admin')).toBe('/sim/instructor');
    expect(landingFor('super_admin')).toBe(SUPER_ADMIN_LANDING);
  });
});
