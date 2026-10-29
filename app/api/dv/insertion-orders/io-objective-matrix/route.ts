// B4 the type x objective matrix served to the step 1 page (AC-07-02, V-07-19).
import { NextResponse, type NextRequest } from 'next/server';
import { getSessionUser } from '@/lib/auth/session';
import { ioObjectiveMatrix, isIoType } from '@/lib/insertion-orders/matrix';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: 'UNAUTHENTICATED' }, { status: 401 });
  const type = req.nextUrl.searchParams.get('type');
  if (!isIoType(type)) return NextResponse.json({ error: 'INVALID' }, { status: 400 });
  return NextResponse.json(ioObjectiveMatrix(type), { headers: { 'Cache-Control': 'no-store' } });
}
