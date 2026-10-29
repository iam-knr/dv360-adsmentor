import { notFound } from 'next/navigation';
import { FloodlightHistory } from '@/components/resources/FloodlightHistory';
import { listFloodlightHistory } from '@/lib/resources/history';
import { requireView } from '@/lib/scope/guard';
import { resolveAdvertiser } from '@/lib/scope/resolve';

export const metadata = { title: 'History' };

export default async function Page({
  params,
}: {
  params: Promise<{ partnerId: string; advertiserId: string }>;
}) {
  const user = await requireView('RO');
  const { partnerId, advertiserId } = await params;
  const chain = await resolveAdvertiser(partnerId, advertiserId);
  if (!chain) notFound();
  const rows = await listFloodlightHistory(user, chain.advertiser.publicId);
  return (
    <FloodlightHistory
      partnerId={chain.partner.publicId}
      advertiserId={chain.advertiser.publicId}
      rows={rows}
    />
  );
}
