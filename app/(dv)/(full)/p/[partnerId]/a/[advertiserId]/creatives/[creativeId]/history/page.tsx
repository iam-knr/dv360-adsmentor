import { notFound } from 'next/navigation';
import { CreativeHeader } from '@/components/creatives/CreativeHeader';
import { CreativeHistory } from '@/components/creatives/CreativeHistory';
import { FormFrame } from '@/components/shell/Frames';
import { orNotFound } from '@/lib/creatives/page';
import { getCreativeHistory } from '@/lib/creatives/review-service';
import { getCreativeDetail } from '@/lib/creatives/service';
import { requireView } from '@/lib/scope/guard';
import { resolveAdvertiser } from '@/lib/scope/resolve';

export const metadata = { title: 'History' };

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ partnerId: string; advertiserId: string; creativeId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireView('RO');
  const { partnerId, advertiserId, creativeId } = await params;
  const q = await searchParams;
  const chain = await resolveAdvertiser(partnerId, advertiserId);
  if (!chain) notFound();
  const pid = chain.partner.publicId;
  const aid = chain.advertiser.publicId;
  const detail = await orNotFound(() => getCreativeDetail(user, aid, creativeId));
  const page = Math.max(1, Number(one(q.page)) || 1);
  const userFilter = one(q.user);
  const fieldFilter = one(q.field);
  const history = await orNotFound(() =>
    getCreativeHistory(user, aid, creativeId, {
      page,
      ...(userFilter ? { user: userFilter } : {}),
      ...(fieldFilter ? { field: fieldFilter } : {}),
    }),
  );
  return (
    <FormFrame title={detail.row.name}>
      <CreativeHeader partnerId={pid} advertiserId={aid} row={detail.row} active="history" />
      <CreativeHistory
        rows={history.rows}
        total={history.total}
        page={history.page}
        pageSize={history.pageSize}
        initialFilters={[
          ...(userFilter ? [{ fieldId: 'user', values: [userFilter] }] : []),
          ...(fieldFilter ? [{ fieldId: 'field', values: [fieldFilter] }] : []),
        ]}
      />
    </FormFrame>
  );
}
