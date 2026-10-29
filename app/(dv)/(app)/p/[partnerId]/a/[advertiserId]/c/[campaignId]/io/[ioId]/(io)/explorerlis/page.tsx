import { notFound } from 'next/navigation';
import { LiGrid } from '@/components/line-items/LiGrid';
import { listLineItems } from '@/lib/line-items/service';
import { requireView } from '@/lib/scope/guard';
import { resolveIo } from '@/lib/scope/resolve';
import { ioPath } from '@/lib/routes/paths';
export const metadata = { title: 'Line items' };

export default async function Page({
  params,
}: {
  params: Promise<{ partnerId: string; advertiserId: string; campaignId?: string; ioId?: string }>;
}) {
  const user = await requireView('RO');
  const p = await params;
  const chain = await resolveIo(p.partnerId, p.advertiserId, p.campaignId!, p.ioId!);
  if (!chain) notFound();
  const result = await listLineItems(
    user,
    { kind: 'io', id: chain.io.id },
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
      newLink={ioPath(
        chain.partner.publicId,
        chain.advertiser.publicId,
        chain.campaign.publicId,
        chain.io.publicId,
        'lis',
        'new',
      )}
      embedded
    />
  );
}
