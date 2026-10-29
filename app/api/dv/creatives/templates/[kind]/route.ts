// GET /api/dv/creatives/templates/:kind   CSV template of the bulk add dialog (module 12 S8)
import { getSessionUser } from '@/lib/auth/session';
import { badRequest, unauthenticated } from '@/lib/creatives/api';
import { BULK_KIND_LABEL, isBulkKind, templateCsv } from '@/lib/creatives/bulk-csv';

export const dynamic = 'force-dynamic';

export async function GET(_req: Request, { params }: { params: Promise<{ kind: string }> }) {
  const user = await getSessionUser();
  if (!user) return unauthenticated();
  const { kind } = await params;
  if (!isBulkKind(kind)) return badRequest('Unknown template.');
  return new Response(templateCsv(kind), {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${BULK_KIND_LABEL[kind].replace(/\W+/g, '-')}-creatives-template.csv"`,
      'Cache-Control': 'no-store',
    },
  });
}
