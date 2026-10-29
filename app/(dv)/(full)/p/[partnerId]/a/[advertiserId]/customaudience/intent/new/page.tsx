import { notFound } from 'next/navigation';
import { FormFrame } from '@/components/shell/Frames';
import { CustomListForm } from '@/components/audiences/CustomListForm';
import { getAudienceLookups } from '@/lib/audiences/service';
import { requireView } from '@/lib/scope/guard';
import { resolveAdvertiser } from '@/lib/scope/resolve';

export const metadata = { title: 'New custom intent list' };

export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ partnerId: string; advertiserId: string }>;
  searchParams: Promise<{ surface?: string }>;
}) {
  const user = await requireView('STD');
  const { partnerId, advertiserId } = await params;
  const chain = await resolveAdvertiser(partnerId, advertiserId);
  if (!chain) notFound();
  const lookups = await getAudienceLookups(user, chain.advertiser.publicId);
  const surface = (await searchParams).surface === 'youtube' ? 'youtube' : 'display';
  return (
    <FormFrame title="New custom intent list">
      <CustomListForm partnerId={chain.partner.publicId} advertiserId={chain.advertiser.publicId} lookups={lookups} surface={surface} />
    </FormFrame>
  );
}
