import { CrossMediaDetailRoute } from '@/components/planning/pages/CrossMediaRoutes';

export const metadata = { title: 'Cross-media reach report' };

export default async function Page({
  params,
}: {
  params: Promise<{ partnerId: string; advertiserId?: string; reportId?: string }>;
}) {
  return <CrossMediaDetailRoute params={await params} />;
}
