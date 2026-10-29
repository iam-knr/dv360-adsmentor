import { notFound } from 'next/navigation';
import { InsightsPage } from '@/components/audiences/Analysis';
import { listInsightLineItems } from '@/lib/audiences/service';
import { requireView } from '@/lib/scope/guard';
import { resolveAdvertiser } from '@/lib/scope/resolve';

export const metadata = { title: 'Audience insights' };

export default async function Page({
  params,
}: {
  params: Promise<{ partnerId: string; advertiserId: string }>;
}) {
  const user = await requireView('RO');
  const { partnerId, advertiserId } = await params;
  const chain = await resolveAdvertiser(partnerId, advertiserId);
  if (!chain) notFound();
  const lineItems = await listInsightLineItems(user, chain.advertiser.publicId);
  return <InsightsPage advertiserId={chain.advertiser.publicId} lineItems={lineItems} />;
}
