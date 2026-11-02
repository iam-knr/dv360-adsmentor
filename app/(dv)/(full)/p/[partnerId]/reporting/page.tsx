import { ReportsHub } from '@/components/reporting/ReportsHub';
import { requireView } from '@/lib/scope/guard';
import { listReports, listTemplates, pageContext } from '@/lib/reporting/service';

export const metadata = { title: 'Reports' };

type Search = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ partnerId: string }>;
  searchParams: Promise<Search>;
}) {
  const user = await requireView('REP');
  const { partnerId } = await params;
  const sp = await searchParams;
  const tab = one(sp.tab) === 'offline' ? 'offline' : 'instant';
  const createdBy = one(sp.createdBy) === 'any' ? 'any' : 'me';
  const q = one(sp.q) ?? '';
  const page = Math.max(1, Number(one(sp.page)) || 1);
  const pageSize = Number(one(sp.rows)) || undefined;
  const [ctx, list] = await Promise.all([
    pageContext(user, partnerId),
    listReports(user, partnerId, { kind: tab, createdBy, q, page, ...(pageSize ? { pageSize } : {}) }),
  ]);
  return (
    <ReportsHub
      partnerId={ctx.partner.publicId}
      tab={tab}
      createdBy={createdBy}
      q={q}
      page={list.page}
      pageSize={list.pageSize}
      total={list.total}
      rows={list.rows}
      templates={listTemplates()}
      canWrite={ctx.canWrite}
    />
  );
}
