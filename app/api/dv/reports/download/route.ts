// POST /api/dv/reports/download  { partner, definition, format }  toolbar Download without a stored run
import { getSessionUser } from '@/lib/auth/session';
import { badRequest, fileResponse, unauthenticated } from '@/lib/reporting/api';
import { directDownload } from '@/lib/reporting/service';
import type { ReportDefinition, ReportFormatWire } from '@/lib/reporting/types';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return unauthenticated();
  const body = (await req.json().catch(() => null)) as {
    partner?: string;
    definition?: ReportDefinition;
    format?: ReportFormatWire;
  } | null;
  if (!body?.partner || !body.definition) return badRequest('partner and definition are required.');
  const format = body.format === 'XLSX' ? 'XLSX' : 'CSV';
  return fileResponse(() => directDownload(user, body.partner!, body.definition!, format));
}
