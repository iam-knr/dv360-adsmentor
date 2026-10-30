// A GET CSV of the filtered log (routes.md 8.17, module 05 4.8).
import { NextResponse, type NextRequest } from 'next/server';
import { getHistoryCsv } from '@/lib/history/read';
import { parseHistoryQuery, withUser } from '@/lib/history/api';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const q = parseHistoryQuery(req);
  if (!q) return NextResponse.json({ error: 'INVALID' }, { status: 400 });
  return withUser(async (user) => {
    const csv = await getHistoryCsv(user, q);
    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="history-${q.entityType.toLowerCase()}.csv"`,
        'Cache-Control': 'no-store',
      },
    });
  });
}
