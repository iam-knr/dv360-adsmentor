import { notFound } from 'next/navigation';
import { ConversionsList } from '@/components/resources/FloodlightConversions';
import { listFloodlightConversions } from '@/lib/resources/floodlight';
import { requireView } from '@/lib/scope/guard';
import { resolveAdvertiser } from '@/lib/scope/resolve';

export const metadata = { title: 'Floodlight conversions' };

export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ partnerId: string; advertiserId: string }>;
  searchParams: Promise<{ status?: string }>;
}) {
  const user = await requireView('RO');
  const { partnerId, advertiserId } = await params;
  const chain = await resolveAdvertiser(partnerId, advertiserId);
  if (!chain) notFound();
  const { status } = await searchParams;
  const filter = status === 'ARCHIVED' || status === 'ALL' ? status : 'ACTIVE';
  const rows = await listFloodlightConversions(user, chain.advertiser.publicId, {
    status: filter === 'ALL' ? ['ACTIVE', 'ARCHIVED'] : [filter],
  });
  return (
    <ConversionsList
      partnerId={chain.partner.publicId}
      advertiserId={chain.advertiser.publicId}
      rows={rows}
      status={filter}
    />
  );
}
