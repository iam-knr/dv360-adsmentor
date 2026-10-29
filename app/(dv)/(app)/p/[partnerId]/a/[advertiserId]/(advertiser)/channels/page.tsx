import { notFound } from 'next/navigation';
import { ChannelsKeywordsPage } from '@/components/resources/ChannelsKeywordsPage';
import { listChannels } from '@/lib/resources/lists';
import { requireView } from '@/lib/scope/guard';
import { resolveAdvertiser } from '@/lib/scope/resolve';

export const metadata = { title: 'Channels' };

export default async function Page({
  params,
}: {
  params: Promise<{ partnerId: string; advertiserId: string }>;
}) {
  const user = await requireView('RO');
  const { partnerId, advertiserId } = await params;
  const chain = await resolveAdvertiser(partnerId, advertiserId);
  if (!chain) notFound();
  const channels = await listChannels(user, { level: 'advertiser', id: chain.advertiser.publicId });
  return (
    <ChannelsKeywordsPage
      partnerId={chain.partner.publicId}
      advertiserId={chain.advertiser.publicId}
      tab="channels"
      channels={channels}
      keywordLists={[]}
    />
  );
}
