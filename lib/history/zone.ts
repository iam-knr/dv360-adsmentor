// Time zone helpers of the History page (module 05 4.4, C-05-6). `Intl` short names give "GMT+5:30" for India, the demo
// shows "IST", so a map of common zones comes first and `GMT+h:mm` is the fallback. Pure.
import { TZDate } from '@date-fns/tz';
import { format } from 'date-fns';

/** [standard, daylight] abbreviations. 25 zones; others fall back to `GMT+h:mm`. */
const ZONE_LABELS: Record<string, readonly [string, string?]> = {
  'Asia/Calcutta': ['IST'],
  'Asia/Kolkata': ['IST'],
  UTC: ['UTC'],
  'Etc/UTC': ['UTC'],
  'America/New_York': ['EST', 'EDT'],
  'America/Chicago': ['CST', 'CDT'],
  'America/Denver': ['MST', 'MDT'],
  'America/Phoenix': ['MST'],
  'America/Los_Angeles': ['PST', 'PDT'],
  'America/Anchorage': ['AKST', 'AKDT'],
  'Pacific/Honolulu': ['HST'],
  'Europe/London': ['GMT', 'BST'],
  'Europe/Dublin': ['GMT', 'IST'],
  'Europe/Paris': ['CET', 'CEST'],
  'Europe/Berlin': ['CET', 'CEST'],
  'Europe/Madrid': ['CET', 'CEST'],
  'Europe/Rome': ['CET', 'CEST'],
  'Europe/Amsterdam': ['CET', 'CEST'],
  'Europe/Moscow': ['MSK'],
  'Asia/Dubai': ['GST'],
  'Asia/Singapore': ['SGT'],
  'Asia/Tokyo': ['JST'],
  'Asia/Hong_Kong': ['HKT'],
  'Australia/Sydney': ['AEST', 'AEDT'],
  'Pacific/Auckland': ['NZST', 'NZDT'],
};

/** Offset from UTC in minutes of `zone` at `at`. */
export function offsetMinutes(zone: string, at: Date): number {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: zone, timeZoneName: 'longOffset' }).formatToParts(at);
  const name = parts.find((p) => p.type === 'timeZoneName')?.value ?? 'GMT';
  const m = /GMT([+-])(\d{1,2})(?::(\d{2}))?/.exec(name);
  if (!m) return 0;
  const minutes = Number(m[2]) * 60 + Number(m[3] ?? 0);
  return m[1] === '-' ? -minutes : minutes;
}

/** "IST", "EDT", or `GMT+h:mm` for a zone that is not in the map. */
export function formatZoneLabel(zone: string, at: Date = new Date()): string {
  const entry = ZONE_LABELS[zone];
  if (entry) {
    const [standard, daylight] = entry;
    if (!daylight) return standard;
    const year = at.getUTCFullYear();
    const base = Math.min(
      offsetMinutes(zone, new Date(Date.UTC(year, 0, 1))),
      offsetMinutes(zone, new Date(Date.UTC(year, 6, 1))),
    );
    return offsetMinutes(zone, at) > base ? daylight : standard;
  }
  const off = offsetMinutes(zone, at);
  if (off === 0) return 'GMT';
  const abs = Math.abs(off);
  return `GMT${off < 0 ? '-' : '+'}${Math.floor(abs / 60)}:${String(abs % 60).padStart(2, '0')}`;
}

/** Calendar day (YYYY-MM-DD) of an instant in a zone. Day cards and year headings bucket by this. */
export function dayIn(zone: string, at: Date): string {
  return format(new TZDate(at.getTime(), zone), 'yyyy-MM-dd');
}

/** Wall clock time HH:mm:ss of an instant in a zone. */
export function timeIn(zone: string, at: Date): string {
  return format(new TZDate(at.getTime(), zone), 'HH:mm:ss');
}

/** First instant of a calendar day in a zone. */
export function startOfDayIn(zone: string, day: string): Date {
  const [y, m, d] = day.split('-').map(Number) as [number, number, number];
  return new Date(new TZDate(y, m - 1, d, 0, 0, 0, zone).getTime());
}

/** Last millisecond of a calendar day in a zone. */
export function endOfDayIn(zone: string, day: string): Date {
  const [y, m, d] = day.split('-').map(Number) as [number, number, number];
  return new Date(new TZDate(y, m - 1, d + 1, 0, 0, 0, zone).getTime() - 1);
}

/** True for a name the runtime knows. The `zone` query param comes from the browser, never trusted. */
export function isKnownZone(zone: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: zone });
    return true;
  } catch {
    return false;
  }
}

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "Wednesday" for a YYYY-MM-DD calendar day. */
export function weekdayOf(day: string): string {
  return WEEKDAYS[new Date(`${day}T00:00:00Z`).getUTCDay()] ?? '';
}

/** "Mar 26" for a YYYY-MM-DD calendar day. */
export function monthDay(day: string): string {
  return `${MONTHS[Number(day.slice(5, 7)) - 1] ?? ''} ${Number(day.slice(8, 10))}`;
}

/** "Mar 26, 2026". */
export function longDate(day: string): string {
  return `${monthDay(day)}, ${day.slice(0, 4)}`;
}
