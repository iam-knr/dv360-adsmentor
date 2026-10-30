// Shared pieces of the SDF value mappers (module 11 4.4): column maps keyed by header name, enum codecs that take
// the UI label (or the stored key), and the status / frequency / pacing vocabularies. Pure and client safe.
import {
  CellError,
  decBool,
  decDate,
  decInt,
  decList,
  decNum,
  encBool,
  encDate,
  encList,
  encNum,
  enumError,
} from './codec';

export interface ColMap<M> {
  /** Cell text for a stored entity. Absent: the column is exported blank and not applied on upload. */
  get?: (m: M) => string;
  /** Apply a cell to the model. Throws `CellError` for a bad value. */
  set?: (m: M, v: string) => void;
}
export type ColMaps<M> = Record<string, ColMap<M>>;

/** Enum codec between stored keys and the labels shown in the UI. Unknown labels raise BLK-031. */
export function enumCodec<K extends string>(labels: Record<K, string>, column: string) {
  const byLabel = new Map(
    (Object.entries(labels) as [K, string][]).flatMap(([k, l]) => [
      [l.toLowerCase(), k] as const,
      [k.toLowerCase(), k] as const,
    ]),
  );
  return {
    enc: (k: K | null | undefined): string => (k ? (labels[k] ?? '') : ''),
    dec: (s: string): K | null => {
      const v = s.trim();
      if (v === '') return null;
      const k = byLabel.get(v.toLowerCase());
      if (!k) throw enumError(v, column);
      return k;
    },
  };
}

export const STATUS_LABEL = {
  DRAFT: 'Draft',
  ACTIVE: 'Active',
  PAUSED: 'Paused',
  ARCHIVED: 'Archived',
} as const;
export const FREQ_PERIOD_LABEL = {
  MINUTE: 'Minute',
  HOUR: 'Hour',
  DAY: 'Day',
  WEEK: 'Week',
  MONTH: 'Month',
} as const;
export const PACING_PERIOD_LABEL = { FLIGHT: 'Flight', DAILY: 'Daily' } as const;
export const PACING_TYPE_LABEL = { EVEN: 'Even', AHEAD: 'Ahead', ASAP: 'ASAP' } as const;
export const BUDGET_UNIT_LABEL = { CURRENCY: 'Currency', IMPRESSIONS: 'Impressions' } as const;

export const text = <M>(
  get: (m: M) => string | null | undefined,
  set?: (m: M, v: string) => void,
): ColMap<M> => ({
  get: (m) => get(m) ?? '',
  ...(set ? { set } : {}),
});
export const bool = <M>(
  get: (m: M) => boolean | null | undefined,
  set?: (m: M, v: boolean | null) => void,
): ColMap<M> => ({
  get: (m) => encBool(get(m)),
  ...(set ? { set: (m, v) => set(m, decBool(v)) } : {}),
});
export const date = <M>(
  get: (m: M) => string | null | undefined,
  set?: (m: M, v: string | null) => void,
): ColMap<M> => ({
  get: (m) => encDate(get(m)),
  ...(set ? { set: (m, v) => set(m, decDate(v)) } : {}),
});
export const money = <M>(
  get: (m: M) => number | string | null | undefined,
  set?: (m: M, v: number | null) => void,
  decimals = 2,
): ColMap<M> => ({
  get: (m) => encNum(get(m), decimals),
  ...(set ? { set: (m, v) => set(m, decNum(v)) } : {}),
});
export const int = <M>(
  get: (m: M) => number | string | null | undefined,
  set?: (m: M, v: number | null) => void,
): ColMap<M> => ({
  get: (m) => encNum(get(m), 0),
  ...(set ? { set: (m, v) => set(m, decInt(v)) } : {}),
});
export const list = <M>(
  get: (m: M) => readonly string[] | null | undefined,
  set?: (m: M, v: string[]) => void,
): ColMap<M> => ({
  get: (m) => encList(get(m)),
  ...(set ? { set: (m, v) => set(m, decList(v)) } : {}),
});
export function enm<M, K extends string>(
  labels: Record<K, string>,
  column: string,
  get: (m: M) => K | null | undefined,
  set?: (m: M, v: K | null) => void,
): ColMap<M> {
  const c = enumCodec(labels, column);
  return { get: (m) => c.enc(get(m)), ...(set ? { set: (m, v) => set(m, c.dec(v)) } : {}) };
}

export { CellError };
