// Wire types of the History readers (module 05 4.2, routes.md 8.17). Plain data, safe to send to the browser.
export type HistoryEntityType = 'ADVERTISER' | 'CAMPAIGN' | 'INSERTION_ORDER' | 'LINE_ITEM';
export const HISTORY_ENTITY_TYPES: readonly HistoryEntityType[] = [
  'ADVERTISER',
  'CAMPAIGN',
  'INSERTION_ORDER',
  'LINE_ITEM',
];

export interface HistoryQuery {
  entityType: HistoryEntityType;
  /** Public id or row id. */
  entityId: string;
  /** `d` param: `YYYYMMDD:YYYYMMDD`, a preset token or `{n}D_TODAY`. Default 90 days up to today. */
  d?: string | null;
  includeSystem?: boolean;
  tz?: 'advertiser' | 'local';
  /** IANA zone of the viewer's browser, used when `tz` is `local`. */
  zone?: string | null;
  /** Date (YYYY-MM-DD). Only days before it are returned. */
  cursor?: string | null;
}

export interface HistoryChange {
  groupId: string;
  time: string;
  tzLabel: string;
  user: string;
  system: boolean;
  summary: string;
  lines: string[];
}

export interface HistoryDay {
  date: string;
  weekday: string;
  /** "insertion order" when every change of the day is to one entity type, else empty. */
  entityLabel: string;
  count: number;
  notesCount: number;
  changes: HistoryChange[];
}

export interface SpendPoint {
  date: string;
  amount: number;
}

export interface HistoryPageData {
  spend: SpendPoint[];
  /** "Weekly" when the bars were grouped by week (more than 120 days). */
  spendGrain: 'Daily' | 'Weekly';
  days: HistoryDay[];
  nextCursor?: string;
  currency: string;
  /** Zone the page renders in (advertiser zone, or the viewer's when tz=local). */
  timeZone: string;
  advertiserTimeZone: string;
  range: { from: string; to: string };
  /** Today in the display zone: the end of the default range and the date picker clock. */
  today: string;
  entityName: string;
  canAddNotes: boolean;
}

export interface HistoryNoteRow {
  id: string;
  date: string;
  author: string;
  time: string;
  text: string;
  mine: boolean;
}

export interface NotificationDto {
  id: string;
  kind: 'Announcement';
  title: string;
  body: string;
  /** "5 m", "3 h", "9 d". */
  ageLabel: string;
  learnMoreRoute?: string;
  severity: 'INFO' | 'WARNING';
}
