import { notFound } from 'next/navigation';
import { AnalysisHub } from '@/components/audiences/Analysis';
import { requireView } from '@/lib/scope/guard';
import { resolveAdvertiser } from '@/lib/scope/resolve';

export const metadata = { title: 'Analysis' };

export default async function Page({
  params,
}: {
  params: Promise<{ partnerId: string; advertiserId: string }>;
}) {
  await requireView('RO');
  const { partnerId, advertiserId } = await params;
  const chain = await resolveAdvertiser(partnerId, advertiserId);
  if (!chain) notFound();
  return <AnalysisHub partnerId={chain.partner.publicId} advertiserId={chain.advertiser.publicId} />;
}
