import { AbListRoute } from '@/components/experiments/pages/ExperimentRoutes';

export const metadata = { title: 'Experiments' };

export default async function Page({
  params,
}: {
  params: Promise<{ partnerId: string; advertiserId: string }>;
}) {
  return <AbListRoute params={await params} />;
}
