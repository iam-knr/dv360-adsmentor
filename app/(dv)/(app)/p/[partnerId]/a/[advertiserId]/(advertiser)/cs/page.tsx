import { notFound } from 'next/navigation';
import { CampaignsList } from '@/components/campaigns/CampaignsList';
import { listCampaigns } from '@/lib/campaigns/service';
import { requireView } from '@/lib/scope/guard';
import { resolveAdvertiser } from '@/lib/scope/resolve';

export const metadata = { title: 'Campaigns' };

export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ partnerId: string; advertiserId: string }>;
  searchParams: Promise<{ d?: string }>;
}) {
  const user = await requireView('RO');
  const { partnerId, advertiserId } = await params;
  const chain = await resolveAdvertiser(partnerId, advertiserId);
  if (!chain) notFound();
  const { d } = await searchParams;
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
      rows={result.rows}
    />
  );
}
