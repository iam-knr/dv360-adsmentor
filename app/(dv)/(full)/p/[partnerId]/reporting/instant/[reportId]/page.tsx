import { redirect } from 'next/navigation';
import { ReportBuilder } from '@/components/reporting/ReportBuilder';
import { requireView } from '@/lib/scope/guard';
import { ServiceFailure } from '@/lib/campaigns/service-kit';
import { notFound } from 'next/navigation';
import { getReport, listFields, pageContext } from '@/lib/reporting/service';

export const metadata = { title: 'Instant report' };

export default async function Page({ params }: { params: Promise<{ partnerId: string; reportId: string }> }) {
  const user = await requireView('REP');
  const { partnerId, reportId } = await params;
  const [ctx, view] = await Promise.all([
    pageContext(user, partnerId),
    getReport(user, reportId).catch((e: unknown) => {
      if (e instanceof ServiceFailure) notFound();
      throw e;
    }),
  ]);
  if (view.definition.kind !== 'INSTANT')
    redirect(`/p/${partnerId}/reporting/offline/${reportId}`);
  return (
    <ReportBuilder
      partnerId={ctx.partner.publicId}
      partnerName={ctx.partner.name}
      fields={listFields(user, {}).fields}
      initial={view.definition}
      reportId={view.definition.id}
      version={view.version}
      readOnly={!view.canEdit}
      ctx={ctx}
      skipped={view.skipped}
    />
  );
}
