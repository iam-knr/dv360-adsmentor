import { notFound, redirect } from 'next/navigation';
import { OfflineBuilder } from '@/components/reporting/OfflineBuilder';
import { requireView } from '@/lib/scope/guard';
import { ServiceFailure } from '@/lib/campaigns/service-kit';
import { getReport, listFields, pageContext } from '@/lib/reporting/service';

export const metadata = { title: 'Offline report' };

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
  const def = view.definition;
  if (def.kind === 'INSTANT') redirect(`/p/${partnerId}/reporting/instant/${reportId}`);
  const offlineType = def.offlineType ?? 'FLOODLIGHT';
  return (
    <OfflineBuilder
      partnerId={ctx.partner.publicId}
      partnerName={ctx.partner.name}
      offlineType={offlineType}
      fields={listFields(user, { offline: offlineType }).fields}
      initial={def}
      reportId={def.id}
      version={view.version}
      readOnly={!view.canEdit}
      ctx={ctx}
    />
  );
}
