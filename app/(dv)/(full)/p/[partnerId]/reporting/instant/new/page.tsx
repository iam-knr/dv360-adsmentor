import { ReportBuilder } from '@/components/reporting/ReportBuilder';
import { requireView } from '@/lib/scope/guard';
import { listFields, pageContext } from '@/lib/reporting/service';
import { definitionFromTemplate } from '@/lib/reporting/templates';
import type { ReportDefinition } from '@/lib/reporting/types';

export const metadata = { title: 'Untitled report' };

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
  const ctx = await pageContext(user, partnerId);
  const key = Array.isArray(sp.template) ? sp.template[0] : sp.template;
  const initial: ReportDefinition = (key && definitionFromTemplate(key, ctx.partner.publicId)) || {
    kind: 'INSTANT',
    name: 'Untitled Report',
    timeZone: 'ADVERTISER',
    dateRange: 'LAST_7_DAYS',
    filters: [{ field: 'partner', op: 'IN', values: [ctx.partner.publicId] }],
    dimensions: [],
    metrics: [],
    viz: { type: 'TABLE' },
  };
  return (
    <ReportBuilder
      partnerId={ctx.partner.publicId}
      partnerName={ctx.partner.name}
      fields={listFields(user, {}).fields}
      initial={initial}
      readOnly={!ctx.canWrite}
      ctx={ctx}
    />
  );
}
