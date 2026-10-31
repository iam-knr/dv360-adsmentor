import { notFound } from 'next/navigation';
import { PolicyCenter } from '@/components/settings/PolicyCenter';
import { requireView } from '@/lib/scope/guard';
import { getPolicyCenter } from '@/lib/settings/policy';

export const metadata = { title: 'Policy center' };

export default async function Page({
  params,
}: {
  params: Promise<{ partnerId: string; advertiserId: string }>;
}) {
  const user = await requireView('RO');
  const { advertiserId } = await params;
  const res = await getPolicyCenter(user, advertiserId);
  if (!res.ok) notFound();
  return <PolicyCenter data={res.data} advertiserId={advertiserId} />;
}
