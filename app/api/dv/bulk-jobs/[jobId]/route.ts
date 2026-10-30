// GET /api/dv/bulk-jobs/:id (module 11 K14)
import { getSessionUser } from '@/lib/auth/session';
import { NO_STORE, unauthenticated } from '@/lib/bulk/api';
import { getJob } from '@/lib/bulk/jobs';
import { ServiceFailure } from '@/lib/campaigns/service-kit';

export const dynamic = 'force-dynamic';

export async function GET(_req: Request, { params }: { params: Promise<{ jobId: string }> }) {
  const user = await getSessionUser();
  if (!user) return unauthenticated();
  try {
    return Response.json({ data: await getJob(user, (await params).jobId) }, { headers: NO_STORE });
  } catch (e) {
    if (e instanceof ServiceFailure)
      return Response.json({ error: e.code }, { status: e.code === 'NOT_FOUND' ? 404 : 403 });
    throw e;
  }
}
