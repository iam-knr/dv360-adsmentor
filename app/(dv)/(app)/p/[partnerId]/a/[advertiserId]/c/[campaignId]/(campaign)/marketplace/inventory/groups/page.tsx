import { DealGroupsPage } from '@/components/inventory/pages/DealGroupsPage';

export const metadata = { title: 'My inventory' };

export default async function Page({
  params,
}: {
  params: Promise<{ partnerId: string; advertiserId: string; campaignId?: string }>;
}) {
  return <DealGroupsPage params={await params} />;
}
