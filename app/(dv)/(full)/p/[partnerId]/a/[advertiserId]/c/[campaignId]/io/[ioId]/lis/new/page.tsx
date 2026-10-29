import { notFound } from 'next/navigation';
import { LiForm } from '@/components/line-items/LiForm';
import { LiTypePicker } from '@/components/line-items/LiTypePicker';
import { FormFrame } from '@/components/shell/Frames';
import {
  getConversionCandidates,
  getCreativeCandidates,
  getDraftInit,
  getIoChoices,
  getTypeOptions,
} from '@/lib/line-items/service';
import { isFormType } from '@/lib/line-items/type-config';
import { requireView } from '@/lib/scope/guard';
import { resolveIo } from '@/lib/scope/resolve';

export const metadata = { title: 'New line item' };

export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ partnerId: string; advertiserId: string; campaignId: string; ioId: string }>;
  searchParams: Promise<{ type?: string }>;
}) {
  const user = await requireView('STD');
  const p = await params;
  const chain = await resolveIo(p.partnerId, p.advertiserId, p.campaignId, p.ioId);
  if (!chain) notFound();
  const { type } = await searchParams;
  const ids = {
    partnerId: chain.partner.publicId,
    advertiserId: chain.advertiser.publicId,
    campaignId: chain.campaign.publicId,
    ioPublicId: chain.io.publicId,
  };

  if (!type || !isFormType(type)) {
    const [options, ios] = await Promise.all([
      getTypeOptions(user, chain.io.id),
      getIoChoices(user, chain.advertiser.id),
    ]);
    if (!options) notFound();
    return (
      <FormFrame title="New line item">
        <LiTypePicker
          partnerId={ids.partnerId}
          advertiserId={ids.advertiserId}
          campaignId={ids.campaignId}
          ioId={ids.ioPublicId}
          options={options}
          ios={ios}
        />
      </FormFrame>
    );
  }
  const draft = await getDraftInit(user, chain.io.id, type);
  if (!draft) notFound();
  const [creatives, conversions] = await Promise.all([
    getCreativeCandidates(user, chain.io.id, { type }),
    getConversionCandidates(user, chain.advertiser.id),
  ]);
  return (
    <FormFrame title="New line item">
      <LiForm
        mode="create"
        {...ids}
        ioId={chain.io.id}
        advertiserRowId={chain.advertiser.id}
        currency={draft.currency}
        initial={draft.value}
        io={draft.io}
        locked={draft.locked}
        creatives={creatives}
        conversions={conversions}
        higherCapText={draft.higherCapText}
        readOnly={draft.readOnly}
      />
    </FormFrame>
  );
}
