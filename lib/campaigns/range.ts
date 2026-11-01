// The `d` list param (routes.md 6.1) to a sim date range for getGridMetrics. Pure. Every preset the list date picker
// offers (Today ... Lifetime, "n days up to today") resolves through `parseDateRangeParam`, the same windows as the
// picker, so the label on the trigger and the numbers in the grid always cover the same days.
import { parseDateRangeParam } from '@/lib/metrics/date-range';
import type { DateRange } from '@/lib/metrics/grid-metrics';

const DAY_MS = 86_400_000;

function shift(iso: string, days: number): string {
  return new Date(Date.parse(`${iso}T00:00:00Z`) + days * DAY_MS).toISOString().slice(0, 10);
}

/** The grid default when the URL has no (valid) `d`: the last 7 days up to the sim today. */
export function defaultRange(today: string): DateRange {
  return { from: shift(today, -6), to: today };
}

/** `d` form of a range: `YYYYMMDD:YYYYMMDD`. */
export function compactRange(r: DateRange): string {
  return `${r.from.replaceAll('-', '')}:${r.to.replaceAll('-', '')}`;
}

/** Unknown or missing tokens give the grid default, the last 7 days up to today. */
export function rangeFromParam(d: string | null | undefined, today: string): DateRange {
  if (!d) return defaultRange(today);
  try {
    return parseDateRangeParam(d, today);
  } catch {
    return defaultRange(today);
  }
}
