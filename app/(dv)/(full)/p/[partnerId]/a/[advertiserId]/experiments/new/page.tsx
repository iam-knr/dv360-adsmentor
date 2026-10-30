import { AbNewRoute } from '@/components/experiments/pages/ExperimentRoutes';

export const metadata = { title: 'Create A/B test' };

export default async function Page({
  params,
}: {
  params: Promise<{ partnerId: string; advertiserId: string }>;
}) {
  return <AbNewRoute params={await params} />;
}
