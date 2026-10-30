// CSV of the filtered log (module 05 4.8, data-model 6.4). Pure. UTF-8 with BOM, CRLF line ends.
export const CSV_COLUMNS = [
  'Time',
  'Time zone',
  'Entity type',
  'Entity ID',
  'Entity name',
  'User',
  'Source',
  'Field',
  'Old value',
  'New value',
  'Note',
] as const;

/** HIS-020: the most rows one download returns. */
export const MAX_DOWNLOAD_ROWS = 50_000;
export const HIS_020 = '[SIM] Narrow the date range to download. The limit is 50,000 rows.';

function cell(value: string | number | null | undefined): string {
  const s = value === null || value === undefined ? '' : String(value);
  // a leading = + - @ would run as a formula when the file opens in a spreadsheet
  const safe = /^[=+@]/.test(s) || /^-[^0-9.]/.test(s) ? `'${s}` : s;
  return /[",\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

export function csvLine(values: (string | number | null | undefined)[]): string {
  return values.map(cell).join(',');
}

export function buildCsv(rows: (string | number | null | undefined)[][]): string {
  return `﻿${[csvLine([...CSV_COLUMNS]), ...rows.map(csvLine)].join('\r\n')}\r\n`;
}
