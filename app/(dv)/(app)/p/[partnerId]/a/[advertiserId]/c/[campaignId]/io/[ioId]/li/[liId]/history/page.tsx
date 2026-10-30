import { notFound } from 'next/navigation';
import { HistoryPage } from '@/components/history';
import { loadHistoryPage } from '@/lib/history/page';
import { resolveLi } from '@/lib/scope/resolve';

export const metadata = { title: 'History' };

export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{
    partnerId: string;
    advertiserId: string;
    campaignId: string;
    ioId: string;
    liId: string;
  }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { partnerId, advertiserId, campaignId, ioId, liId } = await params;
  const chain = await resolveLi(partnerId, advertiserId, campaignId, ioId, liId);
  if (!chain) notFound();
  const { data, initialParams } = await loadHistoryPage('LINE_ITEM', chain.li.id, await searchParams);
  return (
    <HistoryPage
      entity={{ type: 'LINE_ITEM', id: chain.li.id }}
      initial={data}
      initialParams={initialParams}
    />
  );
}
