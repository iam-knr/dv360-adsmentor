// LI rules: line item, rules shared by all types (validation.md 2.6).
import {
  allowedBidStrategies,
  CONVERSION_STRATEGIES,
  CUSTOM_VALUE_STRATEGIES,
  strategyNeedsTarget,
} from '../constants/bids';
import { LI_COUNTING_MODES } from '../constants/conversions';
import { creativeFormatAllowed, LI_TYPES_WITHOUT_LIBRARY_CREATIVES } from '../constants/creatives';
import { looserThan, periodLabel, strictestCap } from '../constants/frequency';
import {
  AUTOMATION_LI_TYPES,
  isMatrixLiType,
  LI_TYPE_BY_OBJECTIVE,
  LI_TYPE_LABEL,
  liTypeAllowedByIoType,
  YOUTUBE_LI_TYPES,
} from '../constants/li-compat';
import { LIMITS } from '../constants/limits';
import { isLiPacingAllowed } from '../constants/pacing';
import {
  DIMENSION_LABEL,
  isDimensionAvailable,
  matrixDimensionOf,
} from '../constants/targeting-availability';
import { MSG } from '../messages';
import {
  byteLength,
  codePointLength,
  dateRange,
  isBlank,
  isEmptyNum,
  isIsoDate,
  isWhole,
  nonNegative,
  pct,
  positive,
  today,
  toNum,
} from '../primitives';
import type {
  AnyRule,
  InventoryQuality,
  LineItemInput,
  Rule,
  ValidationContext,
  Violation,
} from '../types';
import {
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

type LiRule = Omit<Rule<LineItemInput>, 'kind'>;

export function def(rule: LiRule): Rule<LineItemInput> {
  return { kind: 'lineItem', ...rule };
}

const QUALITIES: readonly InventoryQuality[] = [
  'AUTHORIZED_DIRECT_SELLERS',
  'AUTHORIZED_DIRECT_SELLERS_AND_RESELLERS',
  'AUTHORIZED_AND_NON_PARTICIPATING',
];

/** Label of the line item's type for `{Type}` in messages. Empty when the type is not chosen yet. */
export function typeLabel(l: LineItemInput): string {
  return l.type ? LI_TYPE_LABEL[l.type] : '';
}

/** Caps above the line item: campaign, then insertion order. */
function higherCaps(ctx: ValidationContext) {
  return [resolveCap(ctx.campaign?.frequencyCap), resolveCap(ctx.io?.frequencyCap)].flatMap((c) =>
    c ? [c] : [],
  );
}

function isYoutubeOrDemandGen(l: LineItemInput): boolean {
  return !!l.type && (YOUTUBE_LI_TYPES.includes(l.type) || l.type === 'DEMAND_GEN');
}

export const LI_001 = def({
  id: 'LI-001',
  severity: 'error',
  triggers: ['blur'],
  reads: ['name'],
  message: MSG.ENTER_VALUE,
  check: (l) => (isBlank(l.name) ? { path: 'name' } : null),
});

export const LI_002 = def({
  id: 'LI-002',
  severity: 'error',
  triggers: ['save'],
  reads: ['name'],
  message: MSG.MAX_CHARS,
  check: (l) =>
    codePointLength(l.name) > LIMITS.NAME_MAX_240
      ? { path: 'name', params: { max: LIMITS.NAME_MAX_240 } }
      : null,
});

export const LI_003 = def({
  id: 'LI-003',
  severity: 'error',
  triggers: ['save'],
  reads: ['status'],
  message: MSG.CHOOSE_STATUS,
  appliesTo: (_l, ctx) => ctx.mode === 'create',
  check: (l) => (l.status === 'DRAFT' || l.status === 'ACTIVE' ? null : { path: 'status' }),
});

export const LI_004 = def({
  id: 'LI-004',
  severity: 'error',
  triggers: ['save'],
  reads: ['type'],
  message: MSG.LOCKED_AFTER_CREATE,
  appliesTo: (_l, ctx) => ctx.mode === 'edit',
  check: (l, ctx) => {
    const stored = originalOf<LineItemInput>(ctx)?.type;
    return stored && l.type !== stored ? { path: 'type' } : null;
  },
});

export const LI_005 = def({
  id: 'LI-005',
  severity: 'error',
  triggers: ['cross'],
  reads: ['ioId'],
  message: 'Choose an active or paused insertion order.',
  check: (l, ctx) => (!l.ioId || !ctx.io || ctx.io.status === 'ARCHIVED' ? { path: 'ioId' } : null),
});

export const LI_006 = def({
  id: 'LI-006',
  severity: 'error',
  triggers: ['cross'],
  reads: ['type', 'ioId'],
  message: MSG.LI_TYPE_INCOMPAT,
  appliesTo: (l, ctx) => !!ctx.io && !!l.type && isMatrixLiType(l.type),
  check: (l, ctx) => {
    const type = l.type;
    if (!ctx.io || !type || !isMatrixLiType(type)) return null;
    return LI_TYPE_BY_OBJECTIVE[ctx.io.objective][type]
      ? null
      : { path: 'type', params: { Type: LI_TYPE_LABEL[type] } };
  },
});

export const LI_007 = def({
  id: 'LI-007',
  severity: 'error',
  triggers: ['cross'],
  reads: ['type', 'ioId'],
  message: MSG.LI_TYPE_INCOMPAT,
  appliesTo: (l, ctx) => !!ctx.io && !!l.type,
  check: (l, ctx) =>
    ctx.io && l.type && !liTypeAllowedByIoType(ctx.io.type, l.type)
      ? { path: 'type', params: { Type: LI_TYPE_LABEL[l.type] } }
      : null,
});

export const LI_008 = def({
  id: 'LI-008',
  severity: 'error',
  triggers: ['cross'],
  reads: ['type', 'ioId'],
  message: MSG.AUTOMATION_LI_TYPE,
  appliesTo: (l, ctx) => !!l.type && ctx.io?.mode === 'IO_AUTOMATED',
  check: (l) => (l.type && !AUTOMATION_LI_TYPES.includes(l.type) ? { path: 'ioId' } : null),
});

export const LI_010 = def({
  id: 'LI-010',
  severity: 'error',
  triggers: ['save'],
  reads: ['inventory.quality'],
  message: 'Choose an inventory quality option.',
  appliesTo: (l) => !isYoutubeOrDemandGen(l), // YouTube and Demand Gen use Google inventory (no quality dropdown)
  check: (l) =>
    l.inventory.quality && QUALITIES.includes(l.inventory.quality)
      ? null
      : { path: 'inventory.quality' },
});

export const LI_011 = def({
  id: 'LI-011',
  severity: 'error',
  triggers: ['save'],
  reads: ['inventory'],
  message: MSG.PICK_INVENTORY_SOURCE,
  appliesTo: (l) => !isYoutubeOrDemandGen(l),
  check: (l) =>
    l.inventory.exchanges.length + l.inventory.deals.length + l.inventory.dealGroups.length === 0
      ? { path: 'inventory' }
      : null,
});

export const LI_012 = def({
  id: 'LI-012',
  severity: 'error',
  triggers: ['save'],
  reads: ['inventory.exchanges'],
  message: "This exchange isn't enabled for the partner.",
  check: (l, ctx) =>
    l.inventory.exchanges
      .map((id, i) => ({ id, i }))
      .filter(({ id }) => !ctx.partner.enabledExchangeIds.includes(id))
      .map(({ i }): Violation => ({ path: `inventory.exchanges[${i}]` })),
});

export const LI_013 = def({
  id: 'LI-013',
  severity: 'error',
  triggers: ['save'],
  reads: ['inventory.deals'],
  message: "This deal isn't available to this advertiser.",
  needs: ['deals'],
  check: (l, ctx) =>
    l.inventory.deals
      .map((id, i) => ({ deal: ctx.lookups.deals?.get(id), i }))
      .filter(
        ({ deal }) =>
          !deal ||
          !deal.accessible ||
          !deal.exchangeEnabled ||
          deal.status === 'ARCHIVED' ||
          deal.status === 'NOT_SERVABLE',
      )
      .map(({ i }): Violation => ({ path: `inventory.deals[${i}]` })),
});

export const LI_014 = def({
  id: 'LI-014',
  severity: 'error',
  triggers: ['save'],
  reads: ['inventory.targetCuratedCtv', 'type'],
  message: "This option isn't available for {Type} line items.",
  appliesTo: (l) => !!l.type && !!l.inventory.targetCuratedCtv,
  check: (l) =>
    l.type === 'VIDEO' || l.type === 'CTV'
      ? null
      : { path: 'inventory.targetCuratedCtv', params: { Type: typeLabel(l) } },
});

export const LI_020 = def({
  id: 'LI-020',
  severity: 'error',
  triggers: ['save'],
  reads: ['flight.mode'],
  message: 'Choose flight dates.',
  check: (l) =>
    l.flight.mode === 'SAME_AS_IO' || l.flight.mode === 'CUSTOM' ? null : { path: 'flight.mode' },
});

export const LI_021 = def({
  id: 'LI-021',
  severity: 'error',
  triggers: ['cross'],
  reads: ['flight.startDate', 'flight.endDate'],
  message: MSG.END_BEFORE_START,
  appliesTo: (l) => l.flight.mode === 'CUSTOM',
  check: (l) =>
    dateRange(l.flight.startDate, l.flight.endDate) ? null : { path: 'flight.endDate' },
});

export const LI_022 = def({
  id: 'LI-022',
  severity: 'error',
  triggers: ['cross'],
  reads: ['flight', 'ioId'],
  message: "Line item dates must be within the insertion order's flight.",
  appliesTo: (l, ctx) => l.flight.mode === 'CUSTOM' && !!ctx.io?.flight,
  check: (l, ctx) => {
    const flight = ctx.io?.flight;
    if (!flight) return null;
    const { startDate, endDate } = l.flight;
    const early = isIsoDate(startDate) && startDate < flight.start;
    const late = isIsoDate(endDate) && endDate > flight.end;
    return early || late ? { path: 'flight' } : null;
  },
});

export const LI_023 = def({
  id: 'LI-023',
  severity: 'error',
  triggers: ['save'],
  reads: ['flight.startDate'],
  message: "The start date can't be changed after the line item has started.",
  appliesTo: (l, ctx) => ctx.mode === 'edit' && l.flight.mode === 'CUSTOM',
  check: (l, ctx) => {
    const stored = originalOf<LineItemInput>(ctx);
    const storedStart =
      stored?.flight.mode === 'CUSTOM' ? stored.flight.startDate : ctx.io?.flight?.start;
    if (!isIsoDate(storedStart)) return null;
    return storedStart <= today(ctx) && l.flight.startDate !== storedStart
      ? { path: 'flight.startDate' }
      : null;
  },
});

export const LI_024 = def({
  id: 'LI-024',
  severity: 'error',
  triggers: ['blur'],
  reads: ['flight.startDate'],
  message: MSG.START_IN_PAST,
  appliesTo: (l, ctx) =>
    ctx.mode === 'create' && l.flight.mode === 'CUSTOM' && isIsoDate(l.flight.startDate),
  check: (l, ctx) =>
    l.flight.startDate && l.flight.startDate < today(ctx) ? { path: 'flight.startDate' } : null,
});

export const LI_030 = def({
  id: 'LI-030',
  severity: 'error',
  triggers: ['blur'],
  reads: ['budget.mode', 'budget.amount'],
  message: MSG.ENTER_VALUE,
  appliesTo: (l) => l.budget.mode === 'AMOUNT',
  check: (l) => (isEmptyNum(l.budget.amount) ? { path: 'budget.amount' } : null),
});

export const LI_031 = def({
  id: 'LI-031',
  severity: 'error',
  triggers: ['blur'],
  reads: ['budget.mode', 'budget.amount'],
  message: MSG.ENTER_POSITIVE,
  appliesTo: (l) => l.budget.mode === 'AMOUNT' && !isEmptyNum(l.budget.amount),
  check: (l) => (positive(l.budget.amount) ? null : { path: 'budget.amount' }),
});

export const LI_032 = def({
  id: 'LI-032',
  severity: 'error',
  triggers: ['blur'],
  reads: ['budget.amount', 'ioId'],
  message: MSG.WHOLE_NUMBER,
  appliesTo: (l, ctx) =>
    l.budget.mode === 'AMOUNT' &&
    ctx.io?.budgetType === 'IMPRESSIONS' &&
    toNum(l.budget.amount) !== null,
  check: (l) => (isWhole(l.budget.amount) ? null : { path: 'budget.amount' }),
});

export const LI_033 = def({
  id: 'LI-033',
  severity: 'warning',
  triggers: ['cross'],
  reads: ['budget.amount', 'ioId'],
  message: MSG.LI_BUDGET_GT_IO,
  appliesTo: (l, ctx) => l.budget.mode === 'AMOUNT' && !!ctx.io && ctx.io.budgetTotal > 0,
  check: (l, ctx) => {
    const amount = toNum(l.budget.amount);
    return amount !== null && ctx.io && amount > ctx.io.budgetTotal
      ? { path: 'budget.amount' }
      : null;
  },
});

export const LI_034 = def({
  id: 'LI-034',
  severity: 'error',
  triggers: ['cross'],
  reads: ['pacing.period', 'pacing.type'],
  message: MSG.PACING_COMBO,
  appliesTo: (l, ctx) => ctx.io?.mode !== 'IO_AUTOMATED' && !!l.pacing.period && !!l.pacing.type,
  check: (l) =>
    isLiPacingAllowed(l.pacing.period!, l.pacing.type!) ? null : { path: 'pacing.type' },
});

export const LI_035 = def({
  id: 'LI-035',
  severity: 'error',
  triggers: ['cross'],
  reads: ['pacing.type', 'pacing.period', 'ioId'],
  message: "Pacing is managed by the insertion order's automation.",
  appliesTo: (_l, ctx) => ctx.io?.mode === 'IO_AUTOMATED',
  check: (l) =>
    l.pacing.type === 'ASAP' && l.pacing.period === 'FLIGHT' ? null : { path: 'pacing.type' },
});

export const LI_036 = def({
  id: 'LI-036',
  severity: 'error',
  triggers: ['blur'],
  reads: ['pacing.period', 'pacing.dailyAmount'],
  message: MSG.ENTER_POSITIVE,
  // YouTube line items have LI-YT-006 and LI-YT-007 for the same field
  appliesTo: (l) =>
    l.pacing.period === 'DAILY' && !(l.type && YOUTUBE_LI_TYPES.includes(l.type)),
  check: (l) => (positive(l.pacing.dailyAmount) ? null : { path: 'pacing.dailyAmount' }),
});

export const LI_037 = def({
  id: 'LI-037',
  severity: 'warning',
  triggers: ['cross'],
  reads: ['pacing.dailyAmount', 'budget.amount'],
  message:
    'The daily amount is higher than the line item budget, so the line item budget will limit spend.',
  appliesTo: (l) => l.pacing.period === 'DAILY' && l.budget.mode === 'AMOUNT',
  check: (l) => {
    const daily = toNum(l.pacing.dailyAmount);
    const budget = toNum(l.budget.amount);
    return daily !== null && budget !== null && budget > 0 && daily > budget
      ? { path: 'pacing.dailyAmount' }
      : null;
  },
});

export const LI_040 = def({
  id: 'LI-040',
  severity: 'error',
  triggers: ['save'],
  reads: ['bid.mode'],
  message: 'Choose a bid strategy.',
  check: (l) =>
    l.bid.mode === 'AUTOMATED' || l.bid.mode === 'FIXED' ? null : { path: 'bid.mode' },
});

export const LI_041 = def({
  id: 'LI-041',
  severity: 'error',
  triggers: ['blur'],
  reads: ['bid.mode', 'bid.fixedCpm'],
  message: MSG.ENTER_POSITIVE,
  appliesTo: (l) => l.bid.mode === 'FIXED' && l.type !== 'DOOH_DISPLAY' && l.type !== 'DOOH_VIDEO',
  check: (l) => (positive(l.bid.fixedCpm) ? null : { path: 'bid.fixedCpm' }),
});

export const LI_042 = def({
  id: 'LI-042',
  severity: 'error',
  triggers: ['cross'],
  reads: ['bid.mode', 'bid.optimizedTowards', 'type', 'ioId'],
  message: MSG.BID_UNAVAILABLE_IO,
  suppressedBy: ['LI-006', 'LI-007', 'LI-YT-009'],
  appliesTo: (l, ctx) =>
    l.bid.mode === 'AUTOMATED' &&
    !!ctx.io &&
    ctx.io.mode !== 'IO_AUTOMATED' &&
    !!l.type &&
    !YOUTUBE_LI_TYPES.includes(l.type) &&
    l.type !== 'DOOH_DISPLAY' &&
    l.type !== 'DOOH_VIDEO',
  check: (l, ctx) => {
    if (!ctx.io || !l.type) return null;
    const allowed = allowedBidStrategies(ctx.io.type, ctx.io.objective, l.type);
    const chosen = l.bid.optimizedTowards;
    return chosen && allowed.includes(chosen) ? null : { path: 'bid.optimizedTowards' };
  },
});

export const LI_043 = def({
  id: 'LI-043',
  severity: 'error',
  triggers: ['blur'],
  reads: ['bid.mode', 'bid.optimizedTowards', 'bid.priority', 'bid.targetValue'],
  message: MSG.ENTER_POSITIVE,
  appliesTo: (l) =>
    l.bid.mode === 'AUTOMATED' &&
    !!l.bid.optimizedTowards &&
    !(l.type && YOUTUBE_LI_TYPES.includes(l.type)) && // the YouTube bid value lives on the ad group (AG-003)
    strategyNeedsTarget(l.bid.optimizedTowards, l.bid.priority),
  check: (l) => (positive(l.bid.targetValue) ? null : { path: 'bid.targetValue' }),
});

export const LI_044 = def({
  id: 'LI-044',
  severity: 'error',
  triggers: ['cross'],
  reads: ['bid', 'ioId'],
  message: "Bid strategy is managed by the insertion order's automation.",
  appliesTo: (_l, ctx) => ctx.io?.mode === 'IO_AUTOMATED',
  check: (l, ctx) =>
    l.bid.mode === 'AUTOMATED' && l.bid.optimizedTowards === (ctx.io?.optimizedTowards ?? null)
      ? null
      : { path: 'bid.optimizedTowards' },
});

/** Audio defaults to a fixed bid. Documentation row, nothing to emit. */
export const LI_045 = def({
  id: 'LI-045',
  severity: 'info',
  triggers: ['cross'],
  reads: ['type', 'bid.mode'],
  message: null,
  check: () => null,
});

export const LI_046 = def({
  id: 'LI-046',
  severity: 'error',
  triggers: ['cross'],
  reads: ['bid.optimizedTowards', 'conversions.activities'],
  message: 'Select at least one conversion to use this bid strategy.',
  appliesTo: (l) =>
    l.bid.mode === 'AUTOMATED' &&
    !!l.bid.optimizedTowards &&
    CONVERSION_STRATEGIES.includes(l.bid.optimizedTowards),
  check: (l) => (l.conversions.activities.length === 0 ? { path: 'conversions.activities' } : null),
});

export const LI_047 = def({
  id: 'LI-047',
  severity: 'error',
  triggers: ['cross'],
  reads: ['bid.optimizedTowards', 'bid.customBiddingAlgorithmId'],
  message: 'Choose an active custom bidding algorithm.',
  appliesTo: (l) =>
    l.bid.mode === 'AUTOMATED' &&
    !!l.bid.optimizedTowards &&
    CUSTOM_VALUE_STRATEGIES.includes(l.bid.optimizedTowards),
  check: (l, ctx) => {
    const id = l.bid.customBiddingAlgorithmId;
    if (!id) return { path: 'bid.customBiddingAlgorithmId' };
    const known = ctx.lookups.customBidding;
    if (!known) return null; // lookup not loaded: the server run decides
    return known.get(id)?.status === 'ACTIVE' ? null : { path: 'bid.customBiddingAlgorithmId' };
  },
});

export const LI_050 = def({
  id: 'LI-050',
  severity: 'error',
  triggers: ['blur'],
  reads: ['frequencyCap.mode', 'frequencyCap.maxImpressions'],
  message: MSG.ENTER_VALUE,
  check: (l) => capMaxEmpty(l.frequencyCap, 'frequencyCap'),
});

export const LI_051 = def({
  id: 'LI-051',
  severity: 'error',
  triggers: ['blur'],
  reads: ['frequencyCap.maxImpressions', 'frequencyCap.periodCount'],
  message: MSG.ENTER_POSITIVE,
  check: (l) => {
    const max = capMaxInvalid(l.frequencyCap, 'frequencyCap');
    return [...(max ? [max] : []), ...capWindowInvalid(l.frequencyCap, 'frequencyCap', false)];
  },
});

export const LI_052 = def({
  id: 'LI-052',
  severity: 'info',
  triggers: ['cross'],
  reads: ['frequencyCap.mode', 'ioId'],
  message: MSG.FREQ_HIGHER_LI,
  appliesTo: (l, ctx) => l.frequencyCap.mode !== 'LIMITED' && higherCaps(ctx).length > 0,
  check: (_l, ctx) => {
    const cap = strictestCap(higherCaps(ctx));
    return cap ? { path: 'frequencyCap', params: { n: cap.n, period: periodLabel(cap) } } : null;
  },
});

export const LI_053 = def({
  id: 'LI-053',
  severity: 'info',
  triggers: ['cross'],
  reads: ['frequencyCap', 'ioId'],
  message:
    'This limit is less restrictive than the higher-level limit, so the higher-level limit applies.',
  appliesTo: (l, ctx) => resolveCap(l.frequencyCap) !== null && higherCaps(ctx).length > 0,
  check: (l, ctx) => {
    const own = resolveCap(l.frequencyCap);
    return own && higherCaps(ctx).some((high) => looserThan(own, high))
      ? { path: 'frequencyCap' }
      : null;
  },
});

export const LI_060 = def({
  id: 'LI-060',
  severity: 'error',
  triggers: ['save'],
  reads: ['creatives', 'type'],
  message: MSG.CREATIVE_NOT_ALLOWED,
  needs: ['creatives'],
  appliesTo: (l) => !!l.type,
  check: (l, ctx) =>
    l.creatives
      .map((id, i) => ({ info: ctx.lookups.creatives?.get(id), i }))
      .filter(({ info }) => !!info && !creativeFormatAllowed(l.type!, info.format, l.adType))
      .map(({ i }): Violation => ({ path: `creatives[${i}]`, params: { Type: typeLabel(l) } })),
});

export const LI_061 = def({
  id: 'LI-061',
  severity: 'error',
  triggers: ['save'],
  reads: ['creatives'],
  message: "This creative can't be assigned because it isn't servable.",
  needs: ['creatives'],
  check: (l, ctx) =>
    l.creatives
      .map((id, i) => ({ info: ctx.lookups.creatives?.get(id), i }))
      .filter(
        ({ info }) => !!info && (info.status === 'ARCHIVED' || info.review === 'NOT_SERVABLE'),
      )
      .map(({ i }): Violation => ({ path: `creatives[${i}]` })),
});

export const LI_062 = def({
  id: 'LI-062',
  severity: 'info',
  triggers: ['cross'],
  reads: ['creatives'],
  message: MSG.INV_AVAIL_UNKNOWN,
  appliesTo: (l) => l.creatives.length === 0,
  check: () => ({ path: 'creatives' }),
});

export const LI_063 = def({
  id: 'LI-063',
  severity: 'warning',
  triggers: ['activate'],
  reads: ['creatives'],
  message: "This line item has no creatives and won't deliver.",
  appliesTo: (l) =>
    !!l.type && !LI_TYPES_WITHOUT_LIBRARY_CREATIVES.includes(l.type) && l.creatives.length === 0,
  check: () => ({ path: 'creatives' }),
});

export const LI_064 = def({
  id: 'LI-064',
  severity: 'warning',
  triggers: ['cross'],
  reads: ['creatives', 'targeting.countries'],
  message: 'This creative is restricted from serving in line items that target {country}.',
  needs: ['creatives'],
  check: (l, ctx) => {
    const countries = l.targeting.countries ?? [];
    const out: Violation[] = [];
    l.creatives.forEach((id, i) => {
      const info = ctx.lookups.creatives?.get(id);
      for (const country of info?.restrictedCountries ?? []) {
        if (countries.includes(country)) out.push({ path: `creatives[${i}]`, params: { country } });
      }
    });
    return out;
  },
});

export const LI_070 = def({
  id: 'LI-070',
  severity: 'error',
  triggers: ['save'],
  reads: ['conversions.activities'],
  message: "Choose an active conversion from the advertiser's Floodlight group.",
  needs: ['floodlightActivities'],
  check: (l, ctx) =>
    l.conversions.activities
      .map((id, i) => ({ info: ctx.lookups.floodlightActivities?.get(id), i }))
      .filter(({ info }) => !info || info.status !== 'ACTIVE' || !info.linkedToAdvertiser)
      .map(({ i }): Violation => ({ path: `conversions.activities[${i}]` })),
});

export const LI_071 = def({
  id: 'LI-071',
  severity: 'error',
  triggers: ['save'],
  reads: ['conversions.countingMode'],
  message: 'Choose a conversion counting option.',
  check: (l) =>
    l.conversions.countingMode && LI_COUNTING_MODES.includes(l.conversions.countingMode)
      ? null
      : { path: 'conversions.countingMode' },
});

export const LI_072 = def({
  id: 'LI-072',
  severity: 'error',
  triggers: ['blur'],
  reads: ['conversions.countingMode', 'conversions.postViewPct'],
  message: MSG.ENTER_VALUE,
  appliesTo: (l) => l.conversions.countingMode === 'PERCENTAGE',
  check: (l) => {
    if (isEmptyNum(l.conversions.postViewPct)) return { path: 'conversions.postViewPct' };
    return pct(l.conversions.postViewPct)
      ? null
      : { path: 'conversions.postViewPct', message: MSG.PCT_RANGE };
  },
});

export const LI_073 = def({
  id: 'LI-073',
  severity: 'error',
  triggers: ['save'],
  reads: ['conversions.attributionModelId'],
  message: 'Choose an attribution model.',
  appliesTo: (l) => !isBlank(l.conversions.attributionModelId),
  check: (l, ctx) =>
    ctx.advertiser.attributionModelIds.includes(l.conversions.attributionModelId!)
      ? null
      : { path: 'conversions.attributionModelId' },
});

export const LI_080 = def({
  id: 'LI-080',
  severity: 'error',
  triggers: ['save'],
  reads: ['euPoliticalAds'],
  message: MSG.EU_POLITICAL_REQUIRED,
  appliesTo: (_l, ctx) => ctx.mode === 'create' && ctx.source !== 'sdf',
  check: (l) => (l.euPoliticalAds ? null : { path: 'euPoliticalAds' }),
});

export const LI_081 = def({
  id: 'LI-081',
  severity: 'info',
  triggers: ['save'],
  reads: ['euPoliticalAds'],
  message: MSG.SDF_EU_DEFAULT,
  appliesTo: (l, ctx) => ctx.source === 'sdf' && !l.euPoliticalAds,
  check: () => ({ path: 'euPoliticalAds' }),
});

export const LI_090 = def({
  id: 'LI-090',
  severity: 'error',
  triggers: ['blur'],
  reads: ['revenueModel.type', 'revenueModel.value'],
  message: MSG.NON_NEGATIVE,
  appliesTo: (l) => !!l.revenueModel?.type && !isEmptyNum(l.revenueModel.value),
  check: (l) => {
    const model = l.revenueModel;
    if (!model?.type) return null;
    const valid =
      model.type === 'TOTAL_MEDIA_COST_MARKUP' ? pct(model.value) : nonNegative(model.value);
    return valid ? null : { path: 'revenueModel.value' };
  },
});

/** Partner costs repeat IO-070..IO-074; each variant keeps the wording of the IO rule. */
export const LI_091 = def({
  id: 'LI-091',
  severity: 'error',
  triggers: ['blur'],
  reads: ['partnerCosts'],
  message: MSG.NON_NEGATIVE,
  check: (l, ctx) => {
    const withMessage = (list: Violation[], message: string): Violation[] =>
      list.map((v) => ({ ...v, message }));
    return [
      ...withMessage(cpmFeeNegative(l.partnerCosts, 'partnerCosts'), MSG.NON_NEGATIVE),
      ...withMessage(mediaFeePercentInvalid(l.partnerCosts, 'partnerCosts'), MSG.PCT_RANGE),
      ...withMessage(feeTypeMissing(l.partnerCosts, 'partnerCosts'), MSG.PICK_FEE_TYPE),
      ...withMessage(
        ctx.mode === 'edit'
          ? [
              systemFeeChanged(
                l.partnerCosts,
                originalOf<LineItemInput>(ctx)?.partnerCosts,
                'partnerCosts',
              ),
            ].flatMap((v) => (v ? [v] : []))
          : [],
        MSG.FEE_LOCKED,
      ),
      ...withMessage(tooManyFees(l.partnerCosts, 'partnerCosts'), MSG.FEES_MAX),
    ];
  },
});

export const LI_092 = def({
  id: 'LI-092',
  severity: 'error',
  triggers: ['save'],
  reads: ['integrationCode'],
  message: MSG.MAX_CHARS,
  check: (l) =>
    byteLength(l.integrationCode ?? '') > LIMITS.INTEGRATION_CODE_MAX
      ? { path: 'integrationCode', params: { max: LIMITS.INTEGRATION_CODE_MAX } }
      : null,
});

export const LI_100 = def({
  id: 'LI-100',
  severity: 'error',
  triggers: ['save'],
  reads: ['targeting.lockedRowsChanged'],
  message: MSG.TARGETING_LOCKED_ADV,
  check: (l) => ((l.targeting.lockedRowsChanged ?? []).length > 0 ? { path: 'targeting' } : null),
});

export const LI_101 = def({
  id: 'LI-101',
  severity: 'error',
  triggers: ['save'],
  reads: ['targeting.templateId', 'type'],
  message: 'This template is for {Type} line items.',
  needs: ['templates'],
  appliesTo: (l) => !!l.type && !!l.targeting.templateId,
  check: (l, ctx) => {
    const template = ctx.lookups.templates?.get(l.targeting.templateId!);
    return template && template.liType !== l.type
      ? { path: 'targeting.templateId', params: { Type: LI_TYPE_LABEL[template.liType] } }
      : null;
  },
});

export const LI_102 = def({
  id: 'LI-102',
  severity: 'error',
  triggers: ['save'],
  reads: ['targeting.dimensions', 'type'],
  message: MSG.DIMENSION_NA,
  appliesTo: (l) => !!l.type,
  check: (l) => {
    const out: Violation[] = [];
    l.targeting.dimensions.forEach((key, i) => {
      const dim = matrixDimensionOf(key);
      if (dim && !isDimensionAvailable(l.type!, dim, l.adType)) {
        out.push({
          path: `targeting.dimensions[${i}]`,
          params: { Dimension: DIMENSION_LABEL[dim], Type: typeLabel(l) },
        });
      }
    });
    return out;
  },
});

/** Activation with an error open: the engine already runs every error rule on activate. Documentation row. */
export const LI_110 = def({
  id: 'LI-110',
  severity: 'error',
  triggers: ['activate'],
  reads: ['status'],
  message: null,
  check: () => null,
});

export const LI_111 = def({
  id: 'LI-111',
  severity: 'error',
  triggers: ['activate'],
  reads: ['status'],
  message: 'Unarchive the insertion order before activating this line item.',
  appliesTo: (_l, ctx) => ctx.io?.status === 'ARCHIVED' || ctx.campaign?.status === 'ARCHIVED',
  check: () => ({ path: 'status' }),
});

export const LI_120 = def({
  id: 'LI-120',
  severity: 'info',
  triggers: ['save'],
  reads: ['copiedFromType'],
  message: "Settings that don't apply to this line item type weren't copied.",
  appliesTo: (l) => !!l.copiedFromType && !!l.type && l.copiedFromType !== l.type,
  check: () => ({ path: 'copiedFromType' }),
});

export const lineItemRules: readonly AnyRule[] = [
  LI_001,
  LI_002,
  LI_003,
  LI_004,
  LI_005,
  LI_006,
  LI_007,
  LI_008,
  LI_010,
  LI_011,
  LI_012,
  LI_013,
  LI_014,
  LI_020,
  LI_021,
  LI_022,
  LI_023,
  LI_024,
  LI_030,
  LI_031,
  LI_032,
  LI_033,
  LI_034,
  LI_035,
  LI_036,
  LI_037,
  LI_040,
  LI_041,
  LI_042,
  LI_043,
  LI_044,
  LI_045,
  LI_046,
  LI_047,
  LI_050,
  LI_051,
  LI_052,
  LI_053,
  LI_060,
  LI_061,
  LI_062,
  LI_063,
  LI_064,
  LI_070,
  LI_071,
  LI_072,
  LI_073,
  LI_080,
  LI_081,
  LI_090,
  LI_091,
  LI_092,
  LI_100,
  LI_101,
  LI_102,
  LI_110,
  LI_111,
  LI_120,
];
