// GET /api/dv/youtube/assets/:id   bytes of an uploaded logo or companion banner (module 09 Y18)
import { getSessionUser } from '@/lib/auth/session';
import { json, unauthenticated } from '@/lib/youtube/api';
import { readAdAsset } from '@/lib/youtube/service';

export const dynamic = 'force-dynamic';

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return unauthenticated();
  const file = await readAdAsset(user, (await ctx.params).id);
  if (!file) return json({ error: 'NOT_FOUND' }, 404);
  return new Response(Buffer.from(file.bytes), {
    headers: { 'Content-Type': file.contentType, 'Cache-Control': 'private, max-age=60' },
  });
}
