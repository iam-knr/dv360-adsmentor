import { notFound } from 'next/navigation';
import { CampaignForm } from '@/components/campaigns/CampaignForm';
import { FormFrame } from '@/components/shell/Frames';
import { serviceCtx } from '@/lib/campaigns/service-kit';
import { newCampaignValue } from '@/lib/campaigns/wire';
import { requireView } from '@/lib/scope/guard';
import { resolveAdvertiser } from '@/lib/scope/resolve';
import { todayIn } from '@/lib/validation/primitives';

export const metadata = { title: 'New campaign' };

export default async function Page({
  params,
}: {
  params: Promise<{ partnerId: string; advertiserId: string }>;
}) {
  const user = await requireView('STD');
  const { partnerId, advertiserId } = await params;
  const chain = await resolveAdvertiser(partnerId, advertiserId);
  if (!chain) notFound();
  const ctx = await serviceCtx(user);
  const today = todayIn(ctx.simNow, chain.advertiser.timeZone);
  return (
    <FormFrame title="New campaign">
      <CampaignForm
        mode="create"
        partnerId={chain.partner.publicId}
        advertiserId={chain.advertiser.publicId}
        currency={chain.advertiser.currencyCode}
        initial={newCampaignValue(today)}
      />
    </FormFrame>
  );
}
