import { FeaturedRoute } from '@/components/inventory/pages/FeaturedRoute';

export const metadata = { title: 'Marketplace' };

export default async function Page({
  params,
}: {
  params: Promise<{ partnerId: string; advertiserId: string; campaignId?: string }>;
}) {
  return <FeaturedRoute params={await params} />;
}
