import 'server-only';
// InsertionOrder rows to the wire shape and back (module 07 3.2). Decimal major units in the DB and on the wire.
import {
  Prisma,
  type BudgetSegment,
  type FeeType,
  type InsertionOrder,
  type IoOptimizeTarget,
  type PartnerCost,
} from '@prisma/client';
import { decimalToNumber, fromDbDate, toDbDate } from '@/lib/campaigns/service-kit';
import { frequencyFromRow, frequencyToRow } from '@/lib/campaigns/mapping';
import { FEE_TYPES } from '@/lib/validation/constants/fees';
import type { BidStrategy } from '@/lib/validation/constants/io-matrix';
import type { IoSnapshot } from '@/lib/validation';
import { ioFlight } from '@/lib/validation/rules/io';
import {
  canAutomate,
  defaultOptimizedTowards,
  isEmptyFee,
  systemFee,
  toIoValidationInput,
  type FeeWire,
  type IoWire,
} from './wire';

export type IoFull = InsertionOrder & { segments: BudgetSegment[]; fees: PartnerCost[] };

/** DM FeeType keys in MX-17 order (FEE_TYPES[i] is the label of FEE_TYPE_KEYS[i]). */
export const FEE_TYPE_KEYS: readonly FeeType[] = [
  'DEFAULT',
  'THIRD_PARTY_AD_SERVER',
  'DOUBLEVERIFY',
  'ADSAFE',
  'ADXPOSE',
  'VIZU',
  'AGGREGATE_KNOWLEDGE',
  'TERACENT',
  'EVIDON',
  'AGENCY_TRADING_DESK',
  'SHOPLOCAL',
  'TRUSTMETRICS',
  'INTEGRAL_AD_SCIENCE_VIDEO',
  'MOAT_VIDEO',
  'SCOPE3',
  'CUSTOM_FEE_1',
  'CUSTOM_FEE_2',
  'CUSTOM_FEE_3',
  'CUSTOM_FEE_4',
  'CUSTOM_FEE_5',
];

export function feeTypeKey(label: string | null | undefined): FeeType {
  const i = (FEE_TYPES as readonly string[]).indexOf(label ?? '');
  return FEE_TYPE_KEYS[i] ?? 'DEFAULT';
}

export function feeTypeLabel(key: FeeType): string {
  const i = FEE_TYPE_KEYS.indexOf(key);
  return FEE_TYPES[i] ?? 'Default';
}

/**
 * Strategies the DM enum `IoOptimizeTarget` can store. The others (Maximize clicks, Maximize conversions, Target ...)
 * are stored as null and read back as the objective's default (PR deviation: the enum needs the BidGoal values).
 */
const STORABLE_TARGETS: readonly IoOptimizeTarget[] = [
  'MAX_VIEWABLE_IMPRESSIONS',
  'MAX_VIEWABLE_10S',
  'MAX_COMPLETED_IN_VIEW_AUDIBLE',
  'MAX_CUSTOM_VALUE_COST',
  'MAX_REACH',
];

export function storableTarget(s: BidStrategy | null | undefined): IoOptimizeTarget | null {
  return s && (STORABLE_TARGETS as readonly string[]).includes(s) ? (s as IoOptimizeTarget) : null;
}

const blank = (v: unknown) =>
  v === null || v === undefined || (typeof v === 'string' ? v.trim() === '' : false);
const dec = (v: unknown): Prisma.Decimal | null =>
  blank(v) ? null : new Prisma.Decimal(String(v).trim());
const text = (v: string | null | undefined): string | null => (blank(v) ? null : String(v).trim());

function feesToWire(fees: PartnerCost[]): IoWire['partnerCosts'] {
  const cpm = fees.filter((f) => f.kind === 'CPM_FEE').sort((a, b) => a.slot - b.slot);
  const media = fees.filter((f) => f.kind === 'MEDIA_FEE').sort((a, b) => a.slot - b.slot);
  const mediaFees: FeeWire[] = media.map((f) =>
    f.isSystem
      ? systemFee()
      : {
          type: feeTypeLabel(f.feeType),
          amount: decimalToNumber(f.percentage) ?? '',
          invoiced: f.invoiced,
        },
  );
  if (!mediaFees.some((f) => f.system)) mediaFees.unshift(systemFee());
  return {
    cpmFees: cpm.map((f) => ({
      type: feeTypeLabel(f.feeType),
      amount: decimalToNumber(f.amount) ?? '',
      invoiced: f.invoiced,
    })),
    mediaFees,
  };
}

export function ioToWire(io: IoFull): IoWire {
  const impressions = io.budgetUnit === 'IMPRESSIONS';
  const automated = io.bidBudgetControl === 'IO_AUTOMATED';
  return {
    name: io.name,
    status: io.status === 'SCHEDULED_FOR_DELETION' ? 'ARCHIVED' : io.status,
    type: io.type,
    objective: io.objective,
    budget: {
      type: io.budgetUnit,
      segments: [...io.segments]
        .sort((a, b) => a.ordinal - b.ordinal)
        .map((s) => ({
          id: s.id,
          amount: decimalToNumber(s.amount) ?? '',
          description: s.description ?? '',
          startDate: fromDbDate(s.startDate),
          endDate: fromDbDate(s.endDate),
        })),
    },
    pacing: {
      period: io.pacingPeriod,
      type: io.pacingType,
      dailyAmount: impressions
        ? io.dailyMaxImpressions !== null
          ? Number(io.dailyMaxImpressions)
          : ''
        : (decimalToNumber(io.dailyMaxAmount) ?? ''),
    },
    kpi: io.type === 'DOOH' ? null : { type: io.kpi, value: decimalToNumber(io.kpiValue) ?? '' },
    optimization: {
      mode: io.bidBudgetControl,
      optimizedTowards: automated
        ? (io.optimizeTarget ?? defaultOptimizedTowards(io.type, io.objective))
        : null,
      prioritizeFullBudget: io.prioritizeFullBudget,
      autoBudgetAllocation: io.autoBudgetAllocation,
      youtubeReachFrequency: io.ytReachFreqOptimization,
    },
    frequencyCap: frequencyFromRow(io),
    partnerCosts: feesToWire(io.fees),
    integrationCode: io.integrationCode ?? '',
    integrationDetail: io.integrationDetail ?? '',
  };
}

/** Scalar columns from a validated wire value. Type, objective and budget unit are only set on create. */
export function ioData(w: IoWire) {
  const type = w.type ?? 'STANDARD';
  const objective = w.objective ?? 'NONE';
  const automate = canAutomate(type, objective) && w.optimization.mode === 'IO_AUTOMATED';
  const impressions = w.budget.type === 'IMPRESSIONS';
  const daily = w.pacing.period === 'DAILY';
  const kpiType = type === 'DOOH' ? null : (w.kpi?.type ?? null);
  return {
    name: w.name.trim(),
    // RC-039: automation stores Flight + ASAP at the line items, the IO keeps its own pacing
    pacingPeriod: w.pacing.period ?? 'FLIGHT',
    pacingType: w.pacing.type ?? 'AHEAD',
    dailyMaxAmount: daily && !impressions ? dec(w.pacing.dailyAmount) : null,
    dailyMaxImpressions:
      daily && impressions && !blank(w.pacing.dailyAmount)
        ? BigInt(String(w.pacing.dailyAmount))
        : null,
    kpi: kpiType,
    kpiValue: kpiType ? dec(w.kpi?.value) : null,
    // RC-002: objective NONE and DOOH store LI_CONTROLLED
    bidBudgetControl: automate ? ('IO_AUTOMATED' as const) : ('LI_CONTROLLED' as const),
    optimizeTarget: automate ? storableTarget(w.optimization.optimizedTowards) : null,
    prioritizeFullBudget: w.optimization.prioritizeFullBudget ?? true,
    autoBudgetAllocation: !automate && !!w.optimization.autoBudgetAllocation,
    ytReachFreqOptimization: !!w.optimization.youtubeReachFrequency,
    ...(type === 'DOOH'
      ? {
          freqMode: 'INHERIT' as const,
          freqMaxExposures: null,
          freqUnit: null,
          freqUnitCount: null,
        }
      : frequencyToRow(w.frequencyCap)),
    integrationCode: text(w.integrationCode),
    integrationDetail: text(w.integrationDetail),
  };
}

export function segmentRows(w: IoWire) {
  return w.budget.segments.map((s, ordinal) => ({
    id: s.id,
    ordinal,
    amount: dec(s.amount) ?? new Prisma.Decimal(0),
    description: text(s.description),
    startDate: toDbDate(String(s.startDate)),
    endDate: toDbDate(String(s.endDate)),
  }));
}

/** PartnerCost rows: CPM fees by slot, media fee 1 the locked DV360 fee, then the other media fees. */
export function feeRows(w: IoWire) {
  const cpm = (w.type === 'DOOH' ? [] : w.partnerCosts.cpmFees)
    .filter((f) => !isEmptyFee(f))
    .map((f, i) => ({
      kind: 'CPM_FEE' as const,
      slot: i + 1,
      feeType: feeTypeKey(f.type),
      amount: dec(f.amount),
      percentage: null,
      invoiced: !!f.invoiced,
      isSystem: false,
    }));
  const others = w.partnerCosts.mediaFees.filter((f) => !f.system && !isEmptyFee(f));
  const media = [
    {
      kind: 'MEDIA_FEE' as const,
      slot: 1,
      feeType: 'DV360_FEE' as const,
      amount: null,
      percentage: null,
      invoiced: true,
      isSystem: true,
    },
    ...others.map((f, i) => ({
      kind: 'MEDIA_FEE' as const,
      slot: i + 2,
      feeType: feeTypeKey(f.type),
      amount: null,
      percentage: dec(f.amount),
      invoiced: !!f.invoiced,
      isSystem: false,
    })),
  ];
  return [...cpm, ...media];
}

/** The IO snapshot line item rules read (also used by the LI service of P3-06c through buildContext). */
export function ioSnapshotOf(
  io: IoFull,
  currency: Parameters<typeof toIoValidationInput>[1],
): IoSnapshot {
  const input = toIoValidationInput(ioToWire(io), currency);
  return {
    id: io.id,
    type: io.type,
    objective: io.objective,
    mode: io.bidBudgetControl,
    optimizedTowards: input.optimization.optimizedTowards ?? null,
    status: io.status === 'SCHEDULED_FOR_DELETION' ? 'ARCHIVED' : io.status,
    budgetType: io.budgetUnit,
    budgetTotal: input.budget.segments.reduce((sum, s) => sum + (Number(s.amount) || 0), 0),
    flight: ioFlight(input),
    frequencyCap: input.frequencyCap,
  };
}
