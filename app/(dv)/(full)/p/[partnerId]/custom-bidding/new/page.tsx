import { notFound } from 'next/navigation';
import { CustomBiddingWizard } from '@/components/resources/CustomBidding';
import { FormFrame } from '@/components/shell/Frames';
import { customBiddingActivities } from '@/lib/resources/custom-bidding';
import { requireView } from '@/lib/scope/guard';
import { resolvePartner } from '@/lib/scope/resolve';

export const metadata = { title: 'New algorithm' };

export default async function Page({ params }: { params: Promise<{ partnerId: string }> }) {
  const user = await requireView('STD');
  const { partnerId } = await params;
  const partner = await resolvePartner(partnerId);
  if (!partner) notFound();
  const activities = await customBiddingActivities(user, {
    level: 'partner',
    id: partner.publicId,
  });
  return (
    <FormFrame title="New algorithm">
      <CustomBiddingWizard
        partnerId={partner.publicId}
        initial={null}
        initialStep="setup"
        activities={activities}
      />
    </FormFrame>
  );
}
