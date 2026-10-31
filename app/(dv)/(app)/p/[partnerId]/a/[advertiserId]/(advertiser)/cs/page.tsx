import { notFound } from 'next/navigation';
import { ListFilterChips } from '@/components/search/ListFilterChips';
import { CampaignsList } from '@/components/campaigns/CampaignsList';
import { listCampaigns } from '@/lib/campaigns/service';
import { requireView } from '@/lib/scope/guard';
import { resolveAdvertiser } from '@/lib/scope/resolve';
import { extraFilterChips, filterNamedRows, parseListFilters } from '@/lib/search/list-filters';

export const metadata = { title: 'Campaigns' };

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
  const result = await listCampaigns(user, chain.advertiser.publicId, {
    status: ['*'],
    pageSize: 1000,
    d: d ?? null,
  });
  return (
    <CampaignsList
      partnerId={chain.partner.publicId}
      advertiserId={chain.advertiser.publicId}
      currency={chain.advertiser.currencyCode}
      rows={filterNamedRows(result.rows, filters)}
      initialStatus={filters.status}
      filterChips={<ListFilterChips chips={extraFilterChips(filters)} />}
    />
  );
}
