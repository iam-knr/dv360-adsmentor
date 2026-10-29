import { notFound } from 'next/navigation';
import { AudienceDetails } from '@/components/audiences/AudienceDetails';
import { getAudience } from '@/lib/audiences/service';
import { requireView } from '@/lib/scope/guard';
import { resolveAdvertiser } from '@/lib/scope/resolve';
import { ServiceFailure } from '@/lib/resources/kit';

export const metadata = { title: 'Audience details' };

export default async function Page({
  params,
}: {
  params: Promise<{ partnerId: string; advertiserId: string; audienceId: string }>;
}) {
  const user = await requireView('RO');
  const { partnerId, advertiserId, audienceId } = await params;
  const chain = await resolveAdvertiser(partnerId, advertiserId);
  if (!chain) notFound();
  const audience = await getAudience(user, audienceId).catch((e: unknown) => {
    if (e instanceof ServiceFailure) return null;
    throw e;
  });
  if (!audience) notFound();
  return (
    <AudienceDetails
      partnerId={chain.partner.publicId}
      advertiserId={chain.advertiser.publicId}
      audience={audience}
    />
  );
}
