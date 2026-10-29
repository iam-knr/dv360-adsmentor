import { describe, expect, it } from 'vitest';
import { Prisma } from '@prisma/client';
import {
  buildRow,
  COUNTER_KEYS,
  deriveRatios,
  emptyCounters,
  kpiActual,
  kpiActualTrueView,
  MIN_SAMPLE,
  MONEY_COUNTER_KEYS,
  totalsOf,
  type Counters,
  type MetricRow,
} from '@/lib/metrics';

const c = (over: Partial<Counters>): Counters => ({ ...emptyCounters(), ...over });
const row = (
  over: Partial<Counters>,
  extra: Partial<Parameters<typeof buildRow>[3]> = {},
  days = 1,
) =>
  buildRow('io', c(over), days, {
    currency: 'INR',
    kpi: null,
    kpiGoal: null,
    budget: null,
    revenueToDate: 0,
    pacingPct: null,
    dailyTarget: null,
    ...extra,
  });

describe('metric names (RC-023)', () => {
  it('every counter is a SimDailyMetric column (engine 9.2 names)', () => {
    const columns = Object.keys(Prisma.SimDailyMetricScalarFieldEnum);
    for (const k of [...COUNTER_KEYS, ...MONEY_COUNTER_KEYS]) expect(columns).toContain(k);
  });
});

describe('KPI Actual (engine 4.6, V-06-16)', () => {
  it('CPM = cost / impressions x 1000', () => {
    expect(kpiActual('CPM', c({ impressions: 20_000, revenue: 1_800 }))).toBeCloseTo(90);
  });
  it('CTR = clicks / impressions, in percent', () => {
    expect(kpiActual('CTR', c({ impressions: 50_000, clicks: 75 }))).toBeCloseTo(0.15);
  });
  it('CPA = total cost / total conversions', () => {
    expect(kpiActual('CPA', c({ convTotal: 12.5, revenue: 6_000 }))).toBeCloseTo(480);
  });
  it('other KPIs', () => {
    const k = c({
      impressions: 10_000,
      clicks: 100,
      convPostClick: 5,
      convTotal: 20,
      measurableImpressions: 8_000,
      viewableImpressions: 6_000,
      viewable10sImpressions: 2_000,
      videoStarts: 4_000,
      videoCompletions: 3_000,
      videoViews: 2_500,
      customImpressionValue: 1_200,
      revenue: 1_000,
    });
    expect(kpiActual('CPC', k)).toBeCloseTo(10);
    expect(kpiActual('VIEWABLE_PCT', k)).toBeCloseTo(75);
    expect(kpiActual('VCPM', k)).toBeCloseTo(1000 / 6);
    expect(kpiActual('CPV', k)).toBeCloseTo(0.4);
    expect(kpiActual('VTR', k)).toBeCloseTo(25);
    expect(kpiActual('COMPL_VIDEO', k)).toBeCloseTo(75);
    expect(kpiActual('TOS10', k)).toBeCloseTo(25);
    expect(kpiActual('CLICK_CVR', k)).toBeCloseTo(5);
    expect(kpiActual('IMPR_CVR', k)).toBeCloseTo(0.2);
    expect(kpiActual('VALUE_COST', k)).toBeCloseTo(1.2);
    expect(kpiActual('OTHER', k)).toBeNull();
    expect(kpiActual(null, k)).toBeNull();
  });
  it('is "-" below the minimum sample', () => {
    expect(
      kpiActual('CPM', c({ impressions: MIN_SAMPLE.impressions - 1, revenue: 10 })),
    ).toBeNull();
    expect(kpiActual('CPC', c({ clicks: 29, revenue: 10 }))).toBeNull();
    expect(kpiActual('CPA', c({ convTotal: 9.99, revenue: 10 }))).toBeNull();
    expect(kpiActual('CPV', c({ videoViews: 99, revenue: 10 }))).toBeNull();
  });
  it('TrueView KPI uses videoViews: CPV for cost KPIs, VTR for rates', () => {
    const k = c({ impressions: 10_000, videoViews: 2_000, revenue: 500 });
    expect(kpiActualTrueView('CPM', k)).toBeCloseTo(0.25);
    expect(kpiActualTrueView('CTR', k)).toBeCloseTo(20);
    expect(kpiActualTrueView('CPM', c({ impressions: 10_000, revenue: 500 }))).toBeNull();
  });
});

describe('null vs zero (AC-06-02)', () => {
  it('no rows: counters 0, ratios and KPI null, budget Unknown', () => {
    const r = row({}, { kpi: 'CPM', kpiGoal: 90 }, 0);
    expect(r.hasData).toBe(false);
    expect(r.impressions).toBe(0);
    expect(r.ratios.ctr).toBeNull();
    expect(r.ratios.cpa).toBeNull();
    expect(r.kpiActual).toBeNull();
    expect(r.budgetAmount).toBeNull();
    expect(r.pacing.pacingPct).toBeNull();
  });
  it('rows with zero impressions: data present, ratios still null (no division by zero)', () => {
    const r = row({ revenue: 0 });
    expect(r.hasData).toBe(true);
    expect(r.ratios.cpm).toBeNull();
    expect(r.cpa).toBe(0);
  });
  it('Spent and Revenue are revenue (RC-038); interactions = clicks + engagements', () => {
    const r = row({ revenue: 120, totalMediaCost: 100, clicks: 3, engagements: 4 });
    expect(r.spent).toBe(120);
    expect(r.revenue).toBe(120);
    expect(r.totalMediaCost).toBe(100);
    expect(r.interactions).toBe(7);
  });
  it('budget remaining = budget minus spend to date', () => {
    expect(row({}, { budget: 500, revenueToDate: 120 }).pacing.budgetRemaining).toBe(380);
  });
});

describe('totals row', () => {
  it('sums counters and recomputes ratios from the sums', () => {
    const a = row(
      { impressions: 1_000, clicks: 10, revenue: 100 },
      { budget: 1000, kpi: 'CPM', kpiGoal: 90 },
    );
    const b = row(
      { impressions: 3_000, clicks: 3, revenue: 200 },
      { budget: null, kpi: 'CPM', kpiGoal: 90 },
    );
    const t = totalsOf('io', [a, b], 'INR');
    expect(t.impressions).toBe(4_000);
    expect(t.revenue).toBe(300);
    expect(t.ratios.ctr).toBeCloseTo((13 / 4000) * 100);
    expect(t.ratios.cpm).toBeCloseTo(75);
    expect(t.kpiActual).toBeCloseTo(75);
    expect(t.budgetAmount).toBe(1000);
    expect(t.rowCount).toBe(2);
  });
  it('mixed KPIs give no KPI Actual; mixed currencies are refused', () => {
    const a = row({ impressions: 2000, revenue: 1 }, { kpi: 'CPM' });
    const b = row({ impressions: 2000, revenue: 1 }, { kpi: 'CTR' });
    expect(totalsOf('io', [a, b], 'INR').kpiActual).toBeNull();
    const sgd: MetricRow = { ...a, currency: 'SGD' };
    expect(() => totalsOf('io', [a, sgd], 'INR')).toThrow();
  });
  it('derives ratios as percent numbers', () => {
    const r = deriveRatios(
      c({ impressions: 200, clicks: 1, measurableImpressions: 100, viewableImpressions: 60 }),
    );
    expect(r.ctr).toBeCloseTo(0.5);
    expect(r.viewabilityPct).toBeCloseTo(60);
  });
});
