import { NewPlanRoute } from '@/components/planning/pages/NewPlanRoute';

export const metadata = { title: 'New plan' };

export default async function Page({
  params,
}: {
  params: Promise<{ partnerId: string; advertiserId: string }>;
}) {
  return <NewPlanRoute params={await params} />;
}
