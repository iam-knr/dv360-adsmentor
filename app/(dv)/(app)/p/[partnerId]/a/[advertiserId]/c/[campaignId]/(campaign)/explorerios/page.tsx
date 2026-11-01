import { notFound } from 'next/navigation';
import { IoList } from '@/components/insertion-orders/IoList';
import { compactRange, defaultRange } from '@/lib/campaigns/range';
import { getSimToday } from '@/lib/campaigns/service';
import { listInsertionOrders } from '@/lib/insertion-orders/service';
import { requireView } from '@/lib/scope/guard';
import { resolveCampaign } from '@/lib/scope/resolve';

export const metadata = { title: 'Insertion orders' };

export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ partnerId: string; advertiserId: string; campaignId: string }>;
  searchParams: Promise<{ d?: string }>;
}) {
  const user = await requireView('RO');
  const { partnerId, advertiserId, campaignId } = await params;
  const chain = await resolveCampaign(partnerId, advertiserId, campaignId);
  if (!chain) notFound();
  const { d: dParam } = await searchParams;
  const today = await getSimToday(user, chain.advertiser.timeZone);
  const d = dParam ?? compactRange(defaultRange(today));
  const result = await listInsertionOrders(
    user,
    { campaignId: chain.campaign.publicId },
    { status: ['*'], pageSize: 1000, d },
  );
  return (
    <IoList
      partnerId={chain.partner.publicId}
      advertiserId={chain.advertiser.publicId}
      campaignId={chain.campaign.publicId}
      currency={chain.advertiser.currencyCode}
      rows={result.rows}
      embedded
      d={d}
      today={today}
    />
  );
}
