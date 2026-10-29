// The footer block shared by the CSV and the XLSX Info sheet (module 16 4.4).
import type { QueryResult } from '../types';

export interface FileMeta {
  /** Sim now in the advertiser time zone, `YYYY/MM/DD HH:mm`. */
  reportTime: string;
  timeZoneLabel: string;
  currency: string;
}

const slash = (iso: string) => iso.replace(/-/g, '/');

export function notesOf(r: QueryResult, rowCap: number): string[] {
  const notes: string[] = [];
  if (r.warnings.includes('APPROXIMATED_PIVOT')) notes.push('Approximated pivot');
  if (r.warnings.includes('LATE_CONVERSIONS'))
    notes.push('Conversions for the last 30 days may still be updated');
  if (r.warnings.includes('TIME_ZONE_APPROXIMATED')) notes.push('Time zone shift is approximated');
  if (r.truncated) notes.push(`Truncated at ${rowCap.toLocaleString('en-US')} rows`);
  return notes;
}

/** Label / value pairs, in file order. */
export function footerLines(r: QueryResult, meta: FileMeta, rowCap: number): [string, string][] {
  const groupBy = r.columns.filter((c) => c.kind === 'DIMENSION').map((c) => c.label);
  return [
    ['Report Time:', meta.reportTime],
    ['Date Range:', `${slash(r.range.from)} - ${slash(r.range.to)}`],
    ['Group By:', groupBy.join(', ')],
    ['Time Zone:', meta.timeZoneLabel],
    ['Currency:', meta.currency],
    ['Notes:', notesOf(r, rowCap).join('; ')],
  ];
}
