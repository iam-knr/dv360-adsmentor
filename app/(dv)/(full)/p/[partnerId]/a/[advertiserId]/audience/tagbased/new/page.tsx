import { notFound } from 'next/navigation';
import { FormFrame } from '@/components/shell/Frames';
import { TagBasedForm } from '@/components/audiences/TagBasedForm';
import { getAudienceLookups } from '@/lib/audiences/service';
import { requireView } from '@/lib/scope/guard';
import { resolveAdvertiser } from '@/lib/scope/resolve';

export const metadata = { title: 'New tag-based audience' };

export default async function Page({
  params,
}: {
  params: Promise<{ partnerId: string; advertiserId: string }>;
}) {
  const user = await requireView('STD');
  const { partnerId, advertiserId } = await params;
  const chain = await resolveAdvertiser(partnerId, advertiserId);
  if (!chain) notFound();
  const lookups = await getAudienceLookups(user, chain.advertiser.publicId);
  return (
    <FormFrame title="New tag-based audience">
      <TagBasedForm partnerId={chain.partner.publicId} advertiserId={chain.advertiser.publicId} lookups={lookups} />
    </FormFrame>
  );
}
