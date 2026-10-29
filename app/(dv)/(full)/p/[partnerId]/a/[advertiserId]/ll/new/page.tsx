import { notFound } from 'next/navigation';
import { LocationListForm } from '@/components/resources/LocationLists';
import { FormFrame } from '@/components/shell/Frames';
import { requireView } from '@/lib/scope/guard';
import { resolveAdvertiser } from '@/lib/scope/resolve';

export const metadata = { title: 'New location list' };

export default async function Page({
  params,
}: {
  params: Promise<{ partnerId: string; advertiserId: string }>;
}) {
  await requireView('STD');
  const { partnerId, advertiserId } = await params;
  const chain = await resolveAdvertiser(partnerId, advertiserId);
  if (!chain) notFound();
  return (
    <FormFrame title="New location list">
      <LocationListForm
        partnerId={chain.partner.publicId}
        advertiserId={chain.advertiser.publicId}
        initial={null}
      />
    </FormFrame>
  );
}
