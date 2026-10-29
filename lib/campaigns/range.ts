// The `d` list param (routes.md 6.1) to a sim date range for getGridMetrics. Pure.
import type { DateRange } from '@/lib/metrics/grid-metrics';

const DAY_MS = 86_400_000;

function shift(iso: string, days: number): string {
  return new Date(Date.parse(`${iso}T00:00:00Z`) + days * DAY_MS).toISOString().slice(0, 10);
}

const fromCompact = (s: string) => `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`;

/** Unknown or missing tokens give the grid default, the last 7 days up to today. */
export function rangeFromParam(d: string | null | undefined, today: string): DateRange {
  const custom = d ? /^(\d{8}):(\d{8})$/.exec(d) : null;
  if (custom) return { from: fromCompact(custom[1] ?? ''), to: fromCompact(custom[2] ?? '') };
  const nd = d ? /^(\d+)D_(TODAY|YESTERDAY)$/.exec(d) : null;
  if (nd) {
    const end = nd[2] === 'TODAY' ? today : shift(today, -1);
    return { from: shift(end, 1 - Number(nd[1])), to: end };
  }
  switch (d) {
    case 'TODAY':
      return { from: today, to: today };
    case 'YESTERDAY':
      return { from: shift(today, -1), to: shift(today, -1) };
    case 'LAST_14_DAYS':
      return { from: shift(today, -14), to: shift(today, -1) };
    case 'LAST_30_DAYS':
      return { from: shift(today, -30), to: shift(today, -1) };
    case 'THIS_MONTH':
    case 'MONTH_TO_DATE':
      return { from: `${today.slice(0, 8)}01`, to: today };
    case 'LIFETIME':
    case 'LAST_2_YEARS':
      return { from: shift(today, -730), to: today };
    default:
      return { from: shift(today, -6), to: today };
  }
}
