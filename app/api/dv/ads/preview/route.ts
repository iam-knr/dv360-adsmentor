// POST /api/dv/ads/preview   { adGroupId, videoRef, text…, filter, format, device, surface } (module 09 Y17)
// A pure function of the draft: nothing is written, the ad need not exist.
import { getSessionUser } from '@/lib/auth/session';
import { badRequest, json, parsePreview, unauthenticated } from '@/lib/youtube/api';
import { previewAd } from '@/lib/youtube/service';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return unauthenticated();
  const body = parsePreview(await req.json().catch(() => null));
  if (!body.success) return badRequest('adGroupId is required.');
  const out = await previewAd(user, body.data);
  return out ? json(out) : json({ error: 'NOT_FOUND' }, 404);
}
