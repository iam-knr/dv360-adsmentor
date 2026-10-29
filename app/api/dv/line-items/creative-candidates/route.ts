// GET /api/dv/line-items/creative-candidates?ioId=…&type=DISPLAY[&adType=VIDEO]
// Creatives the "Select creatives" panel offers for a draft in that IO, with eligibility per MX-09 (L14, Δ-08-5).
import { getSessionUser } from '@/lib/auth/session';
import { badRequest, json, unauthenticated } from '@/lib/line-items/api';
import { getCreativeCandidates } from '@/lib/line-items/service';
import { isFormType } from '@/lib/line-items/type-config';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const user = await getSessionUser();
  if (!user) return unauthenticated();
  const params = new URL(req.url).searchParams;
  const ioId = params.get('ioId');
  const type = params.get('type') ?? '';
  const adTypeParam = params.get('adType');
  const adType = adTypeParam === 'DISPLAY' || adTypeParam === 'VIDEO' ? adTypeParam : null;
  if (!ioId || !isFormType(type)) return badRequest('ioId and a supported type are required.');
  if (adTypeParam && !adType) return badRequest('Unknown adType.');
  const rows = await getCreativeCandidates(user, ioId, {
    type,
    ...(adType ? { adType } : {}),
  });
  return json({ rows, total: rows.length });
}
