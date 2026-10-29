import { notFound } from 'next/navigation';
import { CreativesLibrary } from '@/components/creatives/CreativesLibrary';
import { orNotFound } from '@/lib/creatives/page';
import { listCreatives } from '@/lib/creatives/service';
import { requireView } from '@/lib/scope/guard';
import { resolveAdvertiser } from '@/lib/scope/resolve';

export const metadata = { title: 'Creatives' };

export default async function Page({
  params,
}: {
  params: Promise<{ partnerId: string; advertiserId: string }>;
}) {
  const user = await requireView('RO');
  const { partnerId, advertiserId } = await params;
  const chain = await resolveAdvertiser(partnerId, advertiserId);
  if (!chain) notFound();
  // default view: Status: Active, newest first (module 12 AC 1)
  const initial = await orNotFound(() =>
    listCreatives(user, chain.advertiser.publicId, { status: ['ACTIVE'], pageSize: 50 }),
  );
  return (
    <CreativesLibrary
      partnerId={chain.partner.publicId}
      advertiserId={chain.advertiser.publicId}
      initial={initial}
    />
  );
}
