// `d` list param <-> DateRangeValue of the shared date picker. "Today" is always the SIM date passed in, never the
// browser clock. Pure.
import { parseDateRangeParam, TOKEN_TO_PRESET, type PresetToken } from '@/lib/metrics/date-range';
import { formatRange, type DatePresetId, type DateRangeValue } from './date-presets';

const PRESET_TO_TOKEN = Object.fromEntries(
  Object.entries(TOKEN_TO_PRESET).map(([token, preset]) => [preset, token]),
) as Record<string, PresetToken>;

const toDate = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y ?? 1970, (m ?? 1) - 1, d ?? 1);
};
const pad = (n: number) => String(n).padStart(2, '0');
const toIso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

/** Picker value of a `d` param. An unreadable `d` falls back to the last 7 days up to `today`. */
export function valueFromParam(d: string | null | undefined, today: string): DateRangeValue {
  let range: { from: string; to: string };
  try {
    range = parseDateRangeParam(d, today);
  } catch {
    const from = new Date(toDate(today));
    from.setDate(from.getDate() - 6);
    return { start: toDate(toIso(from)), end: toDate(today), preset: 'custom' };
  }
  const raw = (d ?? '').trim().toUpperCase();
  const base = { start: toDate(range.from), end: toDate(range.to) };
  const n = /^(\d{1,4})D_(TODAY|YESTERDAY)$/.exec(raw);
  if (n)
    return {
      ...base,
      preset: n[2] === 'TODAY' ? 'daysToToday' : 'daysToYesterday',
      days: Number(n[1]),
    };
  const preset = TOKEN_TO_PRESET[raw as PresetToken];
  return { ...base, preset: preset ?? 'custom' };
}

/** `d` param of a picker value: a token for presets, `YYYYMMDD:YYYYMMDD` for a custom range. */
export function paramFromValue(v: DateRangeValue): string {
  const id = v.preset as DatePresetId | undefined;
  if (id === 'daysToToday') return `${v.days ?? 30}D_TODAY`;
  if (id === 'daysToYesterday') return `${v.days ?? 30}D_YESTERDAY`;
  const token = id ? PRESET_TO_TOKEN[id] : undefined;
  if (token) return token;
  return `${toIso(v.start).replaceAll('-', '')}:${toIso(v.end).replaceAll('-', '')}`;
}

/** Trigger text of real DV360: the dates, "Oct 31, 2026" or "Oct 25 - 31, 2026". */
export const rangeText = (v: DateRangeValue) => formatRange(v.start, v.end);
