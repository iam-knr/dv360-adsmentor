import { CrossMediaListRoute } from '@/components/planning/pages/CrossMediaRoutes';

export const metadata = { title: 'Cross-media reach' };

export default async function Page({
  params,
}: {
  params: Promise<{ partnerId: string; advertiserId?: string; reportId?: string }>;
}) {
  return <CrossMediaListRoute params={await params} />;
}
