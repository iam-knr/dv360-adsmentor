import { OfflineBuilder } from '@/components/reporting/OfflineBuilder';
import { requireView } from '@/lib/scope/guard';
import { listFields, pageContext } from '@/lib/reporting/service';
import type { OfflineTypeWire, ReportDefinition } from '@/lib/reporting/types';

export const metadata = { title: 'Offline report' };

export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ partnerId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireView('REP');
  const { partnerId } = await params;
  const sp = await searchParams;
  const t = Array.isArray(sp.type) ? sp.type[0] : sp.type;
  const offlineType: OfflineTypeWire = t === 'inventory-availability' ? 'INVENTORY_AVAILABILITY' : 'FLOODLIGHT';
  const ctx = await pageContext(user, partnerId);
  const initial: ReportDefinition = {
    kind: 'OFFLINE',
    offlineType,
    name: 'Untitled Offline Report',
    timeZone: 'ADVERTISER',
    dateRange: 'LAST_7_DAYS',
    filters: [{ field: 'partner', op: 'IN', values: [ctx.partner.publicId] }],
    dimensions: [],
    metrics: [],
    viz: { type: 'TABLE' },
  };
  return (
    <OfflineBuilder
      partnerId={ctx.partner.publicId}
      partnerName={ctx.partner.name}
      offlineType={offlineType}
      fields={listFields(user, { offline: offlineType }).fields}
      initial={initial}
      readOnly={!ctx.canWrite}
      ctx={ctx}
    />
  );
}
