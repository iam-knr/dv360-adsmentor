import { notFound } from 'next/navigation';
import { DataManager } from '@/components/settings/DataManager';
import { requireView } from '@/lib/scope/guard';
import { getDataManager } from '@/lib/settings/data-manager';

export const metadata = { title: 'Linked accounts' };

export default async function Page({
  params,
}: {
  params: Promise<{ partnerId: string; advertiserId: string }>;
}) {
  const user = await requireView('RO');
  const { partnerId, advertiserId } = await params;
  const res = await getDataManager(user, advertiserId);
  if (!res.ok) notFound();
  return (
    <DataManager partnerId={partnerId} advertiserId={advertiserId} tab="linked" data={res.data} />
  );
}
