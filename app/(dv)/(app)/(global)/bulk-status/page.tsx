import { BulkStatusTable } from '@/components/bulk/BulkStatusTable';
import { listJobs } from '@/lib/bulk/jobs';
import { resumeSandboxJobs } from '@/lib/bulk/run';
import { requireUserOrRedirect } from '@/lib/auth/session';
import { requireView } from '@/lib/scope/guard';

export const metadata = { title: 'Bulk status' };
export const dynamic = 'force-dynamic';

export default async function Page() {
  await requireView('REP');
  const user = await requireUserOrRedirect();
  // Reporting-only people may open the page but have no read access to jobs: an empty list (RT 2)
  const jobs = await (async () => {
    if (!user.sandboxId) return { rows: [], capped: false };
    try {
      await resumeSandboxJobs(user.sandboxId);
      return await listJobs(user);
    } catch {
      return { rows: [], capped: false };
    }
  })();
  return <BulkStatusTable initial={jobs.rows} capped={jobs.capped} />;
}
