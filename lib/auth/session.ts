import 'server-only';
import { cache } from 'react';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { auth } from './index';
import { devBypassUser, isDevBypassEnabled } from './dev-bypass';
import { resolveSessionUser, type ResolvedSession } from './session-core';
import type { SessionFailureReason, SessionUser } from './types';
import { VIEW_AS_ACT_HEADER, VIEW_AS_HEADER } from './view-as-headers';
import { parseViewAs } from './view-as';

export class UnauthenticatedError extends Error {
  constructor(readonly reason: SessionFailureReason = 'none') {
    super('UNAUTHENTICATED');
    this.name = 'UnauthenticatedError';
  }
}

async function requestHeaders(): Promise<Headers | null> {
  try {
    return await headers();
  } catch {
    return null; // outside a request (tests, scripts)
  }
}

async function resolve(): Promise<ResolvedSession> {
  if (isDevBypassEnabled()) return { ok: true, user: devBypassUser() };

  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return { ok: false, reason: 'none' };

  const { sv, sid, loginAt } = session.user;
  if (sv < 0 || !sid || !loginAt) return { ok: false, reason: 'revoked' };

  const h = await requestHeaders();
  return resolveSessionUser({
    userId,
    claims: { sv, sid, loginAt },
    now: new Date(),
    viewAs: h ? parseViewAs((n) => h.get(n)) : null,
  });
}

/** One resolution per request (React cache), so layouts and pages share the database reads. */
export const resolveSession = cache(resolve);

/** The signed in user, or null. Never throws. */
export async function getSessionUser(): Promise<SessionUser | null> {
  const r = await resolveSession();
  return r.ok ? r.user : null;
}

/** For server actions and route handlers: throws `UnauthenticatedError` (message UNAUTHENTICATED). */
export async function requireUser(): Promise<SessionUser> {
  const r = await resolveSession();
  if (!r.ok) throw new UnauthenticatedError(r.reason);
  return r.user;
}

/** For pages and layouts: sends a signed out or expired person to the right page. */
export async function requireUserOrRedirect(): Promise<SessionUser> {
  const r = await resolveSession();
  if (r.ok) return r.user;
  if (r.reason === 'none') redirect('/sim/login');
  if (r.reason === 'suspended') redirect('/sim/suspended');
  redirect(`/sim/session-expired?reason=${r.reason}`);
}

export { VIEW_AS_HEADER, VIEW_AS_ACT_HEADER };
