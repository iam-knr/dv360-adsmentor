// CSV writer (module 16 4.4): UTF-8, `\n`, comma separated, quoted when needed; header, rows, blank line, footer.
import type { Cell, QueryResult } from '../types';
import { footerLines, type FileMeta } from './layout';

export function csvCell(v: Cell | undefined): string {
  if (v === null || v === undefined) return '';
  const s = typeof v === 'number' ? String(Number.isFinite(v) ? v : '') : v;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function buildCsv(r: QueryResult, meta: FileMeta, rowCap: number): string {
  const lines: string[] = [r.columns.map((c) => csvCell(c.label)).join(',')];
  for (const row of r.rows) lines.push(row.map(csvCell).join(','));
  lines.push('');
  for (const [k, v] of footerLines(r, meta, rowCap)) lines.push(`${csvCell(k)},${csvCell(v)}`);
  return `${lines.join('\n')}\n`;
}
