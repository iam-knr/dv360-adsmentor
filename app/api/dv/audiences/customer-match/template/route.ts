// GET /api/dv/audiences/customer-match/template?type=EMAIL: the CSV template of a contact type (module 14 4.1).
import { NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth/session';
import { CSV_TEMPLATES } from '@/lib/audiences/sizes';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: 'UNAUTHENTICATED' }, { status: 401 });
  const type = new URL(req.url).searchParams.get('type') ?? 'EMAIL';
  const body = CSV_TEMPLATES[type];
  if (!body) return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 });
  return new NextResponse(body, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="customer-match-${type.toLowerCase()}.csv"`,
      'Cache-Control': 'no-store',
    },
  });
}
