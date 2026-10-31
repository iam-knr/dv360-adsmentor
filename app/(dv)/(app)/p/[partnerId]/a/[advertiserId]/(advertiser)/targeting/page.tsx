import { notFound } from 'next/navigation';
import { AdvertiserTargetingRules } from '@/components/settings/AdvertiserTargetingRules';
import { requireView } from '@/lib/scope/guard';
import { getAdvertiserTargetingRules } from '@/lib/settings/targeting-rules';

export const metadata = { title: 'Targeting rules' };

export default async function Page({
  params,
}: {
  params: Promise<{ partnerId: string; advertiserId: string }>;
}) {
  const user = await requireView('RO');
  const { advertiserId } = await params;
  const res = await getAdvertiserTargetingRules(user, advertiserId);
  if (!res.ok) notFound();
  return <AdvertiserTargetingRules rules={res.data} />;
}
