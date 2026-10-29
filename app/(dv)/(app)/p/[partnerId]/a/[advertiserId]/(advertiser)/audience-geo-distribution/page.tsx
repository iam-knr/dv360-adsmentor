import { notFound } from 'next/navigation';
import { GeoDistributionPage } from '@/components/audiences/Analysis';
import { getAudienceLookups } from '@/lib/audiences/service';
import { requireView } from '@/lib/scope/guard';
import { resolveAdvertiser } from '@/lib/scope/resolve';

export const metadata = { title: 'Geographic distribution' };

export default async function Page({
  params,
}: {
  params: Promise<{ partnerId: string; advertiserId: string }>;
}) {
  const user = await requireView('RO');
  const { partnerId, advertiserId } = await params;
  const chain = await resolveAdvertiser(partnerId, advertiserId);
  if (!chain) notFound();
  const lookups = await getAudienceLookups(user, chain.advertiser.publicId);
  return <GeoDistributionPage advertiserId={chain.advertiser.publicId} lookups={lookups} />;
}
