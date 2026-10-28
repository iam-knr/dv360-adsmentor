// MX-06 Frequency cap nesting (validation.md 3). Chain: campaign, IO, line item. Pure helpers, no Date.

export const FREQ_PERIODS = ['MINUTE', 'HOUR', 'DAY', 'WEEK', 'MONTH'] as const;
export type FreqPeriod = (typeof FREQ_PERIODS)[number];

/** DM `FrequencyMode` (RC-018). Campaign: UNLIMITED or LIMITED. IO and line item: INHERIT or LIMITED (UNLIMITED is read as INHERIT). */
export const FREQ_MODES = ['UNLIMITED', 'INHERIT', 'LIMITED'] as const;
export type FreqMode = (typeof FREQ_MODES)[number];

/** `MINUTE=1`, `HOUR=60`, `DAY=1440`, `WEEK=10080`, `MONTH=43200` (30 days). */
export const UNIT_MINUTES: Record<FreqPeriod, number> = {
  MINUTE: 1,
  HOUR: 60,
  DAY: 1440,
  WEEK: 10080,
  MONTH: 43200,
};

/** A cap that is fully specified: `n` exposures per `periodCount` units. */
export interface ResolvedCap {
  n: number;
  periodCount: number;
  period: FreqPeriod;
}

export function windowMin(cap: ResolvedCap): number {
  return cap.periodCount * UNIT_MINUTES[cap.period];
}

export function impliedMax(cap: ResolvedCap, windowMinutes: number): number {
  return cap.n * Math.ceil(windowMinutes / windowMin(cap));
}

/** The `low` cap never bites when the `high` cap already allows no more than `low.n` in the same window. */
export function looserThan(low: ResolvedCap, high: ResolvedCap): boolean {
  return impliedMax(high, windowMin(low)) <= low.n;
}

/** The strictest cap: lowest exposures per minute. */
export function strictestCap(caps: readonly ResolvedCap[]): ResolvedCap | null {
  let best: ResolvedCap | null = null;
  for (const cap of caps) {
    if (!best || cap.n / windowMin(cap) < best.n / windowMin(best)) best = cap;
  }
  return best;
}

const UNIT_WORD: Record<FreqPeriod, string> = {
  MINUTE: 'minute',
  HOUR: 'hour',
  DAY: 'day',
  WEEK: 'week',
  MONTH: 'month',
};

/** `week` for a count of 1, `2 weeks` otherwise. Used as `{period}` in the info messages. */
export function periodLabel(cap: ResolvedCap): string {
  const word = UNIT_WORD[cap.period];
  return cap.periodCount === 1 ? word : `${cap.periodCount} ${word}s`;
}
