// Fixtures for the resource rules: a valid input of each kind and a minimal validation context.
import type { ValidationContext } from '@/lib/validation';
import type {
  ChannelInput,
  CustomBiddingInput,
  FloodlightConversionInput,
  FloodlightGroupInput,
  KeywordListInput,
  LocationListInput,
} from '@/lib/validation/rules/resources';

export function resourceCtx(over: Partial<ValidationContext> = {}): ValidationContext {
  return {
    mode: 'create',
    now: new Date('2026-10-28T06:30:00Z'),
    actor: { userId: 'u1', role: 'STANDARD', limitedAccess: false },
    partner: { enabledExchangeIds: [] },
    advertiser: {
      currency: 'INR',
      timeZone: 'Asia/Kolkata',
      demandGenFloodlightOptimization: true,
      googleInventoryEnabled: true,
      appAttributionLinked: false,
      attributionModelIds: [],
    },
    lookups: {},
    ...over,
  };
}

export const validChannel = (): ChannelInput => ({
  name: 'Trusted sites',
  sites: ['news.example.com', 'com.example.lumen.pay'],
});

export const validKeywordList = (): KeywordListInput => ({
  name: 'Brand safety',
  keywords: ['free download\ncrack, torrent'],
});

export const validLocationList = (): LocationListInput => ({
  name: 'Metros',
  type: 'REGIONAL',
  entries: ['560001', '400001'],
  geoOptions: [{ id: 'in', code: 'IN', name: 'India', kind: 'COUNTRY' }],
});

export const validGroup = (): FloodlightGroupInput => ({
  name: 'Group',
  clickDays: 30,
  impressionDays: 1,
  viewableImpressionPct: 50,
  variableKeys: ['u1', 'u100'],
});

export const validConversion = (
  over: Partial<FloodlightConversionInput> = {},
): FloodlightConversionInput => ({
  platform: 'WEB',
  name: 'Purchase',
  format: 'GOOGLE_TAG',
  type: 'COUNTER',
  countingMethod: 'STANDARD',
  status: 'ACTIVE',
  remarketing: false,
  valueBasedBidding: false,
  ...over,
});

export const validCustomBidding = (): CustomBiddingInput => ({
  name: 'Click value',
  objective: 'CLICKS',
  source: 'RULES',
  rules: [{ groupKey: 'Click rules', signalKey: 'CLICKED', score: 1 }],
  multipliers: [
    { kind: 'DEVICE_TYPE', values: [{ valueKey: 'SMARTPHONE', multiplier: 1.5 }] },
    { kind: 'DAY_AND_TIME', values: [{ valueKey: 'WEEKEND_EVENING', multiplier: 2 }] },
  ],
});
