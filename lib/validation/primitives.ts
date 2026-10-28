// Shared primitives (GEN-001..GEN-010, validation.md 2.1). Pure helpers that never read the clock or a random source.
import type { Num, ValidationContext } from './types';

export function isBlank(value: unknown): boolean {
  if (value === null || value === undefined) return true;
  if (typeof value === 'string') return value.trim().length === 0;
  return false;
}

/** True for null, undefined, '' and whitespace. A number (even 0) is not empty. */
export function isEmptyNum(value: Num): boolean {
  if (value === null || value === undefined) return true;
  return typeof value === 'string' && value.trim().length === 0;
}

/** The number in a form value, or null when it is empty or not numeric. */
export function toNum(value: Num): number | null {
  if (isEmptyNum(value)) return null;
  const n = typeof value === 'number' ? value : Number(String(value).trim());
  return Number.isFinite(n) ? n : null;
}

/** GEN-001. */
export function required(value: unknown): boolean {
  return !isBlank(value);
}

/** GEN-002: a number greater than 0. */
export function positive(value: Num): boolean {
  const n = toNum(value);
  return n !== null && n > 0;
}

/** GEN-003: a number greater than `min`. */
export function larger(value: Num, min: number): boolean {
  const n = toNum(value);
  return n !== null && n > min;
}

/** Characters as Unicode code points, so an emoji counts once (GEN-004). */
export function codePointLength(value: string): number {
  let count = 0;
  for (const _ of value) count += 1;
  return count;
}

/** GEN-004: true when the text fits. */
export function maxLen(value: string | null | undefined, max: number): boolean {
  return codePointLength(value ?? '') <= max;
}

/** UTF-8 byte length, for fields limited in bytes (integration code). */
export function byteLength(value: string): number {
  return new TextEncoder().encode(value).length;
}

/** GEN-006: `http(s)://host...` within the length limit. */
export function isUrl(value: string, maxLength = 1024): boolean {
  if (value.length > maxLength) return false;
  if (!/^https?:\/\/[^\s/?#]+/i.test(value)) return false;
  try {
    const url = new URL(value);
    return (url.protocol === 'http:' || url.protocol === 'https:') && url.hostname.length > 0;
  } catch {
    return false;
  }
}

/** GEN-007: a whole number. */
export function isWhole(value: Num): boolean {
  const n = toNum(value);
  return n !== null && Number.isInteger(n);
}

/** GEN-009: a percentage between 0 and 100. */
export function pct(value: Num): boolean {
  const n = toNum(value);
  return n !== null && n >= 0 && n <= 100;
}

/** GEN-010: 0 or greater. */
export function nonNegative(value: Num): boolean {
  const n = toNum(value);
  return n !== null && n >= 0;
}

// ---------------------------------------------------------------------------------------------
// Dates. Date-only values are ISO strings `YYYY-MM-DD`; they compare as text.
// ---------------------------------------------------------------------------------------------

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export function isIsoDate(value: string | null | undefined): value is string {
  if (!value || !ISO_DATE.test(value)) return false;
  const [y, m, d] = value.split('-').map(Number) as [number, number, number];
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
}

/** GEN-008: `end >= start`. Missing or invalid dates pass (another rule reports them). */
export function dateRange(start: string | null | undefined, end: string | null | undefined): boolean {
  if (!isIsoDate(start) || !isIsoDate(end)) return true;
  return end >= start;
}

/** "Today" in the advertiser time zone as `YYYY-MM-DD`. Time comes from the context, never from the clock. */
export function todayIn(now: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  const get = (type: string): string => parts.find((p) => p.type === type)?.value ?? '';
  return `${get('year')}-${get('month')}-${get('day')}`;
}

export function today(ctx: ValidationContext): string {
  return todayIn(ctx.now, ctx.advertiser.timeZone);
}

/** True when two inclusive date ranges share a day. */
export function rangesOverlap(
  a: { start: string; end: string },
  b: { start: string; end: string },
): boolean {
  return a.start <= b.end && b.start <= a.end;
}
