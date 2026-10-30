import { notFound } from 'next/navigation';
import { HistoryPage } from '@/components/history';
import { loadHistoryPage } from '@/lib/history/page';
import { resolveAdvertiser } from '@/lib/scope/resolve';

export const metadata = { title: 'History' };

export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ partnerId: string; advertiserId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { partnerId, advertiserId } = await params;
  const chain = await resolveAdvertiser(partnerId, advertiserId);
  if (!chain) notFound();
  const { data, initialParams } = await loadHistoryPage('ADVERTISER', chain.advertiser.id, await searchParams);
  return (
    <HistoryPage
      title
      entity={{ type: 'ADVERTISER', id: chain.advertiser.id }}
      initial={data}
      initialParams={initialParams}
    />
  );
}
