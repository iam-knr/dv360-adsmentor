import { NextResponse, type NextRequest } from 'next/server';
import { actorOrResponse } from '@/lib/accounts/http';
import { listAudit } from '@/lib/accounts/service';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const a = await actorOrResponse();
  if (a instanceof NextResponse) return a;
  const p = req.nextUrl.searchParams;
  const { rows, total, page, pages } = await listAudit(a, {
    q: p.get('q') ?? undefined,
    action: p.get('action') ?? undefined,
    page: Number(p.get('page')) || 1,
  });
  return NextResponse.json({ rows, total, page, pages }, { headers: { 'Cache-Control': 'no-store' } });
}
