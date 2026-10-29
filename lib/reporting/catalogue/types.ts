// Report field catalogue types (module 16 4.2). Static data, compiled into the bundle; the database only keeps a copy
// for ordering and search (the seed writes it), the planner never reads `ReportField`.

export const CATEGORIES = [
  'General',
  'Performance',
  'Location',
  'Computer System',
  'Date',
  'Cost',
  'Fees',
  'Profit',
  'Conversions',
  'Active View',
  'Audience',
  'Brand Controls',
  'Win Loss',
  'Impression Loss',
  'Invalid Traffic',
  'Custom Bidding',
  'Custom Impression Value',
  'In-Stream Video',
  'In-Stream Audio',
  'YouTube',
  'Unique Reach',
  'Unique Reach Audience',
  'Unique Household Reach',
  'Unique Reach Overlap',
  'Unique Reach Overlap (pivoted)',
  'Unique Reach by Frequency (pivoted)',
  'Programmatic Guaranteed Savings',
  'Savings',
  'Refund',
  'Digital Out Of Home',
  'Rich Media',
  'TV',
  'CM360',
  'Inventory Availability',
] as const;
export type ReportCategory = (typeof CATEGORIES)[number];

export type Currency = 'ADV' | 'PARTNER' | 'USD';

export type SourceSpec =
  | { t: 'COUNTER'; col: string }
  | { t: 'COUNTER_FX'; col: string; currency: Currency }
  | { t: 'RATIO'; num: string; den: string; scale?: 1 | 100 | 1000 }
  | { t: 'DIFF'; of: string[] }
  | { t: 'SUM_OF'; of: string[] }
  | { t: 'SNAPSHOT'; scope: 'LI' | 'IO' | 'SEGMENT'; col: string }
  | {
      t: 'REACH';
      col: 'impressionReach' | 'avgFrequency' | 'viewableReach' | 'clickReach' | 'coViewedReach';
      /** Household variants scale the person reach by this factor (engine household factor, [SIM] 0.42). */
      factor?: number;
    }
  | { t: 'CONST'; value: number | string | null };

export type SliceKind =
  | 'exchange'
  | 'deal'
  | 'device'
  | 'environment'
  | 'region'
  | 'creative'
  | 'creativeSize'
  | 'format'
  | 'hourOfDay'
  | 'audience'
  | 'activity'
  | 'adGroup'
  | 'ad'
  | 'date'
  | 'hour';

export type DimSource =
  | { t: 'ENTITY'; path: string }
  | { t: 'SLICE'; kind: SliceKind; part?: string }
  | { t: 'DERIVED'; parent: SliceKind; allocation: string }
  | { t: 'CALENDAR'; part: 'dayOfWeek' | 'week' | 'month' | 'monthYear' | 'quarter' | 'year' }
  | { t: 'CONST'; value: string };

export type FieldStatus = 'LIVE' | 'ZERO' | 'NA';
export type OfflineType = 'FLOODLIGHT' | 'INVENTORY_AVAILABILITY';
export type DataType =
  'STRING' | 'ID' | 'INT' | 'DECIMAL' | 'PERCENT' | 'MONEY' | 'DATE' | 'DATETIME' | 'BOOL';

export interface ReportFieldDef {
  key: string;
  label: string;
  kind: 'DIMENSION' | 'METRIC';
  category: ReportCategory;
  dataType: DataType;
  source: SourceSpec | DimSource;
  currency?: Currency;
  status: FieldStatus;
  downloadOnly?: boolean;
  frequentlyUsed?: boolean;
  offline?: OfflineType[];
  /** Offline reports only: hidden from the instant picker. */
  offlineOnly?: boolean;
  sensitivity?: 'PARTNER_COST';
  /** Compatibility groups (4.3), derived at build time from the source. */
  compat?: string[];
}
