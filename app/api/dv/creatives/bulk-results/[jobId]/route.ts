// GET /api/dv/creatives/bulk-results/:jobId   result file of a bulk add job (CRE-050)
import { getSessionUser } from '@/lib/auth/session';
import { json, unauthenticated } from '@/lib/creatives/api';
import { BULK_RESULT_FILE, readBulkResult } from '@/lib/creatives/bulk';
import { ServiceFailure } from '@/lib/campaigns/service-kit';

export const dynamic = 'force-dynamic';

export async function GET(_req: Request, { params }: { params: Promise<{ jobId: string }> }) {
  const user = await getSessionUser();
  if (!user) return unauthenticated();
  const { jobId } = await params;
  try {
    const bytes = await readBulkResult(user, jobId);
    if (!bytes) return json({ error: 'NOT_FOUND' }, 404);
    return new Response(Buffer.from(bytes), {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${BULK_RESULT_FILE}"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (e) {
    if (e instanceof ServiceFailure)
      return json({ error: e.code }, e.code === 'FORBIDDEN' ? 403 : 404);
    throw e;
  }
}
