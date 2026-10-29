// Formula-safe CSV cells (module 19 4.4 rule 6, T13). Pure.
const FORMULA_START = /^[=+\-@\t\r]/;

export function csvCell(value: unknown): string {
  let s =
    typeof value === 'string'
      ? value
      : value === null || value === undefined
        ? ''
        : String(value as string | number | boolean);
  if (FORMULA_START.test(s)) s = `'${s}`;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(header: string[], rows: unknown[][]): string {
  return [header, ...rows].map((r) => r.map(csvCell).join(',')).join('\r\n') + '\r\n';
}
