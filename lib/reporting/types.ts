// Wire and domain types of module 16 (routes.md 8.13 plus the additions of 16 section 4.1).
export type ReportKindWire = 'INSTANT' | 'OFFLINE';
export type OfflineTypeWire = 'FLOODLIGHT' | 'INVENTORY_AVAILABILITY';
export type VizType = 'TABLE' | 'PIVOT_TABLE' | 'COLUMN' | 'TIME_SERIES' | 'PIE' | 'SCATTER';
export type ReportRepeatWire = 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'QUARTERLY' | 'YEARLY';
export type ReportFormatWire = 'CSV' | 'XLSX';

export interface ReportFilter {
  field: string;
  op: 'IN' | 'NOT_IN' | 'EQ';
  values: string[];
}

export interface ReportSchedule {
  active: boolean;
  timeZone: string;
  repeats: ReportRepeatWire;
  every: number;
  /** YYYY-MM-DD */
  starts: string;
  expires?: string;
}

export interface ReportDelivery {
  format: ReportFormatWire;
  fileName: string;
  emailOwner: boolean;
  attachment?: boolean;
  shareWith: string[];
}

export interface ReportDefinition {
  id?: string;
  kind: ReportKindWire;
  offlineType?: OfflineTypeWire;
  name: string;
  timeZone: 'ADVERTISER' | 'UTC';
  /** `d` param syntax: a preset token (`LAST_7_DAYS`) or `YYYYMMDD:YYYYMMDD`. */
  dateRange: string;
  filters: ReportFilter[];
  dimensions: string[];
  metrics: string[];
  viz: { type: VizType; options?: { columns?: string } };
  schedule?: ReportSchedule;
  delivery?: ReportDelivery;
  /** Offline report template key. */
  template?: string;
  autoRun?: boolean;
}

export type Warning =
  'APPROXIMATED_PIVOT' | 'LATE_CONVERSIONS' | 'TRUNCATED' | 'TIME_ZONE_APPROXIMATED';

export interface QueryColumn {
  key: string;
  label: string;
  kind: 'DIMENSION' | 'METRIC';
  dataType: string;
}

export type Cell = string | number | null;

export interface QueryResult {
  columns: QueryColumn[];
  rows: Cell[][];
  truncated: boolean;
  totalRows: number;
  warnings: Warning[];
  /** ISO instant of the sim clock when the numbers were read. */
  asOf: string;
  /** Resolved range (advertiser sim dates). */
  range: { from: string; to: string };
}

export interface RuleIssue {
  ruleId: string;
  path: string;
  severity: 'error' | 'warning';
  message: string;
}

export type ReportRunStatusWire = 'QUEUED' | 'RUNNING' | 'DONE' | 'FAILED';

export interface RunRow {
  id: string;
  fileId: string;
  dateRange: { from: string; to: string };
  createdBy: string;
  completedAt: string | null;
  status: ReportRunStatusWire;
  format: ReportFormatWire;
  fileName: string | null;
  sizeBytes: number | null;
  scheduled: boolean;
  error: string | null;
  warnings: string[];
}

export interface ReportRow {
  id: string;
  publicId: string;
  kind: 'INSTANT' | 'OFFLINE_FLOODLIGHT' | 'OFFLINE_INVENTORY_AVAILABILITY';
  name: string;
  createdBy: string;
  createdByMe: boolean;
  modified: string;
  files: number;
  shared: boolean;
  scheduled: boolean;
}
