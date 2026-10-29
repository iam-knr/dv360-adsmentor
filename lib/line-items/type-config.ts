// Per-type line item configuration (module 08 2.2 to 2.4, explore 05 and 19 2.3, 2.4). Pure and client safe:
// the picker, the form and the service read the same tables, so a section that the form hides is never stored.
import { allowedBidStrategies, defaultBidMode } from '@/lib/validation/constants/bids';
import {
  AUTOMATION_LI_TYPES,
  LI_TYPE_LABEL,
  liTypeAllowedByIoType,
  liTypeAllowedByObjective,
} from '@/lib/validation/constants/li-compat';
import { format, MSG } from '@/lib/validation/messages';
import type {
  BidStrategy,
  IoObjective,
  IoType,
  LiType,
  OptimizationMode,
} from '@/lib/validation/types';

export { LI_TYPE_LABEL };

/** Cards per IO type, in grid order (module 08 2.2, explore 19 2.3). */
export const PICKER_TYPES: Record<IoType, readonly LiType[]> = {
  STANDARD: [
    'DISPLAY',
    'VIDEO',
    'CTV',
    'AUDIO',
    'MOBILE_APP_INSTALL',
    'ADS_IN_MOBILE_APPS',
    'YT_VIDEO',
    'YT_AUDIO',
    'DEMAND_GEN',
  ],
  CTV_OTT: ['CTV', 'YT_ON_CTV'],
  DOOH: ['DOOH_DISPLAY', 'DOOH_VIDEO'],
};

/** One line under each card title (explore 05, verbatim). DOOH and YouTube on CTV: [SIM]. */
export const LI_TYPE_DESCRIPTION: Record<LiType, string> = {
  DISPLAY: 'Image, HTML5 (incl. rich media), and native ads (display and video)',
  VIDEO: 'Video ads sold on a CPM basis for a variety of environments',
  CTV: 'TV content on Connected TVs and other digital devices',
  AUDIO: 'Audio ads sold on a CPM basis for a variety of environments',
  MOBILE_APP_INSTALL: 'Drive installs of your app with display and video ads',
  ADS_IN_MOBILE_APPS: 'Display or video ads that serve on mobile app inventory',
  YT_VIDEO: 'Video ads on YouTube and partners',
  YT_AUDIO: 'Audio ads on YouTube and partners',
  DEMAND_GEN: 'Video and image ads on YouTube, Discover, Gmail, and the Google Display Network',
  DOOH_DISPLAY: 'Image ads on billboards, bus stations, airports and other screens',
  DOOH_VIDEO: 'Video ads on billboards, bus stations, airports and other screens',
  YT_ON_CTV: 'YouTube and partners video ads on Connected TVs',
};

/** Types this module builds a form for. YouTube video and audio forms are module 09 (P4-06). */
export const FORM_TYPES: readonly LiType[] = [
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
];

export function isFormType(type: string): type is LiType {
  return (FORM_TYPES as readonly string[]).includes(type);
}

export function isLiType(type: string): type is LiType {
  return Object.prototype.hasOwnProperty.call(LI_TYPE_LABEL, type);
}

/** Lower case type for headings: "New display line item". */
export function newTitle(type: LiType): string {
  const label = LI_TYPE_LABEL[type];
  const lower = /^(YouTube|Demand Gen|Connected TV)/.test(label) ? label : label.toLowerCase();
  return `New ${lower} line item`;
}

export type ExchangeFormat = 'DISPLAY' | 'VIDEO' | 'AUDIO' | 'DOOH';

export interface PreAddedRow {
  /** DM `TargetingDimension` key. */
  dimension: string;
  label: string;
  summary: string;
  locked: boolean;
}

export interface TypeConfig {
  templates: boolean;
  /** Public inventory section: which exchanges count. Null: no exchanges (Demand Gen uses Google inventory). */
  exchanges: ExchangeFormat | null;
  /** Quality dropdown and public inventory shown (DOOH shows only deals and groups, explore 19 2.4). */
  quality: boolean;
  curatedCtv: boolean;
  deals: boolean;
  optimizedTargeting: boolean;
  frequency: boolean;
  creatives: boolean;
  conversions: boolean;
  /** Bid modes offered. */
  bidModes: readonly ('AUTOMATED' | 'FIXED')[];
  /** Budget amount required (Demand Gen, LI-DG-006). */
  budgetRequired: boolean;
  preAdded: readonly PreAddedRow[];
  inventoryNote?: string;
  targetingNote?: string;
}

const BRAND: PreAddedRow = {
  dimension: 'BRAND_SUITABILITY',
  label: 'Brand suitability',
  summary: 'Inventory mode: Maximum inventory · Not yet labeled',
  locked: true,
};
const OPEN_MEASUREMENT: PreAddedRow = {
  dimension: 'VIEWABILITY',
  label: 'Viewability',
  summary: 'Open Measurement: Target only Open Measurement enabled mobile display inventory.',
  locked: true,
};

const STANDARD: TypeConfig = {
  templates: true,
  exchanges: 'DISPLAY',
  quality: true,
  curatedCtv: false,
  deals: true,
  optimizedTargeting: true,
  frequency: true,
  creatives: true,
  conversions: true,
  bidModes: ['AUTOMATED', 'FIXED'],
  budgetRequired: false,
  preAdded: [BRAND],
};

export const TYPE_CONFIG: Record<LiType, TypeConfig> = {
  DISPLAY: { ...STANDARD, preAdded: [BRAND, OPEN_MEASUREMENT] },
  VIDEO: { ...STANDARD, exchanges: 'VIDEO', curatedCtv: true },
  CTV: {
    ...STANDARD,
    exchanges: 'VIDEO',
    curatedCtv: true,
    preAdded: [
      BRAND,
      {
        dimension: 'POSITION_IN_CONTENT',
        label: 'Position',
        summary: 'Position in content — In-stream: All positions selected',
        locked: false,
      },
      {
        dimension: 'VIDEO_PLAYER_SIZE',
        label: 'Video',
        summary: 'Video player size — Large, HD',
        locked: false,
      },
      {
        dimension: 'DEVICE_TYPE',
        label: 'Device',
        summary: 'Include: Connected TV; Exclude: Computer, Smartphone, Tablet',
        locked: false,
      },
    ],
  },
  AUDIO: {
    ...STANDARD,
    exchanges: 'AUDIO',
    inventoryNote:
      'Google Ad Manager and Spotify Ad Exchange support public inventory for audio line items.',
    targetingNote:
      'Most audio ads serve in mobile app environments, which limits the available targeting options.',
  },
  MOBILE_APP_INSTALL: {
    ...STANDARD,
    templates: false,
    preAdded: [
      BRAND,
      { dimension: 'ENVIRONMENT', label: 'Environment', summary: 'Include: App', locked: true },
      OPEN_MEASUREMENT,
      {
        dimension: 'DEVICE_TYPE',
        label: 'Device',
        summary: 'Include: Smartphone, Tablet',
        locked: false,
      },
    ],
  },
  ADS_IN_MOBILE_APPS: {
    ...STANDARD,
    templates: false,
    preAdded: [
      BRAND,
      { dimension: 'ENVIRONMENT', label: 'Environment', summary: 'Include: App', locked: true },
      {
        dimension: 'DEVICE_TYPE',
        label: 'Device',
        summary: 'Include: Smartphone, Tablet',
        locked: true,
      },
    ],
  },
  DEMAND_GEN: {
    ...STANDARD,
    exchanges: null,
    quality: false,
    deals: false,
    optimizedTargeting: false,
    creatives: false,
    bidModes: ['AUTOMATED'],
    budgetRequired: true,
    preAdded: [],
  },
  DOOH_DISPLAY: {
    ...STANDARD,
    templates: false,
    exchanges: 'DOOH',
    quality: false,
    optimizedTargeting: false,
    frequency: false,
    conversions: false,
    bidModes: ['FIXED'],
    preAdded: [],
    targetingNote: 'Select your targeting criteria to control where your ads will be displayed.',
  },
  DOOH_VIDEO: {
    ...STANDARD,
    templates: false,
    exchanges: 'DOOH',
    quality: false,
    optimizedTargeting: false,
    frequency: false,
    conversions: false,
    bidModes: ['FIXED'],
    preAdded: [],
    targetingNote: 'Select your targeting criteria to control where your ads will be displayed.',
  },
  // YouTube forms (module 09 2.2): no exchanges, deals, library creatives (MX-09 A) or optimized targeting; the bid
  // strategy is locked by the subtype; the amount is required (LI-YT-006). YT_ON_CTV keeps the plain entry.
  YT_VIDEO: {
    ...STANDARD,
    exchanges: null,
    quality: false,
    deals: false,
    optimizedTargeting: false,
    creatives: false,
    bidModes: ['AUTOMATED'],
  },
  YT_AUDIO: {
    ...STANDARD,
    exchanges: null,
    quality: false,
    deals: false,
    optimizedTargeting: false,
    creatives: false,
    bidModes: ['AUTOMATED'],
  },
  YT_ON_CTV: {
    ...STANDARD,
    exchanges: null,
    quality: false,
    deals: false,
    bidModes: ['AUTOMATED'],
  },
};

/** "Add targeting" menu of the DOOH forms offers only these (explore 19 2.4). */
export const DOOH_TARGETING_MENU = ['Geography', 'Day & time'] as const;

/** Which exchange support flag a type reads. */
export function exchangeSupports(
  fmt: ExchangeFormat,
  e: {
    supportsDisplay: boolean;
    supportsVideo: boolean;
    supportsAudio: boolean;
    supportsCtv: boolean;
    supportsDooh: boolean;
  },
): boolean {
  switch (fmt) {
    case 'DISPLAY':
      return e.supportsDisplay;
    case 'VIDEO':
      return e.supportsVideo || e.supportsCtv;
    case 'AUDIO':
      return e.supportsAudio;
    case 'DOOH':
      return e.supportsDooh;
  }
}

/** Exchange format of a type, with the app ad type deciding for the two app types. */
export function exchangeFormatOf(
  type: LiType,
  adType?: 'DISPLAY' | 'VIDEO' | null,
): ExchangeFormat | null {
  if (type === 'MOBILE_APP_INSTALL' || type === 'ADS_IN_MOBILE_APPS')
    return adType === 'VIDEO' ? 'VIDEO' : 'DISPLAY';
  return TYPE_CONFIG[type].exchanges;
}

export function exchangesText(n: number): string {
  return `${n} Exchanges and 0 Subexchanges are selected`;
}

// ---------------------------------------------------------------------------------------------
// Picker (MX-03 with the IO type, automation and Demand Gen prerequisite, explore 19 2.3)
// ---------------------------------------------------------------------------------------------

export interface PickerIo {
  type: IoType;
  objective: IoObjective;
  mode: OptimizationMode;
}

export interface LiTypeOption {
  type: LiType;
  enabled: boolean;
  reason?: string;
  group: 'STANDARD' | 'DOOH' | 'CTV_OTT';
  /** Demand Gen with the advertiser prerequisite off: the card is clickable and shows the yellow toast. */
  prerequisite?: string;
}

export const AUTOMATION_REASON = (type: LiType) =>
  `${LI_TYPE_LABEL[type]} line items aren't compatible with your insertion order's optimization settings.`;

/** `GET line-item-types` (RT 8.6, module 08 4.1 L2). */
export function liTypeOptions(
  io: PickerIo,
  advertiser: { demandGenFloodlightOptimization: boolean },
): LiTypeOption[] {
  const group = io.type;
  return PICKER_TYPES[io.type].map((type): LiTypeOption => {
    const label = LI_TYPE_LABEL[type];
    if (!liTypeAllowedByIoType(io.type, type) || !liTypeAllowedByObjective(io.objective, type))
      return {
        type,
        group,
        enabled: false,
        reason: format(MSG.LI_TYPE_INCOMPAT, { Type: label }),
      };
    if (io.mode === 'IO_AUTOMATED' && !AUTOMATION_LI_TYPES.includes(type))
      return { type, group, enabled: false, reason: AUTOMATION_REASON(type) };
    if (type === 'DEMAND_GEN' && !advertiser.demandGenFloodlightOptimization)
      return {
        type,
        group,
        enabled: true,
        prerequisite: `${MSG.DG_PREREQ} ${MSG.DG_PREREQ_BULLET}`,
      };
    return { type, group, enabled: true };
  });
}

// ---------------------------------------------------------------------------------------------
// Bid strategy (MX-04) labels
// ---------------------------------------------------------------------------------------------

export const BID_STRATEGY_LABEL: Record<BidStrategy, string> = {
  FIXED_BID: 'Fixed bid',
  MAX_CLICKS: 'Maximize clicks',
  TARGET_CPC: 'Target CPC',
  MAX_CONVERSIONS: 'Maximize conversions',
  MAX_CONVERSION_VALUE: 'Maximize conversion value',
  TARGET_CPA: 'Target CPA',
  TARGET_ROAS: 'Target ROAS',
  MAX_REACH: 'Maximize reach',
  MAX_VIEWABLE_IMPRESSIONS: 'Maximize viewable impressions',
  MAX_VIEWABLE_10S: 'Maximize viewable impressions for 10 seconds',
  MAX_COMPLETED_IN_VIEW_AUDIBLE: 'Maximize completed in-view and audible impressions',
  MAX_CPV: 'Maximum CPV',
  TARGET_CPM: 'Target CPM',
  TARGET_CPV: 'Target CPV',
  TARGET_VIEWABLE_IMPRESSIONS: 'Target viewable CPM',
  MAX_CUSTOM_VALUE_COST: 'Maximize custom value / cost',
  TARGET_CUSTOM_VALUE_COST: 'Target custom value / cost',
};

/** Automated options of the "Optimized towards" dropdown. Mobile app install adds "Maximize installs". */
export function bidOptions(
  io: { type: IoType; objective: IoObjective },
  type: LiType,
): readonly BidStrategy[] {
  return allowedBidStrategies(io.type, io.objective, type);
}

/** Default strategy of a new line item: the first MX-04 option (CTV in Brand awareness: Maximize reach). */
export function defaultStrategy(
  io: { type: IoType; objective: IoObjective },
  type: LiType,
): BidStrategy | null {
  return bidOptions(io, type)[0] ?? null;
}

export function defaultBid(type: LiType): 'AUTOMATED' | 'FIXED' {
  const modes = TYPE_CONFIG[type].bidModes;
  return modes.length === 1 ? modes[0]! : defaultBidMode(type);
}
