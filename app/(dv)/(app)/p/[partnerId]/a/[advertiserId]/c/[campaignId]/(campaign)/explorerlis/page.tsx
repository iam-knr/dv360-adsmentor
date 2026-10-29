import { notFound } from 'next/navigation';
import { LiGrid } from '@/components/line-items/LiGrid';
import { listLineItems } from '@/lib/line-items/service';
import { requireView } from '@/lib/scope/guard';
import { resolveCampaign } from '@/lib/scope/resolve';

export const metadata = { title: 'Line items' };

export default async function Page({
  params,
}: {
  params: Promise<{ partnerId: string; advertiserId: string; campaignId?: string; ioId?: string }>;
}) {
  const user = await requireView('RO');
  const p = await params;
  const chain = await resolveCampaign(p.partnerId, p.advertiserId, p.campaignId!);
  if (!chain) notFound();
  const result = await listLineItems(
    user,
    { kind: 'campaign', id: chain.campaign.id },
    {
      status: ['DRAFT', 'ACTIVE', 'PAUSED', 'ARCHIVED'],
      pageSize: 1000,
    },
  );
  if (!result) notFound();
  return (
    <LiGrid
      partnerId={chain.partner.publicId}
      advertiserId={chain.advertiser.publicId}
      result={result}
    />
  );
}
