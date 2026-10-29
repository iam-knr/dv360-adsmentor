import { notFound } from 'next/navigation';
import { LiAppPreStep } from '@/components/line-items/LiAppPreStep';
import { LiForm } from '@/components/line-items/LiForm';
import { LiTypePicker } from '@/components/line-items/LiTypePicker';
import { YtStep1 } from '@/components/youtube/YtStep1';
import { FormFrame } from '@/components/shell/Frames';
import {
  getConversionCandidates,
  getCreativeCandidates,
  getDraftInit,
  getIoChoices,
  getTypeOptions,
} from '@/lib/line-items/service';
import { findApp } from '@/lib/line-items/apps';
import { isFormType } from '@/lib/line-items/type-config';
import { ioPath } from '@/lib/routes/paths';
import { requireView } from '@/lib/scope/guard';
import { MSG } from '@/lib/validation/messages';
import { isYoutubeEnabled } from '@/lib/youtube/service';
import {
  subtypeFrom,
  type YtAdFormatChoice,
  type YtOptimization,
} from '@/lib/validation/constants/youtube';
import { resolveIo } from '@/lib/scope/resolve';

export const metadata = { title: 'New line item' };

export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ partnerId: string; advertiserId: string; campaignId: string; ioId: string }>;
  searchParams: Promise<{
    type?: string;
    platform?: string;
    appId?: string;
    adType?: string;
    name?: string;
    optimization?: string;
    format?: string;
  }>;
}) {
  const user = await requireView('STD');
  const p = await params;
  const chain = await resolveIo(p.partnerId, p.advertiserId, p.campaignId, p.ioId);
  if (!chain) notFound();
  const sp = await searchParams;
  const { type } = sp;
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
  const adType = sp.adType === 'VIDEO' ? 'VIDEO' : 'DISPLAY';
  const platform = sp.platform === 'IOS' || sp.platform === 'ANDROID' ? sp.platform : 'ALL';
  const pickedApp = type === 'MOBILE_APP_INSTALL' ? findApp(sp.appId) : null;
  const name = sp.name?.trim() ?? '';
  if ((type === 'MOBILE_APP_INSTALL' && !pickedApp) || (type === 'ADS_IN_MOBILE_APPS' && !name)) {
    return (
      <FormFrame title="New line item">
        <LiAppPreStep
          type={type}
          base={ioPath(
            ids.partnerId,
            ids.advertiserId,
            ids.campaignId,
            ids.ioPublicId,
            'lis',
            'new',
          )}
        />
      </FormFrame>
    );
  }
  let youtube: { optimization: YtOptimization; choice: YtAdFormatChoice | null } | null = null;
  if (type === 'YT_VIDEO' || type === 'YT_AUDIO') {
    const base = ioPath(
      ids.partnerId,
      ids.advertiserId,
      ids.campaignId,
      ids.ioPublicId,
      'lis',
      'new',
    );
    const optimization = sp.optimization as YtOptimization | undefined;
    const choice = (sp.format as YtAdFormatChoice | undefined) ?? null;
    const known =
      type === 'YT_AUDIO' || (!!optimization && subtypeFrom(optimization, choice) !== null);
    if (!name || !known) {
      return (
        <FormFrame title="New line item">
          <YtStep1
            base={base}
            type={type}
            blocked={
              (await isYoutubeEnabled(user, chain.advertiser.id)) ? null : MSG.YT_NOT_ENABLED
            }
          />
        </FormFrame>
      );
    }
    if (type === 'YT_VIDEO') youtube = { optimization: optimization!, choice };
  }
  const draft = await getDraftInit(user, chain.io.id, type, {
    ...(pickedApp ? { platform, appId: pickedApp.id } : {}),
    ...(type === 'MOBILE_APP_INSTALL' || type === 'ADS_IN_MOBILE_APPS' ? { adType } : {}),
    ...(name ? { name } : {}),
    ...(youtube ? { youtube } : {}),
  });
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
        app={draft.app}
        creatives={creatives}
        conversions={conversions}
        higherCapText={draft.higherCapText}
        readOnly={draft.readOnly}
      />
    </FormFrame>
  );
}
