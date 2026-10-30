import { NextResponse, type NextRequest } from 'next/server';
import { listAccounts } from '@/lib/accounts/service';
import { actorOrResponse } from '@/lib/accounts/http';

export const dynamic = 'force-dynamic';

// GET /api/manage/accounts: scoped list, no secrets (module 19 4.7).
export async function GET(req: NextRequest) {
  const a = await actorOrResponse();
  if (a instanceof NextResponse) return a;
  const p = req.nextUrl.searchParams;
  const { rows, total } = await listAccounts(a, {
    search: p.get('q') ?? p.get('search') ?? undefined,
    page: Number(p.get('page') ?? 1) || 1,
    pageSize: Number(p.get('pageSize') ?? 20) || 20,
  });
  return NextResponse.json({ rows, total }, { headers: { 'Cache-Control': 'no-store' } });
}
