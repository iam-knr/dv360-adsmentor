// A GET history page of an advertiser, campaign, IO or line item (routes.md 8.17). Reads only.
import { NextResponse, type NextRequest } from 'next/server';
import { getHistory } from '@/lib/history/read';
import { parseHistoryQuery, withUser } from '@/lib/history/api';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const q = parseHistoryQuery(req);
  if (!q) return NextResponse.json({ error: 'INVALID' }, { status: 400 });
  return withUser(async (user) =>
    NextResponse.json(await getHistory(user, q), { headers: { 'Cache-Control': 'no-store' } }),
  );
}
