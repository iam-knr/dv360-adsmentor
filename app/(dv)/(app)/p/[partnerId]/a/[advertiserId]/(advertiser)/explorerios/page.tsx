import { notFound } from 'next/navigation';
import { ListFilterChips } from '@/components/search/ListFilterChips';
import { IoList } from '@/components/insertion-orders/IoList';
import { listInsertionOrders } from '@/lib/insertion-orders/service';
import { requireView } from '@/lib/scope/guard';
import { resolveAdvertiser } from '@/lib/scope/resolve';
import { extraFilterChips, filterIoRows, parseListFilters } from '@/lib/search/list-filters';

export const metadata = { title: 'Insertion orders' };

export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ partnerId: string; advertiserId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireView('RO');
  const { partnerId, advertiserId } = await params;
  const chain = await resolveAdvertiser(partnerId, advertiserId);
  if (!chain) notFound();
  const filters = parseListFilters(await searchParams);
  const d = filters.d;
  const result = await listInsertionOrders(
    user,
    { advertiserId: chain.advertiser.publicId },
    { status: ['*'], pageSize: 1000, d: d ?? null },
  );
  return (
    <IoList
      partnerId={chain.partner.publicId}
      advertiserId={chain.advertiser.publicId}
      currency={chain.advertiser.currencyCode}
      rows={filterIoRows(result.rows, filters)}
      initialStatus={filters.status}
      filterChips={<ListFilterChips chips={extraFilterChips(filters)} />}
    />
  );
}
