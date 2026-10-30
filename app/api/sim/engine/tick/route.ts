// Engine timer endpoint (routes.md 8.20, RC-027, ADR-048). A GitHub Actions workflow calls it every 5 minutes with
// Authorization: Bearer $CRON_SECRET. It thaws sandboxes that a class window froze before windows were removed, then advances every sandbox that owes ticks
// within a time budget, at most 25 sandboxes per call, and reports how many are still due.
import { NextResponse, type NextRequest } from 'next/server';
import { runDueTicks, runRetention } from '@/lib/engine/server';
import { advanceProvisioning } from '@/lib/sandbox/provision';
import { thawWindowFrozenSandboxes } from '@/lib/sandbox/thaw';
import { budgetFrom, isAuthorised } from './auth';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  if (!isAuthorised(req.headers, process.env.CRON_SECRET)) {
    return NextResponse.json({ error: 'UNAUTHENTICATED' }, { status: 401 });
  }
  const started = Date.now();
  const url = new URL(req.url);
  const thawed = await thawWindowFrozenSandboxes(new Date()).catch(() => 0);
  const deadline = started + budgetFrom(url.searchParams);
  const result = await runDueTicks(deadline);
  // new students: seed queued sandboxes, start accounts that have none (module 18 4.4)
  const provisioning = await advanceProvisioning(deadline).catch(() => undefined);
  const trimmed = url.searchParams.get('retention') === '1' ? await runRetention() : undefined;
  return NextResponse.json({
    ok: true,
    thawed,
    ...result,
    ...(provisioning ? { provisioning } : {}),
    ...(trimmed !== undefined ? { trimmedHourlyRows: trimmed } : {}),
    elapsedMs: Date.now() - started,
  });
}
