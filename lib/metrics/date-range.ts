// `d` query param (routes.md 6.1) to a concrete sim-date range. "Today" is the sim clock in the advertiser time zone,
// never the wall clock (RT R9). The preset windows mirror `resolvePreset` in components/dv/date-presets.ts (lib may
// not import components, build-plan 2.4); tests/metrics/date-range.test.ts checks both give the same days.
import { TZDate } from '@date-fns/tz';
import { format } from 'date-fns';
import type { DateRange } from './types';

export type PresetToken =
  | 'TODAY'
  | 'YESTERDAY'
  | 'THIS_WEEK'
  | 'LAST_WEEK'
  | 'LAST_7_DAYS'
  | 'LAST_14_DAYS'
  | 'LAST_30_DAYS'
  | 'THIS_MONTH'
  | 'LAST_MONTH'
  | 'MONTH_TO_DATE'
  | 'QUARTER_TO_DATE'
  | 'YEAR_TO_DATE'
  | 'LAST_2_YEARS'
  | 'LIFETIME';

/** Token to the `DatePresetId` of `DvDateRange`. */
export const TOKEN_TO_PRESET: Record<PresetToken, string> = {
  TODAY: 'today',
  YESTERDAY: 'yesterday',
  THIS_WEEK: 'thisWeek',
  LAST_WEEK: 'lastWeek',
  LAST_7_DAYS: 'last7',
  LAST_14_DAYS: 'last14',
  LAST_30_DAYS: 'last30',
  THIS_MONTH: 'thisMonth',
  LAST_MONTH: 'lastMonth',
  MONTH_TO_DATE: 'monthToDate',
  QUARTER_TO_DATE: 'quarterToDate',
  YEAR_TO_DATE: 'yearToDate',
  LAST_2_YEARS: 'last2Years',
  LIFETIME: 'lifetime',
};

export const DEFAULT_LIST_RANGE = 'YESTERDAY';
export const LIFETIME_START = '2000-01-01';

export class DateRangeParamError extends Error {
  constructor(value: string) {
    super(`Invalid date range: ${value}`);
    this.name = 'DateRangeParamError';
  }
}

/** Sim date (YYYY-MM-DD) of an instant in a time zone. */
export function simDateIn(simNow: Date, timeZone: string): string {
  return format(new TZDate(simNow.getTime(), timeZone), 'yyyy-MM-dd');
}

// Calendar arithmetic on YYYY-MM-DD strings in UTC, so the host time zone never moves a day.
const toUtc = (iso: string) => new Date(`${iso}T00:00:00Z`);
const toIso = (d: Date) => d.toISOString().slice(0, 10);

export function addDaysIso(iso: string, n: number): string {
  const d = toUtc(iso);
  d.setUTCDate(d.getUTCDate() + n);
  return toIso(d);
}

export function eachDayIso(range: DateRange): string[] {
  const out: string[] = [];
  for (let d = range.from; d <= range.to; d = addDaysIso(d, 1)) out.push(d);
  return out;
}

function isValidIso(iso: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(iso) && toIso(toUtc(iso)) === iso;
}

const ym = (iso: string) => ({ y: Number(iso.slice(0, 4)), m: Number(iso.slice(5, 7)) });
const ymd = (y: number, m: number, d: number) => toIso(new Date(Date.UTC(y, m - 1, d)));
const weekday = (iso: string) => toUtc(iso).getUTCDay(); // 0 = Sunday

/** Same windows as `resolvePreset` (weeks Sunday to Saturday; "Last n days" end yesterday). */
export function resolveToken(
  token: PresetToken,
  today: string,
  lifetimeStart = LIFETIME_START,
): DateRange {
  const yesterday = addDaysIso(today, -1);
  const { y, m } = ym(today);
  switch (token) {
    case 'TODAY':
      return { from: today, to: today };
    case 'YESTERDAY':
      return { from: yesterday, to: yesterday };
    case 'THIS_WEEK':
      return { from: addDaysIso(today, -weekday(today)), to: today };
    case 'LAST_WEEK': {
      const sunday = addDaysIso(today, -weekday(today));
      return { from: addDaysIso(sunday, -7), to: addDaysIso(sunday, -1) };
    }
    case 'LAST_7_DAYS':
      return { from: addDaysIso(yesterday, -6), to: yesterday };
    case 'LAST_14_DAYS':
      return { from: addDaysIso(yesterday, -13), to: yesterday };
    case 'LAST_30_DAYS':
      return { from: addDaysIso(yesterday, -29), to: yesterday };
    case 'THIS_MONTH':
    case 'MONTH_TO_DATE':
      return { from: ymd(y, m, 1), to: today };
    case 'LAST_MONTH':
      return { from: ymd(y, m - 1, 1), to: ymd(y, m, 0) };
    case 'QUARTER_TO_DATE':
      return { from: ymd(y, Math.floor((m - 1) / 3) * 3 + 1, 1), to: today };
    case 'YEAR_TO_DATE':
      return { from: ymd(y, 1, 1), to: today };
    case 'LAST_2_YEARS': {
      // date-fns subYears clamps Feb 29 to Feb 28
      const day = Math.min(Number(today.slice(8, 10)), Number(ymd(y - 2, m + 1, 0).slice(8, 10)));
      return { from: addDaysIso(ymd(y - 2, m, day), 1), to: today };
    }
    case 'LIFETIME':
      return { from: lifetimeStart, to: today };
  }
}

/**
 * Parse a `d` value: `YYYYMMDD:YYYYMMDD`, a preset token, `{n}D_TODAY` or `{n}D_YESTERDAY`. Empty means the list
 * default `YESTERDAY`. Throws `DateRangeParamError` for anything else (and for from > to).
 */
export function parseDateRangeParam(
  value: string | null | undefined,
  today: string,
  lifetimeStart = LIFETIME_START,
): DateRange {
  const raw = (value ?? '').trim().toUpperCase() || DEFAULT_LIST_RANGE;
  const explicit = /^(\d{4})(\d{2})(\d{2}):(\d{4})(\d{2})(\d{2})$/.exec(raw);
  if (explicit) {
    const from = `${explicit[1]}-${explicit[2]}-${explicit[3]}`;
    const to = `${explicit[4]}-${explicit[5]}-${explicit[6]}`;
    if (!isValidIso(from) || !isValidIso(to) || from > to) throw new DateRangeParamError(raw);
    return { from, to };
  }
  const nDays = /^(\d{1,4})D_(TODAY|YESTERDAY)$/.exec(raw);
  if (nDays) {
    const n = Math.max(1, Number(nDays[1]));
    const end = nDays[2] === 'TODAY' ? today : addDaysIso(today, -1);
    return { from: addDaysIso(end, -(n - 1)), to: end };
  }
  if (raw in TOKEN_TO_PRESET) return resolveToken(raw as PresetToken, today, lifetimeStart);
  throw new DateRangeParamError(raw);
}
