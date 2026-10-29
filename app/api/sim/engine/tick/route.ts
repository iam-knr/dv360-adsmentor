// Engine timer endpoint (routes.md 8.20, RC-027, ADR-048). A GitHub Actions workflow calls it every 5 minutes with
// Authorization: Bearer $CRON_SECRET. It moves access windows first (P3-02), then advances every sandbox that owes ticks
// within a time budget, at most 25 sandboxes per call, and reports how many are still due.
import { NextResponse, type NextRequest } from 'next/server';
import { tickAccessWindows } from '@/lib/access/windows';
import { runDueTicks, runRetention } from '@/lib/engine/server';
import { budgetFrom, isAuthorised } from './auth';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  if (!isAuthorised(req.headers, process.env.CRON_SECRET)) {
    return NextResponse.json({ error: 'UNAUTHENTICATED' }, { status: 401 });
  }
  const started = Date.now();
  const url = new URL(req.url);
  const windows = await tickAccessWindows(new Date());
  const result = await runDueTicks(started + budgetFrom(url.searchParams));
  const trimmed = url.searchParams.get('retention') === '1' ? await runRetention() : undefined;
  return NextResponse.json({
    ok: true,
    windows,
    ...result,
    ...(trimmed !== undefined ? { trimmedHourlyRows: trimmed } : {}),
    elapsedMs: Date.now() - started,
  });
}
