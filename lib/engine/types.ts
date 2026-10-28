// Primitive vocabulary shared by every engine module (engine.md 2.1).

export const FORMAT_LIST = [
  'display',
  'native',
  'video_instream',
  'ctv',
  'audio',
  'youtube',
] as const;
export type Format = (typeof FORMAT_LIST)[number];
export type Device = 'computer' | 'smartphone' | 'tablet' | 'ctv';
export type Environment = 'web' | 'app';

export interface Dist {
  mu: number;
  sigma: number;
}

/** One row of synthetic supply for one tick (engine.md 2.1). */
export interface Cell {
  /** `${exchange}|${region}|${device}|${env}|${format}` */
  id: string;
  exchangeId: string;
  country: string;
  region: string;
  device: Device;
  environment: Environment;
  format: Format;
  /** Sandbox-tz hour 0..23. */
  hour: number;
  /** Bid requests this tick, integer. */
  requests: number;
  /** Expected requests in a typical sim day for this cell (no hour curve, no noise). */
  dayRequests: number;
  floor: Dist;
  external: Dist;
  internal: Dist;
  predictedViewability: { mean: number; kappa: number };
  uniqueUsersPerRequest: number;
  identifiedShare: number;
  ivtRate: number;
  /** Hour-of-day request index, mean 1 over the day. */
  hodIndex: number;
}

export type LineItemType =
  | 'DISPLAY'
  | 'VIDEO'
  | 'CTV'
  | 'AUDIO'
  | 'MOBILE_APP_INSTALL'
  | 'ADS_IN_MOBILE_APPS'
  | 'YT_VIDEO'
  | 'YT_AUDIO'
  | 'YT_ON_CTV'
  | 'DEMAND_GEN'
  | 'DOOH_DISPLAY'
  | 'DOOH_VIDEO';

/** Formats a line item type can buy (engine.md 3.1). */
export function formatsForType(t: LineItemType): Format[] {
  switch (t) {
    case 'DISPLAY':
    case 'MOBILE_APP_INSTALL':
    case 'ADS_IN_MOBILE_APPS':
    case 'DOOH_DISPLAY':
      return ['display', 'native'];
    case 'VIDEO':
    case 'DOOH_VIDEO':
      return ['video_instream'];
    case 'CTV':
      return ['ctv'];
    case 'AUDIO':
      return ['audio'];
    case 'YT_VIDEO':
    case 'YT_AUDIO':
    case 'YT_ON_CTV':
    case 'DEMAND_GEN':
      return ['youtube'];
  }
}

export type BidGoal =
  | 'MAX_CLICKS'
  | 'MAX_CONVERSIONS'
  | 'MAX_CONVERSION_VALUE'
  | 'MAX_VIEWABLE_IMPRESSIONS'
  | 'MAX_VIEWABLE_10S'
  | 'MAX_COMPLETED_IN_VIEW_AUDIBLE'
  | 'MAX_REACH'
  | 'MAX_CUSTOM_VALUE_COST'
  | 'MAX_CPV'
  | 'TARGET_CPM'
  | 'TARGET_CPV'
  | 'TARGET_CPC'
  | 'TARGET_CPA'
  | 'TARGET_ROAS'
  | 'TARGET_CUSTOM_VALUE_COST'
  | 'TARGET_VIEWABLE_IMPRESSIONS';
