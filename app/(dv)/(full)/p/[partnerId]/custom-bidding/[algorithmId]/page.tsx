import { notFound } from 'next/navigation';
import { CustomBiddingWizard } from '@/components/resources/CustomBidding';
import { FormFrame } from '@/components/shell/Frames';
import { getCustomBidding } from '@/lib/resources/custom-bidding';
import { ServiceFailure } from '@/lib/resources/kit';
import { requireView } from '@/lib/scope/guard';
import { resolvePartner } from '@/lib/scope/resolve';

export const metadata = { title: 'Algorithm' };

export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ partnerId: string; algorithmId: string }>;
  searchParams: Promise<{ step?: string }>;
}) {
  const user = await requireView('RO');
  const { partnerId, algorithmId } = await params;
  const { step } = await searchParams;
  const partner = await resolvePartner(partnerId);
  if (!partner) notFound();
  const view = await getCustomBidding(user, algorithmId).catch((e: unknown) => {
    if (e instanceof ServiceFailure) return null;
    throw e;
  });
  if (!view) notFound();
  return (
    <FormFrame title={view.name}>
      <CustomBiddingWizard
        partnerId={partner.publicId}
        initial={view}
        initialStep={step === 'test' || step === 'save' ? step : 'setup'}
        activities={view.activities}
      />
    </FormFrame>
  );
}
