// Helpers for the tick orchestrator: state bootstrapping, day rollover and KPI maths.

import { newLearning } from './bidding';
import type { Params } from './params/schema';
import type { DayRecord, IoState, LiState, SimStateData } from './state';
import type { IoKpi } from './world';

export function ensureLiState(
  state: SimStateData,
  id: string,
  date: string,
  tick: number,
  p: Params,
): LiState {
  let s = state.li[id];
  if (!s) {
    s = {
      today: date,
      spendToday: 0,
      spendYesterday: 0,
      liveTicksToday: 0,
      liveTicksYesterday: 0,
      spentFlight: 0,
      liveTicks: 0,
      learning: newLearning(tick, p),
      lambda: 0,
      lastCapacity: -1,
      lastR: 1,
      lastStatus: 'DRAFT',
      days: [],
      winsLast: 0,
    };
    state.li[id] = s;
  }
  if (s.today !== date) {
    s.spendYesterday = s.spendToday;
    s.liveTicksYesterday = s.liveTicksToday;
    s.spendToday = 0;
    s.liveTicksToday = 0;
    s.today = date;
  }
  return s;
}

export function ensureIoState(
  state: SimStateData,
  id: string,
  date: string,
  tick: number,
): { s: IoState; rolled: boolean } {
  let s = state.io[id];
  let rolled = false;
  if (!s) {
    s = {
      today: date,
      spentToday: 0,
      spentYesterday: 0,
      segSpent: {},
      daily: [],
      activatedTick: tick,
      weights: {},
      eff: {},
      autoWeightsDate: date,
    };
    state.io[id] = s;
  }
  if (s.today !== date) {
    s.daily.push({ date: s.today, spend: s.spentToday });
    if (s.daily.length > 30) s.daily.splice(0, s.daily.length - 30);
    s.spentYesterday = s.spentToday;
    s.spentToday = 0;
    s.today = date;
    rolled = true;
    for (const id2 of Object.keys(s.eff)) {
      const e = s.eff[id2];
      if (e) s.eff[id2] = { events: e.events * (2 / 3), spend: e.spend * (2 / 3) };
    }
  }
  return { s, rolled };
}

/** The record for `date`, creating it and trimming history to 14 days. */
export function dayRecord(s: LiState, date: string): DayRecord {
  const last = s.days[s.days.length - 1];
  if (last && last.date === date) return last;
  const rec: DayRecord = {
    date,
    spend: 0,
    impressions: 0,
    clicks: 0,
    conversions: 0,
    viewable: 0,
    measurable: 0,
    views: 0,
    cost: 0,
  };
  s.days.push(rec);
  if (s.days.length > 14) s.days.splice(0, s.days.length - 14);
  return rec;
}

const LOWER_IS_BETTER = new Set<IoKpi['kind']>(['CPM', 'CPC', 'CPA', 'VCPM', 'CPV']);

/** KPI actual from summed day records, or null below the minimum sample (4.6). */
export function kpiActual(
  kind: IoKpi['kind'],
  d: Omit<DayRecord, 'date'>,
  p: Params,
): number | null {
  const min = p.alerts.minSample;
  switch (kind) {
    case 'CPM':
      return d.impressions >= min.impressions ? (d.spend / d.impressions) * 1000 : null;
    case 'CPC':
      return d.clicks >= min.clicks ? d.spend / d.clicks : null;
    case 'CTR':
      return d.impressions >= min.impressions ? d.clicks / d.impressions : null;
    case 'CPA':
      return d.conversions >= min.conversions ? d.spend / d.conversions : null;
    case 'CVR':
      return d.clicks >= min.clicks ? d.conversions / d.clicks : null;
    case 'VCPM':
      return d.viewable >= min.impressions ? (d.spend / d.viewable) * 1000 : null;
    case 'VIEWABILITY':
      return d.measurable >= min.impressions ? d.viewable / d.measurable : null;
    case 'CPV':
      return d.views >= min.views ? d.spend / d.views : null;
    case 'VTR':
      return d.impressions >= min.impressions ? d.views / d.impressions : null;
  }
}

/** True when the KPI is worse than its goal by more than the underperforming threshold. */
export function worseThanGoal(
  kind: IoKpi['kind'],
  actual: number,
  goal: number,
  pct: number,
): boolean {
  if (goal <= 0) return false;
  return LOWER_IS_BETTER.has(kind)
    ? actual > goal * (1 + pct / 100)
    : actual < goal * (1 - pct / 100);
}

export function sumDays(days: readonly DayRecord[], lastN: number): Omit<DayRecord, 'date'> {
  const out = {
    spend: 0,
    impressions: 0,
    clicks: 0,
    conversions: 0,
    viewable: 0,
    measurable: 0,
    views: 0,
    cost: 0,
  };
  for (const d of days.slice(-lastN)) {
    out.spend += d.spend;
    out.impressions += d.impressions;
    out.clicks += d.clicks;
    out.conversions += d.conversions;
    out.viewable += d.viewable;
    out.measurable += d.measurable;
    out.views += d.views;
    out.cost += d.cost;
  }
  return out;
}
