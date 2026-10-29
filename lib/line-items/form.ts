// Form model of the line item form (module 08 2.3, 4.3). Pure and client safe: defaults per type (explore 05 and
// 19 2.4), IO automation locks (RC-039, LI-035, LI-044), the copy-settings merge (LI-120) and the conversion to the
// validation input (money in minor units, RC-019). The form holds money in major units, as typed.
import { toMinor, type CurrencyCode } from '@/lib/money';
import { POST_VIEW_PCT_DEFAULT } from '@/lib/validation/constants/conversions';
import { AUTOMATION_FORCED_PACING } from '@/lib/validation/constants/pacing';
import type { TargetingState } from '@/lib/targeting';
import type {
  BidStrategy,
  FeeInput,
  IoObjective,
  IoType,
  LineItemInput,
  LiTargetingInput,
  LiType,
  Num,
  OptimizationMode,
} from '@/lib/validation/types';
import { YT_SUBTYPE_INFO } from '@/lib/validation/constants/youtube';
import { defaultYoutubeInput, isYoutubeType, NO_CAP, type YtStep1 } from '@/lib/youtube/li';
import { defaultBid, defaultStrategy, TYPE_CONFIG } from './type-config';

/** What the form edits: the validation input (money in major units) plus the columns the rules do not read. */
export interface LiFormValue extends LineItemInput {
  optimizedTargeting: boolean;
  creativeOptimization: boolean;
  integrationDetail?: string | null;
  targetingState: TargetingState;
}

/** The parent insertion order as the form needs it. */
export interface FormIo {
  id: string;
  name: string;
  type: IoType;
  objective: IoObjective;
  mode: OptimizationMode;
  optimizedTowards: BidStrategy | null;
  /** IO flight, `YYYY-MM-DD`, for "Use same dates as insertion order ({dates})". */
  flight: { start: string; end: string } | null;
}

export interface DefaultsInput {
  type: LiType;
  io: FormIo;
  /** Partner exchanges that support the type's format (public inventory default, explore 05). */
  exchangeIds: string[];
  targetingState: TargetingState;
  app?: { platform: 'ALL' | 'IOS' | 'ANDROID'; storeId: string } | null;
  adType?: 'DISPLAY' | 'VIDEO' | null;
  name?: string;
  /** YouTube step 1 choice (module 09 2.1). */
  youtube?: YtStep1 | null;
}

/** Media fee 1, the locked DV360 fee (explore 19 2.2, IO form). */
export const SYSTEM_MEDIA_FEE: FeeInput = { type: 'DV360_FEE', amount: null, system: true };

/** Targeting summary the validation rules read, from the type's pre-added rows (MX-10). */
export function defaultTargetingInput(type: LiType, app?: DefaultsInput['app']): LiTargetingInput {
  const config = TYPE_CONFIG[type];
  const out: LiTargetingInput = { dimensions: config.preAdded.map((r) => r.dimension) };
  if (type === 'CTV')
    out.device = { include: ['CONNECTED_TV'], exclude: ['COMPUTER', 'SMARTPHONE', 'TABLET'] };
  if (type === 'CTV') out.position = { onScreen: [], inContent: ['IN_STREAM'] };
  if (type === 'ADS_IN_MOBILE_APPS' || type === 'MOBILE_APP_INSTALL') {
    out.environment = { include: ['APP'] };
    out.device = { include: ['SMARTPHONE', 'TABLET'], exclude: [] };
  }
  if (type === 'MOBILE_APP_INSTALL' && app && app.platform !== 'ALL')
    out.dimensions = [...out.dimensions, 'OPERATING_SYSTEM'];
  return out;
}

/** A new line item of `type` in `io` (AC-08-04, AC-08-05). */
export function defaultLineItemForm(input: DefaultsInput): LiFormValue {
  const { type, io } = input;
  const config = TYPE_CONFIG[type];
  const bidMode = defaultBid(type);
  const value: LiFormValue = {
    name: input.name ?? '',
    status: 'DRAFT',
    type,
    ioId: io.id,
    inventory: {
      quality: config.quality ? 'AUTHORIZED_DIRECT_SELLERS_AND_RESELLERS' : null,
      exchanges: config.exchanges ? input.exchangeIds : [],
      deals: [],
      dealGroups: [],
      targetCuratedCtv: false,
    },
    flight: { mode: 'SAME_AS_IO', startDate: null, endDate: null },
    budget: { mode: config.budgetRequired ? 'AMOUNT' : 'UNLIMITED', amount: null },
    pacing: {
      period: config.budgetRequired ? 'DAILY' : 'FLIGHT',
      type: config.budgetRequired ? 'EVEN' : 'ASAP',
      dailyAmount: null,
    },
    bid: {
      mode: bidMode,
      fixedCpm: null,
      optimizedTowards: bidMode === 'AUTOMATED' ? defaultStrategy(io, type) : null,
      priority: 'FULL_BUDGET',
      targetValue: null,
      customBiddingAlgorithmId: null,
    },
    frequencyCap: { mode: 'INHERIT', maxImpressions: null, periodCount: 1, period: 'MONTH' },
    creatives: [],
    conversions: {
      activities: [],
      countingMode: type === 'MOBILE_APP_INSTALL' ? 'POST_CLICK_ONLY' : 'ALL',
      postViewPct: POST_VIEW_PCT_DEFAULT,
      attributionModelId: null,
    },
    euPoliticalAds: null,
    revenueModel: { type: 'TOTAL_MEDIA_COST_MARKUP', value: null },
    partnerCosts: { cpmFees: [], mediaFees: [SYSTEM_MEDIA_FEE] },
    integrationCode: '',
    integrationDetail: '',
    targeting: defaultTargetingInput(type, input.app),
    app: type === 'MOBILE_APP_INSTALL' ? (input.app ?? { platform: 'ALL', storeId: null }) : null,
    adType:
      type === 'MOBILE_APP_INSTALL' || type === 'ADS_IN_MOBILE_APPS'
        ? (input.adType ?? 'DISPLAY')
        : null,
    copiedFromType: null,
    optimizedTargeting: false,
    creativeOptimization: true,
    targetingState: input.targetingState,
  };
  if (isYoutubeType(type)) {
    const youtube = defaultYoutubeInput(type, input.youtube);
    const info = YT_SUBTYPE_INFO[youtube.subtype!];
    value.youtube = youtube;
    value.bid = { ...value.bid, mode: 'AUTOMATED', optimizedTowards: info.liBid, fixedCpm: null };
    value.frequencyCap = { ...NO_CAP };
    // Daily is the YouTube default; the amount is required (LI-YT-006)
    value.budget = { mode: 'UNLIMITED', amount: null };
    value.pacing = { period: 'DAILY', type: 'EVEN', dailyAmount: null };
    value.targeting = { dimensions: ['GEOGRAPHY', 'BRAND_SUITABILITY', 'INVENTORY_SOURCE'] };
  }
  return applyIoLocks(value, io);
}

export type LockReason = 'IO_AUTOMATION' | 'AFTER_CREATE' | 'TYPE' | 'STARTED';

export interface FieldLock {
  path: 'pacing' | 'bid' | 'type' | 'app' | 'adType' | 'flight.startDate';
  reason: LockReason;
}

/** Locked paths (module 08 4.3 item 2, AC-08-10, AC-08-27). `started`: the stored start date is today or earlier. */
export function lockedPaths(
  io: Pick<FormIo, 'mode'>,
  mode: 'create' | 'edit',
  started = false,
): FieldLock[] {
  const out: FieldLock[] = [];
  if (io.mode === 'IO_AUTOMATED') {
    out.push({ path: 'pacing', reason: 'IO_AUTOMATION' }, { path: 'bid', reason: 'IO_AUTOMATION' });
  }
  if (mode === 'edit') {
    out.push(
      { path: 'type', reason: 'AFTER_CREATE' },
      { path: 'app', reason: 'AFTER_CREATE' },
      { path: 'adType', reason: 'AFTER_CREATE' },
    );
    if (started) out.push({ path: 'flight.startDate', reason: 'STARTED' });
  }
  return out;
}

/** Under IO automation the line item stores ASAP + FLIGHT and the IO's strategy (RC-039, LI-035, LI-044). */
export function applyIoLocks(value: LiFormValue, io: Pick<FormIo, 'mode' | 'optimizedTowards'>) {
  if (io.mode !== 'IO_AUTOMATED') return value;
  return {
    ...value,
    pacing: { ...AUTOMATION_FORCED_PACING, dailyAmount: null },
    bid: {
      ...value.bid,
      mode: 'AUTOMATED' as const,
      optimizedTowards: io.optimizedTowards,
      fixedCpm: null,
    },
  };
}

/** The settings `GET copy-source` returns (module 08 4.1 L17): everything but name, status and parent. */
export type LiCopySettings = Omit<LiFormValue, 'name' | 'status' | 'ioId'>;

export function copySettingsOf(source: LiFormValue): LiCopySettings {
  const { name: _n, status: _s, ioId: _i, ...settings } = source;
  return structuredClone(settings);
}

/**
 * "Copy settings from an existing line item" (AC-08-14): the draft keeps its name, status, parent and type;
 * everything else comes from the source. The target IO's automation locks win (module 08 4.3 item 2).
 */
export function mergeCopySettings(
  draft: LiFormValue,
  source: { type: LiType; settings: LiCopySettings; id?: string },
  io: Pick<FormIo, 'mode' | 'optimizedTowards'>,
): LiFormValue {
  const merged: LiFormValue = {
    ...structuredClone(source.settings),
    name: draft.name,
    status: draft.status,
    ioId: draft.ioId,
    type: draft.type,
    app: draft.type === 'MOBILE_APP_INSTALL' ? draft.app : source.settings.app,
    copiedFromType: source.type,
  };
  return applyIoLocks(merged, io);
}

// ---------------------------------------------------------------------------------------------
// Conversion to the validation input (RC-019: rules receive minor units)
// ---------------------------------------------------------------------------------------------

function minor(v: Num, currency: CurrencyCode): Num {
  if (v === null || v === undefined || v === '') return v;
  const n = typeof v === 'number' ? v : Number(String(v).trim());
  return Number.isFinite(n) ? toMinor(n, currency) : v;
}

/** The validation input of a form value. ROAS targets are percentages and stay as typed. */
export function toValidationInput(value: LiFormValue, currency: CurrencyCode): LineItemInput {
  const roas = value.bid.optimizedTowards === 'TARGET_ROAS';
  return {
    ...value,
    budget: { ...value.budget, amount: minor(value.budget.amount, currency) },
    pacing: { ...value.pacing, dailyAmount: minor(value.pacing.dailyAmount, currency) },
    bid: {
      ...value.bid,
      fixedCpm: minor(value.bid.fixedCpm, currency),
      targetValue: roas ? value.bid.targetValue : minor(value.bid.targetValue, currency),
    },
    revenueModel: value.revenueModel
      ? {
          ...value.revenueModel,
          value:
            value.revenueModel.type === 'CPM_VALUE'
              ? minor(value.revenueModel.value, currency)
              : value.revenueModel.value,
        }
      : value.revenueModel,
    partnerCosts: {
      cpmFees: value.partnerCosts.cpmFees.map((f) => ({ ...f, amount: minor(f.amount, currency) })),
      mediaFees: value.partnerCosts.mediaFees,
    },
  };
}

/** Number or null from a typed value. */
export function numOrNull(v: Num): number | null {
  if (v === null || v === undefined || v === '') return null;
  const n = typeof v === 'number' ? v : Number(String(v).trim());
  return Number.isFinite(n) ? n : null;
}
