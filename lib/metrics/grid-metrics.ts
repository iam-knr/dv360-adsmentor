// Performance columns, totals row and chart cards of the list pages (engine.md 9.4, data-model 7.1). Two queries per
// request whatever the number of ids: entity attributes (currency, KPI, budget) and the metric aggregate.
import { withSandbox, type Tx } from '@/lib/db';
import { eachDayIso } from './date-range';
import {
  addCounters,
  deriveRatios,
  emptyCounters,
  kpiActual,
  kpiActualTrueView,
  MONEY_KPIS,
  scaleMoney,
} from './derived';
import { fxRate, loadFxTable, type FxTable } from './fx';
import { aggregate, dailySeries, type AggregateRow } from './query';
import type {
  ChartCardData,
  ChartCardId,
  Counters,
  GridMetricsArgs,
  KpiType,
  MetricLevel,
  MetricRow,
  MetricTotals,
} from './types';

export type { MetricLevel, DateRange, MetricRow, GridMetricsArgs } from './types';

export interface EntityInfo {
  id: string;
  currency: string;
  kpi: KpiType | null;
  /** In the advertiser currency for money KPIs, percent for rate KPIs. */
  kpiGoal: number | null;
  /** Lifetime budget in the advertiser currency; null = "Unknown". */
  budget: number | null;
}

const dec = (v: { toString(): string } | null | undefined): number | null =>
  v === null || v === undefined ? null : Number(v.toString());
const sumOrNull = (values: { amount: { toString(): string } }[]): number | null =>
  values.length === 0 ? null : values.reduce((s, v) => s + Number(v.amount.toString()), 0);

/**
 * Budget per level: campaign = sum of its budget rows (none = "Unknown", AC-06-02), IO = sum of its budget
 * segments, LI = its fixed budget ("Unlimited up to IO" = unknown), ad group and advertiser = unknown.
 */
export async function loadEntities(
  tx: Tx,
  level: MetricLevel,
  ids: string[],
): Promise<Map<string, EntityInfo>> {
  const where = { id: { in: ids } };
  const kpiOf = (o: { kpi: KpiType | null; kpiValue: { toString(): string } | null } | null) => ({
    kpi: o?.kpi ?? null,
    kpiGoal: dec(o?.kpiValue),
  });
  let list: EntityInfo[];
  switch (level) {
    case 'campaign':
      list = (
        await tx.campaign.findMany({
          where,
          select: {
            id: true,
            kpi: true,
            kpiValue: true,
            advertiser: { select: { currencyCode: true } },
            budgets: { select: { amount: true } },
          },
        })
      ).map((c) => ({
        id: c.id,
        currency: c.advertiser.currencyCode,
        ...kpiOf(c),
        budget: sumOrNull(c.budgets),
      }));
      break;
    case 'io':
      list = (
        await tx.insertionOrder.findMany({
          where,
          select: {
            id: true,
            kpi: true,
            kpiValue: true,
            advertiser: { select: { currencyCode: true } },
            segments: { select: { amount: true } },
          },
        })
      ).map((io) => ({
        id: io.id,
        currency: io.advertiser.currencyCode,
        ...kpiOf(io),
        budget: sumOrNull(io.segments),
      }));
      break;
    case 'li':
      list = (
        await tx.lineItem.findMany({
          where,
          select: {
            id: true,
            budgetMode: true,
            budgetAmount: true,
            advertiser: { select: { currencyCode: true } },
            io: { select: { kpi: true, kpiValue: true } },
          },
        })
      ).map((li) => ({
        id: li.id,
        currency: li.advertiser.currencyCode,
        ...kpiOf(li.io),
        budget: li.budgetMode === 'FIXED' ? dec(li.budgetAmount) : null,
      }));
      break;
    case 'adGroup':
      list = (
        await tx.adGroup.findMany({
          where,
          select: {
            id: true,
            advertiser: { select: { currencyCode: true } },
            lineItem: { select: { io: { select: { kpi: true, kpiValue: true } } } },
          },
        })
      ).map((ag) => ({
        id: ag.id,
        currency: ag.advertiser.currencyCode,
        ...kpiOf(ag.lineItem.io),
        budget: null,
      }));
      break;
    case 'advertiser':
      list = (
        await tx.advertiser.findMany({ where, select: { id: true, currencyCode: true } })
      ).map((a) => ({
        id: a.id,
        currency: a.currencyCode,
        kpi: null,
        kpiGoal: null,
        budget: null,
      }));
      break;
  }
  return new Map(list.map((e) => [e.id, e]));
}

const EMPTY_AGG = (key: string): AggregateRow => ({
  key,
  days: 0,
  counters: emptyCounters(),
  revenueToDate: 0,
  liPacingPct: null,
  ioPacingPct: null,
  dailyTarget: null,
});

/** Build one row from counters already in the target currency. Exported for the unit tests. */
export function buildRow(
  level: MetricLevel,
  counters: Counters,
  days: number,
  extra: {
    currency: string;
    kpi: KpiType | null;
    kpiGoal: number | null;
    budget: number | null;
    revenueToDate: number;
    pacingPct: number | null;
    dailyTarget: number | null;
  },
): MetricRow {
  const hasData = days > 0;
  const ratios = deriveRatios(counters);
  const budgetRemaining =
    extra.budget === null ? null : Math.max(0, extra.budget - extra.revenueToDate);
  const pacing = {
    pacingPct: hasData && (level === 'io' || level === 'li') ? extra.pacingPct : null,
    budgetRemaining,
    dailyTarget: hasData && (level === 'io' || level === 'li') ? extra.dailyTarget : null,
  };
  return {
    impressions: counters.impressions,
    clicks: counters.clicks,
    interactions: counters.clicks + counters.engagements,
    conversions: counters.convTotal,
    revenue: counters.revenue,
    cpa: ratios.cpa ?? 0,
    customImpressionValue: counters.customImpressionValue,
    customImpressionCost: counters.customImpressionCost,
    budget: extra.budget ?? 0,
    pacingPct: pacing.pacingPct ?? 0,
    budgetRemaining: pacing.budgetRemaining ?? 0,
    dailyTarget: pacing.dailyTarget ?? 0,
    currency: extra.currency,
    hasData,
    spent: counters.revenue,
    totalMediaCost: counters.totalMediaCost,
    counters,
    ratios,
    kpi: extra.kpi,
    kpiGoal: extra.kpiGoal,
    kpiActual: hasData ? kpiActual(extra.kpi, counters) : null,
    kpiActualTrueView: hasData ? kpiActualTrueView(extra.kpi, counters) : null,
    budgetAmount: extra.budget,
    pacing,
  };
}

async function gridRows(
  tx: Tx,
  args: GridMetricsArgs,
  fx: FxTable | null,
): Promise<Record<string, MetricRow>> {
  const ids = [...new Set(args.ids)];
  if (ids.length === 0) return {};
  const [entities, agg] = await Promise.all([
    loadEntities(tx, args.level, ids),
    aggregate(tx, args.level, ids, args.range, args.sandboxId),
  ]);
  const out: Record<string, MetricRow> = {};
  for (const id of args.ids) {
    const e = entities.get(id);
    if (!e) continue; // unknown or another sandbox's id (RLS)
    const a = agg.get(id) ?? EMPTY_AGG(id);
    const currency = args.currency ?? e.currency;
    const rate = fx ? fxRate(fx, e.currency, currency) : 1;
    const money = (v: number | null) => (v === null ? null : v * rate);
    out[id] = buildRow(args.level, scaleMoney(a.counters, rate), a.days, {
      currency,
      kpi: e.kpi,
      kpiGoal: e.kpi && MONEY_KPIS.has(e.kpi) ? money(e.kpiGoal) : e.kpiGoal,
      budget: money(e.budget),
      revenueToDate: a.revenueToDate * rate,
      pacingPct: args.level === 'li' ? a.liPacingPct : a.ioPacingPct,
      dailyTarget: money(a.dailyTarget),
    });
  }
  return out;
}

const needsFx = (args: GridMetricsArgs) => Boolean(args.currency);

/**
 * Metrics per id over `range`. Rows for ids that do not exist in the sandbox are left out. With `currency`, every
 * money field is converted with `FxRate` (throws `FxRateMissingError` when a rate is missing).
 */
export async function getGridMetrics(args: GridMetricsArgs): Promise<Record<string, MetricRow>> {
  return withSandbox(args.sandboxId, (tx) => getGridMetricsTx(tx, args));
}

export async function getGridMetricsTx(
  tx: Tx,
  args: GridMetricsArgs,
): Promise<Record<string, MetricRow>> {
  const fx = needsFx(args) ? await loadFxTable(tx) : null;
  return gridRows(tx, args, fx);
}

/** Sum rows that share one currency into the footer row. Ratios and KPI come from the summed counters. */
export function totalsOf(level: MetricLevel, rows: MetricRow[], currency: string): MetricTotals {
  let counters = emptyCounters();
  let days = 0;
  let budget: number | null = null;
  let remaining: number | null = null;
  let dailyTarget: number | null = null;
  const kpis = new Set<KpiType | null>();
  const goals = new Set<number | null>();
  for (const r of rows) {
    if (r.currency !== currency)
      throw new Error(`totalsOf: row in ${r.currency}, total in ${currency}`);
    counters = addCounters(counters, r.counters);
    if (r.hasData) days += 1;
    if (r.budgetAmount !== null) budget = (budget ?? 0) + r.budgetAmount;
    if (r.pacing.budgetRemaining !== null) remaining = (remaining ?? 0) + r.pacing.budgetRemaining;
    if (r.pacing.dailyTarget !== null) dailyTarget = (dailyTarget ?? 0) + r.pacing.dailyTarget;
    kpis.add(r.kpi);
    goals.add(r.kpiGoal);
  }
  // KPI Actual in the footer only when every row measures the same KPI
  const kpi = kpis.size === 1 ? ([...kpis][0] ?? null) : null;
  const row = buildRow(level, counters, days, {
    currency,
    kpi,
    kpiGoal: kpi && goals.size === 1 ? ([...goals][0] ?? null) : null,
    budget,
    revenueToDate: 0,
    pacingPct: null,
    dailyTarget,
  });
  return {
    ...row,
    budgetRemaining: remaining ?? 0,
    rowCount: rows.length,
    pacing: { pacingPct: null, budgetRemaining: remaining, dailyTarget },
  };
}

export interface TotalsArgs extends GridMetricsArgs {
  /** Footer currency. Default: the rows' currency when they share one; mixed rows need it (the partner currency). */
  currency?: string;
}

/** Footer row "Total: Display": rows converted to one currency, then summed (AC-01-5 logic). */
export async function getTotals(args: TotalsArgs): Promise<MetricTotals> {
  return withSandbox(args.sandboxId, (tx) => getTotalsTx(tx, args));
}

export async function getTotalsTx(tx: Tx, args: TotalsArgs): Promise<MetricTotals> {
  const rows = Object.values(await getGridMetricsTx(tx, args));
  const currency = args.currency ?? rows[0]?.currency ?? 'INR';
  if (rows.some((r) => r.currency !== currency)) {
    throw new Error(
      'getTotals: rows in several currencies, pass `currency` (the partner currency)',
    );
  }
  return totalsOf(args.level, rows, currency);
}

export interface ChartCardArgs extends GridMetricsArgs {
  cards?: ChartCardId[];
  /** Sim today in the advertiser time zone (the "Today" footer of Total cost). */
  today: string;
}

const BUILT_IN: ChartCardId[] = [
  'totalCost',
  'avgPerformance',
  'impressionsLost',
  'addedImpressionReach',
  'exploreBudgetOptions',
];

/** Chart strip data (design-system 2.16, engine 9.4). Reach and budget forecast cards return the empty marker. */
export async function getChartCardData(args: ChartCardArgs): Promise<ChartCardData[]> {
  return withSandbox(args.sandboxId, (tx) => getChartCardDataTx(tx, args));
}

export async function getChartCardDataTx(tx: Tx, args: ChartCardArgs): Promise<ChartCardData[]> {
  const ids = [...new Set(args.ids)];
  const entities = await loadEntities(tx, args.level, ids);
  const known = ids.filter((id) => entities.has(id));
  const currencies = new Set([...entities.values()].map((e) => e.currency));
  const currency = args.currency ?? [...currencies][0] ?? 'INR';
  const fx =
    currencies.size > 1 || (args.currency && !currencies.has(args.currency))
      ? await loadFxTable(tx)
      : null;
  if (currencies.size > 1 && !args.currency) {
    throw new Error('getChartCardData: ids in several currencies, pass `currency`');
  }
  // Day series per currency group, converted, then merged by day
  const byDay = new Map<string, Counters>();
  for (const cur of currencies) {
    const group = known.filter((id) => entities.get(id)?.currency === cur);
    const rate = fx ? fxRate(fx, cur, currency) : 1;
    const series = await dailySeries(tx, args.level, group, args.range, args.sandboxId);
    for (const [day, c] of series) {
      byDay.set(day, addCounters(byDay.get(day) ?? emptyCounters(), scaleMoney(c, rate)));
    }
  }
  const days = eachDayIso(args.range);
  let total = emptyCounters();
  for (const c of byDay.values()) total = addCounters(total, c);

  const kpis = new Set(known.map((id) => entities.get(id)?.kpi ?? null));
  const kpi = kpis.size === 1 ? ([...kpis][0] ?? null) : null;
  const goals = new Set(known.map((id) => entities.get(id)?.kpiGoal ?? null));
  const rawGoal = kpi && goals.size === 1 ? ([...goals][0] ?? null) : null;
  const goalRate =
    kpi && MONEY_KPIS.has(kpi) && fx && known[0]
      ? fxRate(fx, entities.get(known[0])?.currency ?? currency, currency)
      : 1;
  let budget: number | null = null;
  for (const id of known) {
    const e = entities.get(id);
    if (e?.budget === null || e?.budget === undefined) continue;
    budget = (budget ?? 0) + e.budget * (fx ? fxRate(fx, e.currency, currency) : 1);
  }

  const wanted = args.cards ?? BUILT_IN;
  return wanted.map((id): ChartCardData => {
    switch (id) {
      case 'totalCost':
        return {
          id,
          currency,
          total: total.revenue,
          today: byDay.get(args.today)?.revenue ?? 0,
          budget,
          days: days.map((d) => ({ date: d, value: byDay.get(d)?.revenue ?? 0 })),
        };
      case 'avgPerformance':
        return {
          id,
          currency,
          kpi,
          goal: rawGoal === null ? null : rawGoal * goalRate,
          actual: kpiActual(kpi, total),
          days: days.map((d) => {
            const c = byDay.get(d);
            return { date: d, value: c ? kpiActual(kpi, c) : null };
          }),
        };
      case 'impressionsLost': {
        const lost = (c: Counters) =>
          c.lostBudget + c.lostPacing + c.lostBelowMinBid + c.lostExternalBid;
        return {
          id,
          total: lost(total),
          byReason: {
            budget: total.lostBudget,
            pacing: total.lostPacing,
            bid: total.lostBelowMinBid,
            other: total.lostExternalBid,
          },
          days: days.map((d) => {
            const c = byDay.get(d);
            return { date: d, value: c ? lost(c) : 0 };
          }),
        };
      }
      default:
        return { id, empty: true };
    }
  });
}
