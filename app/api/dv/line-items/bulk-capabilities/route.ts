// GET /api/dv/line-items/bulk-capabilities?ids=1,2 (module 11 K1)
import { getSessionUser } from '@/lib/auth/session';
import { badRequest, NO_STORE, unauthenticated } from '@/lib/bulk/api';
import { bulkCapabilities } from '@/lib/bulk/run';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const user = await getSessionUser();
  if (!user) return unauthenticated();
  const ids = (new URL(req.url).searchParams.get('ids') ?? '')
    .split(',')
    .filter(Boolean)
    .slice(0, 500);
  if (ids.length === 0) return badRequest('ids is required.');
  return Response.json(
    { data: await bulkCapabilities(user, 'lineItem', ids) },
    { headers: NO_STORE },
  );
}
