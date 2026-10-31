// Pure routing decisions of middleware.ts (routes.md 5.3). No I/O, so it is unit tested without a server.
import type { SessionClaims } from './types';
import { areaForPath, canOpenArea } from '@/lib/rbac/areas';

export interface GuardInput {
  pathname: string;
  search: string;
  session: SessionClaims | null;
}

export type GuardDecision =
  | { type: 'next' }
  | { type: 'redirect'; to: string; status: 307 | 308 }
  | { type: 'unauthorized' }
  | { type: 'password-change-required' };

const PUBLIC_EXACT = new Set([
  '/',
  '/sim/login',
  '/sim/session-expired',
  '/sim/suspended',
  '/api/health',
]);
const PUBLIC_PREFIXES = ['/api/auth', '/api/sim/engine', '/components'];

/** Paths a person who must change the password may still reach. */
const ALLOWED_WHILE_MUST_CHANGE = [
  '/sim/me/password',
  '/sim/logout',
  '/sim/session-expired',
  '/api/auth',
];

function under(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

export function isPublicPath(pathname: string): boolean {
  return PUBLIC_EXACT.has(pathname) || PUBLIC_PREFIXES.some((p) => under(pathname, p));
}

export function isApiPath(pathname: string): boolean {
  return under(pathname, '/api');
}

/** A DV360 route: everything that is not simulator, account management, API or tooling. */
export function isDvPath(pathname: string): boolean {
  if (pathname === '/') return false;
  return !['/sim', '/manage', '/api', '/components', '/_next'].some((p) => under(pathname, p));
}

/** Accept only same-site relative paths for `?next=`. */
export function safeNext(next: string | null | undefined): string | null {
  if (!next || next.length > 2000) return null;
  if (!next.startsWith('/') || next.startsWith('//') || next.includes('\\')) return null;
  if (/[\u0000-\u001f]/.test(next)) return null;
  if (next === '/sim/login' || next.startsWith('/sim/login?')) return null;
  return next;
}

export function decide({ pathname, search, session }: GuardInput): GuardDecision {
  // 1. /ng_nav/** to /** (routes R1)
  if (under(pathname, '/ng_nav')) {
    // One leading slash only: "/ng_nav//evil.test" or "/ng_nav/\\evil.test" must not become a protocol relative URL.
    const rest = `/${pathname.slice('/ng_nav'.length).replace(/^[/\\]+/, '')}`;
    return { type: 'redirect', to: `${rest}${search}`, status: 308 };
  }
  if (isPublicPath(pathname)) return { type: 'next' };

  // 2. session required
  if (!session) {
    if (isApiPath(pathname)) return { type: 'unauthorized' };
    const next = encodeURIComponent(`${pathname}${search}`);
    return { type: 'redirect', to: `/sim/login?next=${next}`, status: 307 };
  }

  // 3. forced password change comes before anything else
  if (session.mcp && !ALLOWED_WHILE_MUST_CHANGE.some((p) => under(pathname, p))) {
    if (isApiPath(pathname)) return { type: 'password-change-required' };
    return { type: 'redirect', to: '/sim/me/password', status: 307 };
  }

  // 4. role gates (RC-075: /sim/** and /manage/** go to /sim/forbidden)
  const area = areaForPath(pathname);
  if (area && !canOpenArea(session.appRole, area)) {
    return { type: 'redirect', to: '/sim/forbidden', status: 307 };
  }

  // There are no class windows (ADM-FIX): a student with a session always gets through.
  return { type: 'next' };
}
