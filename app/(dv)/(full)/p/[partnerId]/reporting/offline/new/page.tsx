import { OfflineBuilder } from '@/components/reporting/OfflineBuilder';
import { requireView } from '@/lib/scope/guard';
import { listFields, pageContext } from '@/lib/reporting/service';
import { OFFLINE_TEMPLATES } from '@/lib/reporting/templates';
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
  // The Floodlight form opens with its first template loaded (metric pill "Floodlight Impressions").
  const tpl = OFFLINE_TEMPLATES.find((x) => x.type === offlineType);
  const initial: ReportDefinition = {
    kind: 'OFFLINE',
    offlineType,
    name: 'Untitled Offline Report',
    timeZone: 'ADVERTISER',
    dateRange: tpl?.dateRange ?? 'LAST_7_DAYS',
    filters: [{ field: 'partner', op: 'IN', values: [ctx.partner.publicId] }],
    dimensions: tpl ? [...tpl.dimensions] : [],
    metrics: tpl ? [...tpl.metrics] : [],
    viz: { type: 'TABLE' },
    ...(tpl ? { template: tpl.key } : {}),
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
      ownerEmail={user.email}
    />
  );
}
