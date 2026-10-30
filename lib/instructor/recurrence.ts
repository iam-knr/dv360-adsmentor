import { TZDate } from '@date-fns/tz';
import { InstructorError, MAX_SERIES } from './rules';

// Pure window arithmetic. Dates are local calendar dates in the class time zone ("YYYY-MM-DD"), times "HH:mm".
// Everything stored is UTC; the zone is applied here and nowhere else, so DST edges are handled in one place.
export const WEEKDAYS = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'] as const;
export type Weekday = (typeof WEEKDAYS)[number];

const DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const TIME = /^([01]\d|2[0-3]):([0-5]\d)$/;

export interface Occurrence {
  opensAt: Date;
  closesAt: Date;
}

/** 2026-13-40 and 2026-02-30 are not dates; Date would roll them over silently. */
function isRealDate(y: number, m: number, day: number): boolean {
  const c = new Date(Date.UTC(y, m - 1, day));
  return c.getUTCFullYear() === y && c.getUTCMonth() === m - 1 && c.getUTCDate() === day;
}

export function localToUtc(date: string, time: string, timeZone: string): Date {
  const d = DATE.exec(date);
  const t = TIME.exec(time);
  if (!d || !t || !isRealDate(+d[1]!, +d[2]!, +d[3]!)) throw new InstructorError('SIM-017');
  const at = new TZDate(+d[1]!, +d[2]! - 1, +d[3]!, +t[1]!, +t[2]!, 0, timeZone);
  if (Number.isNaN(at.getTime())) throw new InstructorError('SIM-017');
  return new Date(at.getTime());
}

/** Weekday of a calendar date, independent of any zone. */
export function weekdayOf(date: string): Weekday {
  const d = DATE.exec(date);
  if (!d || !isRealDate(+d[1]!, +d[2]!, +d[3]!)) throw new InstructorError('SIM-017');
  return WEEKDAYS[new Date(Date.UTC(+d[1]!, +d[2]! - 1, +d[3]!)).getUTCDay()]!;
}

export function addDaysTo(date: string, days: number): string {
  const d = DATE.exec(date);
  if (!d) throw new InstructorError('SIM-017');
  return new Date(Date.UTC(+d[1]!, +d[2]! - 1, +d[3]! + days)).toISOString().slice(0, 10);
}

/** Local calendar date of an instant in a zone. */
export function localDateOf(at: Date, timeZone: string): string {
  const z = new TZDate(at.getTime(), timeZone);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${z.getFullYear()}-${p(z.getMonth() + 1)}-${p(z.getDate())}`;
}

export function localTimeOf(at: Date, timeZone: string): string {
  const z = new TZDate(at.getTime(), timeZone);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(z.getHours())}:${p(z.getMinutes())}`;
}

export function singleOccurrence(
  date: string,
  startTime: string,
  endTime: string,
  timeZone: string,
): Occurrence {
  const opensAt = localToUtc(date, startTime, timeZone);
  const closesAt = localToUtc(date, endTime, timeZone);
  if (closesAt.getTime() <= opensAt.getTime()) throw new InstructorError('SIM-005');
  return { opensAt, closesAt };
}

export interface WeeklyRepeat {
  byDay: Weekday[];
  /** Last local date, inclusive. */
  until: string;
}

/**
 * Every matching weekday from `firstDate` to `repeat.until`, same local start and end time each day. The first
 * date counts only if its weekday is in `byDay`. More than 26 occurrences is refused (module 18 Δ18-3).
 */
export function weeklyOccurrences(
  firstDate: string,
  startTime: string,
  endTime: string,
  repeat: WeeklyRepeat,
  timeZone: string,
): Occurrence[] {
  if (repeat.byDay.length === 0 || !DATE.test(repeat.until)) throw new InstructorError('SIM-019');
  weekdayOf(repeat.until); // SIM-017 for a date that does not exist
  if (repeat.until < firstDate) throw new InstructorError('SIM-019');
  const wanted = new Set(repeat.byDay);
  const out: Occurrence[] = [];
  for (let date = firstDate, guard = 0; date <= repeat.until && guard < 800; guard++) {
    if (wanted.has(weekdayOf(date))) {
      out.push(singleOccurrence(date, startTime, endTime, timeZone));
      if (out.length > MAX_SERIES) throw new InstructorError('SIM-016');
    }
    date = addDaysTo(date, 1);
  }
  if (out.length === 0) throw new InstructorError('SIM-019');
  return out;
}
