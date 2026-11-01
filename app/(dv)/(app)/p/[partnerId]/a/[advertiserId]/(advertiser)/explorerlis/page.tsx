import { notFound } from 'next/navigation';
import { ListFilterChips } from '@/components/search/ListFilterChips';
import { LiGrid } from '@/components/line-items/LiGrid';
import { listLineItems } from '@/lib/line-items/service';
import { requireView } from '@/lib/scope/guard';
import { resolveAdvertiser } from '@/lib/scope/resolve';
import { extraFilterChips, filterLineItemRows, parseListFilters } from '@/lib/search/list-filters';

export const metadata = { title: 'Line items' };

export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ partnerId: string; advertiserId: string; campaignId?: string; ioId?: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireView('RO');
  const p = await params;
  // `f.*`, `q` and `d` of routes.md 6.1; the Search overlay links here (module 01 AC-01-12).
  // Archived list: [A]/explorerlis?f.status=ARCHIVED, reached from the IO list menu (module 08 AC-08-26, RC-052)
  const filters = parseListFilters(await searchParams);
  const archived = filters.status === 'ARCHIVED';
  const chain = await resolveAdvertiser(p.partnerId, p.advertiserId);
  if (!chain) notFound();
  const result = await listLineItems(
    user,
    { kind: 'advertiser', id: chain.advertiser.id },
    {
      status: ['DRAFT', 'ACTIVE', 'PAUSED', 'ARCHIVED'],
      pageSize: 1000,
      ...(filters.d ? { d: filters.d } : {}),
    },
  );
  if (!result) notFound();
  const rows = filterLineItemRows(result.rows, filters, result.simToday);
  return (
    <LiGrid
      partnerId={chain.partner.publicId}
      advertiserId={chain.advertiser.publicId}
      result={{ ...result, rows }}
      archived={archived}
      initialStatus={filters.status}
      filterChips={<ListFilterChips chips={extraFilterChips(filters)} />}
    />
  );
}
