// GET  /api/dv/ad-groups/:id/ads   the ad rows (module 09 Y11)
// POST /api/dv/ad-groups/:id/ads   { value, note? } create an ad (Y12)
import { getSessionUser } from '@/lib/auth/session';
import { badRequest, json, parseWrite, respond, unauthenticated } from '@/lib/youtube/api';
import { createAd, getAdGroupDetail } from '@/lib/youtube/service';
import type { AdFormValue } from '@/lib/youtube/types';

export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  const user = await getSessionUser();
  if (!user) return unauthenticated();
  const out = await getAdGroupDetail(user, (await ctx.params).id);
  return out ? json({ rows: out.ads }) : json({ error: 'NOT_FOUND' }, 404);
}

export async function POST(req: Request, ctx: Ctx) {
  const user = await getSessionUser();
  if (!user) return unauthenticated();
  const body = parseWrite(await req.json().catch(() => null));
  if (!body.success) return badRequest('value is required.');
  return respond(
    await createAd(
      user,
      (await ctx.params).id,
      body.data.value as unknown as AdFormValue,
      body.data.note ? { note: body.data.note } : {},
    ),
    201,
  );
}
