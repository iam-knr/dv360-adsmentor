// POST /api/dv/marketplace/bulk-assign  { advertiser, productIds, lineItemIds }   (routes.md 8.10, RC: assigns to line items)
import { getSessionUser } from '@/lib/auth/session';
import { badRequest, resultToHttp, unauthenticated } from '@/lib/creatives/api';
import { bulkAssignMarketplace } from '@/lib/inventory/marketplace';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return unauthenticated();
  const body = (await req.json().catch(() => null)) as {
    advertiser?: string;
    productIds?: string[];
    lineItemIds?: string[];
  } | null;
  if (!body?.advertiser) return badRequest('advertiser is required.');
  return resultToHttp(
    await bulkAssignMarketplace(user, body.advertiser, {
      productIds: body.productIds ?? [],
      lineItemIds: body.lineItemIds ?? [],
    }),
  );
}
