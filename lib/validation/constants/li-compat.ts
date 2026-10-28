// MX-03 Line item type x IO objective compatibility, and the IO type rules of MX-02 table A (validation.md 3).
import type { IoObjective, IoType } from './io-matrix';

export const LI_TYPES = [
  'DISPLAY',
  'VIDEO',
  'CTV',
  'AUDIO',
  'MOBILE_APP_INSTALL',
  'ADS_IN_MOBILE_APPS',
  'YT_VIDEO',
  'YT_AUDIO',
  'DEMAND_GEN',
  'DOOH_DISPLAY',
  'DOOH_VIDEO',
  'YT_ON_CTV',
] as const;
export type LiType = (typeof LI_TYPES)[number];

/** UI names (validation.md 1.3). Used as `{Type}` in messages. */
export const LI_TYPE_LABEL: Record<LiType, string> = {
  DISPLAY: 'Display',
  VIDEO: 'Video',
  CTV: 'Connected TV',
  AUDIO: 'Audio',
  MOBILE_APP_INSTALL: 'Mobile app install',
  ADS_IN_MOBILE_APPS: 'Ads in mobile apps',
  YT_VIDEO: 'YouTube & partners video',
  YT_AUDIO: 'YouTube & partners audio',
  DEMAND_GEN: 'Demand Gen',
  DOOH_DISPLAY: 'Display digital out of home',
  DOOH_VIDEO: 'Video digital out of home',
  YT_ON_CTV: 'YouTube & partners on CTV',
};

/** Types that only exist in one kind of IO (the matrix has no objective column for them). */
export const DOOH_LI_TYPES: readonly LiType[] = ['DOOH_DISPLAY', 'DOOH_VIDEO'];
export const CTV_OTT_ONLY_LI_TYPES: readonly LiType[] = ['YT_ON_CTV'];
export const YOUTUBE_LI_TYPES: readonly LiType[] = ['YT_VIDEO', 'YT_AUDIO', 'YT_ON_CTV'];

/** Types with a row in MX-03 (everything but DOOH_* and YT_ON_CTV). */
export type MatrixLiType = Exclude<LiType, 'DOOH_DISPLAY' | 'DOOH_VIDEO' | 'YT_ON_CTV'>;

const Y = true;
const N = false;

/** MX-03: `LI_TYPE_BY_OBJECTIVE[objective][type]`. */
export const LI_TYPE_BY_OBJECTIVE: Record<IoObjective, Record<MatrixLiType, boolean>> = {
  BRAND_AWARENESS: {
    DISPLAY: Y,
    VIDEO: Y,
    CTV: Y,
    AUDIO: Y,
    MOBILE_APP_INSTALL: Y,
    ADS_IN_MOBILE_APPS: Y,
    YT_VIDEO: Y,
    YT_AUDIO: Y,
    DEMAND_GEN: N,
  },
  CLICKS: {
    DISPLAY: Y,
    VIDEO: Y,
    CTV: N,
    AUDIO: N,
    MOBILE_APP_INSTALL: Y,
    ADS_IN_MOBILE_APPS: Y,
    YT_VIDEO: N,
    YT_AUDIO: N,
    DEMAND_GEN: Y,
  },
  CONVERSIONS: {
    DISPLAY: Y,
    VIDEO: Y,
    CTV: Y,
    AUDIO: Y,
    MOBILE_APP_INSTALL: Y,
    ADS_IN_MOBILE_APPS: Y,
    YT_VIDEO: N,
    YT_AUDIO: N,
    DEMAND_GEN: Y,
  },
  CUSTOM: {
    DISPLAY: Y,
    VIDEO: Y,
    CTV: Y,
    AUDIO: Y,
    MOBILE_APP_INSTALL: Y,
    ADS_IN_MOBILE_APPS: Y,
    YT_VIDEO: N,
    YT_AUDIO: N,
    DEMAND_GEN: N,
  },
  NONE: {
    DISPLAY: Y,
    VIDEO: Y,
    CTV: Y,
    AUDIO: Y,
    MOBILE_APP_INSTALL: Y,
    ADS_IN_MOBILE_APPS: Y,
    YT_VIDEO: Y,
    YT_AUDIO: Y,
    DEMAND_GEN: Y,
  },
};

export function isMatrixLiType(type: LiType): type is MatrixLiType {
  return !DOOH_LI_TYPES.includes(type) && !CTV_OTT_ONLY_LI_TYPES.includes(type);
}

/** MX-03: true when the card is enabled for the objective. Types without a matrix row are not judged here. */
export function liTypeAllowedByObjective(objective: IoObjective, type: LiType): boolean {
  return isMatrixLiType(type) ? LI_TYPE_BY_OBJECTIVE[objective][type] : true;
}

/** MX-02 table A: which line item types an IO type accepts at all (LI-007). */
export function liTypeAllowedByIoType(ioType: IoType, type: LiType): boolean {
  switch (ioType) {
    case 'DOOH':
      return DOOH_LI_TYPES.includes(type);
    case 'CTV_OTT':
      return type === 'CTV' || type === 'YT_ON_CTV';
    case 'STANDARD':
      return !DOOH_LI_TYPES.includes(type) && !CTV_OTT_ONLY_LI_TYPES.includes(type);
  }
}

/** Types an automated IO may contain (RC-041, IO-052). */
export const AUTOMATION_LI_TYPES: readonly LiType[] = ['DISPLAY', 'VIDEO', 'CTV'];
