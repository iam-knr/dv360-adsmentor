// Fixtures of the YouTube validation tests (module 09 6.3). Money in minor units.
import {
  fullLookups,
  inr,
  makeCtx,
  validLineItem,
  type CtxOverrides,
} from '@/lib/validation/testing/fixtures';
import { YT_SUBTYPE_INFO } from '@/lib/validation/constants/youtube';
import type {
  AdGroupInput,
  AdInput,
  LineItemInput,
  ValidationContext,
  YoutubeVideoInfo,
} from '@/lib/validation/types';
import type { YtSubtype } from '@/lib/validation/constants/youtube';

export { inr };

export const VIDEOS: YoutubeVideoInfo[] = [
  { videoId: 'AAAAAAAAAA6', durationSec: 6, orientation: 'HORIZONTAL', isPublic: true },
  { videoId: 'AAAAAAAAA15', durationSec: 15, orientation: 'HORIZONTAL', isPublic: true },
  { videoId: 'AAAAAAAAAV5', durationSec: 5, orientation: 'VERTICAL', isPublic: true },
  { videoId: 'AAAAAAAAPRV', durationSec: 30, orientation: 'HORIZONTAL', isPublic: false },
];

export function ytLineItem(subtype: YtSubtype = 'EFFICIENT_REACH'): LineItemInput {
  const info = YT_SUBTYPE_INFO[subtype];
  const base = validLineItem('YT_VIDEO');
  return {
    ...base,
    type: subtype === 'AUDIO_REACH' ? 'YT_AUDIO' : 'YT_VIDEO',
    inventory: {
      quality: 'AUTHORIZED_DIRECT_SELLERS_AND_RESELLERS',
      exchanges: [],
      deals: [],
      dealGroups: [],
    },
    budget: { mode: 'UNLIMITED' },
    pacing: { period: 'DAILY', type: 'EVEN', dailyAmount: inr(1000) },
    bid: { mode: 'AUTOMATED', optimizedTowards: info.liBid as never, priority: 'FULL_BUDGET' },
    creatives: [],
    targeting: { dimensions: ['GEOGRAPHY', 'BRAND_SUITABILITY', 'INVENTORY_SOURCE'] },
    youtube: {
      subtype,
      optimization: info.optimization,
      adFormatChoice: info.choice,
      adFormats: { inStream: true, inFeed: true, shorts: true },
      viewCap: { mode: 'UNLIMITED' },
      targetFrequency: info.targetFrequency
        ? { mode: 'LIMITED', maxImpressions: 3, periodCount: 1, period: 'WEEK' }
        : null,
      productFeed: false,
      relatedVideoIds: [],
      inventorySources: ['YOUTUBE', 'GOOGLE_TV', 'VIDEO_PARTNERS'],
    },
  };
}

export function ytCtx(overrides: CtxOverrides = {}): ValidationContext {
  const ctx = makeCtx(
    {
      ...overrides,
      lookups: {
        ...fullLookups('YT_VIDEO'),
        youtubeVideos: new Map(VIDEOS.map((v) => [v.videoId, v])),
        ...(overrides.lookups ?? {}),
      },
    },
    'YT_VIDEO',
  );
  return ctx;
}

export function validAdGroup(): AdGroupInput {
  return { name: 'Ad group 1', status: 'ACTIVE', bid: inr(75), dimensions: [], adCount: 1 };
}

export function validAd(): AdInput {
  return {
    name: 'Ad 1',
    status: 'ACTIVE',
    videoRef: 'AAAAAAAAAA6',
    videoId: 'AAAAAAAAAA6',
    headline: 'Headline',
    longHeadline: 'A longer headline',
    description: 'Description',
    callToAction: 'Shop now',
    businessName: 'Fixture business',
    logoAssetId: 'logo-1',
    path1: '',
    path2: '',
    landingPageUrl: 'https://example.com',
    clickTrackerUrl: '',
    companionMode: 'NONE',
  };
}
