import { notFound } from 'next/navigation';
import { FormFrame } from '@/components/shell/Frames';
import { NewAudienceTypes } from '@/components/audiences/NewAudienceTypes';
import { requireView } from '@/lib/scope/guard';
import { resolveAdvertiser } from '@/lib/scope/resolve';

export const metadata = { title: 'New audience' };

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
    <FormFrame title="New audience">
      <NewAudienceTypes partnerId={chain.partner.publicId} advertiserId={chain.advertiser.publicId} />
    </FormFrame>
  );
}
