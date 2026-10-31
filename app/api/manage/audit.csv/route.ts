import { NextResponse, type NextRequest } from 'next/server';
import { actorOrResponse } from '@/lib/accounts/http';
import { toCsv } from '@/lib/accounts/csv';
import { isPlaceholderEmail } from '@/lib/accounts/audit-labels';
import { listAudit } from '@/lib/accounts/service';

export const dynamic = 'force-dynamic';

// GET /api/manage/audit.csv?q=&action=: the first 50 rows of the filtered audit log, with the same plain labels as the
// screen (lib/accounts/audit-labels.ts). Cells are formula safe.
export async function GET(req: NextRequest) {
  const a = await actorOrResponse();
  if (a instanceof NextResponse) return a;
  const p = req.nextUrl.searchParams;
  const { rows } = await listAudit(a, {
    q: p.get('q') ?? undefined,
    action: p.get('action') ?? undefined,
    page: Number(p.get('page')) || 1,
  });
  const body = toCsv(
    ['when', 'who', 'what_happened', 'target_type', 'target'],
    rows.map((r) => [
      r.createdAt.toISOString(),
      r.actor
        ? isPlaceholderEmail(r.actor.email)
          ? r.actor.name
          : `${r.actor.name} (${r.actor.email})`
        : 'System',
      r.summary + (r.result === 'DENIED' ? ' (denied)' : ''),
      r.targetRef?.kind ?? '',
      r.targetRef ? r.targetRef.label + (r.targetRef.sub ? ` (${r.targetRef.sub})` : '') : '',
    ]),
  );
  return new NextResponse(body, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="audit-log.csv"',
      'Cache-Control': 'no-store',
    },
  });
}
