import { notFound } from 'next/navigation';
import { LocationListForm } from '@/components/resources/LocationLists';
import { FormFrame } from '@/components/shell/Frames';
import { getLocationList } from '@/lib/resources/lists';
import { ServiceFailure } from '@/lib/resources/kit';
import { requireView } from '@/lib/scope/guard';
import { resolveAdvertiser } from '@/lib/scope/resolve';

export const metadata = { title: 'Edit location list' };

export default async function Page({
  params,
}: {
  params: Promise<{ partnerId: string; advertiserId: string; listId: string }>;
}) {
  const user = await requireView('RO');
  const { partnerId, advertiserId, listId } = await params;
  const chain = await resolveAdvertiser(partnerId, advertiserId);
  if (!chain) notFound();
  const view = await getLocationList(user, listId).catch((e: unknown) => {
    if (e instanceof ServiceFailure) return null;
    throw e;
  });
  if (!view) notFound();
  return (
    <FormFrame title="Edit location list">
      <LocationListForm
        partnerId={chain.partner.publicId}
        advertiserId={chain.advertiser.publicId}
        initial={view}
      />
    </FormFrame>
  );
}
