// POST /api/dv/creatives/test-tag  { tag }   macro substitution only, never fetched (module 12 S10)
import { getSessionUser } from '@/lib/auth/session';
import { badRequest, json, unauthenticated } from '@/lib/creatives/api';
import { testTag } from '@/lib/creatives/service';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return unauthenticated();
  const body = (await req.json().catch(() => null)) as { tag?: unknown } | null;
  if (typeof body?.tag !== 'string' || body.tag.length > 100_000)
    return badRequest('tag is required.');
  return json(testTag(body.tag));
}
