// GET  /api/dv/negotiations?advertiser=…&status=PROPOSED,COUNTERED   list
// POST /api/dv/negotiations  { advertiser, rfpId }                    import   (routes.md 8.10)
import { getSessionUser } from '@/lib/auth/session';
import { badRequest, readResponse, resultToHttp, unauthenticated } from '@/lib/creatives/api';
import {
  importNegotiation,
  listNegotiations,
  type NegotiationStatusKey,
} from '@/lib/inventory/negotiations';

export const dynamic = 'force-dynamic';

const STATUSES = ['DRAFT', 'PROPOSED', 'COUNTERED', 'ACCEPTED', 'DECLINED', 'EXPIRED'];

export async function GET(req: Request) {
  const user = await getSessionUser();
  if (!user) return unauthenticated();
  const params = new URL(req.url).searchParams;
  const advertiser = params.get('advertiser');
  const status = (params.get('status') ?? '').split(',').filter(Boolean);
  if (!advertiser || status.some((s) => !STATUSES.includes(s)))
    return badRequest('advertiser and valid filters are required.');
  return readResponse(() =>
    listNegotiations(
      user,
      advertiser,
      status.length ? { status: status as NegotiationStatusKey[] } : {},
    ),
  );
}

export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return unauthenticated();
  const body = (await req.json().catch(() => null)) as {
    advertiser?: string;
    rfpId?: string;
  } | null;
  if (!body?.advertiser) return badRequest('advertiser is required.');
  return resultToHttp(
    await importNegotiation(user, body.advertiser, { rfpId: body.rfpId ?? '' }),
    201,
  );
}
