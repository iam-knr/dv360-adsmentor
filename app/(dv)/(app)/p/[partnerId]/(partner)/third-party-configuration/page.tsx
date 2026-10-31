import { notFound } from 'next/navigation';
import { ConfigurationsForm } from '@/components/settings/ConfigurationsForm';
import { requireView } from '@/lib/scope/guard';
import { getAdvertiserConfigurations } from '@/lib/settings/configurations';

export const metadata = { title: 'Advertiser configurations' };

export default async function Page({ params }: { params: Promise<{ partnerId: string }> }) {
  const user = await requireView('RO');
  const { partnerId } = await params;
  const res = await getAdvertiserConfigurations(user, partnerId);
  if (!res.ok) notFound();
  return <ConfigurationsForm key={partnerId} partnerId={partnerId} initial={res.data} />;
}
