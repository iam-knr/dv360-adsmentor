// Date helpers. Plans use ISO date strings (YYYY-MM-DD) for @db.Date columns and UTC midnights for timestamps.
const DAY_MS = 86_400_000;

export function toDate(iso: string): Date {
  return new Date(`${iso}T00:00:00.000Z`);
}

export function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function addDays(iso: string, days: number): string {
  return isoDate(new Date(toDate(iso).getTime() + days * DAY_MS));
}

/** Whole days from a to b (b - a). */
export function daysBetween(a: string, b: string): number {
  return Math.round((toDate(b).getTime() - toDate(a).getTime()) / DAY_MS);
}

export function maxIso(a: string, b: string): string {
  return a >= b ? a : b;
}

export function minIso(a: string, b: string): string {
  return a <= b ? a : b;
}

/** Every date from start to end, both included. Empty when end is before start. */
export function eachDay(start: string, end: string): string[] {
  const out: string[] = [];
  for (let d = start; d <= end; d = addDays(d, 1)) out.push(d);
  return out;
}

export function weekday(iso: string): number {
  return toDate(iso).getUTCDay();
}
