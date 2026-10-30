// GET /api/dv/bulk-jobs (module 11 K13): the 100 most recent jobs of the sandbox.
import { getSessionUser } from '@/lib/auth/session';
import { NO_STORE, unauthenticated } from '@/lib/bulk/api';
import { listJobs } from '@/lib/bulk/jobs';
import { resumeSandboxJobs } from '@/lib/bulk/run';

export const dynamic = 'force-dynamic';

export async function GET() {
  const user = await getSessionUser();
  if (!user) return unauthenticated();
  if (user.sandboxId) await resumeSandboxJobs(user.sandboxId);
  return Response.json({ data: await listJobs(user) }, { headers: NO_STORE });
}
