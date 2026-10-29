// POST /api/dv/ads/:id/status   { status: 'ACTIVE' | 'PAUSED' } (module 09 Y14)
import { getSessionUser } from '@/lib/auth/session';
import { badRequest, parseStatusBody, respond, unauthenticated } from '@/lib/youtube/api';
import { setAdStatus } from '@/lib/youtube/service';

export const dynamic = 'force-dynamic';

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return unauthenticated();
  const body = parseStatusBody(await req.json().catch(() => null));
  if (!body.success) return badRequest('status must be ACTIVE or PAUSED.');
  return respond(await setAdStatus(user, (await ctx.params).id, body.data.status));
}
