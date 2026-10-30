import { LiftListRoute } from '@/components/experiments/pages/ExperimentRoutes';

export const metadata = { title: 'Lift studies' };

export default async function Page({
  params,
}: {
  params: Promise<{ partnerId: string; advertiserId: string }>;
}) {
  return <LiftListRoute params={await params} />;
}
