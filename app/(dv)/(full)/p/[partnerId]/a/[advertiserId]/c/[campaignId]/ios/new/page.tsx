import { notFound } from 'next/navigation';
import { IoForm } from '@/components/insertion-orders/IoForm';
import { IoStep1 } from '@/components/insertion-orders/IoStep1';
import { FormFrame } from '@/components/shell/Frames';
import { ioObjectiveMatrix, isIoObjective, isIoType } from '@/lib/insertion-orders/matrix';
import { newIoContext } from '@/lib/insertion-orders/service';
import { newIoValue } from '@/lib/insertion-orders/wire';
import { requireView } from '@/lib/scope/guard';
import { resolveCampaign } from '@/lib/scope/resolve';

export const metadata = { title: 'New insertion order' };

export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ partnerId: string; advertiserId: string; campaignId: string }>;
  searchParams: Promise<{ type?: string; objective?: string }>;
}) {
  const user = await requireView('STD');
  const { partnerId, advertiserId, campaignId } = await params;
  const chain = await resolveCampaign(partnerId, advertiserId, campaignId);
  if (!chain) notFound();
  const { type, objective } = await searchParams;
  const ids = {
    partnerId: chain.partner.publicId,
    advertiserId: chain.advertiser.publicId,
    campaignId: chain.campaign.publicId,
  };

  if (!isIoType(type) || !isIoObjective(objective)) {
    return (
      <FormFrame title="New insertion order">
        <IoStep1
          {...ids}
          matrices={{
            STANDARD: ioObjectiveMatrix('STANDARD'),
            CTV_OTT: ioObjectiveMatrix('CTV_OTT'),
            DOOH: ioObjectiveMatrix('DOOH'),
          }}
        />
      </FormFrame>
    );
  }
  const entry = ioObjectiveMatrix(type).objectives.find((o) => o.key === objective);
  if (!entry?.enabled) notFound();
  const ctx = await newIoContext(user, chain.campaign.publicId);
  return (
    <FormFrame title="New insertion order">
      <IoForm
        mode="create"
        {...ids}
        currency={ctx.currency}
        initial={newIoValue(type, objective, ctx.today)}
        matrix={entry}
        campaignFrequencyCap={ctx.campaignFrequencyCap}
      />
    </FormFrame>
  );
}
