import { LiftNewRoute } from '@/components/experiments/pages/ExperimentRoutes';

export const metadata = { title: 'New lift study' };

export default async function Page({
  params,
}: {
  params: Promise<{ partnerId: string; advertiserId: string }>;
}) {
  return <LiftNewRoute params={await params} />;
}
