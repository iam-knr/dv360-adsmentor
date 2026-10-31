import { notFound } from 'next/navigation';
import { AdvertiserDetailsForm } from '@/components/settings/AdvertiserDetailsForm';
import { requireView } from '@/lib/scope/guard';
import { getAdvertiserDetails } from '@/lib/settings/advertiser-details';

export const metadata = { title: 'Basic details' };

export default async function Page({
  params,
}: {
  params: Promise<{ partnerId: string; advertiserId: string }>;
}) {
  const user = await requireView('RO');
  const { advertiserId } = await params;
  const res = await getAdvertiserDetails(user, advertiserId);
  if (!res.ok) notFound();
  return <AdvertiserDetailsForm details={res.data} />;
}
