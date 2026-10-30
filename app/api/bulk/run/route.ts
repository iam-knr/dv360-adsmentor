// Bulk worker (module 11 4.8): continues QUEUED and RUNNING bulk edit and duplication jobs. Bearer $CRON_SECRET.
import { NextResponse, type NextRequest } from 'next/server';
import { runDueJobs } from '@/lib/bulk/run';
import { isAuthorised } from '@/app/api/sim/engine/tick/auth';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  if (!isAuthorised(req.headers, process.env.CRON_SECRET)) return NextResponse.json({ error: 'UNAUTHENTICATED' }, { status: 401 });
  return NextResponse.json({ ok: true, ...(await runDueJobs()) });
}
