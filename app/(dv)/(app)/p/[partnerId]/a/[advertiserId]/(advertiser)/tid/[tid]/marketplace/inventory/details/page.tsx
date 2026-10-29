import { DealDetailsPage } from '@/components/inventory/pages/DealDetailsPage';

export const metadata = { title: 'Deal' };

export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ partnerId: string; advertiserId: string; campaignId?: string; tid: string }>;
  searchParams: Promise<{ activeTab?: string; page?: string; user?: string; field?: string }>;
}) {
  const { tid, ...ids } = await params;
  return <DealDetailsPage params={ids} tid={tid} search={await searchParams} />;
}
