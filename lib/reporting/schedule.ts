// Schedules on the sim clock (module 16 4.5). Pure: `occurrences` lists the run instants of a schedule between two sim
// instants; the engine hook (`runDueReports`) and the save action (`nextRunSimAt`) both use it.
import { TZDate } from '@date-fns/tz';
import { addDays, addMonths, addYears } from 'date-fns';
import type { ReportSchedule } from './types';

/** Missed occurrences generated per report after a fast-forward (4.5). */
export const MAX_CATCH_UP = 10;
/** Safety bound on how many occurrences a single call walks. */
const WALK_LIMIT = 5000;

/** Local calendar date `YYYY-MM-DD` of occurrence number `i`. */
function occurrenceDate(s: ReportSchedule, i: number): string {
  const [y, m, d] = s.starts.split('-').map(Number) as [number, number, number];
  const base = new Date(Date.UTC(y, m - 1, d));
  const step = i * Math.max(1, s.every);
  let out: Date;
  switch (s.repeats) {
    case 'DAILY':
      out = addDays(base, step);
      break;
    case 'WEEKLY':
      out = addDays(base, step * 7);
      break;
    case 'MONTHLY':
      out = addMonths(base, step);
      break;
    case 'QUARTERLY':
      out = addMonths(base, step * 3);
      break;
    case 'YEARLY':
      out = addYears(base, step);
      break;
  }
  return out.toISOString().slice(0, 10);
}

/** 00:00 on `date` in the schedule's time zone, as a UTC instant. */
function localMidnight(date: string, timeZone: string): Date {
  const [y, m, d] = date.split('-').map(Number) as [number, number, number];
  return new Date(new TZDate(y, m - 1, d, 0, 0, 0, timeZone).getTime());
}

/**
 * Run instants `t` with `from < t <= to`, in order. Stops at `expires` (inclusive of that local day) and after
 * `limit` entries. A schedule that is not active has none.
 */
export function occurrences(
  s: ReportSchedule,
  from: Date,
  to: Date,
  limit: number = WALK_LIMIT,
): Date[] {
  if (!s.active || !s.starts) return [];
  const out: Date[] = [];
  for (let i = 0; i < WALK_LIMIT && out.length < limit; i++) {
    const date = occurrenceDate(s, i);
    if (s.expires && date > s.expires) break;
    const at = localMidnight(date, s.timeZone);
    if (at.getTime() > to.getTime()) break;
    if (at.getTime() > from.getTime()) out.push(at);
  }
  return out;
}

/** First occurrence strictly after `after`, or null when the schedule has ended. */
export function nextOccurrence(s: ReportSchedule, after: Date): Date | null {
  if (!s.active || !s.starts) return null;
  for (let i = 0; i < WALK_LIMIT; i++) {
    const date = occurrenceDate(s, i);
    if (s.expires && date > s.expires) return null;
    const at = localMidnight(date, s.timeZone);
    if (at.getTime() > after.getTime()) return at;
  }
  return null;
}

const UNIT: Record<ReportSchedule['repeats'], [string, string]> = {
  DAILY: ['day', 'days'],
  WEEKLY: ['week', 'weeks'],
  MONTHLY: ['month', 'months'],
  QUARTERLY: ['quarter', 'quarters'],
  YEARLY: ['year', 'years'],
};

/** "Runs every day at 12 am in {tz} until {date}" (S4 card 3). */
export function scheduleSummary(
  s: ReportSchedule,
  fmt: { tzLabel?: string; date?: (iso: string) => string } = {},
): string {
  const [one, many] = UNIT[s.repeats];
  const every = s.every === 1 ? `${one}` : `${s.every} ${many}`;
  const tail = s.expires ? ` until ${fmt.date ? fmt.date(s.expires) : s.expires}` : '';
  return `Runs every ${every} at 12 am in ${fmt.tzLabel ?? s.timeZone}${tail}`;
}

/** The sim date a run of occurrence `at` counts as "today" for its relative date range (R9). */
export function occurrenceDay(at: Date, timeZone: string): string {
  const z = new TZDate(at.getTime(), timeZone);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${z.getFullYear()}-${p(z.getMonth() + 1)}-${p(z.getDate())}`;
}
