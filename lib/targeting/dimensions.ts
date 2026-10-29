// Card dimensions: labels, Add targeting groups, MX-10 availability, pre-added defaults and type-change cleanup
// (module 10 2.1, 4.3 rule 5). Dimension keys are the MX-10 matrix labels (RC-011).
import {
  availabilityOf,
  TARGETING_AVAILABILITY,
  type Availability,
  type MatrixDimension,
} from '@/lib/validation/constants/targeting-availability';
import { LI_TYPE_LABEL, LI_TYPES, type LiType } from '@/lib/validation/constants/li-compat';
import { AGE_STOPS, DEVICE_TYPES, GENDERS, HOUSEHOLD_INCOMES, PARENTAL_STATUSES } from './options';
import type { CriteriaKey, Sel, TargetingCriteria, TargetingState } from './types';

export type MenuGroup = 'Content' | 'Audience' | 'Technology';

export const MENU: Record<MenuGroup, MatrixDimension[]> = {
  Content: [
    'BRAND_SUITABILITY',
    'APPS_URLS',
    'KEYWORDS',
    'CATEGORIES',
    'ENVIRONMENT',
    'POSITION',
    'VIEWABILITY',
    'LANGUAGE',
  ],
  Audience: ['AUDIENCE_LISTS', 'GEOGRAPHY', 'DAY_TIME', 'DEMOGRAPHICS'],
  Technology: ['BROWSER', 'DEVICE', 'CONNECTION_SPEED', 'CARRIER_ISP'],
};

/** YouTube LI menu (explore 06/07): the short list, no groups. */
export const YOUTUBE_MENU: MatrixDimension[] = [
  'KEYWORD_EXCLUSIONS',
  'LANGUAGE',
  'INVENTORY_SOURCES',
  'GEOGRAPHY',
  'DAY_TIME',
  'DEVICE',
];

export const CARD_LABEL: Partial<Record<MatrixDimension, string>> = {
  INVENTORY_SOURCES: 'Inventory sources',
  BRAND_SUITABILITY: 'Brand suitability',
  APPS_URLS: 'Apps & URLs',
  KEYWORDS: 'Keywords',
  KEYWORD_EXCLUSIONS: 'Keyword exclusions',
  CATEGORIES: 'Categories',
  ENVIRONMENT: 'Environment',
  POSITION: 'Position',
  VIEWABILITY: 'Viewability',
  LANGUAGE: 'Language',
  AUDIENCE_LISTS: 'Audience lists',
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
  DOOH_VENUE_SCREEN: 'Venue and screen',
};

/** Which criteria field holds each matrix dimension. INVENTORY_SOURCES is LI form data, not card state. */
export const CRITERIA_OF: Partial<Record<MatrixDimension, CriteriaKey>> = {
  BRAND_SUITABILITY: 'brandSuitability',
  APPS_URLS: 'appsAndUrls',
  KEYWORDS: 'keywords',
  KEYWORD_EXCLUSIONS: 'keywords',
  CATEGORIES: 'categories',
  ENVIRONMENT: 'environment',
  POSITION: 'position',
  VIEWABILITY: 'viewability',
  LANGUAGE: 'language',
  AUDIENCE_LISTS: 'audienceLists',
  GEOGRAPHY: 'geography',
  DAY_TIME: 'dayAndTime',
  DEMOGRAPHICS: 'demographics',
  BROWSER: 'browser',
  DEVICE: 'device',
  CONNECTION_SPEED: 'connectionSpeed',
  CARRIER_ISP: 'carrierIsp',
  VIDEO_PLAYER_SIZE: 'videoPlayerSize',
  CONTENT_DURATION: 'contentDuration',
  LIVESTREAM: 'livestream',
  REWARDED: 'rewarded',
  OPTIMIZED_TARGETING: 'optimizedTargeting',
  DOOH_VENUE_SCREEN: 'doohVenue',
};

/** The card row order (menu order, then the type-only rows). */
export const ROW_ORDER: MatrixDimension[] = [
  'INVENTORY_SOURCES',
  ...MENU.Content.slice(0, 2),
  'KEYWORDS',
  'KEYWORD_EXCLUSIONS',
  ...MENU.Content.slice(3),
  ...MENU.Audience,
  ...MENU.Technology,
  'VIDEO_PLAYER_SIZE',
  'CONTENT_DURATION',
  'LIVESTREAM',
  'REWARDED',
  'DOOH_VENUE_SCREEN',
];

/** Accepts stub-era spellings ("display", DM `CONNECTED_TV`) and returns the VAL key, or null. */
export function toLiType(value: string): LiType | null {
  const key = value.toUpperCase().replace(/[^A-Z_]/g, '_');
  const alias: Record<string, LiType> = {
    CONNECTED_TV: 'CTV',
    YOUTUBE_VIDEO: 'YT_VIDEO',
    YOUTUBE_AUDIO: 'YT_AUDIO',
  };
  if (alias[key]) return alias[key];
  return (LI_TYPES as readonly string[]).includes(key) ? (key as LiType) : null;
}

export function typeLabel(type: string): string {
  const t = toLiType(type);
  return t ? LI_TYPE_LABEL[t] : type;
}

export function availability(type: string, dim: MatrixDimension): Availability {
  // The YouTube ad group editor reuses the card with the YTAG column of MX-10 (module 09 2.4).
  if (type === AD_GROUP_TYPE) return TARGETING_AVAILABILITY[dim].YTAG;
  const t = toLiType(type);
  return t ? availabilityOf(t, dim) : 'Y';
}

const AD_GROUP_TYPE = 'YT_AD_GROUP';
const AD_GROUP_MENU: MatrixDimension[] = [
  'APPS_URLS',
  'KEYWORDS',
  'CATEGORIES',
  'DEMOGRAPHICS',
  'AUDIENCE_LISTS',
];
const isYoutube = (type: string) =>
  ['YT_VIDEO', 'YT_AUDIO', 'YT_ON_CTV'].includes(toLiType(type) ?? '');
const isVideoLike = (type: string) => ['VIDEO', 'CTV'].includes(toLiType(type) ?? '');

/** 19-gap-finish 2.4: Mobile app install pre-adds Viewability (Open Measurement locked) and Device. */
const EXTRA_PRE_ADDED: Partial<Record<LiType, MatrixDimension[]>> = {
  MOBILE_APP_INSTALL: ['VIEWABILITY', 'DEVICE'],
};
const EXTRA_LOCKED: Partial<Record<LiType, MatrixDimension[]>> = {
  MOBILE_APP_INSTALL: ['VIEWABILITY'],
};

/** Rows locked by the type (MX-10 `L`): no trash icon. */
export function typeLocked(type: string): MatrixDimension[] {
  const t = toLiType(type);
  return ROW_ORDER.filter((d) => availability(type, d) === 'L').concat(
    t ? (EXTRA_LOCKED[t] ?? []) : [],
  );
}

/** Rows a new card starts with (MX-10 `P` and `L`). */
export function preAdded(type: string): MatrixDimension[] {
  const t = toLiType(type);
  const extra = t ? (EXTRA_PRE_ADDED[t] ?? []) : [];
  return ROW_ORDER.filter((d) => ['P', 'L'].includes(availability(type, d)) || extra.includes(d));
}

/** Add targeting menu for a type: groups with the dimensions the type allows (hidden when `N`). */
export function menuFor(type: string): { group: MenuGroup | null; items: MatrixDimension[] }[] {
  if (type === AD_GROUP_TYPE) return [{ group: null, items: AD_GROUP_MENU }];
  if (isYoutube(type)) return [{ group: null, items: YOUTUBE_MENU }];
  return (Object.keys(MENU) as MenuGroup[])
    .map((group) => ({
      group,
      items: MENU[group].filter((d) =>
        d === 'KEYWORDS'
          ? availability(type, 'KEYWORDS') !== 'N' ||
            availability(type, 'KEYWORD_EXCLUSIONS') !== 'N'
          : availability(type, d) !== 'N',
      ),
    }))
    .filter((g) => g.items.length > 0);
}

const sel = (ids: string[], mode: Sel['mode'] = 'INCLUDE'): Sel[] =>
  ids.map((id) => ({ id, mode }));

/** State of a freshly added row (4.3 rule 3), with the per-type defaults of MX-10 and 19-gap-finish. */
export function defaultCriteria(dim: MatrixDimension, type: string): Partial<TargetingCriteria> {
  const t = toLiType(type);
  switch (dim) {
    case 'BRAND_SUITABILITY':
      return {
        brandSuitability: {
          inventoryMode: 'MAXIMUM',
          thirdParty: { provider: 'NONE', options: [] },
        },
      };
    case 'APPS_URLS':
      return { appsAndUrls: { channelIds: [], collections: [], urls: [], apps: [] } };
    case 'KEYWORDS':
    case 'KEYWORD_EXCLUSIONS':
      return { keywords: { include: [], exclude: [] } };
    case 'CATEGORIES':
      return { categories: [] };
    case 'ENVIRONMENT':
      return { environment: { web: false, app: t === 'ADS_IN_MOBILE_APPS' } };
    case 'POSITION':
      return {
        position: { onScreen: [], inContent: isVideoLike(type) ? ['IN_STREAM'] : [], native: [] },
      };
    case 'VIEWABILITY':
      return {
        viewability: {
          openMeasurement: t === 'DISPLAY' || t === 'MOBILE_APP_INSTALL',
          predictedPct: null,
        },
      };
    case 'LANGUAGE':
      return { language: [] };
    case 'AUDIENCE_LISTS':
      return {
        audienceLists: {
          include: { firstPartyGroups: [], google: [], combined: [], custom: [] },
          exclude: { firstParty: [], google: [] },
        },
      };
    case 'GEOGRAPHY':
      return { geography: { regions: [] } };
    case 'DAY_TIME':
      return { dayAndTime: { segments: [], tz: 'ADVERTISER' } };
    case 'DEMOGRAPHICS':
      return {
        demographics: {
          gender: GENDERS.map((o) => o.code),
          ageRange: [AGE_STOPS[0], AGE_STOPS[AGE_STOPS.length - 1]!],
          ageUnknown: true,
          parental: PARENTAL_STATUSES.map((o) => o.code),
          income: HOUSEHOLD_INCOMES.map((o) => o.code),
        },
      };
    case 'BROWSER':
      return { browser: [] };
    case 'DEVICE': {
      const all = DEVICE_TYPES.map((o) => o.code);
      if (t === 'CTV')
        return {
          device: {
            types: [
              ...sel(['CONNECTED_TV']),
              ...sel(['COMPUTER', 'SMARTPHONE', 'TABLET'], 'EXCLUDE'),
            ],
            os: [],
            makeModel: [],
          },
        };
      if (t === 'ADS_IN_MOBILE_APPS' || t === 'MOBILE_APP_INSTALL')
        return { device: { types: sel(['SMARTPHONE', 'TABLET']), os: [], makeModel: [] } };
      return { device: { types: sel(all), os: [], makeModel: [] } };
    }
    case 'CONNECTION_SPEED':
      return { connectionSpeed: 'ALL' };
    case 'CARRIER_ISP':
      return { carrierIsp: [] };
    case 'VIDEO_PLAYER_SIZE':
      return { videoPlayerSize: t === 'CTV' ? ['LARGE', 'HD'] : [] };
    case 'CONTENT_DURATION':
      return { contentDuration: [] };
    case 'LIVESTREAM':
      return { livestream: 'INCLUDE' };
    case 'REWARDED':
      return { rewarded: 'INCLUDE' };
    case 'DOOH_VENUE_SCREEN':
      return { doohVenue: [] };
    default:
      return {};
  }
}

export function emptyTargetingState(type: string): TargetingState {
  const criteria: TargetingCriteria = {};
  for (const dim of preAdded(type)) Object.assign(criteria, defaultCriteria(dim, type));
  return { version: 1, lineItemType: type, criteria };
}

/** Is the row of `dim` present in the card? Type-locked rows are always present. */
export function hasRow(state: TargetingState, dim: MatrixDimension): boolean {
  const key = CRITERIA_OF[dim];
  if (dim === 'INVENTORY_SOURCES') return availability(state.lineItemType, dim) === 'L';
  if (!key || state.criteria[key] === undefined) return false;
  if (dim === 'KEYWORDS' || dim === 'KEYWORD_EXCLUSIONS')
    return keywordDim(state.lineItemType) === dim;
  return true;
}

/** Keywords show as "Keywords" where includes are allowed, else as "Keyword exclusions". */
export function keywordDim(type: string): 'KEYWORDS' | 'KEYWORD_EXCLUSIONS' {
  return availability(type, 'KEYWORDS') !== 'N' ? 'KEYWORDS' : 'KEYWORD_EXCLUSIONS';
}

export function rowsOf(state: TargetingState): MatrixDimension[] {
  return ROW_ORDER.filter((d) => hasRow(state, d));
}

export function removeDimension(state: TargetingState, dim: MatrixDimension): TargetingState {
  const key = CRITERIA_OF[dim];
  if (!key) return state;
  const criteria = { ...state.criteria };
  delete criteria[key];
  return { ...state, criteria };
}

/**
 * Type change (4.3 rule 5, AC-10-18): drops dimensions the new type does not allow, keeps only exclusions for
 * keywords where includes are not allowed, and adds the rows the new type locks. `removed` names the dropped rows.
 */
export function changeLineItemType(
  state: TargetingState,
  type: string,
): { state: TargetingState; removed: string[]; toast: string | null } {
  const criteria: TargetingCriteria = { ...state.criteria };
  const removed: string[] = [];
  for (const dim of ROW_ORDER) {
    const key = CRITERIA_OF[dim];
    if (!key || criteria[key] === undefined || dim === 'KEYWORD_EXCLUSIONS') continue;
    if (dim === 'KEYWORDS') {
      const kw = criteria.keywords!;
      if (availability(type, 'KEYWORDS') !== 'N') continue;
      if (availability(type, 'KEYWORD_EXCLUSIONS') !== 'N') {
        if (kw.include.length > 0) removed.push(CARD_LABEL.KEYWORDS!);
        criteria.keywords = { include: [], exclude: kw.exclude };
        continue;
      }
    } else if (availability(type, dim) !== 'N') continue;
    delete criteria[key];
    removed.push(CARD_LABEL[dim] ?? dim);
  }
  if (
    criteria.optimizedTargeting !== undefined &&
    availability(type, 'OPTIMIZED_TARGETING') === 'N'
  )
    delete criteria.optimizedTargeting;
  for (const dim of typeLocked(type)) {
    const key = CRITERIA_OF[dim];
    if (key && criteria[key] === undefined) Object.assign(criteria, defaultCriteria(dim, type));
  }
  const toast =
    removed.length > 0
      ? `Targeting that isn't available for ${typeLabel(type)} line items was removed: ${removed.join(', ')}.`
      : null;
  return { state: { ...state, lineItemType: type, criteria }, removed, toast };
}
