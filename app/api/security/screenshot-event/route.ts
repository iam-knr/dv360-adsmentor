// POST /api/security/screenshot-event: the page reports a recognised screenshot key (docs/gaps/screenshot-guard.md).
// The client only says "this method on this page"; who the person is, whether they are guarded and everything that
// follows is decided here from the signed session. Same origin only, rate limited, idempotent.
import { NextResponse, type NextRequest } from 'next/server';
import { eventRateLimited, recordScreenshotEvent } from '@/lib/accounts/screenshot-guard';
import { resolveSession } from '@/lib/auth/session';
import { isScreenshotGuarded } from '@/lib/security/guard-policy';
import { isSameOrigin } from '@/lib/security/same-origin';
import { isScreenshotMethod } from '@/lib/security/screenshot-detect';

export const dynamic = 'force-dynamic';

const MAX_BODY = 2048;
const json = (status: number, body: Record<string, unknown>) =>
  NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } });

export async function POST(req: NextRequest) {
  if (!isSameOrigin(req)) return json(403, { error: 'CROSS_ORIGIN' });

  const session = await resolveSession();
  if (!session.ok) {
    return session.reason === 'suspended'
      ? json(403, { error: 'ACCESS_SUSPENDED' })
      : json(401, { error: 'UNAUTHENTICATED' });
  }
  const user = session.user;

  let body: { method?: unknown; path?: unknown };
  try {
    const text = await req.text();
    if (text.length > MAX_BODY) return json(413, { error: 'TOO_LARGE' });
    body = JSON.parse(text) as typeof body;
  } catch {
    return json(400, { error: 'BAD_REQUEST' });
  }
  if (!body || typeof body !== 'object' || !isScreenshotMethod(body.method))
    return json(400, { error: 'BAD_METHOD' });

  // The Super admin (also while viewing a student) and students whose screenshots are allowed are ignored.
  if (!isScreenshotGuarded(user)) return json(200, { ok: true, ignored: true });

  if (await eventRateLimited(user.id)) return json(429, { error: 'RATE_LIMITED' });

  const outcome = await recordScreenshotEvent(user.id, { method: body.method, path: body.path });
  return json(200, { ok: true, status: outcome.status });
}
