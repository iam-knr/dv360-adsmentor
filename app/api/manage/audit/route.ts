import { NextResponse } from 'next/server';
import { actorOrResponse } from '@/lib/accounts/http';
import { listAudit } from '@/lib/accounts/service';

export const dynamic = 'force-dynamic';

export async function GET() {
  const a = await actorOrResponse();
  if (a instanceof NextResponse) return a;
  const rows = await listAudit(a);
  return NextResponse.json({ rows }, { headers: { 'Cache-Control': 'no-store' } });
}
