// Wire types of the line item module (RT 8.6 with RC-003, RC-006, RC-018, RC-040 and module 08 4 / Δ-08-13, 14, 17).
// Plain data, shared by the service, the route handlers and the client components.
import type { CurrencyCode } from '@/lib/money';
import type { Issue, LiType } from '@/lib/validation/types';
import type { FieldLock, FormIo, LiCopySettings, LiFormValue } from './form';

export type { LiTypeOption } from './type-config';

export type Result<T> =
  | { ok: true; data: T; warnings?: Issue[] }
  | { ok: false; issues: Issue[]; code?: 'FORBIDDEN' | 'NOT_FOUND' | 'CONFLICT' };

export type LiStatus = 'DRAFT' | 'ACTIVE' | 'PAUSED' | 'ARCHIVED';

export interface LineItemRow {
  id: string;
  publicId: string;
  ioId: string;
  ioPublicId: string;
  campaignPublicId: string;
  name: string;
  status: LiStatus;
  alertCount: number;
  type: LiType;
  budget: number | null;
  goal: string;
  impressions: number;
  revenue: number;
  clicks: number;
  conversions: number;
  cpa: number | null;
  customValueCost: number | null;
  trueViewViews?: number;
  /** Search filters (module 01): pacing type and the flight the line item runs in (own or the IO's). */
  pacingType?: string;
  flightStart?: string | null;
  flightEnd?: string | null;
}

export type LiListScope =
  | { kind: 'io'; id: string }
  | { kind: 'campaign'; id: string }
  | { kind: 'advertiser'; id: string }
  | { kind: 'audience'; id: string };

export interface LiListQuery {
  q?: string;
  status?: LiStatus[];
  type?: LiType[];
  /** `d` list param: date range of the metrics (routes.md 6.1). */
  d?: string | null;
  page?: number;
  pageSize?: number;
  sort?: { field: 'name' | 'publicId' | 'status' | 'type'; dir: 'asc' | 'desc' };
}

export interface LiListResult {
  rows: LineItemRow[];
  total: number;
  page: number;
  pageSize: number;
  totalsRow: { impressions: number; revenue: number; clicks: number; conversions: number };
  currency: CurrencyCode;
  asOf: string;
  /** Sim date in the advertiser time zone, when the sandbox has a clock. */
  simToday?: string;
}

/** Everything the form needs to edit a stored line item (module 08 4 `LineItemDetail`). */
export interface LineItemDetail {
  id: string;
  publicId: string;
  version: number;
  value: LiFormValue;
  io: FormIo;
  currency: CurrencyCode;
  locked: FieldLock[];
  templateName: string | null;
  advancedAdServingRate: number;
  /** "The higher level frequency cap is set to …", null when there is none. */
  higherCapText: string | null;
  app: AppSearchRow | null;
  creatives: CreativePickerRow[];
  conversions: ConversionPickerRow[];
  readOnly: boolean;
}

/** Everything the create form needs (no stored row yet). */
export interface LineItemDraftInit {
  value: LiFormValue;
  io: FormIo;
  currency: CurrencyCode;
  locked: FieldLock[];
  higherCapText: string | null;
  app: AppSearchRow | null;
  readOnly: boolean;
}

export interface LiCopySource {
  id: string;
  type: LiType;
  settings: LiCopySettings;
}

export interface CopyCandidate {
  id: string;
  publicId: string;
  name: string;
  ioName: string;
}

export interface CreativePickerRow {
  id: string;
  publicId: string;
  name: string;
  cm360Id: string | null;
  status: string;
  type: string;
  format: string;
  aiLabel: string;
  dv360Status: string;
  exchangeStatus: string;
  dimensions: string | null;
  source: string;
  created: string;
  eligible: boolean;
  /** Why the creative is not eligible (LI-060 or LI-061 text). */
  reason?: string;
}

export interface ConversionPickerRow {
  id: string;
  publicId: string;
  name: string;
  source: string;
  type: 'COUNTER' | 'SALE';
  countingMethod: string;
}

export interface AppSearchRow {
  id: string;
  store: 'IOS' | 'ANDROID';
  name: string;
  publisher: string;
  /** "Android - {package}" / "iOS - {id}" (explore 19 2.4). */
  storeLine: string;
}

export interface IoChoice {
  id: string;
  publicId: string;
  campaignPublicId: string;
  name: string;
  campaignName: string;
}
