import { notFound } from 'next/navigation';
import { TargetingDefaultsForm } from '@/components/settings/TargetingDefaultsForm';
import { requireView } from '@/lib/scope/guard';
import { getTargetingDefaults } from '@/lib/settings/targeting-defaults';

export const metadata = { title: 'Targeting' };

export default async function Page({ params }: { params: Promise<{ partnerId: string }> }) {
  const user = await requireView('RO');
  const { partnerId } = await params;
  const res = await getTargetingDefaults(user, partnerId);
  if (!res.ok) notFound();
  return <TargetingDefaultsForm key={partnerId} partnerId={partnerId} initial={res.data} />;
}
