// GET /api/dv/bulk-jobs/:id/result (module 11 K14): the stored zip or csv.
import { getSessionUser } from '@/lib/auth/session';
import { unauthenticated } from '@/lib/bulk/api';
import { getJobResult } from '@/lib/bulk/jobs';
import { ServiceFailure } from '@/lib/campaigns/service-kit';

export const dynamic = 'force-dynamic';

export async function GET(_req: Request, { params }: { params: Promise<{ jobId: string }> }) {
  const user = await getSessionUser();
  if (!user) return unauthenticated();
  try {
    const file = await getJobResult(user, (await params).jobId);
    if (!file)
      return Response.json(
        { error: 'NOT_FOUND', message: 'The file is no longer available.' },
        { status: 404 },
      );
    return new Response(Buffer.from(file.bytes), {
      headers: {
        'Content-Type': file.contentType,
        'Content-Disposition': `attachment; filename="${file.name}"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (e) {
    if (e instanceof ServiceFailure)
      return Response.json({ error: e.code }, { status: e.code === 'NOT_FOUND' ? 404 : 403 });
    throw e;
  }
}
