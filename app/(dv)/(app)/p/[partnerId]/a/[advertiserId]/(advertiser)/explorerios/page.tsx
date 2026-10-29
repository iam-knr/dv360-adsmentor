import { notFound } from 'next/navigation';
import { IoList } from '@/components/insertion-orders/IoList';
import { listInsertionOrders } from '@/lib/insertion-orders/service';
import { requireView } from '@/lib/scope/guard';
import { resolveAdvertiser } from '@/lib/scope/resolve';

export const metadata = { title: 'Insertion orders' };

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
  const result = await listInsertionOrders(
    user,
    { advertiserId: chain.advertiser.publicId },
    { status: ['*'], pageSize: 1000, d: d ?? null },
  );
  return (
    <IoList
      partnerId={chain.partner.publicId}
      advertiserId={chain.advertiser.publicId}
      currency={chain.advertiser.currencyCode}
      rows={result.rows}
    />
  );
}
