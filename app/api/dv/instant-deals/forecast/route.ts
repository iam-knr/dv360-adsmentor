// POST /api/dv/instant-deals/forecast  { advertiser, sellerId, name, targeting, advertiserIds }   (routes.md 8.10, RC-026)
import { getSessionUser } from '@/lib/auth/session';
import { badRequest, resultToHttp, unauthenticated } from '@/lib/creatives/api';
import { requestInstantForecast } from '@/lib/inventory/instant';
import type { InstantDealPayload } from '@/lib/inventory/types';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return unauthenticated();
  const body = (await req.json().catch(() => null)) as
    (Partial<InstantDealPayload> & { advertiser?: string }) | null;
  if (!body?.advertiser) return badRequest('advertiser is required.');
  return resultToHttp(
    await requestInstantForecast(user, body.advertiser, {
      sellerId: body.sellerId ?? '',
      name: body.name ?? '',
      targeting: body.targeting ?? {},
      advertiserIds: body.advertiserIds ?? [],
    }),
  );
}
