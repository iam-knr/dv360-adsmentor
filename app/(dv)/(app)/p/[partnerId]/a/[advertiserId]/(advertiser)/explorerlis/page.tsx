import { notFound } from 'next/navigation';
import { LiGrid } from '@/components/line-items/LiGrid';
import { listLineItems } from '@/lib/line-items/service';
import { requireView } from '@/lib/scope/guard';
import { resolveAdvertiser } from '@/lib/scope/resolve';

export const metadata = { title: 'Line items' };

export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ partnerId: string; advertiserId: string; campaignId?: string; ioId?: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireView('RO');
  const p = await params;
  // Archived list: [A]/explorerlis?f.status=ARCHIVED, reached from the IO list menu (module 08 AC-08-26, RC-052)
  const archived = (await searchParams)['f.status'] === 'ARCHIVED';
  const chain = await resolveAdvertiser(p.partnerId, p.advertiserId);
  if (!chain) notFound();
  const result = await listLineItems(
    user,
    { kind: 'advertiser', id: chain.advertiser.id },
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
      archived={archived}
    />
  );
}
