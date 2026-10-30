import { LiftReportRoute } from '@/components/experiments/pages/ExperimentRoutes';

export const metadata = { title: 'Lift study report' };

export default async function Page({
  params,
}: {
  params: Promise<{ partnerId: string; advertiserId: string; studyId: string }>;
}) {
  return <LiftReportRoute params={await params} />;
}
