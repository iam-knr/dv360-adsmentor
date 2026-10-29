// Wire types of the creative module (module 12 4.3, routes.md 8.9 with the module's deltas). Client safe: plain data.
import type { CreativeKind } from '@prisma/client';
import type { CreativeInput, Issue } from '@/lib/validation/types';
import type { LiType } from '@/lib/validation/constants/li-compat';

export type { CreativeInput } from '@/lib/validation/types';
export type { Result, WireIssue } from '@/lib/campaigns/service-kit';

export type CreativeStatus = 'ACTIVE' | 'PAUSED' | 'ARCHIVED';
export type Dv360Status = 'PENDING' | 'SERVABLE' | 'NOT_SERVABLE';
export type ExchangeStatus = 'APPROVED' | 'PENDING' | 'DISAPPROVED';

export interface ExchangeStatusCell {
  /** `Servable (n of m)` text. */
  text: string;
  servable: number;
  total: number;
  /** Hover card rows. */
  exchanges: { name: string; status: ExchangeStatus }[];
}

/** One library row: the 16 columns of module 12 S1 plus what the row actions need. */
export interface CreativeRow {
  id: string;
  publicId: string;
  name: string;
  status: CreativeStatus;
  kind: CreativeKind;
  formatKey: string | null;
  /** "Standard" or "Third party". */
  type: string;
  format: string;
  aiLabel: string;
  dv360Status: Dv360Status;
  exchangeStatus: ExchangeStatusCell;
  companions: number;
  dimensions: string | null;
  duration: string | null;
  source: string;
  createdAt: string;
  modifiedAt: string;
  /** Third-party tag creatives only. */
  tagWrapping: 'Yes' | 'No' | null;
  lineItems: number;
  restricted: boolean;
  /** Open CREATIVE_REJECTED or CREATIVE_RESTRICTED alert. */
  alert: boolean;
  cm360Id: string | null;
}

export interface CreativeListQuery {
  q?: string;
  status?: CreativeStatus[];
  type?: string;
  format?: string;
  dv360Status?: Dv360Status;
  exchangeStatus?: 'SERVABLE' | 'NOT_SERVABLE';
  source?: string;
  lineItem?: string;
  aiLabel?: string;
  created?: { from: string; to: string };
  page?: number;
  pageSize?: number;
  sort?: { field: 'name' | 'publicId' | 'status' | 'createdAt' | 'updatedAt'; dir: 'asc' | 'desc' };
}

export interface CreativeListResult {
  rows: CreativeRow[];
  total: number;
  page: number;
  pageSize: number;
}

export interface CreativeAssetView {
  id: string;
  role: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  width: number | null;
  height: number | null;
  durationSeconds: number | null;
}

export interface CreativeDetail {
  id: string;
  publicId: string;
  version: number;
  row: CreativeRow;
  value: CreativeInput;
  assets: CreativeAssetView[];
  /** CM360 creatives: only name and status can change (CRE-060). */
  cm360: boolean;
  readOnly: boolean;
  /** Last 7 sim days from SimDailyMetric slice `creative` (module 12 section 5), null when no data. */
  performance: { date: string; impressions: number; clicks: number; ctr: number }[] | null;
}

export interface ExchangeReviewRow {
  exchangeId: string;
  name: string;
  code: string;
  status: ExchangeStatus;
  ssl: ExchangeStatus;
  reasonCode: string | null;
  feedback: { summary: string; steps: readonly string[] } | null;
  lastSyncAt: string | null;
  canAppeal: boolean;
}

export interface EligibilityRow {
  lineItemId: string;
  lineItemPublicId: string;
  name: string;
  type: LiType;
  canServe: boolean;
  /** First failing MX-09 B condition in words. */
  why: string | null;
  code: string | null;
  /** Top C.* reason of the last 24 sim hours from DeliveryDiagnostic, when the engine has run. */
  lastDay: string | null;
}

export interface CreativeStatusView {
  id: string;
  name: string;
  created: string;
  modified: string;
  reviewCompleted: string | null;
  dv360: {
    status: Dv360Status;
    feedback: string;
    canAppeal: boolean;
    restrictions: { id: string; message: string; countryCode: string | null }[];
    destinationUrls: string[];
  };
  exchanges: ExchangeReviewRow[];
  /** "Approved by n of m exchanges". */
  exchangeSummary: string;
  noExchanges: boolean;
  pending: boolean;
  pendingHint: string | null;
  lineItems: {
    id: string;
    publicId: string;
    name: string;
    ioPublicId: string;
    campaignPublicId: string;
  }[];
  eligibility: EligibilityRow[];
}

export interface HistoryRow {
  id: string;
  date: string;
  user: string;
  summary: string;
  lines: string[];
}

export interface AppealRow {
  id: string;
  creativeId: string | null;
  creativePublicId: string | null;
  name: string;
  campaignImpact: string;
  appealType: string;
  inventory: string;
  policy: string;
  status: 'Pending' | 'Approved' | 'Rejected';
  createdAt: string;
  completedAt: string | null;
  result: string;
}

export interface WriteMeta {
  expectedVersion?: number;
  note?: string;
}

export interface BulkResponse {
  jobId: string | null;
  done: number;
  failed: number;
  errors: { id: string; message: string }[];
}

export type CreativeIssue = Issue;
