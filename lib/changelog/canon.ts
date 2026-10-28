// Canonical string form of a stored value (data-model 6.3 item 8): enum keys, ISO dates, decimal text, JSON for lists.
import type { FieldKind, FmtCtx } from './registry-types';

function isDecimal(v: unknown): v is { toFixed: (n?: number) => string; toString: () => string } {
  return typeof v === 'object' && v !== null && 'toFixed' in v && 'd' in v && 'e' in v;
}

export function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null';
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${stableStringify(v)}`).join(',')}}`;
}

/** null for null/undefined. Equal values always give equal strings, so the diff compares strings. */
export function canonical(value: unknown, kind: FieldKind, ctx: FmtCtx = {}): string | null {
  if (value === null || value === undefined) return null;
  if (kind === 'bool' || typeof value === 'boolean') return value ? 'true' : 'false';
  if (value instanceof Date) {
    const iso = value.toISOString();
    // calendar dates (Postgres date columns) come back at midnight UTC
    return iso.endsWith('T00:00:00.000Z') ? iso.slice(0, 10) : iso;
  }
  if (kind === 'money') {
    const scale = ctx.moneyScale ?? 2;
    if (isDecimal(value)) return value.toFixed(scale);
    if (typeof value === 'number') return value.toFixed(scale);
    if (typeof value === 'bigint') return value.toString();
    return stableStringify(value);
  }
  if (isDecimal(value)) return value.toString();
  if (typeof value === 'bigint' || typeof value === 'number') return String(value);
  if (typeof value === 'string') return value;
  return stableStringify(value);
}
