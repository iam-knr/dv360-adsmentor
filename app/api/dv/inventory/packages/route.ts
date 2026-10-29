// GET /api/dv/inventory/packages?advertiser=…&campaignId=   (routes.md 8.10)
import { getSessionUser } from '@/lib/auth/session';
import { badRequest, readResponse, unauthenticated } from '@/lib/creatives/api';
import { listPackages } from '@/lib/inventory/deals';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const user = await getSessionUser();
  if (!user) return unauthenticated();
  const params = new URL(req.url).searchParams;
  const advertiser = params.get('advertiser');
  if (!advertiser) return badRequest('advertiser is required.');
  return readResponse(() => listPackages(user, advertiser, params.get('campaignId') ?? undefined));
}
