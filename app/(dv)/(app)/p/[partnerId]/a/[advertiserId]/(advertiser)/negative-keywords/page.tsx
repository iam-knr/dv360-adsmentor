import { notFound } from 'next/navigation';
import { ChannelsKeywordsPage } from '@/components/resources/ChannelsKeywordsPage';
import { listNegativeKeywordLists } from '@/lib/resources/lists';
import { requireView } from '@/lib/scope/guard';
import { resolveAdvertiser } from '@/lib/scope/resolve';

export const metadata = { title: 'Negative keyword lists' };

export default async function Page({
  params,
}: {
  params: Promise<{ partnerId: string; advertiserId: string }>;
}) {
  const user = await requireView('RO');
  const { partnerId, advertiserId } = await params;
  const chain = await resolveAdvertiser(partnerId, advertiserId);
  if (!chain) notFound();
  const keywordLists = await listNegativeKeywordLists(user, chain.advertiser.publicId);
  return (
    <ChannelsKeywordsPage
      partnerId={chain.partner.publicId}
      advertiserId={chain.advertiser.publicId}
      tab="keywords"
      channels={[]}
      keywordLists={keywordLists}
    />
  );
}
