// Insertion order wire types, defaults and pure mappers (routes.md 8.5, module 07 2.3 and 3.2). Client safe.
// The form value, the wire value and the validation input share one shape, so issue paths point at form fields.
// Money is in major units on the wire (RC-019); `toIoValidationInput` converts to minor units for the rules.
import type { CurrencyCode } from '@/lib/money';
import {
  ioBidStrategiesFor,
  ioKpisFor,
  IO_DEFAULT_KPI,
  type BidStrategy,
  type IoObjective,
  type IoType,
} from '@/lib/validation/constants/io-matrix';
import { FEE_TYPES } from '@/lib/validation/constants/fees';
import type { FreqPeriod, IoInput, Kpi, Num, PacingPeriod, PacingType } from '@/lib/validation';
import { isMoneyKpi, moneyToMinor, type FrequencyCapWire } from '@/lib/campaigns/wire';

export type { FrequencyCapWire } from '@/lib/campaigns/wire';

export interface SegmentWire {
  id?: string;
  amount?: Num;
  description?: string | null;
  startDate?: string | null;
  endDate?: string | null;
}

export interface FeeWire {
  /** MX-17 label ("Default", "Third-Party Ad Server", ...); the system fee carries SYSTEM_FEE_TYPE. */
  type?: string | null;
  /** CPM fee: money. Media fee: percent. */
  amount?: Num;
  invoiced?: boolean;
  /** Media fee 1, locked (IO-073). */
  system?: boolean;
}

export interface IoWire {
  name: string;
  status: 'DRAFT' | 'ACTIVE' | 'PAUSED' | 'ARCHIVED' | null;
  type: IoType | null;
  objective: IoObjective | null;
  budget: { type: 'CURRENCY' | 'IMPRESSIONS' | null; segments: SegmentWire[] };
  pacing: { period: PacingPeriod | null; type: PacingType | null; dailyAmount?: Num };
  kpi: { type: Kpi | null; value?: Num } | null;
  optimization: {
    mode: 'IO_AUTOMATED' | 'LI_CONTROLLED' | null;
    optimizedTowards?: BidStrategy | null;
    prioritizeFullBudget?: boolean;
    autoBudgetAllocation?: boolean;
    youtubeReachFrequency?: boolean;
  };
  frequencyCap: FrequencyCapWire;
  partnerCosts: { cpmFees: FeeWire[]; mediaFees: FeeWire[] };
  integrationCode?: string | null;
  integrationDetail?: string | null;
}

export const SYSTEM_FEE_TYPE = 'Display & Video 360 Fee';

export const IO_TYPE_LABEL: Record<IoType, string> = {
  STANDARD: 'Standard',
  CTV_OTT: 'Connected TV',
  DOOH: 'Digital Out of Home',
};

/** Step 1 cards (explore 19 2.2). */
export const IO_TYPE_CHOICES: { value: IoType; label: string; description: string }[] = [
  { value: 'STANDARD', label: 'Standard', description: 'Open auction line items serving on DV360' },
  {
    value: 'CTV_OTT',
    label: 'Connected TV and OTT streaming',
    description: 'TV content across over-the-top streaming devices',
  },
  {
    value: 'DOOH',
    label: 'Digital out of home',
    description: 'billboards, bus stations, airports, etc.',
  },
];

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
  MAX_VIEWABLE_10S: 'Maximize viewable for at least 10 seconds',
  MAX_COMPLETED_IN_VIEW_AUDIBLE: 'Maximize completed in-view and audible',
  MAX_CPV: 'Maximize views (CPV)',
  TARGET_CPM: 'Target CPM',
  TARGET_CPV: 'Target CPV',
  TARGET_VIEWABLE_IMPRESSIONS: 'Target viewable impressions',
  MAX_CUSTOM_VALUE_COST: 'Maximize custom value / cost',
  TARGET_CUSTOM_VALUE_COST: 'Target custom value / cost',
};

/** Objectives that can automate bid and budget at the IO (RC-002): not NONE, not DOOH. */
export function canAutomate(type: IoType, objective: IoObjective): boolean {
  return type !== 'DOOH' && objective !== 'NONE';
}

/** "Optimized towards" default per explore 19 2.2. */
export function defaultOptimizedTowards(type: IoType, objective: IoObjective): BidStrategy | null {
  if (!canAutomate(type, objective)) return null;
  const allowed = ioBidStrategiesFor(type, objective);
  const pick: Partial<Record<IoObjective, BidStrategy>> = {
    BRAND_AWARENESS: type === 'CTV_OTT' ? 'MAX_REACH' : 'MAX_VIEWABLE_IMPRESSIONS',
    CLICKS: 'MAX_CLICKS',
    CONVERSIONS: 'MAX_CONVERSIONS',
    CUSTOM: 'MAX_CUSTOM_VALUE_COST',
  };
  const want = pick[objective];
  return want && allowed.includes(want) ? want : (allowed[0] ?? null);
}

/** KPI default: VCPM (Standard awareness), CPM (CTV), CPC (Clicks), CPA (Conversions); none for DOOH. */
export function defaultKpi(type: IoType, objective: IoObjective): Kpi | null {
  const allowed = ioKpisFor(type, objective);
  if (allowed.length === 0) return null;
  const want = IO_DEFAULT_KPI[objective];
  return want && allowed.includes(want) ? want : (allowed[0] ?? null);
}

function addMonths(iso: string, months: number): string {
  const [y, m, d] = iso.split('-').map(Number) as [number, number, number];
  const target = new Date(Date.UTC(y, m - 1 + months, 1));
  const last = new Date(
    Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0),
  ).getUTCDate();
  target.setUTCDate(Math.min(d, last));
  return target.toISOString().slice(0, 10);
}

export const emptyFee = (): FeeWire => ({ type: 'Default', amount: '', invoiced: false });
export const systemFee = (): FeeWire => ({
  type: SYSTEM_FEE_TYPE,
  amount: null,
  invoiced: true,
  system: true,
});

/** New IO defaults (AC-07-04, explore 19 2.2): Draft, Flight + Ahead, Automate when allowed, segment today to +1 month. */
export function newIoValue(type: IoType, objective: IoObjective, today: string): IoWire {
  const automate = canAutomate(type, objective);
  const kpi = defaultKpi(type, objective);
  return {
    name: '',
    status: 'DRAFT',
    type,
    objective,
    budget: {
      type: 'CURRENCY',
      segments: [{ amount: '', description: '', startDate: today, endDate: addMonths(today, 1) }],
    },
    pacing: { period: 'FLIGHT', type: 'AHEAD', dailyAmount: '' },
    kpi: kpi ? { type: kpi, value: '' } : null,
    optimization: {
      mode: automate ? 'IO_AUTOMATED' : 'LI_CONTROLLED',
      optimizedTowards: defaultOptimizedTowards(type, objective),
      prioritizeFullBudget: true,
      autoBudgetAllocation: false,
      youtubeReachFrequency: false,
    },
    frequencyCap: { mode: 'INHERIT', maxImpressions: '', periodCount: 1, period: 'MONTH' },
    partnerCosts: {
      cpmFees: type === 'DOOH' ? [] : [emptyFee(), emptyFee()],
      mediaFees: [systemFee(), emptyFee()],
    },
    integrationCode: '',
    integrationDetail: '',
  };
}

const blank = (v: unknown) => v === null || v === undefined || String(v).trim() === '';

/** A fee row the user left untouched (no amount, default type): not stored. */
export function isEmptyFee(f: FeeWire): boolean {
  return !f.system && blank(f.amount) && (blank(f.type) || f.type === 'Default') && !f.invoiced;
}

export function isFeeType(v: unknown): v is (typeof FEE_TYPES)[number] {
  return typeof v === 'string' && (FEE_TYPES as readonly string[]).includes(v);
}

/**
 * The validation input of an IO wire value. `spent` carries the stored spend per segment id for IO-026
 * (minor units or impressions) and is only set on the stored copy (`ctx.original`).
 */
export function toIoValidationInput(
  io: IoWire,
  currency: CurrencyCode,
  spent?: Record<string, number>,
): IoInput {
  const impressions = io.budget.type === 'IMPRESSIONS';
  const budgetAmount = (v: Num) =>
    impressions ? (blank(v) ? null : v) : moneyToMinor(v, currency);
  const fee = (f: FeeWire, money: boolean) => ({
    type: f.type ?? null,
    amount: f.system
      ? 0
      : money
        ? moneyToMinor(f.amount, currency)
        : blank(f.amount)
          ? null
          : f.amount,
    ...(f.system ? { system: true } : {}),
  });
  return {
    name: io.name,
    status: io.status,
    type: io.type,
    objective: io.objective,
    budget: {
      type: io.budget.type,
      segments: io.budget.segments.map((s) => ({
        ...(s.id ? { id: s.id } : {}),
        ...(s.id && spent && spent[s.id] !== undefined ? { spent: spent[s.id] } : {}),
        amount: budgetAmount(s.amount),
        startDate: blank(s.startDate) ? null : (s.startDate as string),
        endDate: blank(s.endDate) ? null : (s.endDate as string),
      })),
    },
    pacing: {
      period: io.pacing.period,
      type: io.pacing.type,
      dailyAmount: io.pacing.period === 'DAILY' ? budgetAmount(io.pacing.dailyAmount) : null,
    },
    kpi:
      io.type === 'DOOH' || !io.kpi
        ? null
        : {
            type: io.kpi.type,
            value: isMoneyKpi(io.kpi.type)
              ? moneyToMinor(io.kpi.value, currency)
              : blank(io.kpi.value)
                ? null
                : io.kpi.value,
          },
    optimization: {
      mode: io.optimization.mode,
      optimizedTowards: io.optimization.optimizedTowards ?? null,
      autoBudgetAllocation: !!io.optimization.autoBudgetAllocation,
      youtubeReachFrequency: !!io.optimization.youtubeReachFrequency,
    },
    frequencyCap: {
      mode: io.frequencyCap.mode,
      maxImpressions: blank(io.frequencyCap.maxImpressions) ? null : io.frequencyCap.maxImpressions,
      periodCount: blank(io.frequencyCap.periodCount) ? null : io.frequencyCap.periodCount,
      period: (io.frequencyCap.period ?? null) as FreqPeriod | null,
    },
    partnerCosts: {
      cpmFees: io.partnerCosts.cpmFees.filter((f) => !isEmptyFee(f)).map((f) => fee(f, true)),
      mediaFees: io.partnerCosts.mediaFees.filter((f) => !isEmptyFee(f)).map((f) => fee(f, false)),
    },
    integrationCode: io.integrationCode ?? '',
  };
}

// ---------------------------------------------------------------------------------------------
// Rows and details
// ---------------------------------------------------------------------------------------------

export interface IoRow {
  id: string;
  publicId: string;
  campaignId: string;
  campaignPublicId: string;
  name: string;
  status: 'DRAFT' | 'ACTIVE' | 'PAUSED' | 'ARCHIVED';
  alertCount: number;
  type: IoType;
  budget: number | null;
  budgetUnit: 'CURRENCY' | 'IMPRESSIONS';
  /** Id and amount of the segment the inline budget edit changes (the current or next one). */
  editableSegment: { id: string; amount: number; spent: number } | null;
  goal: string | null;
  impressions: number;
  revenue: number;
  interactions: number;
  conversions: number;
  cpa: number | null;
  customImpressionValueCost: number | null;
  parentPaused: boolean;
}

export interface SegmentDetail extends SegmentWire {
  spent: number;
  remaining: number;
  startLocked: boolean;
}

export interface IoDetail {
  id: string;
  publicId: string;
  campaignId: string;
  campaignPublicId: string;
  advertiserId: string;
  version: number;
  archived: boolean;
  value: IoWire;
  segments: SegmentDetail[];
  campaignFrequencyCap: FrequencyCapWire;
  lineItemCounts: { total: number; active: number; byType: Record<string, number> };
  currency: CurrencyCode;
  timeZone: string;
}
