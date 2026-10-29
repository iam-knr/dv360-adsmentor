import { notFound } from 'next/navigation';
import { CustomBiddingListPage } from '@/components/resources/CustomBidding';
import { listCustomBidding } from '@/lib/resources/custom-bidding';
import { requireView } from '@/lib/scope/guard';
import { resolveAdvertiser } from '@/lib/scope/resolve';

export const metadata = { title: 'Custom bidding' };

export default async function Page({
  params,
}: {
  params: Promise<{ partnerId: string; advertiserId: string }>;
}) {
  const user = await requireView('RO');
  const { partnerId, advertiserId } = await params;
  const chain = await resolveAdvertiser(partnerId, advertiserId);
  if (!chain) notFound();
  const rows = await listCustomBidding(user, {
    level: 'advertiser',
    id: chain.advertiser.publicId,
  });
  return (
    <CustomBiddingListPage
      partnerId={chain.partner.publicId}
      advertiserId={chain.advertiser.publicId}
      rows={rows}
    />
  );
}
