// B1 insertion orders list at advertiser or campaign scope (routes.md 8.5).
import { NextResponse, type NextRequest } from 'next/server';
import { ServiceFailure } from '@/lib/campaigns/service-kit';
import { listInsertionOrders } from '@/lib/insertion-orders/service';
import { getSessionUser } from '@/lib/auth/session';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: 'UNAUTHENTICATED' }, { status: 401 });
  const p = req.nextUrl.searchParams;
  const campaignId = p.get('campaignId');
  const advertiserId = p.get('advertiserId');
  if (!campaignId && !advertiserId) return NextResponse.json({ error: 'INVALID' }, { status: 400 });
  try {
    const result = await listInsertionOrders(
      user,
      campaignId ? { campaignId } : { advertiserId: advertiserId! },
      {
        status: p.getAll('status').length ? p.getAll('status') : ['ACTIVE'],
        page: Number(p.get('page') ?? 1),
        pageSize: Math.min(Number(p.get('pageSize') ?? 20), 200),
        d: p.get('d'),
      },
    );
    return NextResponse.json(result, { headers: { 'Cache-Control': 'no-store' } });
  } catch (e) {
    if (e instanceof ServiceFailure)
      return NextResponse.json(
        { error: e.code },
        { status: e.code === 'FORBIDDEN' ? 403 : e.code === 'NOT_FOUND' ? 404 : 400 },
      );
    throw e;
  }
}
