import { AbReportRoute } from '@/components/experiments/pages/ExperimentRoutes';

export const metadata = { title: 'A/B test report' };

export default async function Page({
  params,
}: {
  params: Promise<{ partnerId: string; advertiserId: string; testId: string }>;
}) {
  return <AbReportRoute params={await params} />;
}
