import { LiftEditRoute } from '@/components/experiments/pages/ExperimentRoutes';

export const metadata = { title: 'Review and fix' };

export default async function Page({
  params,
}: {
  params: Promise<{ partnerId: string; advertiserId: string; studyId: string }>;
}) {
  return <LiftEditRoute params={await params} />;
}
