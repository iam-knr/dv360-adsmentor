// TargetingState (routes.md 8.8 with module 10 deltas Δ-10-1, Δ-10-7, Δ-10-8). Pure types: no Prisma, no React,
// so lib/validation and the editors can import them.

export type TargetMode = 'INCLUDE' | 'EXCLUDE';

/** One selected catalogue option. `id` is the TargetingOption code; `label` is the catalogue name for display. */
export interface Sel {
  id: string;
  mode: TargetMode;
  label?: string;
}

export type Day = 'MON' | 'TUE' | 'WED' | 'THU' | 'FRI' | 'SAT' | 'SUN';

/** `from` and `to` are `HH:MM`; `to` may be `24:00`. */
export interface DaySegment {
  day: Day;
  from: string;
  to: string;
}

export type VerificationProvider = 'NONE' | 'DOUBLEVERIFY' | 'IAS' | 'SCOPE3';

export interface RadiusPoint {
  lat: number;
  lng: number;
  radiusKm: number;
  label?: string;
}

/** The dimensions of one targeting card. Every field is optional: absent means "no row". */
export interface TargetingCriteria {
  geography?: { regions: Sel[]; radius?: { points: RadiusPoint[] }; locationListIds?: string[] };
  appsAndUrls?: { channelIds: Sel[]; collections: Sel[]; urls: Sel[]; apps: Sel[] };
  keywords?: { include: string[]; exclude: string[] };
  categories?: Sel[];
  environment?: { web: boolean; app: boolean };
  position?: { onScreen: string[]; inContent: string[]; native: string[] };
  /** `predictedPct` null = "All impressions" (Δ-10-8). */
  viewability?: { openMeasurement: boolean; predictedPct: number | null };
  language?: Sel[];
  brandSuitability?: {
    inventoryMode: 'MAXIMUM' | 'NOT_YET_LABELED';
    thirdParty: { provider: VerificationProvider; options: string[] };
  };
  /** Δ-10-1: Google audiences in include; first-party groups are AND-ed, lists inside a group OR-ed (RC-030). */
  audienceLists?: {
    include: {
      firstPartyGroups: string[][];
      google: string[];
      combined: string[];
      custom: string[];
    };
    exclude: { firstParty: string[]; google: string[] };
  };
  /** `ageRange` uses 18, 25, 35, 45, 55, 65; 65 as the upper bound means 65+. */
  demographics?: {
    gender: string[];
    ageRange: [number, number];
    ageUnknown: boolean;
    parental: string[];
    income: string[];
  };
  dayAndTime?: { segments: DaySegment[]; tz: 'LOCAL' | 'ADVERTISER' };
  browser?: Sel[];
  device?: { types: Sel[]; os: Sel[]; makeModel: Sel[] };
  connectionSpeed?: string;
  carrierIsp?: Sel[];
  // Δ-10-7 (editors for these are P3-07b / Phase 4; the rows are stored losslessly now)
  videoPlayerSize?: string[];
  contentDuration?: string[];
  livestream?: TargetMode;
  rewarded?: TargetMode;
  doohVenue?: Sel[];
  optimizedTargeting?: boolean;
}

export type CriteriaKey = keyof TargetingCriteria;

/**
 * Shape kept from the P3-01 stub (`version`, `lineItemType`, `criteria`), so callers compiled against the stub
 * still compile. `locked` lists matrix labels inherited from advertiser targeting rules (RC-044).
 */
export interface TargetingState {
  version: 1;
  lineItemType: string;
  criteria: TargetingCriteria;
  locked?: string[];
  inherited?: string[];
}
