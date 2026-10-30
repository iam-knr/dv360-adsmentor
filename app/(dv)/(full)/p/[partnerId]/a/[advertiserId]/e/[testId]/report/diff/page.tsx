import { AbSettingsPageRoute } from '@/components/experiments/pages/ExperimentRoutes';

export const metadata = { title: 'A/B test differences' };

export default async function Page({
  params,
}: {
  params: Promise<{ partnerId: string; advertiserId: string; testId: string }>;
}) {
  return <AbSettingsPageRoute params={await params} tab="diff" />;
}
