import { DiscoverRoute } from '@/components/inventory/pages/DiscoverRoute';

export const metadata = { title: 'Marketplace' };

export default async function Page({
  params,
}: {
  params: Promise<{ partnerId: string; advertiserId: string; campaignId?: string }>;
}) {
  return <DiscoverRoute params={await params} />;
}
