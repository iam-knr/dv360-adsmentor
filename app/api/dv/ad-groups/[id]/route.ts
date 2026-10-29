// GET    /api/dv/ad-groups/:id   detail with its ads (module 09 Y5, Y11)
// PUT    /api/dv/ad-groups/:id   { value, expectedVersion?, note? } update (Y7)
// DELETE /api/dv/ad-groups/:id   hard delete, ads cascade (Y9)
import { getSessionUser } from '@/lib/auth/session';
import { badRequest, json, parseWrite, respond, unauthenticated } from '@/lib/youtube/api';
import { deleteAdGroup, getAdGroupDetail, updateAdGroup } from '@/lib/youtube/service';
import type { AdGroupFormValue } from '@/lib/youtube/types';

export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  const user = await getSessionUser();
  if (!user) return unauthenticated();
  const out = await getAdGroupDetail(user, (await ctx.params).id);
  return out ? json(out) : json({ error: 'NOT_FOUND' }, 404);
}

export async function PUT(req: Request, ctx: Ctx) {
  const user = await getSessionUser();
  if (!user) return unauthenticated();
  const body = parseWrite(await req.json().catch(() => null));
  if (!body.success) return badRequest('value is required.');
  return respond(
    await updateAdGroup(
      user,
      (await ctx.params).id,
      body.data.value as unknown as AdGroupFormValue,
      {
        ...(body.data.expectedVersion !== undefined
          ? { expectedVersion: body.data.expectedVersion }
          : {}),
        ...(body.data.note ? { note: body.data.note } : {}),
      },
    ),
  );
}

export async function DELETE(_req: Request, ctx: Ctx) {
  const user = await getSessionUser();
  if (!user) return unauthenticated();
  return respond(await deleteAdGroup(user, (await ctx.params).id));
}
