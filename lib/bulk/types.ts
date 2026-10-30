// Wire types of the bulk framework (module 11 4, RT 8.15). Client safe: no server or database imports.
import type { BulkEntityKey } from './entities';

export type BulkOp =
  | 'ACTIVATE'
  | 'PAUSE'
  | 'ARCHIVE'
  | 'UNARCHIVE'
  | 'DUPLICATE'
  | 'APPLY_TARGETING_TEMPLATE'
  | 'EDIT_SETTINGS'
  | 'EDIT_TARGETING'
  | 'EDIT_CREATIVE_ASSIGNMENT';

export type EditMode = 'ADD' | 'REPLACE' | 'REMOVE';

export type TargetingGroup = 'INVENTORY' | 'CONTENT' | 'AUDIENCE' | 'TECHNOLOGY';

/** Dimensions the bulk edit panels cover (module 11 2.4). */
export type BulkTargetingDimension =
  | 'APPS_URLS'
  | 'KEYWORDS'
  | 'CATEGORIES'
  | 'ENVIRONMENT'
  | 'POSITION'
  | 'VIEWABILITY'
  | 'LANGUAGE'
  | 'GEOGRAPHY'
  | 'AUDIENCE_LISTS'
  | 'DAY_TIME'
  | 'DEMOGRAPHICS'
  | 'BROWSER'
  | 'DEVICE'
  | 'CONNECTION_SPEED'
  | 'CARRIER_ISP'
  | 'INVENTORY_QUALITY'
  | 'EXCHANGES'
  | 'DEALS'
  | 'DEAL_GROUPS';

export interface BulkTargetingEdit {
  group: TargetingGroup;
  dimension: BulkTargetingDimension;
  mode: EditMode;
  /** Shape per dimension, see `lib/bulk/targeting-edit.ts`. */
  value: unknown;
}

/** Fields the Settings panels may overwrite, each behind an "Edit this setting" checkbox. */
export interface IoSettingsPatch {
  pacing?: {
    period: 'FLIGHT' | 'DAILY';
    type: 'EVEN' | 'AHEAD' | 'ASAP';
    dailyAmount?: number | '';
  };
  frequencyCap?: {
    mode: 'UNLIMITED' | 'INHERIT' | 'LIMITED';
    maxImpressions?: number | '';
    periodCount?: number | '';
    period?: 'MINUTE' | 'HOUR' | 'DAY' | 'WEEK' | 'MONTH' | null;
  };
  autoBudgetAllocation?: boolean;
  integrationCode?: string;
}

export interface LiSettingsPatch {
  pacing?: {
    period: 'FLIGHT' | 'DAILY';
    type: 'EVEN' | 'AHEAD' | 'ASAP';
    dailyAmount?: number | '';
  };
  frequencyCap?: IoSettingsPatch['frequencyCap'];
  fixedBid?: number;
  inventoryQuality?: string;
  integrationCode?: string;
  creativeOptimization?: boolean;
  optimizedTargeting?: boolean;
}

export type BulkParams =
  | { op: 'DUPLICATE'; targetParentId?: string; copies: number }
  | { op: 'APPLY_TARGETING_TEMPLATE'; templateId: string }
  | { op: 'EDIT_SETTINGS'; patch: IoSettingsPatch | LiSettingsPatch }
  | { op: 'EDIT_TARGETING'; edit: BulkTargetingEdit }
  | { op: 'EDIT_CREATIVE_ASSIGNMENT'; add?: string[]; remove?: string[] }
  | { op: 'ACTIVATE' | 'PAUSE' | 'ARCHIVE' | 'UNARCHIVE' };

export interface BulkRequest {
  entity: BulkEntityKey;
  /** Public ids as shown in the ID column. */
  ids: string[];
  params: BulkParams;
}

export interface BulkItemOutcome {
  index: number;
  entityId: string;
  status: 'OK' | 'FAILED';
  message?: string;
  ruleId?: string;
  resultEntityId?: string;
}

export type BulkJobStatusKey = 'QUEUED' | 'RUNNING' | 'COMPLETED' | 'FAILED';

export interface BulkResponse {
  jobId: string;
  status: BulkJobStatusKey;
  ok: number;
  failed: number;
  /** BLK-010 text when some rows were not eligible or failed. */
  summary?: string;
  items: BulkItemOutcome[];
}

export interface BulkCapability {
  enabled: boolean;
  eligible: number;
  reason?: string;
}

export interface BulkCapabilities {
  ids: string[];
  actions: Record<string, BulkCapability>;
}

/** One row of the Bulk status page (RT 8.15 `BulkJobRow`). */
export interface BulkJobRow {
  id: string;
  publicId: string;
  requestedAt: string;
  partnerId: string;
  advertiserId: string | null;
  description: string;
  source: string;
  sourceLabel: string;
  user: string;
  updatedAt: string;
  status: BulkJobStatusKey;
  /** `View` opens the copies, `Results` downloads a file, absent for plain edits. */
  action: 'VIEW' | 'RESULTS' | null;
  errorSummary: string | null;
}

export interface BulkJobDetail extends BulkJobRow {
  action2: string;
  items: {
    entityType: string;
    entityId: string | null;
    status: 'OK' | 'FAILED';
    ruleId: string | null;
    message: string | null;
    row: number | null;
  }[];
  resultKey: string | null;
}
