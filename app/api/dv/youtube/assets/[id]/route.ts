// GET /api/dv/youtube/assets/:id   bytes of an uploaded logo or companion banner (module 09 Y18)
import { getSessionUser } from '@/lib/auth/session';
import { json, unauthenticated } from '@/lib/youtube/api';
import { readAdAsset } from '@/lib/youtube/service';

export const dynamic = 'force-dynamic';

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return unauthenticated();
  const { id } = await ctx.params;
  const file = await readAdAsset(user, id);
  if (!file) {
    // seeded ads point at stock files (logo and sample image) that have no stored bytes
    const stock =
      id === 'default-logo'
        ? '/youtube/logo.svg'
        : id.startsWith('sample-')
          ? '/youtube/placeholder.svg'
          : null;
    return stock
      ? Response.redirect(new URL(stock, req.url), 302)
      : json({ error: 'NOT_FOUND' }, 404);
  }
  return new Response(Buffer.from(file.bytes), {
    headers: { 'Content-Type': file.contentType, 'Cache-Control': 'private, max-age=60' },
  });
}
