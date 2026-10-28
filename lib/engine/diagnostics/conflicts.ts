// Conflicting-settings rules (engine.md 3.8). A subset that needs only entity data and params.

import type { Params } from '../params/schema';
import { activeSegment, remainingDays } from '../pacing/budgetState';
import { formatsForType } from '../types';
import type { IoEntity, LineItemEntity } from '../world';

export type ConflictCode =
  | 'CONF.LI_BUDGETS_BELOW_IO'
  | 'CONF.LI_FLIGHT_OUTSIDE_IO'
  | 'CONF.DAILY_CAP_TOO_LOW'
  | 'CONF.ASAP_VS_AUTOMATION'
  | 'CONF.TARGET_ZERO_OVERLAP'
  | 'CONF.BID_BELOW_FLOOR'
  | 'CONF.TARGET_CPA_UNREALISTIC'
  | 'CONF.NO_CONVERSION_ACTIVITY';

export function conflictsForLi(
  li: LineItemEntity,
  io: IoEntity | undefined,
  params: Params,
  today: string,
  enabledExchanges: readonly string[],
): ConflictCode[] {
  const out: ConflictCode[] = [];
  if (io && li.flight) {
    const overlap = io.segments.some(
      (s) => li.flight && li.flight.start <= s.endDay && li.flight.end >= s.startDay,
    );
    if (!overlap) out.push('CONF.LI_FLIGHT_OUTSIDE_IO');
  }
  if (io?.bidBudgetControl === 'IO_AUTOMATED' && li.pacing.type !== 'ASAP')
    out.push('CONF.ASAP_VS_AUTOMATION');
  const geo = li.targeting.geo;
  if (
    geo?.includeRegions?.length &&
    geo.includeRegions.every((r) => geo.excludeRegions?.includes(r))
  ) {
    out.push('CONF.TARGET_ZERO_OVERLAP');
  }
  const formats = formatsForType(li.type);
  if (li.bid.kind === 'FIXED' && (li.bid.fixedCpm ?? 0) > 0) {
    const f = formats[0];
    const fp = f ? params.formats[f] : undefined;
    if (f && fp) {
      let minP25 = Infinity;
      for (const ex of enabledExchanges) {
        const idx = params.exchanges[ex]?.priceIdx;
        if (idx === undefined || !(params.supply.exchangeShare[f]?.[ex] ?? 0)) continue;
        minP25 = Math.min(minP25, fp.floor.median * idx * Math.exp(-0.6745 * fp.floor.sigma));
      }
      const idxLowest = 0.72; // lowest regional price index of the default market
      if (Number.isFinite(minP25) && (li.bid.fixedCpm as number) < minP25 * idxLowest * 0.8)
        out.push('CONF.BID_BELOW_FLOOR');
    }
  }
  const goal = li.bid.goal;
  const needsActivity =
    goal === 'MAX_CONVERSIONS' ||
    goal === 'TARGET_CPA' ||
    goal === 'MAX_CONVERSION_VALUE' ||
    goal === 'TARGET_ROAS';
  if (li.bid.kind === 'AUTOMATED' && needsActivity && li.floodlight.length === 0)
    out.push('CONF.NO_CONVERSION_ACTIVITY');
  if (li.bid.kind === 'AUTOMATED' && (li.bid.targetValue ?? 0) > 0 && formats[0]) {
    const f = params.formats[formats[0]];
    if (f) {
      const clearCpm = f.clear.median;
      const cpc = clearCpm / (1000 * f.ctr);
      const cpa = cpc / Math.max(f.cvrClick, 1e-6);
      const bench =
        goal === 'TARGET_CPM'
          ? clearCpm
          : goal === 'TARGET_CPC'
            ? cpc
            : goal === 'TARGET_CPA'
              ? cpa
              : 0;
      if (bench > 0 && (li.bid.targetValue as number) < 0.3 * bench)
        out.push('CONF.TARGET_CPA_UNREALISTIC');
    }
  }
  if (li.pacing.period === 'DAILY' && li.pacing.dailyAmount && io) {
    const seg = activeSegment(io.segments, today);
    if (seg && li.budget.mode === 'FIXED' && li.budget.amount) {
      const days = remainingDays(today, seg.endDay);
      if (li.pacing.dailyAmount * days < li.budget.amount * 0.5) out.push('CONF.DAILY_CAP_TOO_LOW');
    }
  }
  return out;
}

/** IO level: sum of fixed line item budgets below the IO budget with no unlimited line item. */
export function conflictsForIo(
  io: IoEntity,
  lis: readonly LineItemEntity[],
  today: string,
): ConflictCode[] {
  const out: ConflictCode[] = [];
  const seg = activeSegment(io.segments, today);
  if (!seg || lis.length === 0) return out;
  const active = lis.filter((l) => l.status === 'ACTIVE');
  if (active.length > 0 && active.every((l) => l.budget.mode === 'FIXED')) {
    const sum = active.reduce((a, l) => a + (l.budget.amount ?? 0), 0);
    if (sum < seg.amount * 0.95) out.push('CONF.LI_BUDGETS_BELOW_IO');
  }
  if (io.pacing.period === 'DAILY' && io.pacing.dailyAmount) {
    const days = remainingDays(today, seg.endDay);
    if (io.pacing.dailyAmount * days < seg.amount * 0.5) out.push('CONF.DAILY_CAP_TOO_LOW');
  }
  return out;
}
