import { notFound } from 'next/navigation';
import { CustomBiddingWizard } from '@/components/resources/CustomBidding';
import { FormFrame } from '@/components/shell/Frames';
import { customBiddingActivities } from '@/lib/resources/custom-bidding';
import { requireView } from '@/lib/scope/guard';
import { resolveAdvertiser } from '@/lib/scope/resolve';

export const metadata = { title: 'New algorithm' };

export default async function Page({
  params,
}: {
  params: Promise<{ partnerId: string; advertiserId: string }>;
}) {
  const user = await requireView('STD');
  const { partnerId, advertiserId } = await params;
  const chain = await resolveAdvertiser(partnerId, advertiserId);
  if (!chain) notFound();
  const activities = await customBiddingActivities(user, {
    level: 'advertiser',
    id: chain.advertiser.publicId,
  });
  return (
    <FormFrame title="New algorithm">
      <CustomBiddingWizard
        partnerId={chain.partner.publicId}
        advertiserId={chain.advertiser.publicId}
        initial={null}
        initialStep="setup"
        activities={activities}
      />
    </FormFrame>
  );
}
