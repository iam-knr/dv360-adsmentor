import { NegotiationsRoute } from '@/components/inventory/pages/NegotiationsRoute';

export const metadata = { title: 'Negotiations' };

export default async function Page({
  params,
}: {
  params: Promise<{ partnerId: string; advertiserId: string; campaignId?: string }>;
}) {
  return <NegotiationsRoute params={await params} />;
}
