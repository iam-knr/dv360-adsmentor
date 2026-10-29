// GET /api/dv/youtube/video-lookup?q=   watch URL, youtu.be, shorts URL, id or title text (module 09 Y16)
import { getSessionUser } from '@/lib/auth/session';
import { json, unauthenticated } from '@/lib/youtube/api';
import { lookupVideos } from '@/lib/youtube/service';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const user = await getSessionUser();
  if (!user) return unauthenticated();
  const q = new URL(req.url).searchParams.get('q') ?? '';
  return json({ rows: await lookupVideos(user, q) });
}
