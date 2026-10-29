// GET    /api/dv/ads/:id   ad detail (module 09)
// PUT    /api/dv/ads/:id   { value, expectedVersion?, note? } update (Y13)
// DELETE /api/dv/ads/:id   hard delete (Y15)
import { getSessionUser } from '@/lib/auth/session';
import { badRequest, json, parseWrite, respond, unauthenticated } from '@/lib/youtube/api';
import { deleteAd, getAdDetail, updateAd } from '@/lib/youtube/service';
import type { AdFormValue } from '@/lib/youtube/types';

export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  const user = await getSessionUser();
  if (!user) return unauthenticated();
  const out = await getAdDetail(user, (await ctx.params).id);
  return out ? json(out) : json({ error: 'NOT_FOUND' }, 404);
}

export async function PUT(req: Request, ctx: Ctx) {
  const user = await getSessionUser();
  if (!user) return unauthenticated();
  const body = parseWrite(await req.json().catch(() => null));
  if (!body.success) return badRequest('value is required.');
  return respond(
    await updateAd(user, (await ctx.params).id, body.data.value as unknown as AdFormValue, {
      ...(body.data.expectedVersion !== undefined
        ? { expectedVersion: body.data.expectedVersion }
        : {}),
      ...(body.data.note ? { note: body.data.note } : {}),
    }),
  );
}

export async function DELETE(_req: Request, ctx: Ctx) {
  const user = await getSessionUser();
  if (!user) return unauthenticated();
  return respond(await deleteAd(user, (await ctx.params).id));
}
