import { DvPageHeader } from '@/components/dv';
import { BulkStatusTable } from '@/components/bulk/BulkStatusTable';
import { listJobs } from '@/lib/bulk/jobs';
import { resumeSandboxJobs } from '@/lib/bulk/run';
import { requireUserOrRedirect } from '@/lib/auth/session';

export const metadata = { title: 'Bulk status' };
export const dynamic = 'force-dynamic';

export default async function Page() {
  const user = await requireUserOrRedirect();
  if (user.sandboxId) await resumeSandboxJobs(user.sandboxId);
  const { rows, capped } = user.sandboxId ? await listJobs(user) : { rows: [], capped: false };
  return (
    <>
      <DvPageHeader title="Bulk status" />
      <BulkStatusTable initial={rows} capped={capped} />
    </>
  );
}
