import { OrdersDealsPage } from '@/components/inventory/pages/OrdersDealsPage';

export const metadata = { title: 'My inventory' };

export default async function Page({
  params,
}: {
  params: Promise<{ partnerId: string; advertiserId: string; campaignId?: string }>;
}) {
  return <OrdersDealsPage params={await params} />;
}
