import { notFound } from 'next/navigation';
import { FormFrame } from '@/components/shell/Frames';
import { LookalikeForm } from '@/components/audiences/LookalikeForm';
import { getAudienceLookups } from '@/lib/audiences/service';
import { requireView } from '@/lib/scope/guard';
import { resolveAdvertiser } from '@/lib/scope/resolve';

export const metadata = { title: 'New lookalike audience' };

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
    <FormFrame title="New lookalike audience">
      <LookalikeForm partnerId={chain.partner.publicId} advertiserId={chain.advertiser.publicId} lookups={lookups} />
    </FormFrame>
  );
}
