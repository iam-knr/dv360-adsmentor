// MX-09 Creative type and line item compatibility, MX-09b size limits (validation.md 3).
import type { LiType } from './li-compat';

export const CREATIVE_FORMATS = [
  'IMAGE',
  'HTML5',
  'NATIVE_SITE',
  'NATIVE_VIDEO',
  'VIDEO_FILE',
  'YOUTUBE_VIDEO',
  'AUDIO_FILE',
  'TP_DISPLAY',
  'TP_VIDEO',
  'TP_AUDIO',
] as const;
export type CreativeFormat = (typeof CREATIVE_FORMATS)[number];

export type AppAdType = 'DISPLAY' | 'VIDEO';

/** Columns of MX-09 A. Apps columns depend on the chosen `adType`. */
export type CreativeColumn =
  | 'DISPLAY'
  | 'VIDEO'
  | 'CTV'
  | 'AUDIO'
  | 'APP_DISPLAY'
  | 'APP_VIDEO'
  | 'DOOH_DISPLAY'
  | 'DOOH_VIDEO';

export const CREATIVE_BY_COLUMN: Record<CreativeColumn, readonly CreativeFormat[]> = {
  DISPLAY: ['IMAGE', 'HTML5', 'NATIVE_SITE', 'NATIVE_VIDEO', 'TP_DISPLAY'],
  VIDEO: ['NATIVE_VIDEO', 'VIDEO_FILE', 'YOUTUBE_VIDEO', 'TP_VIDEO'],
  CTV: ['VIDEO_FILE', 'TP_VIDEO'],
  AUDIO: ['AUDIO_FILE', 'TP_AUDIO'],
  APP_DISPLAY: ['IMAGE', 'HTML5', 'NATIVE_SITE', 'TP_DISPLAY'],
  APP_VIDEO: ['NATIVE_VIDEO', 'VIDEO_FILE', 'TP_VIDEO'],
  DOOH_DISPLAY: ['IMAGE'],
  DOOH_VIDEO: ['VIDEO_FILE', 'TP_VIDEO'],
};

/** Column for a line item type, or null when the type uses no library creatives (YouTube, Demand Gen). */
export function creativeColumn(type: LiType, adType?: AppAdType | null): CreativeColumn | null {
  switch (type) {
    case 'DISPLAY':
    case 'VIDEO':
    case 'CTV':
    case 'AUDIO':
    case 'DOOH_DISPLAY':
    case 'DOOH_VIDEO':
      return type;
    case 'MOBILE_APP_INSTALL':
    case 'ADS_IN_MOBILE_APPS':
      return adType === 'VIDEO' ? 'APP_VIDEO' : 'APP_DISPLAY';
    default:
      return null;
  }
}

export function creativeFormatAllowed(
  type: LiType,
  format: CreativeFormat,
  adType?: AppAdType | null,
): boolean {
  const column = creativeColumn(type, adType);
  return column ? CREATIVE_BY_COLUMN[column].includes(format) : true;
}

/** Types whose ads live in ad groups or ad lists, not in the creative library (LI-063 skips them). */
export const LI_TYPES_WITHOUT_LIBRARY_CREATIVES: readonly LiType[] = [
  'YT_VIDEO',
  'YT_AUDIO',
  'YT_ON_CTV',
  'DEMAND_GEN',
];

/** MX-09b standard display sizes (width x height). Simulator defaults, Q11. */
export const STANDARD_DISPLAY_SIZES: readonly (readonly [number, number])[] = [
  [300, 250],
  [336, 280],
  [728, 90],
  [300, 600],
  [320, 50],
  [320, 100],
  [160, 600],
  [120, 600],
  [970, 250],
  [970, 90],
  [468, 60],
  [250, 250],
  [200, 200],
  [300, 1050],
  [320, 480],
  [480, 320],
  [1024, 768],
  [768, 1024],
];

export function isStandardDisplaySize(width: number, height: number): boolean {
  return STANDARD_DISPLAY_SIZES.some(([w, h]) => w === width && h === height);
}
