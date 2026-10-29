// POST /api/dv/reports/query  { partner, definition, limit? }  canvas preview and auto-run (routes.md 8.13)
import { getSessionUser } from '@/lib/auth/session';
import { badRequest, resultToHttp, unauthenticated } from '@/lib/reporting/api';
import { queryReport } from '@/lib/reporting/service';
import type { ReportDefinition } from '@/lib/reporting/types';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return unauthenticated();
  const body = (await req.json().catch(() => null)) as {
    partner?: string;
    definition?: ReportDefinition;
    limit?: number;
  } | null;
  if (!body?.partner || !body.definition) return badRequest('partner and definition are required.');
  return resultToHttp(await queryReport(user, body.partner, body.definition, body.limit));
}
