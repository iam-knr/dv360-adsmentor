// File names of report runs (module 16 4.4): `{name}_{YYYYMMDD}_{HHmm}.{ext}`.
import type { ReportFormatWire } from '../types';

export function safeFileStem(name: string): string {
  const s = name
    .trim()
    .replace(/[^\p{L}\p{N}._ -]+/gu, '')
    .replace(/\s+/g, '_');
  return s.slice(0, 120) || 'report';
}

export function runFileName(stem: string, at: Date, format: ReportFormatWire): string {
  const p = (n: number) => String(n).padStart(2, '0');
  const stamp = `${at.getUTCFullYear()}${p(at.getUTCMonth() + 1)}${p(at.getUTCDate())}_${p(at.getUTCHours())}${p(at.getUTCMinutes())}`;
  return `${safeFileStem(stem)}_${stamp}.${format === 'XLSX' ? 'xlsx' : 'csv'}`;
}

export const CONTENT_TYPE: Record<ReportFormatWire, string> = {
  CSV: 'text/csv; charset=utf-8',
  XLSX: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
};
