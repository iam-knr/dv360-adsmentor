// Daily targets and hourly allowances (engine.md 7.3 and the worked examples there).

import type { Params } from '../params/schema';

export type PacingKind =
  'FLIGHT_EVEN' | 'FLIGHT_AHEAD' | 'FLIGHT_ASAP' | 'DAILY_EVEN' | 'DAILY_ASAP';

/** Valid combinations are Flight x (Ahead, Even, ASAP) and Daily x (Even, ASAP); Daily Ahead acts as Even. */
export function pacingKind(
  period: 'FLIGHT' | 'DAILY',
  type: 'AHEAD' | 'EVEN' | 'ASAP',
): PacingKind {
  if (period === 'DAILY') return type === 'ASAP' ? 'DAILY_ASAP' : 'DAILY_EVEN';
  return type === 'ASAP' ? 'FLIGHT_ASAP' : type === 'AHEAD' ? 'FLIGHT_AHEAD' : 'FLIGHT_EVEN';
}

/**
 * Daily target `T` from the remaining budget `R` at the start of the day and the remaining days `D`
 * including today.
 */
export function dailyTarget(
  kind: PacingKind,
  R: number,
  D: number,
  dailyAmount: number | undefined,
  p: Params,
): number {
  const days = Math.max(1, D);
  switch (kind) {
    case 'FLIGHT_EVEN':
      return R / days;
    case 'FLIGHT_AHEAD':
      return days <= 1
        ? R
        : Math.min(
            R / Math.max(1, days * (1 - p.pacing.aheadFactor)),
            (p.pacing.aheadMaxDailyMultiple * R) / days,
          );
    case 'FLIGHT_ASAP':
      return R;
    case 'DAILY_EVEN':
    case 'DAILY_ASAP':
      return Math.min(dailyAmount ?? R, R);
  }
}

/** Spendable amount for this hour; Infinity when the kind is not paced inside the day. */
export function hourlyAllowance(
  kind: PacingKind,
  T: number,
  spentToday: number,
  hoursLeft: number,
): number {
  const rest = Math.max(0, T - spentToday);
  if (kind === 'FLIGHT_ASAP' || kind === 'DAILY_ASAP') return Infinity;
  return rest / Math.max(1, hoursLeft);
}

/** Underpacing classification of one budget segment (engine.md 7.6). */
export interface UnderpacingInput {
  segmentBudget: number;
  spentToDate: number;
  /** Days since the segment started or the IO was activated, whichever is later (fractional). */
  elapsedDays: number;
  remainingDays: number;
  /** Total segment length in days. */
  segmentDays: number;
  /** Spend over the last `rateWindowDays` days. */
  recentSpend: number;
  thresholdPct: number;
}

export interface UnderpacingResult {
  evaluated: boolean;
  projected: number;
  pacingPct: number;
  underpacing: boolean;
  budgetAtRisk: number;
  likelyToSpend: boolean;
  overpacing: boolean;
}

export function evaluateUnderpacing(i: UnderpacingInput, p: Params): UnderpacingResult {
  const minDays = p.pacing.underpacing.minHoursSinceSegmentStart / 24;
  const elapsed = Math.max(1, i.elapsedDays);
  const window = Math.min(p.pacing.underpacing.rateWindowDays, elapsed);
  const recentRate = i.recentSpend / window;
  const projected = i.spentToDate + Math.max(0, i.remainingDays) * recentRate;
  const elapsedFraction = i.segmentDays > 0 ? Math.min(1, elapsed / i.segmentDays) : 1;
  const pacingPct = i.segmentBudget > 0 ? i.spentToDate / (i.segmentBudget * elapsedFraction) : 1;
  const underpacing =
    i.elapsedDays >= minDays && projected < (i.thresholdPct / 100) * i.segmentBudget;
  return {
    evaluated: i.elapsedDays >= minDays,
    projected,
    pacingPct,
    underpacing,
    budgetAtRisk: Math.max(0, i.segmentBudget - projected),
    likelyToSpend: projected >= i.segmentBudget,
    overpacing: pacingPct > 1.1,
  };
}
