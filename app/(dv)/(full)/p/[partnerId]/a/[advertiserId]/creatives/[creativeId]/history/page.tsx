import { notFound } from 'next/navigation';
import { CreativeHeader } from '@/components/creatives/CreativeHeader';
import { CreativeHistory } from '@/components/creatives/CreativeHistory';
import { FormFrame } from '@/components/shell/Frames';
import { orNotFound } from '@/lib/creatives/page';
import { addDaysIso } from '@/lib/metrics/date-range';
import { dayIn } from '@/lib/history/zone';
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
  // the chip defaults to the last 90 days; removing it (range=all) shows every change
  const zone = chain.advertiser.timeZone;
  const today = dayIn(zone, new Date());
  const range =
    one(q.range) === 'all'
      ? null
      : { from: one(q.from) ?? addDaysIso(today, -89), to: one(q.to) ?? today };
  const history = await orNotFound(() =>
    getCreativeHistory(user, aid, creativeId, {
      page,
      ...(range ? { from: range.from, to: range.to } : {}),
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
        timeZone={zone}
        range={range}
        initialFilters={[
          ...(userFilter ? [{ fieldId: 'user', values: [userFilter] }] : []),
          ...(fieldFilter ? [{ fieldId: 'field', values: [fieldFilter] }] : []),
        ]}
      />
    </FormFrame>
  );
}
