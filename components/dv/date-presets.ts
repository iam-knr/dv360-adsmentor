import {
  addDays,
  endOfMonth,
  format,
  isSameDay,
  isSameMonth,
  isSameYear,
  startOfDay,
  startOfMonth,
  startOfQuarter,
  startOfWeek,
  startOfYear,
  subDays,
  subMonths,
  subYears,
} from 'date-fns';

export type DatePresetId =
  | 'custom'
  | 'today'
  | 'yesterday'
  | 'thisWeek'
  | 'last7'
  | 'lastWeek'
  | 'last14'
  | 'thisMonth'
  | 'last30'
  | 'lastMonth'
  | 'monthToDate'
  | 'quarterToDate'
  | 'yearToDate'
  | 'last2Years'
  | 'lifetime'
  | 'daysToToday'
  | 'daysToYesterday';

export interface DateRangeValue {
  start: Date;
  end: Date;
  /** A `DatePresetId`. Absent or `custom` shows the formatted range. */
  preset?: string;
  /** Number of days for `daysToToday` and `daysToYesterday`. Default 30. */
  days?: number;
}

/** Two preset sets (RC-051, design-system Q15). Orders from explore 02 and 16. */
export const PRESET_SETS = {
  grid: [
    'custom',
    'today',
    'yesterday',
    'last7',
    'last14',
    'last30',
    'monthToDate',
    'quarterToDate',
    'yearToDate',
    'lifetime',
    'daysToToday',
    'daysToYesterday',
  ],
  history: [
    'custom',
    'today',
    'yesterday',
    'thisWeek',
    'last7',
    'lastWeek',
    'last14',
    'thisMonth',
    'last30',
    'lastMonth',
    'last2Years',
    'daysToToday',
    'daysToYesterday',
  ],
} as const satisfies Record<string, readonly DatePresetId[]>;

export type DatePresetSet = keyof typeof PRESET_SETS;

/** Row labels in the preset list. `[n]` is replaced by the editable number field. */
export const PRESET_ROW_LABELS: Record<DatePresetId, string> = {
  custom: 'Custom',
  today: 'Today',
  yesterday: 'Yesterday',
  thisWeek: 'This week (Sun - Today)',
  last7: 'Last 7 days',
  lastWeek: 'Last week (Sun - Sat)',
  last14: 'Last 14 days',
  thisMonth: 'This month',
  last30: 'Last 30 days',
  lastMonth: 'Last month',
  monthToDate: 'Month to date',
  quarterToDate: 'Quarter to date',
  yearToDate: 'Year to date',
  last2Years: 'Last 2 years',
  lifetime: 'Lifetime',
  daysToToday: '[n] days up to today',
  daysToYesterday: '[n] days up to yesterday',
};

/** Labels on the trigger button. */
const TRIGGER_LABELS: Partial<Record<DatePresetId, string>> = {
  today: 'Today',
  yesterday: 'Yesterday',
  thisWeek: 'This week',
  last7: 'Last 7 days',
  lastWeek: 'Last week',
  last14: 'Last 14 days',
  thisMonth: 'This month',
  last30: 'Last 30 days',
  lastMonth: 'Last month',
  monthToDate: 'Month to date',
  quarterToDate: 'Quarter to date',
  yearToDate: 'Year to date',
  last2Years: 'Last 2 years',
  lifetime: 'Lifetime',
};

export const DEFAULT_LIFETIME_START = new Date(2000, 0, 1);

function clampEnd(end: Date, today: Date): Date {
  return end > today ? today : end;
}

/**
 * Resolve a preset to a concrete range. `today` is the simulator clock, never the wall clock.
 * Weeks run Sunday to Saturday. Windows such as "Last 7 days" end yesterday, "n days up to
 * today" ends today (assumed boundaries, listed under Deviations in the P3-04 PR).
 */
export function resolvePreset(
  id: DatePresetId,
  todayInput: Date,
  days = 30,
  lifetimeStart: Date = DEFAULT_LIFETIME_START,
): { start: Date; end: Date } {
  const today = startOfDay(todayInput);
  const yesterday = subDays(today, 1);
  const n = Math.max(1, Math.floor(days));
  switch (id) {
    case 'today':
      return { start: today, end: today };
    case 'yesterday':
      return { start: yesterday, end: yesterday };
    case 'thisWeek':
      return { start: startOfWeek(today, { weekStartsOn: 0 }), end: today };
    case 'last7':
      return { start: subDays(yesterday, 6), end: yesterday };
    case 'lastWeek': {
      const thisSunday = startOfWeek(today, { weekStartsOn: 0 });
      return { start: subDays(thisSunday, 7), end: subDays(thisSunday, 1) };
    }
    case 'last14':
      return { start: subDays(yesterday, 13), end: yesterday };
    case 'thisMonth':
      return { start: startOfMonth(today), end: clampEnd(startOfDay(endOfMonth(today)), today) };
    case 'last30':
      return { start: subDays(yesterday, 29), end: yesterday };
    case 'lastMonth': {
      const prev = subMonths(today, 1);
      return { start: startOfMonth(prev), end: startOfDay(endOfMonth(prev)) };
    }
    case 'monthToDate':
      return { start: startOfMonth(today), end: today };
    case 'quarterToDate':
      return { start: startOfQuarter(today), end: today };
    case 'yearToDate':
      return { start: startOfYear(today), end: today };
    case 'last2Years':
      return { start: addDays(subYears(today, 2), 1), end: today };
    case 'lifetime':
      return { start: startOfDay(lifetimeStart), end: today };
    case 'daysToToday':
      return { start: subDays(today, n - 1), end: today };
    case 'daysToYesterday':
      return { start: subDays(yesterday, n - 1), end: yesterday };
    case 'custom':
    default:
      return { start: today, end: today };
  }
}

/** "Oct 21 - 27, 2026", "Oct 21 - Nov 3, 2026", "Dec 28, 2025 - Jan 3, 2026", "Oct 21, 2026". */
export function formatRange(start: Date, end: Date): string {
  if (isSameDay(start, end)) return format(start, 'MMM d, yyyy');
  if (isSameMonth(start, end)) return `${format(start, 'MMM d')} - ${format(end, 'd, yyyy')}`;
  if (isSameYear(start, end)) return `${format(start, 'MMM d')} - ${format(end, 'MMM d, yyyy')}`;
  return `${format(start, 'MMM d, yyyy')} - ${format(end, 'MMM d, yyyy')}`;
}

/** Trigger label: "Yesterday", "Oct 21 - 27, 2026", "90 days to today". */
export function triggerLabel(value: DateRangeValue): string {
  const id = value.preset as DatePresetId | undefined;
  if (id === 'daysToToday') return `${value.days ?? 30} days to today`;
  if (id === 'daysToYesterday') return `${value.days ?? 30} days to yesterday`;
  const named = id ? TRIGGER_LABELS[id] : undefined;
  return named ?? formatRange(value.start, value.end);
}

/** Parse `yyyy-mm-dd`. Returns null for anything else, including impossible dates. */
export function parseIsoDate(text: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text.trim());
  if (!m) return null;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const date = new Date(y, mo - 1, d);
  return date.getFullYear() === y && date.getMonth() === mo - 1 && date.getDate() === d
    ? date
    : null;
}

export function formatIsoDate(date: Date): string {
  return format(date, 'yyyy-MM-dd');
}
