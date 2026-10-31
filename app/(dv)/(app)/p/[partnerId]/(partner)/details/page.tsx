import { notFound } from 'next/navigation';
import { PartnerDetailsForm } from '@/components/settings/PartnerDetailsForm';
import { requireView } from '@/lib/scope/guard';
import { getExchangesPanel, getPartnerDetails } from '@/lib/settings/partner';

export const metadata = { title: 'Basic details' };

export default async function Page({ params }: { params: Promise<{ partnerId: string }> }) {
  const user = await requireView('RO');
  const { partnerId } = await params;
  const [details, exchanges] = await Promise.all([
    getPartnerDetails(user, partnerId),
    getExchangesPanel(user, partnerId),
  ]);
  if (!details.ok || !exchanges.ok) notFound();
  return (
    <PartnerDetailsForm
      key={details.data.id}
      partnerId={partnerId}
      details={details.data}
      exchanges={exchanges.data}
    />
  );
}
