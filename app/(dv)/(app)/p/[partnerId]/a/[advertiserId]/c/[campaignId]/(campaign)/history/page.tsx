import { notFound } from 'next/navigation';
import { HistoryPage } from '@/components/history';
import { loadHistoryPage } from '@/lib/history/page';
import { resolveCampaign } from '@/lib/scope/resolve';

export const metadata = { title: 'History' };

export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ partnerId: string; advertiserId: string; campaignId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { partnerId, advertiserId, campaignId } = await params;
  const chain = await resolveCampaign(partnerId, advertiserId, campaignId);
  if (!chain) notFound();
  const { data, initialParams } = await loadHistoryPage('CAMPAIGN', chain.campaign.id, await searchParams);
  return (
    <HistoryPage
      title
      entity={{ type: 'CAMPAIGN', id: chain.campaign.id }}
      initial={data}
      initialParams={initialParams}
    />
  );
}
