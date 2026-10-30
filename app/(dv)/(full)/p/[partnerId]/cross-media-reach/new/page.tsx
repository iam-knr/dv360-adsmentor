import { CrossMediaNewRoute } from '@/components/planning/pages/CrossMediaRoutes';

export const metadata = { title: 'Create a report' };

export default async function Page({
  params,
}: {
  params: Promise<{ partnerId: string; advertiserId?: string; reportId?: string }>;
}) {
  return <CrossMediaNewRoute params={await params} />;
}
