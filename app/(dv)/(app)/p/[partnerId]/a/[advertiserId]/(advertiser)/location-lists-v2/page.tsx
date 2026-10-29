import { notFound } from 'next/navigation';
import { LocationListsPage } from '@/components/resources/LocationLists';
import { listLocationLists } from '@/lib/resources/lists';
import { requireView } from '@/lib/scope/guard';
import { resolveAdvertiser } from '@/lib/scope/resolve';

export const metadata = { title: 'Location lists' };

export default async function Page({
  params,
}: {
  params: Promise<{ partnerId: string; advertiserId: string }>;
}) {
  const user = await requireView('RO');
  const { partnerId, advertiserId } = await params;
  const chain = await resolveAdvertiser(partnerId, advertiserId);
  if (!chain) notFound();
  const rows = await listLocationLists(user, chain.advertiser.publicId);
  return (
    <LocationListsPage
      partnerId={chain.partner.publicId}
      advertiserId={chain.advertiser.publicId}
      rows={rows}
    />
  );
}
