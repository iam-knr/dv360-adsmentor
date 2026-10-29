import { PlanRoute } from '@/components/planning/pages/PlanRoute';

export const metadata = { title: 'Adjust your plan and view forecast' };

export default async function Page({
  params,
}: {
  params: Promise<{ partnerId: string; advertiserId: string; planId: string }>;
}) {
  return <PlanRoute params={await params} />;
}
