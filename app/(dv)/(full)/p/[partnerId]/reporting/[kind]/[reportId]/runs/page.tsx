import { notFound } from 'next/navigation';
import { ReportRuns } from '@/components/reporting/ReportRuns';
import { requireView } from '@/lib/scope/guard';
import { ServiceFailure } from '@/lib/campaigns/service-kit';
import { listRuns, pageContext } from '@/lib/reporting/service';

export const metadata = { title: 'Report runs' };

export default async function Page({
  params,
}: {
  params: Promise<{ partnerId: string; kind: string; reportId: string }>;
}) {
  const user = await requireView('REP');
  const { partnerId, kind, reportId } = await params;
  if (kind !== 'instant' && kind !== 'offline') notFound();
  const [ctx, data] = await Promise.all([
    pageContext(user, partnerId),
    listRuns(user, reportId).catch((e: unknown) => {
      if (e instanceof ServiceFailure) notFound();
      throw e;
    }),
  ]);
  return (
    <ReportRuns
      partnerId={ctx.partner.publicId}
      kind={kind}
      report={data.report}
      runs={data.runs}
      canRun={ctx.canWrite}
    />
  );
}
