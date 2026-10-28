// IO rules: insertion order (validation.md 2.5).
import { format as formatMoney, fromMinor, type CurrencyCode } from '@/lib/money';
import { IO_PERCENT_KPIS } from '../constants/goals-kpis';
import { ioBidStrategiesFor, ioKpisFor } from '../constants/io-matrix';
import { AUTOMATION_LI_TYPES, YOUTUBE_LI_TYPES } from '../constants/li-compat';
import { LIMITS } from '../constants/limits';
import { looserThan, periodLabel } from '../constants/frequency';
import { isIoPacingAllowed, OPTIMIZATION_MODES, PACING_PERIODS } from '../constants/pacing';
import { MSG } from '../messages';
import {
  byteLength,
  codePointLength,
  dateRange,
  isBlank,
  isEmptyNum,
  isIsoDate,
  isWhole,
  rangesOverlap,
  today,
  toNum,
} from '../primitives';
import type {
  AnyRule,
  BudgetSegmentInput,
  IoInput,
  LineItemSnapshot,
  Rule,
  Violation,
} from '../types';
import {
  at,
  capMaxEmpty,
  capMaxInvalid,
  capWindowInvalid,
  cpmFeeNegative,
  feeTypeMissing,
  mediaFeePercentInvalid,
  originalOf,
  resolveCap,
  systemFeeChanged,
  tooManyFees,
} from './shared';

type IoRule = Omit<Rule<IoInput>, 'kind'>;

function def(rule: IoRule): Rule<IoInput> {
  return { kind: 'insertionOrder', ...rule };
}

const SEG = 'budget.segments';

function segments(io: IoInput): { seg: BudgetSegmentInput; i: number }[] {
  return io.budget.segments.map((seg, i) => ({ seg, i }));
}

function datedSegments(io: IoInput): { start: string; end: string; i: number }[] {
  return segments(io)
    .filter(({ seg }) => isIsoDate(seg.startDate) && isIsoDate(seg.endDate) && seg.endDate >= seg.startDate)
    .map(({ seg, i }) => ({ start: seg.startDate as string, end: seg.endDate as string, i }));
}

/** Earliest segment start and latest segment end. */
export function ioFlight(io: IoInput): { start: string; end: string } | null {
  const dated = datedSegments(io);
  if (dated.length === 0) return null;
  return {
    start: dated.reduce((min, s) => (s.start < min ? s.start : min), dated[0]!.start),
    end: dated.reduce((max, s) => (s.end > max ? s.end : max), dated[0]!.end),
  };
}

function segmentTotal(io: IoInput): number {
  return io.budget.segments.reduce((sum, s) => sum + (toNum(s.amount) ?? 0), 0);
}

/** Children with custom dates that fall outside `flight`. */
function outsideFlight(children: readonly LineItemSnapshot[], flight: { start: string; end: string }): LineItemSnapshot[] {
  return children.filter((li) => {
    if (li.flight?.mode !== 'CUSTOM') return false;
    const { startDate, endDate } = li.flight;
    return (isIsoDate(startDate) && startDate < flight.start) || (isIsoDate(endDate) && endDate > flight.end);
  });
}

function hasTypeAndObjective(io: IoInput): boolean {
  return io.type !== null && io.objective !== null;
}

export const IO_001 = def({
  id: 'IO-001',
  severity: 'error',
  triggers: ['save'],
  reads: ['type'],
  message: MSG.SELECTION_REQUIRED,
  check: (io) => (io.type ? null : { path: 'type' }),
});

export const IO_002 = def({
  id: 'IO-002',
  severity: 'error',
  triggers: ['save'],
  reads: ['objective'],
  message: MSG.SELECTION_REQUIRED,
  check: (io) => (io.objective ? null : { path: 'objective' }),
});

export const IO_003 = def({
  id: 'IO-003',
  severity: 'error',
  triggers: ['cross'],
  reads: ['type', 'objective'],
  message: "Clicks isn't available for Connected TV and OTT insertion orders.",
  check: (io) => (io.type === 'CTV_OTT' && io.objective === 'CLICKS' ? { path: 'objective' } : null),
});

export const IO_004 = def({
  id: 'IO-004',
  severity: 'error',
  triggers: ['cross'],
  reads: ['type', 'objective'],
  message: 'Digital out of home insertion orders can only be created without an objective.',
  check: (io) =>
    io.type === 'DOOH' && io.objective !== null && io.objective !== 'NONE' ? { path: 'objective' } : null,
});

export const IO_005 = def({
  id: 'IO-005',
  severity: 'error',
  triggers: ['save'],
  reads: ['objective'],
  message: 'The objective can only be changed to "Insertion order without objective".',
  appliesTo: (_io, ctx) => ctx.mode === 'edit',
  check: (io, ctx) => {
    const stored = originalOf<IoInput>(ctx)?.objective;
    if (!stored || !io.objective) return null;
    return io.objective === stored || io.objective === 'NONE' ? null : { path: 'objective' };
  },
});

export const IO_006 = def({
  id: 'IO-006',
  severity: 'error',
  triggers: ['save'],
  reads: ['type'],
  message: MSG.LOCKED_AFTER_CREATE,
  appliesTo: (_io, ctx) => ctx.mode === 'edit',
  check: (io, ctx) => {
    const stored = originalOf<IoInput>(ctx)?.type;
    return stored && io.type !== stored ? { path: 'type' } : null;
  },
});

export const IO_010 = def({
  id: 'IO-010',
  severity: 'error',
  triggers: ['blur'],
  reads: ['name'],
  message: MSG.ENTER_VALUE,
  check: (io) => (isBlank(io.name) ? { path: 'name' } : null),
});

export const IO_011 = def({
  id: 'IO-011',
  severity: 'error',
  triggers: ['save'],
  reads: ['name'],
  message: MSG.MAX_CHARS,
  check: (io) =>
    codePointLength(io.name) > LIMITS.NAME_MAX_240
      ? { path: 'name', params: { max: LIMITS.NAME_MAX_240 } }
      : null,
});

export const IO_012 = def({
  id: 'IO-012',
  severity: 'error',
  triggers: ['save'],
  reads: ['status'],
  message: MSG.CHOOSE_STATUS,
  appliesTo: (_io, ctx) => ctx.mode === 'create',
  check: (io) => (io.status === 'DRAFT' || io.status === 'ACTIVE' ? null : { path: 'status' }),
});

export const IO_020 = def({
  id: 'IO-020',
  severity: 'error',
  triggers: ['save'],
  reads: ['budget.type'],
  message: MSG.LOCKED_AFTER_CREATE,
  check: (io, ctx) => {
    const valid = io.budget.type === 'CURRENCY' || io.budget.type === 'IMPRESSIONS';
    const stored = originalOf<IoInput>(ctx)?.budget.type;
    return !valid || (stored && io.budget.type !== stored) ? { path: 'budget.type' } : null;
  },
});

export const IO_021 = def({
  id: 'IO-021',
  severity: 'error',
  triggers: ['blur'],
  reads: ['budget.segments[].amount'],
  message: MSG.ENTER_VALUE,
  check: (io) =>
    segments(io)
      .filter(({ seg }) => isEmptyNum(seg.amount))
      .map(({ i }): Violation => ({ path: at(SEG, i, 'amount') })),
});

export const IO_022 = def({
  id: 'IO-022',
  severity: 'error',
  triggers: ['blur'],
  reads: ['budget.segments[].amount'],
  message: MSG.ENTER_POSITIVE,
  check: (io) =>
    segments(io)
      .filter(({ seg }) => !isEmptyNum(seg.amount))
      .filter(({ seg }) => {
        const n = toNum(seg.amount);
        return n === null || n <= 0;
      })
      .map(({ i }): Violation => ({ path: at(SEG, i, 'amount') })),
});

export const IO_023 = def({
  id: 'IO-023',
  severity: 'error',
  triggers: ['blur'],
  reads: ['budget.type', 'budget.segments[].amount'],
  message: MSG.WHOLE_NUMBER,
  appliesTo: (io) => io.budget.type === 'IMPRESSIONS',
  check: (io) =>
    segments(io)
      .filter(({ seg }) => !isEmptyNum(seg.amount) && toNum(seg.amount) !== null && !isWhole(seg.amount))
      .map(({ i }): Violation => ({ path: at(SEG, i, 'amount') })),
});

export const IO_024 = def({
  id: 'IO-024',
  severity: 'error',
  triggers: ['cross'],
  reads: ['budget.segments[].startDate', 'budget.segments[].endDate'],
  message: MSG.END_BEFORE_START,
  check: (io) =>
    segments(io)
      .filter(({ seg }) => !dateRange(seg.startDate, seg.endDate))
      .map(({ i }): Violation => ({ path: at(SEG, i, 'endDate') })),
});

export const IO_025 = def({
  id: 'IO-025',
  severity: 'error',
  triggers: ['save'],
  reads: ['budget.segments[].startDate'],
  message: "The start date can't be changed after the segment has started.",
  appliesTo: (_io, ctx) => ctx.mode === 'edit',
  check: (io, ctx) => {
    const stored = originalOf<IoInput>(ctx);
    if (!stored) return null;
    const now = today(ctx);
    return segments(io)
      .filter(({ seg }) => {
        const before = stored.budget.segments.find((s) => s.id !== undefined && s.id === seg.id);
        return !!before && isIsoDate(before.startDate) && before.startDate <= now && seg.startDate !== before.startDate;
      })
      .map(({ i }): Violation => ({ path: at(SEG, i, 'startDate') }));
  },
});

export const IO_026 = def({
  id: 'IO-026',
  severity: 'error',
  triggers: ['blur'],
  reads: ['budget.segments[].amount'],
  message: "The budget can't be lower than the amount already spent ({spent}).",
  appliesTo: (_io, ctx) => ctx.mode === 'edit',
  check: (io, ctx) => {
    const stored = originalOf<IoInput>(ctx);
    if (!stored) return null;
    const out: Violation[] = [];
    for (const { seg, i } of segments(io)) {
      const spent = stored.budget.segments.find((s) => s.id !== undefined && s.id === seg.id)?.spent;
      const amount = toNum(seg.amount);
      if (spent !== undefined && amount !== null && amount < spent) {
        out.push({ path: at(SEG, i, 'amount'), params: { spent: formatSpent(spent, io, ctx.advertiser.currency) } });
      }
    }
    return out;
  },
});

function formatSpent(spent: number, io: IoInput, currency: CurrencyCode): string {
  if (io.budget.type === 'IMPRESSIONS') return spent.toLocaleString('en-US');
  return formatMoney(fromMinor(spent, currency), currency);
}

export const IO_027 = def({
  id: 'IO-027',
  severity: 'error',
  triggers: ['cross'],
  reads: ['budget.segments[].startDate', 'budget.segments[].endDate'],
  message: "Budget segments can't overlap.",
  check: (io) => {
    const dated = datedSegments(io);
    for (let a = 0; a < dated.length; a += 1) {
      for (let b = a + 1; b < dated.length; b += 1) {
        if (rangesOverlap(dated[a]!, dated[b]!)) return { path: SEG };
      }
    }
    return null;
  },
});

export const IO_028 = def({
  id: 'IO-028',
  severity: 'error',
  triggers: ['save'],
  reads: ['budget.segments[].amount'],
  message: MSG.ENTER_VALUE,
  check: (io) =>
    io.budget.segments.some((s) => !isEmptyNum(s.amount)) ? null : { path: at(SEG, 0, 'amount') },
});

export const IO_030 = def({
  id: 'IO-030',
  severity: 'error',
  triggers: ['save'],
  reads: ['pacing.period'],
  message: 'Choose a pacing period.',
  check: (io) => (io.pacing.period && PACING_PERIODS.includes(io.pacing.period) ? null : { path: 'pacing.period' }),
});

export const IO_031 = def({
  id: 'IO-031',
  severity: 'error',
  triggers: ['cross'],
  reads: ['pacing.period', 'pacing.type'],
  message: MSG.PACING_COMBO,
  appliesTo: (io) => !!io.pacing.period && !!io.pacing.type,
  check: (io) =>
    isIoPacingAllowed(io.pacing.period!, io.pacing.type!) ? null : { path: 'pacing.type' },
});

export const IO_032 = def({
  id: 'IO-032',
  severity: 'error',
  triggers: ['blur'],
  reads: ['pacing.period', 'pacing.dailyAmount'],
  message: MSG.ENTER_VALUE,
  appliesTo: (io) => io.pacing.period === 'DAILY',
  check: (io) => (isEmptyNum(io.pacing.dailyAmount) ? { path: 'pacing.dailyAmount' } : null),
});

export const IO_033 = def({
  id: 'IO-033',
  severity: 'error',
  triggers: ['blur'],
  reads: ['pacing.period', 'pacing.dailyAmount'],
  message: MSG.ENTER_POSITIVE,
  appliesTo: (io) => io.pacing.period === 'DAILY' && !isEmptyNum(io.pacing.dailyAmount),
  check: (io) => {
    const n = toNum(io.pacing.dailyAmount);
    return n === null || n <= 0 ? { path: 'pacing.dailyAmount' } : null;
  },
});

export const IO_034 = def({
  id: 'IO-034',
  severity: 'warning',
  triggers: ['cross'],
  reads: ['pacing.dailyAmount', 'budget.segments[].amount'],
  message: 'The daily amount is higher than the segment budget, so the segment budget will limit spend.',
  appliesTo: (io) => io.pacing.period === 'DAILY',
  check: (io) => {
    const daily = toNum(io.pacing.dailyAmount);
    if (daily === null || daily <= 0) return null;
    const tooSmall = io.budget.segments.some((s) => {
      const amount = toNum(s.amount);
      return amount !== null && amount > 0 && daily > amount;
    });
    return tooSmall ? { path: 'pacing.dailyAmount' } : null;
  },
});

export const IO_040 = def({
  id: 'IO-040',
  severity: 'error',
  triggers: ['cross'],
  reads: ['objective', 'kpi.type'],
  message: 'Choose a KPI that is available for this objective.',
  suppressedBy: ['IO-003', 'IO-004'],
  appliesTo: (io) => hasTypeAndObjective(io) && io.type !== 'DOOH' && !!io.kpi?.type,
  check: (io) =>
    ioKpisFor(io.type!, io.objective!).includes(io.kpi!.type!) ? null : { path: 'kpi.type' },
});

export const IO_041 = def({
  id: 'IO-041',
  severity: 'error',
  triggers: ['blur'],
  reads: ['kpi.type', 'kpi.value'],
  message: MSG.ENTER_POSITIVE,
  appliesTo: (io) => io.type !== 'DOOH' && !!io.kpi?.type,
  check: (io) => {
    const n = toNum(io.kpi?.value);
    return n === null || n <= 0 ? { path: 'kpi.value' } : null;
  },
});

export const IO_042 = def({
  id: 'IO-042',
  severity: 'error',
  triggers: ['blur'],
  reads: ['kpi.type', 'kpi.value'],
  message: MSG.PCT_RANGE,
  appliesTo: (io) => io.type !== 'DOOH' && !!io.kpi?.type && IO_PERCENT_KPIS.includes(io.kpi.type),
  check: (io) => {
    const n = toNum(io.kpi?.value);
    return n !== null && n > 100 ? { path: 'kpi.value' } : null;
  },
});

export const IO_043 = def({
  id: 'IO-043',
  severity: 'info',
  triggers: ['cross'],
  reads: ['type'],
  message: null,
  check: () => null,
});

export const IO_050 = def({
  id: 'IO-050',
  severity: 'error',
  triggers: ['save'],
  reads: ['optimization.mode'],
  message: 'Choose how to optimize.',
  check: (io) =>
    io.optimization.mode && OPTIMIZATION_MODES.includes(io.optimization.mode)
      ? null
      : { path: 'optimization.mode' },
});

export const IO_051 = def({
  id: 'IO-051',
  severity: 'info',
  triggers: ['cross'],
  reads: ['optimization.mode'],
  message: MSG.IO_AUTOMATION_CONTENT,
  appliesTo: (io) => io.optimization.mode === 'IO_AUTOMATED',
  check: () => ({ path: 'optimization.mode' }),
});

export const IO_052 = def({
  id: 'IO-052',
  severity: 'error',
  triggers: ['cross'],
  reads: ['optimization.mode', 'lineItems[].type'],
  message: MSG.AUTOMATION_LI_TYPE,
  appliesTo: (io, ctx) => io.optimization.mode === 'IO_AUTOMATED' && (ctx.children?.lineItems?.length ?? 0) > 0,
  check: (_io, ctx) =>
    (ctx.children?.lineItems ?? []).some((li) => !AUTOMATION_LI_TYPES.includes(li.type))
      ? { path: 'lineItems' }
      : null,
});

export const IO_053 = def({
  id: 'IO-053',
  severity: 'info',
  triggers: ['cross'],
  reads: ['optimization.mode'],
  message: 'Line item bid strategy and pacing are managed by this insertion order.',
  appliesTo: (io, ctx) =>
    io.optimization.mode === 'IO_AUTOMATED' &&
    (ctx.children?.lineItems?.length ?? 0) > 0 &&
    originalOf<IoInput>(ctx)?.optimization.mode !== 'IO_AUTOMATED',
  check: () => ({ path: 'optimization.mode' }),
});

export const IO_054 = def({
  id: 'IO-054',
  severity: 'error',
  triggers: ['cross'],
  reads: ['objective', 'optimization.mode', 'optimization.optimizedTowards'],
  message: 'Choose a bid strategy that is available for this objective.',
  suppressedBy: ['IO-003', 'IO-004'],
  appliesTo: (io) => hasTypeAndObjective(io) && io.type !== 'DOOH' && io.optimization.mode === 'IO_AUTOMATED',
  check: (io) => {
    const chosen = io.optimization.optimizedTowards;
    const allowed = ioBidStrategiesFor(io.type!, io.objective!);
    return chosen && allowed.includes(chosen) ? null : { path: 'optimization.optimizedTowards' };
  },
});

export const IO_055 = def({
  id: 'IO-055',
  severity: 'error',
  triggers: ['cross'],
  reads: ['optimization.mode', 'optimization.autoBudgetAllocation'],
  message: 'Automatic budget allocation is only available when bid and budget are controlled at the line item level.',
  appliesTo: (io) => io.optimization.mode === 'IO_AUTOMATED',
  check: (io) => (io.optimization.autoBudgetAllocation ? { path: 'optimization.autoBudgetAllocation' } : null),
});

export const IO_056 = def({
  id: 'IO-056',
  severity: 'warning',
  triggers: ['cross'],
  reads: ['optimization.youtubeReachFrequency', 'lineItems[].type'],
  message: 'This option only applies to YouTube & partners line items.',
  appliesTo: (io) => !!io.optimization.youtubeReachFrequency,
  check: (_io, ctx) =>
    (ctx.children?.lineItems ?? []).some((li) => YOUTUBE_LI_TYPES.includes(li.type))
      ? null
      : { path: 'optimization.youtubeReachFrequency' },
});

export const IO_060 = def({
  id: 'IO-060',
  severity: 'error',
  triggers: ['blur'],
  reads: ['frequencyCap.mode', 'frequencyCap.maxImpressions'],
  message: MSG.ENTER_VALUE,
  check: (io) => capMaxEmpty(io.frequencyCap, 'frequencyCap'),
});

export const IO_061 = def({
  id: 'IO-061',
  severity: 'info',
  triggers: ['cross'],
  reads: ['frequencyCap.mode'],
  message: MSG.FREQ_CAMPAIGN_IO,
  appliesTo: (io, ctx) => io.frequencyCap.mode !== 'LIMITED' && resolveCap(ctx.campaign?.frequencyCap) !== null,
  check: (_io, ctx) => {
    const cap = resolveCap(ctx.campaign?.frequencyCap);
    return cap ? { path: 'frequencyCap', params: { n: cap.n, period: periodLabel(cap) } } : null;
  },
});

export const IO_062 = def({
  id: 'IO-062',
  severity: 'error',
  triggers: ['blur'],
  reads: ['frequencyCap.maxImpressions', 'frequencyCap.periodCount'],
  message: MSG.ENTER_POSITIVE,
  check: (io) => {
    const max = capMaxInvalid(io.frequencyCap, 'frequencyCap');
    return [...(max ? [max] : []), ...capWindowInvalid(io.frequencyCap, 'frequencyCap', false)];
  },
});

export const IO_063 = def({
  id: 'IO-063',
  severity: 'info',
  triggers: ['cross'],
  reads: ['frequencyCap'],
  message: "This limit is less restrictive than the campaign's, so the campaign limit applies.",
  appliesTo: (io, ctx) => resolveCap(io.frequencyCap) !== null && resolveCap(ctx.campaign?.frequencyCap) !== null,
  check: (io, ctx) => {
    const own = resolveCap(io.frequencyCap);
    const campaign = resolveCap(ctx.campaign?.frequencyCap);
    return own && campaign && looserThan(own, campaign) ? { path: 'frequencyCap' } : null;
  },
});

export const IO_070 = def({
  id: 'IO-070',
  severity: 'error',
  triggers: ['blur'],
  reads: ['partnerCosts.cpmFees[].amount'],
  message: MSG.NON_NEGATIVE,
  check: (io) => cpmFeeNegative(io.partnerCosts, 'partnerCosts'),
});

export const IO_071 = def({
  id: 'IO-071',
  severity: 'error',
  triggers: ['blur'],
  reads: ['partnerCosts.mediaFees[].amount'],
  message: MSG.PCT_RANGE,
  check: (io) => mediaFeePercentInvalid(io.partnerCosts, 'partnerCosts'),
});

export const IO_072 = def({
  id: 'IO-072',
  severity: 'error',
  triggers: ['save'],
  reads: ['partnerCosts.cpmFees[].type', 'partnerCosts.mediaFees[].type'],
  message: MSG.PICK_FEE_TYPE,
  check: (io) => feeTypeMissing(io.partnerCosts, 'partnerCosts'),
});

export const IO_073 = def({
  id: 'IO-073',
  severity: 'error',
  triggers: ['save'],
  reads: ['partnerCosts.mediaFees[0]'],
  message: MSG.FEE_LOCKED,
  appliesTo: (_io, ctx) => ctx.mode === 'edit',
  check: (io, ctx) => systemFeeChanged(io.partnerCosts, originalOf<IoInput>(ctx)?.partnerCosts, 'partnerCosts'),
});

export const IO_074 = def({
  id: 'IO-074',
  severity: 'error',
  triggers: ['save'],
  reads: ['partnerCosts'],
  message: MSG.FEES_MAX,
  check: (io) => tooManyFees(io.partnerCosts, 'partnerCosts'),
});

export const IO_080 = def({
  id: 'IO-080',
  severity: 'error',
  triggers: ['save'],
  reads: ['integrationCode'],
  message: MSG.MAX_CHARS,
  check: (io) =>
    byteLength(io.integrationCode ?? '') > LIMITS.INTEGRATION_CODE_MAX
      ? { path: 'integrationCode', params: { max: LIMITS.INTEGRATION_CODE_MAX } }
      : null,
});

/** Activation with an error open: the engine already runs every error rule on activate. Documentation row. */
export const IO_090 = def({
  id: 'IO-090',
  severity: 'error',
  triggers: ['activate'],
  reads: ['status'],
  message: null,
  check: () => null,
});

export const IO_091 = def({
  id: 'IO-091',
  severity: 'error',
  triggers: ['activate'],
  reads: ['status'],
  message: 'Unarchive the campaign before activating this insertion order.',
  appliesTo: (_io, ctx) => ctx.campaign?.status === 'ARCHIVED',
  check: () => ({ path: 'status' }),
});

export const IO_092 = def({
  id: 'IO-092',
  severity: 'error',
  triggers: ['activate'],
  reads: [SEG],
  message: 'An active insertion order needs a budget segment that has not ended.',
  check: (io, ctx) => {
    const now = today(ctx);
    const live = io.budget.segments.some((s) => isIsoDate(s.endDate) && s.endDate >= now);
    return live ? null : { path: SEG };
  },
});

export const IO_093 = def({
  id: 'IO-093',
  severity: 'warning',
  triggers: ['cross'],
  reads: [SEG, 'lineItems[].budget'],
  message: MSG.LI_BUDGET_GT_IO,
  appliesTo: (_io, ctx) => (ctx.children?.lineItems?.length ?? 0) > 0,
  check: (io, ctx) => {
    const sum = (ctx.children?.lineItems ?? []).reduce((total, li) => total + (li.budgetAmount ?? 0), 0);
    return sum > segmentTotal(io) ? { path: '*' } : null;
  },
});

export const IO_094 = def({
  id: 'IO-094',
  severity: 'warning',
  triggers: ['cross'],
  reads: [SEG, 'optimization', 'lineItems[]'],
  message: 'Insertion order or line item has conflicting settings which may prevent your budget from being spent',
  appliesTo: (_io, ctx) => (ctx.children?.lineItems?.length ?? 0) > 0,
  check: (io, ctx) => {
    const children = ctx.children?.lineItems ?? [];
    const flight = ioFlight(io);
    if (flight && outsideFlight(children, flight).length > 0) return { path: '*' };
    if (io.optimization.mode === 'IO_AUTOMATED') {
      const clash = children.some(
        (li) =>
          (li.pacingType !== undefined && li.pacingType !== null && li.pacingType !== 'ASAP') ||
          li.bidMode === 'FIXED' ||
          (!!io.optimization.optimizedTowards &&
            !!li.optimizedTowards &&
            li.optimizedTowards !== io.optimization.optimizedTowards),
      );
      if (clash) return { path: '*' };
    }
    return null;
  },
});

export const IO_095 = def({
  id: 'IO-095',
  severity: 'warning',
  triggers: ['cross'],
  reads: [SEG],
  message: "{n} line items have dates outside this insertion order's flight.",
  appliesTo: (_io, ctx) => ctx.mode === 'edit' && (ctx.children?.lineItems?.length ?? 0) > 0,
  check: (io, ctx) => {
    const flight = ioFlight(io);
    const stored = originalOf<IoInput>(ctx);
    const before = stored ? ioFlight(stored) : null;
    if (!flight || (before && before.start === flight.start && before.end === flight.end)) return null;
    const n = outsideFlight(ctx.children?.lineItems ?? [], flight).length;
    return n > 0 ? { path: SEG, params: { n } } : null;
  },
});

/** The grid's inline budget edit reuses IO-021..IO-027. Documentation row. */
export const IO_100 = def({
  id: 'IO-100',
  severity: 'error',
  triggers: ['blur'],
  reads: [SEG],
  message: null,
  check: () => null,
});

export const insertionOrderRules: readonly AnyRule[] = [
  IO_001,
  IO_002,
  IO_003,
  IO_004,
  IO_005,
  IO_006,
  IO_010,
  IO_011,
  IO_012,
  IO_020,
  IO_021,
  IO_022,
  IO_023,
  IO_024,
  IO_025,
  IO_026,
  IO_027,
  IO_028,
  IO_030,
  IO_031,
  IO_032,
  IO_033,
  IO_034,
  IO_040,
  IO_041,
  IO_042,
  IO_043,
  IO_050,
  IO_051,
  IO_052,
  IO_053,
  IO_054,
  IO_055,
  IO_056,
  IO_060,
  IO_061,
  IO_062,
  IO_063,
  IO_070,
  IO_071,
  IO_072,
  IO_073,
  IO_074,
  IO_080,
  IO_090,
  IO_091,
  IO_092,
  IO_093,
  IO_094,
  IO_095,
  IO_100,
];
