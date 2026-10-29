import { notFound } from 'next/navigation';
import { DvEmptyState } from '@/components/dv';
import { GoogleTagCard } from '@/components/resources/FloodlightDetails';
import { getFloodlightGroup } from '@/lib/resources/floodlight';
import { requireView } from '@/lib/scope/guard';
import { resolveAdvertiser } from '@/lib/scope/resolve';

export const metadata = { title: 'Google tag' };

export default async function Page({
  params,
}: {
  params: Promise<{ partnerId: string; advertiserId: string }>;
}) {
  const user = await requireView('RO');
  const { partnerId, advertiserId } = await params;
  const chain = await resolveAdvertiser(partnerId, advertiserId);
  if (!chain) notFound();
  const group = await getFloodlightGroup(user, chain.advertiser.publicId);
  if (!group) return <DvEmptyState message="This advertiser has no Floodlight group yet." />;
  return (
    <GoogleTagCard
      partnerId={chain.partner.publicId}
      advertiserId={chain.advertiser.publicId}
      group={group}
    />
  );
}
