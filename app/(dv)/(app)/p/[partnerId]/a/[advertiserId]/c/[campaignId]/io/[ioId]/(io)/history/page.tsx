import { notFound } from 'next/navigation';
import { HistoryPage } from '@/components/history';
import { loadHistoryPage } from '@/lib/history/page';
import { resolveIo } from '@/lib/scope/resolve';

export const metadata = { title: 'History' };

export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ partnerId: string; advertiserId: string; campaignId: string; ioId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { partnerId, advertiserId, campaignId, ioId } = await params;
  const chain = await resolveIo(partnerId, advertiserId, campaignId, ioId);
  if (!chain) notFound();
  const { data, initialParams } = await loadHistoryPage('INSERTION_ORDER', chain.io.id, await searchParams);
  return (
    <HistoryPage
      entity={{ type: 'INSERTION_ORDER', id: chain.io.id }}
      initial={data}
      initialParams={initialParams}
    />
  );
}
