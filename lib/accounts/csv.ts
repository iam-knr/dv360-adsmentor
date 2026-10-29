// Formula-safe CSV cells (module 19 4.4 rule 6, T13). Pure.
const FORMULA_START = /^[=+\-@\t\r]/;

type Cell = string | number | boolean | null | undefined;

export function csvCell(value: Cell): string {
  let s = value === null || value === undefined ? '' : String(value);
  if (FORMULA_START.test(s)) s = `'${s}`;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(header: Cell[], rows: Cell[][]): string {
  return [header, ...rows].map((r) => r.map(csvCell).join(',')).join('\r\n') + '\r\n';
}
