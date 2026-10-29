// GET  /api/dv/line-items/:liId/ad-groups   list with performance columns (module 09 Y4)
// POST /api/dv/line-items/:liId/ad-groups   { value, note? } create (Y6)
import { getSessionUser } from '@/lib/auth/session';
import { badRequest, json, parseWrite, respond, unauthenticated } from '@/lib/youtube/api';
import { createAdGroup, listAdGroups } from '@/lib/youtube/service';
import type { AdGroupFormValue } from '@/lib/youtube/types';

export const dynamic = 'force-dynamic';

export async function GET(_req: Request, ctx: { params: Promise<{ liId: string }> }) {
  const user = await getSessionUser();
  if (!user) return unauthenticated();
  const out = await listAdGroups(user, (await ctx.params).liId);
  return out ? json(out) : json({ error: 'NOT_FOUND' }, 404);
}

export async function POST(req: Request, ctx: { params: Promise<{ liId: string }> }) {
  const user = await getSessionUser();
  if (!user) return unauthenticated();
  const body = parseWrite(await req.json().catch(() => null));
  if (!body.success) return badRequest('value is required.');
  return respond(
    await createAdGroup(
      user,
      (await ctx.params).liId,
      body.data.value as unknown as AdGroupFormValue,
      body.data.note ? { note: body.data.note } : {},
    ),
    201,
  );
}
