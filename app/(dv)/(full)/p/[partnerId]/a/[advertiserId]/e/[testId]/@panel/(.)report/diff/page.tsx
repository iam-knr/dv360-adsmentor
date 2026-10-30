import { AbPanelRoute } from '@/components/experiments/pages/ExperimentRoutes';

export default async function Page({
  params,
}: {
  params: Promise<{ partnerId: string; advertiserId: string; testId: string }>;
}) {
  return <AbPanelRoute params={await params} tab="diff" />;
}
