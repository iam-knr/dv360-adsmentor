// POST /api/dv/marketplace/discover  { advertiser, mode, query, filters, page? }   (routes.md 8.10)
import { getSessionUser } from '@/lib/auth/session';
import { badRequest, readResponse, unauthenticated } from '@/lib/creatives/api';
import { discover } from '@/lib/inventory/marketplace';
import type { DiscoverRequest } from '@/lib/inventory/types';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return unauthenticated();
  const body = (await req.json().catch(() => null)) as (Partial<DiscoverRequest> & { advertiser?: string }) | null;
  if (!body?.advertiser || (body.mode !== 'AI' && body.mode !== 'KEYWORD')) return badRequest('advertiser and mode are required.');
  const { advertiser, ...rest } = body;
  return readResponse(() =>
    discover(user, advertiser, { mode: body.mode as 'AI' | 'KEYWORD', query: rest.query ?? '', filters: rest.filters ?? {}, ...(rest.page ? { page: rest.page } : {}) }),
  );
}
