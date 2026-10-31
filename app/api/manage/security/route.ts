// GET /api/manage/security: the numbers behind the badge, the banner and the toast. The Super admin's pages poll it
// every 30 seconds (like the student bell). Never changes state.
import { NextResponse } from 'next/server';
import { securitySummary } from '@/lib/accounts/screenshot-guard';
import { actorOrResponse } from '@/lib/accounts/http';

export const dynamic = 'force-dynamic';

export async function GET() {
  const actor = await actorOrResponse();
  if (actor instanceof NextResponse) return actor;
  return NextResponse.json(await securitySummary(actor), {
    headers: { 'Cache-Control': 'no-store' },
  });
}
