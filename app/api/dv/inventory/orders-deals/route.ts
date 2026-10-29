// GET /api/dv/inventory/orders-deals?advertiser=…&status=ACTIVE,PAUSED&campaignId=&q=   (routes.md 8.10)
import { getSessionUser } from '@/lib/auth/session';
import { badRequest, readResponse, unauthenticated } from '@/lib/creatives/api';
import { listOrdersDeals } from '@/lib/inventory/deals';
import type { DealStatusKey } from '@/lib/inventory/transitions';

export const dynamic = 'force-dynamic';

const STATUSES = ['ACTIVE', 'ARCHIVED', 'PAUSED', 'DRAFT', 'COMPLETED', 'NOT_SERVABLE'];

export async function GET(req: Request) {
  const user = await getSessionUser();
  if (!user) return unauthenticated();
  const params = new URL(req.url).searchParams;
  const advertiser = params.get('advertiser');
  const status = (params.get('status') ?? '').split(',').filter(Boolean);
  if (!advertiser || status.some((s) => !STATUSES.includes(s))) return badRequest('advertiser and valid filters are required.');
  const campaignId = params.get('campaignId');
  const q = params.get('q');
  return readResponse(() =>
    listOrdersDeals(user, advertiser, {
      ...(status.length ? { status: status as DealStatusKey[] } : {}),
      ...(campaignId ? { campaignId } : {}),
      ...(q ? { q } : {}),
    }),
  );
}
