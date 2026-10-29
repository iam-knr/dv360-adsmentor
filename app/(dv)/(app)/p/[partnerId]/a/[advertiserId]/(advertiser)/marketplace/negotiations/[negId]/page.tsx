import { NegotiationRoute } from '@/components/inventory/pages/NegotiationRoute';

export const metadata = { title: 'Negotiation' };

export default async function Page({
  params,
}: {
  params: Promise<{ partnerId: string; advertiserId: string; campaignId?: string; negId: string }>;
}) {
  const { negId, ...ids } = await params;
  return <NegotiationRoute params={ids} negId={negId} />;
}
