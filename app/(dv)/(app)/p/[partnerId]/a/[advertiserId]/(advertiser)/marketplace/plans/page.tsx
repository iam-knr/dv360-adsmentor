import { PlansRoute } from '@/components/planning/pages/PlansRoute';

export const metadata = { title: 'Plans' };

export default async function Page({
  params,
}: {
  params: Promise<{ partnerId: string; advertiserId: string }>;
}) {
  return <PlansRoute params={await params} />;
}
