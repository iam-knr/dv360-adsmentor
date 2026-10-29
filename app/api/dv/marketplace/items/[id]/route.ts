// GET /api/dv/marketplace/items/:id?advertiser=…   (routes.md 8.10)
import { getSessionUser } from '@/lib/auth/session';
import { badRequest, readResponse, unauthenticated } from '@/lib/creatives/api';
import { getMarketplaceItem } from '@/lib/inventory/marketplace';

export const dynamic = 'force-dynamic';

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return unauthenticated();
  const advertiser = new URL(req.url).searchParams.get('advertiser');
  if (!advertiser) return badRequest('advertiser is required.');
  const { id } = await params;
  return readResponse(() => getMarketplaceItem(user, advertiser, id));
}
