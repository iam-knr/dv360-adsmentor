// Edge middleware (routes.md 5.3, module 18 4.3 rule 2, module 19 4.6.1). It only reads the signed session cookie
// and the role claim. Status, sessionVersion, single session and idle limits are checked by requireUser() in every
// page, action and handler. There are no class windows (ADM-FIX).
import NextAuth from 'next-auth';
import { NextResponse, type NextFetchEvent, type NextRequest } from 'next/server';
import { authConfig } from '@/lib/auth/config';
import { devBypassUser, isDevBypassEnabled } from '@/lib/auth/dev-bypass';
import { decide, isApiPath, isPublicPath } from '@/lib/auth/guard';
import type { SessionClaims } from '@/lib/auth/types';
import {
  VIEW_AS_ACT_HEADER,
  VIEW_AS_ACT_PARAM,
  VIEW_AS_HEADER,
  VIEW_AS_PARAM,
} from '@/lib/auth/view-as-headers';

const { auth } = NextAuth(authConfig);

function withSecurityHeaders(res: NextResponse, pathname: string): NextResponse {
  if (
    pathname.startsWith('/sim') ||
    pathname.startsWith('/manage') ||
    pathname.startsWith('/api/auth')
  ) {
    res.headers.set('Cache-Control', 'no-store');
    res.headers.set('Content-Security-Policy', "frame-ancestors 'none'");
    res.headers.set('X-Frame-Options', 'DENY');
    res.headers.set('X-Content-Type-Options', 'nosniff');
    res.headers.set('Referrer-Policy', 'same-origin');
  }
  return res;
}

/** The view-as and class override headers come from the URL only; anything the browser sent in them is dropped. */
function cleanHeaders(req: NextRequest): Headers {
  const headers = new Headers(req.headers);
  headers.delete(VIEW_AS_HEADER);
  headers.delete(VIEW_AS_ACT_HEADER);
  return headers;
}

function json(status: number, body: Record<string, unknown>): NextResponse {
  return NextResponse.json(body, { status });
}

type NextMiddlewareFn = (
  req: NextRequest,
  event: NextFetchEvent,
) => Promise<Response | void> | Response | void;

const authenticated = auth((req) => {
  const { pathname, search } = req.nextUrl;
  const sessionUser = req.auth?.user;
  let session: SessionClaims | null = sessionUser
    ? { id: sessionUser.id, appRole: sessionUser.appRole, mcp: sessionUser.mcp }
    : null;
  if (!session && isDevBypassEnabled()) {
    session = { id: 'dev-user', appRole: devBypassUser().appRole, mcp: false };
  }

  const decision = decide({ pathname, search, session });
  switch (decision.type) {
    case 'redirect':
      return withSecurityHeaders(
        NextResponse.redirect(new URL(decision.to, req.nextUrl.origin), decision.status),
        pathname,
      );
    case 'unauthorized':
      return json(401, { error: 'UNAUTHENTICATED' });
    case 'password-change-required':
      return json(403, { error: 'PASSWORD_CHANGE_REQUIRED' });
    case 'next':
      break;
  }

  const headers = cleanHeaders(req);
  if (session && !isApiPath(pathname)) {
    const params = req.nextUrl.searchParams;
    const as = params.get(VIEW_AS_PARAM);
    if (as) {
      headers.set(VIEW_AS_HEADER, as);
      if (params.get(VIEW_AS_ACT_PARAM) === '1') headers.set(VIEW_AS_ACT_HEADER, '1');
    }
  }
  return withSecurityHeaders(NextResponse.next({ request: { headers } }), pathname);
});

function passThrough(req: NextRequest, pathname: string): NextResponse {
  return withSecurityHeaders(
    NextResponse.next({ request: { headers: cleanHeaders(req) } }),
    pathname,
  );
}

/**
 * Public paths (the login page, the health check, the home page, cron endpoints that carry their own secret) do not
 * need the session, so they skip Auth.js. A deployment without AUTH_SECRET therefore still serves /, /api/health
 * and the component gallery; only the pages that need a session fail until the secret is set.
 */
export default function middleware(req: NextRequest, event: NextFetchEvent) {
  const { pathname, search } = req.nextUrl;
  if (isPublicPath(pathname)) {
    const decision = decide({ pathname, search, session: null });
    if (decision.type === 'redirect') {
      return NextResponse.redirect(new URL(decision.to, req.nextUrl.origin), decision.status);
    }
    return passThrough(req, pathname);
  }
  if (pathname === '/ng_nav' || pathname.startsWith('/ng_nav/')) {
    const decision = decide({ pathname, search, session: null });
    if (decision.type === 'redirect' && decision.status === 308) {
      return NextResponse.redirect(new URL(decision.to, req.nextUrl.origin), 308);
    }
  }
  return (authenticated as unknown as NextMiddlewareFn)(req, event);
}

// Only Next.js internals and the public brand folder skip the middleware. A file extension is not a reason to skip
// it: a DV360 route may end in ".js" or ".txt" (an id or a name), and it still needs a session.
export const config = {
  matcher: ['/((?!_next/|favicon\\.ico$|brand/).*)'],
};
