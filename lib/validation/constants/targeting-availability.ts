// MX-10 Targeting dimension availability per line item type (validation.md 3).
// Matrix labels are mapped to DM `TargetingDimension` keys here (RC-011) and the mapping is tested.
import type { AppAdType } from './creatives';
import type { LiType } from './li-compat';

/** `Y` available, `P` pre-added and removable, `L` pre-added and locked, `N` not available, `V` available only when adType is VIDEO. */
export type Availability = 'Y' | 'P' | 'L' | 'N' | 'V';

export const TARGETING_COLUMNS = [
  'DSP',
  'VID',
  'CTV',
  'AUD',
  'MAI',
  'AIA',
  'YTLI',
  'YTAG',
  'DG',
  'DOOH',
] as const;
export type TargetingColumn = (typeof TARGETING_COLUMNS)[number];

export const MATRIX_DIMENSIONS = [
  'INVENTORY_SOURCES',
  'BRAND_SUITABILITY',
  'APPS_URLS',
  'KEYWORDS',
  'KEYWORD_EXCLUSIONS',
  'CATEGORIES',
  'ENVIRONMENT',
  'POSITION',
  'VIEWABILITY',
  'LANGUAGE',
  'AUDIENCE_LISTS',
  'GEOGRAPHY',
  'DAY_TIME',
  'DEMOGRAPHICS',
  'BROWSER',
  'DEVICE',
  'CONNECTION_SPEED',
  'CARRIER_ISP',
  'VIDEO_PLAYER_SIZE',
  'CONTENT_DURATION',
  'LIVESTREAM',
  'REWARDED',
  'OPTIMIZED_TARGETING',
  'DOOH_VENUE_SCREEN',
] as const;
export type MatrixDimension = (typeof MATRIX_DIMENSIONS)[number];

type Row = readonly [Availability, Availability, Availability, Availability, Availability, Availability, Availability, Availability, Availability, Availability];

// Column order: DSP VID CTV AUD MAI AIA YTLI YTAG DG DOOH
const ROWS: Record<MatrixDimension, Row> = {
  INVENTORY_SOURCES: ['Y', 'Y', 'Y', 'Y', 'Y', 'Y', 'L', 'N', 'N', 'Y'],
  BRAND_SUITABILITY: ['L', 'L', 'L', 'L', 'L', 'L', 'L', 'N', 'N', 'N'],
  APPS_URLS: ['Y', 'Y', 'Y', 'Y', 'Y', 'Y', 'N', 'Y', 'N', 'N'],
  KEYWORDS: ['Y', 'Y', 'N', 'N', 'N', 'Y', 'N', 'Y', 'N', 'N'],
  KEYWORD_EXCLUSIONS: ['Y', 'Y', 'N', 'N', 'Y', 'Y', 'Y', 'Y', 'N', 'N'],
  CATEGORIES: ['Y', 'Y', 'Y', 'Y', 'Y', 'Y', 'N', 'Y', 'N', 'N'],
  ENVIRONMENT: ['Y', 'Y', 'N', 'Y', 'N', 'L', 'N', 'N', 'N', 'N'],
  POSITION: ['Y', 'Y', 'P', 'N', 'Y', 'Y', 'N', 'N', 'N', 'N'],
  VIEWABILITY: ['L', 'Y', 'N', 'N', 'Y', 'Y', 'N', 'N', 'N', 'N'],
  LANGUAGE: ['Y', 'Y', 'Y', 'Y', 'Y', 'Y', 'Y', 'N', 'Y', 'N'],
  AUDIENCE_LISTS: ['Y', 'Y', 'Y', 'Y', 'Y', 'Y', 'N', 'Y', 'Y', 'N'],
  GEOGRAPHY: ['Y', 'Y', 'Y', 'Y', 'Y', 'Y', 'P', 'N', 'Y', 'Y'],
  DAY_TIME: ['Y', 'Y', 'Y', 'Y', 'Y', 'Y', 'Y', 'N', 'Y', 'Y'],
  DEMOGRAPHICS: ['Y', 'Y', 'Y', 'Y', 'Y', 'Y', 'N', 'Y', 'Y', 'N'],
  BROWSER: ['Y', 'Y', 'N', 'N', 'N', 'N', 'N', 'N', 'N', 'N'],
  DEVICE: ['Y', 'Y', 'P', 'Y', 'Y', 'L', 'Y', 'N', 'Y', 'N'],
  CONNECTION_SPEED: ['Y', 'Y', 'N', 'N', 'Y', 'Y', 'N', 'N', 'N', 'N'],
  CARRIER_ISP: ['Y', 'Y', 'N', 'Y', 'Y', 'Y', 'N', 'N', 'N', 'N'],
  VIDEO_PLAYER_SIZE: ['N', 'Y', 'P', 'N', 'N', 'V', 'N', 'N', 'N', 'N'],
  CONTENT_DURATION: ['N', 'Y', 'Y', 'Y', 'N', 'V', 'N', 'N', 'N', 'N'],
  LIVESTREAM: ['N', 'Y', 'Y', 'N', 'N', 'V', 'N', 'N', 'N', 'N'],
  REWARDED: ['N', 'Y', 'N', 'N', 'N', 'V', 'N', 'N', 'N', 'N'],
  OPTIMIZED_TARGETING: ['Y', 'Y', 'Y', 'Y', 'Y', 'Y', 'N', 'N', 'N', 'N'],
  DOOH_VENUE_SCREEN: ['N', 'N', 'N', 'N', 'N', 'N', 'N', 'N', 'N', 'Y'],
};

export const TARGETING_AVAILABILITY: Record<MatrixDimension, Record<TargetingColumn, Availability>> =
  Object.fromEntries(
    MATRIX_DIMENSIONS.map((dim) => [
      dim,
      Object.fromEntries(TARGETING_COLUMNS.map((col, i) => [col, ROWS[dim][i]])),
    ]),
  ) as Record<MatrixDimension, Record<TargetingColumn, Availability>>;

/**
 * DM `TargetingDimension` keys (data-model 4.6) that each matrix label stands for (RC-011).
 * A keyword row with mode EXCLUDE is written `KEYWORD:EXCLUDE`, because the DM stores it as `KEYWORD` with a mode.
 */
export const MATRIX_TO_DM: Record<MatrixDimension, readonly string[]> = {
  INVENTORY_SOURCES: ['INVENTORY_SOURCE', 'AUTHORIZED_SELLER'],
  BRAND_SUITABILITY: [
    'BRAND_SUITABILITY',
    'DIGITAL_CONTENT_LABEL',
    'SENSITIVE_CATEGORY',
    'THIRD_PARTY_VERIFIER',
  ],
  APPS_URLS: ['APPS_AND_URLS'],
  KEYWORDS: ['KEYWORD'],
  KEYWORD_EXCLUSIONS: ['NEGATIVE_KEYWORD_LIST', 'KEYWORD:EXCLUDE'],
  CATEGORIES: ['CATEGORY'],
  ENVIRONMENT: ['ENVIRONMENT'],
  POSITION: ['POSITION_ON_SCREEN', 'POSITION_IN_CONTENT'],
  VIEWABILITY: ['VIEWABILITY'],
  LANGUAGE: ['LANGUAGE'],
  AUDIENCE_LISTS: ['AUDIENCE_LIST', 'TARGETING_EXPANSION'],
  GEOGRAPHY: ['GEOGRAPHY'],
  DAY_TIME: ['DAY_TIME'],
  DEMOGRAPHICS: ['GENDER', 'AGE', 'PARENTAL_STATUS', 'HOUSEHOLD_INCOME'],
  BROWSER: ['BROWSER'],
  DEVICE: ['DEVICE_TYPE', 'DEVICE_MAKE_MODEL', 'OPERATING_SYSTEM'],
  CONNECTION_SPEED: ['CONNECTION_SPEED'],
  CARRIER_ISP: ['CARRIER_ISP'],
  VIDEO_PLAYER_SIZE: ['VIDEO_PLAYER_SIZE'],
  CONTENT_DURATION: ['CONTENT_DURATION'],
  LIVESTREAM: ['CONTENT_STREAM_TYPE'],
  REWARDED: ['REWARDED'],
  OPTIMIZED_TARGETING: ['OPTIMIZED_TARGETING'],
  DOOH_VENUE_SCREEN: ['DOOH_VENUE'],
};

/** UI names used as `{Dimension}` in LI-102 messages. */
export const DIMENSION_LABEL: Record<MatrixDimension, string> = {
  INVENTORY_SOURCES: 'Inventory source',
  BRAND_SUITABILITY: 'Brand suitability',
  APPS_URLS: 'Apps & URLs',
  KEYWORDS: 'Keyword',
  KEYWORD_EXCLUSIONS: 'Keyword exclusion',
  CATEGORIES: 'Category',
  ENVIRONMENT: 'Environment',
  POSITION: 'Position',
  VIEWABILITY: 'Viewability',
  LANGUAGE: 'Language',
  AUDIENCE_LISTS: 'Audience list',
  GEOGRAPHY: 'Geography',
  DAY_TIME: 'Day & time',
  DEMOGRAPHICS: 'Demographics',
  BROWSER: 'Browser',
  DEVICE: 'Device',
  CONNECTION_SPEED: 'Connection speed',
  CARRIER_ISP: 'Carrier & ISP',
  VIDEO_PLAYER_SIZE: 'Video player size',
  CONTENT_DURATION: 'Content duration',
  LIVESTREAM: 'Livestream',
  REWARDED: 'Rewarded',
  OPTIMIZED_TARGETING: 'Optimized targeting',
  DOOH_VENUE_SCREEN: 'Venue and screen',
};

/** Reverse of MATRIX_TO_DM. Keys that no matrix row knows are not judged (decision D-V1). */
export function matrixDimensionOf(dmKey: string): MatrixDimension | null {
  for (const dim of MATRIX_DIMENSIONS) {
    if (MATRIX_TO_DM[dim].includes(dmKey)) return dim;
  }
  return null;
}

export function targetingColumn(type: LiType): TargetingColumn {
  switch (type) {
    case 'DISPLAY':
      return 'DSP';
    case 'VIDEO':
      return 'VID';
    case 'CTV':
      return 'CTV';
    case 'AUDIO':
      return 'AUD';
    case 'MOBILE_APP_INSTALL':
      return 'MAI';
    case 'ADS_IN_MOBILE_APPS':
      return 'AIA';
    case 'YT_VIDEO':
    case 'YT_AUDIO':
    case 'YT_ON_CTV':
      return 'YTLI';
    case 'DEMAND_GEN':
      return 'DG';
    case 'DOOH_DISPLAY':
    case 'DOOH_VIDEO':
      return 'DOOH';
  }
}

/** Raw matrix cell for a type, matrix label and (for apps) ad type. */
export function availabilityOf(
  type: LiType,
  dimension: MatrixDimension,
  adType?: AppAdType | null,
): Availability {
  const cell = TARGETING_AVAILABILITY[dimension][targetingColumn(type)];
  if (cell === 'V') return adType === 'VIDEO' ? 'Y' : 'N';
  return cell;
}

/** True unless the cell is `N` (LI-102 / TGT-003 reject only `N`). */
export function isDimensionAvailable(
  type: LiType,
  dimension: MatrixDimension,
  adType?: AppAdType | null,
): boolean {
  return availabilityOf(type, dimension, adType) !== 'N';
}

/** DOOH exchange names (LI-DOOH-004). Seed data and the exchange lookup carry the same names. */
export const DOOH_EXCHANGE_NAMES: readonly string[] = [
  'Hivestack',
  'Place Exchange',
  'VIOOH Digital Out of Home',
  'Vistar',
];
