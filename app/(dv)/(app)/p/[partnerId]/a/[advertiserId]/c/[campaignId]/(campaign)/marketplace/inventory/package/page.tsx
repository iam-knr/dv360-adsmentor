import { PackagesPage } from '@/components/inventory/pages/PackagesPage';

export const metadata = { title: 'My inventory' };

export default async function Page({
  params,
}: {
  params: Promise<{ partnerId: string; advertiserId: string; campaignId?: string }>;
}) {
  return <PackagesPage params={await params} />;
}
