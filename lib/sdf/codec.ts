// SDF value codec (module 11 4.4 "General format"): CSV with BOM and CRLF, booleans, dates, money, lists and
// tuples. Pure, client safe. `parseCsv` and `writeCsv` round trip.
import Papa from 'papaparse';

export const BOM = '﻿';

export interface ParsedCsv {
  headers: string[];
  rows: string[][];
}

/** BOM tolerant. Returns null for a file with no header (BLK-020). */
export function parseCsv(text: string): ParsedCsv | null {
  const clean = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  if (clean.trim() === '') return null;
  const res = Papa.parse<string[]>(clean, { skipEmptyLines: 'greedy' });
  if (res.errors.some((e) => e.type === 'Quotes')) return null;
  const [headers, ...rows] = res.data;
  if (!headers || headers.length === 0 || headers.every((h) => h.trim() === '')) return null;
  return { headers: headers.map((h) => h.trim()), rows };
}

/** UTF-8 with BOM, header, comma, RFC 4180 quoting, CRLF. */
export function writeCsv(headers: readonly string[], rows: readonly (readonly string[])[]): string {
  const cell = (v: string) => (/[",\r\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
  const line = (r: readonly string[]) => r.map(cell).join(',');
  return BOM + [line(headers), ...rows.map(line)].join('\r\n') + '\r\n';
}

// ---------------------------------------------------------------------------------------------
// Values
// ---------------------------------------------------------------------------------------------

export class CellError extends Error {
  constructor(
    readonly ruleId: 'BLK-030' | 'BLK-031' | 'BLK-032',
    message: string,
  ) {
    super(message);
  }
}

export const formatError = (format: string) =>
  new CellError('BLK-030', `Enter a value in the format ${format}.`);
export const enumError = (value: string, column: string) =>
  new CellError('BLK-031', `"${value}" isn't a valid option for ${column}.`);
export const refError = (value: string, column: string) =>
  new CellError('BLK-032', `"${value}" in ${column} wasn't found.`);

export const encBool = (v: boolean | null | undefined) => (v === null || v === undefined ? '' : v ? 'TRUE' : 'FALSE');
export function decBool(s: string): boolean | null {
  const v = s.trim().toUpperCase();
  if (v === '') return null;
  if (v === 'TRUE') return true;
  if (v === 'FALSE') return false;
  throw formatError('TRUE or FALSE');
}

/** `2026-10-31` to `10/31/2026`. */
export function encDate(iso: string | null | undefined): string {
  if (!iso) return '';
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  return m ? `${m[2]}/${m[3]}/${m[1]}` : '';
}
export function decDate(s: string): string | null {
  const v = s.trim();
  if (v === '') return null;
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(v);
  if (!m) throw formatError('MM/DD/YYYY');
  const [, mm, dd, yyyy] = m;
  const date = new Date(Date.UTC(Number(yyyy), Number(mm) - 1, Number(dd)));
  if (date.getUTCMonth() !== Number(mm) - 1 || date.getUTCDate() !== Number(dd))
    throw formatError('MM/DD/YYYY');
  return `${yyyy}-${String(mm).padStart(2, '0')}-${String(dd).padStart(2, '0')}`;
}

/** Decimal with `.`, no symbol and no thousands separator; two decimals for money. */
export function encNum(v: number | string | null | undefined, decimals = 2): string {
  if (v === null || v === undefined || v === '') return '';
  const n = typeof v === 'number' ? v : Number(v);
  if (!Number.isFinite(n)) return '';
  const fixed = n.toFixed(decimals);
  return decimals > 0 ? fixed : String(Math.trunc(n));
}
export function decNum(s: string): number | null {
  const v = s.trim();
  if (v === '') return null;
  if (!/^-?\d+(\.\d+)?$/.test(v)) throw formatError('a number such as 12.50');
  return Number(v);
}
export function decInt(s: string): number | null {
  const v = s.trim();
  if (v === '') return null;
  if (!/^-?\d+$/.test(v)) throw formatError('a whole number');
  return Number(v);
}

export const encList = (items: readonly string[] | null | undefined) => (items ?? []).join(';');
export const decList = (s: string): string[] =>
  s
    .split(';')
    .map((x) => x.trim())
    .filter((x) => x !== '');

/** `(a;b;c);(d;e)` to `[['a','b','c'],['d','e']]`. Values may be empty: `(5000.00;10/01/2026;10/31/2026;)`. */
export function decTuples(s: string): string[][] {
  const v = s.trim();
  if (v === '') return [];
  const out: string[][] = [];
  const re = /\(([^()]*)\)/g;
  let consumed = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(v))) {
    out.push(m[1]!.split(';').map((x) => x.trim()));
    consumed += m[0].length;
  }
  const rest = v.replace(/\(([^()]*)\)/g, '').replace(/;/g, '').trim();
  if (rest !== '' || consumed === 0) throw formatError('(value;value);(value;value)');
  return out;
}
export const encTuples = (rows: readonly (readonly string[])[]) =>
  rows.map((r) => `(${r.join(';')})`).join(';');

/** Epoch milliseconds of a Date, as the Timestamp column. */
export const encEpoch = (d: Date) => String(d.getTime());
