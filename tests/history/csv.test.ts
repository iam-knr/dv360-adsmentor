import { describe, expect, it } from 'vitest';
import { buildCsv, csvLine, CSV_COLUMNS, HIS_020, MAX_DOWNLOAD_ROWS } from '@/lib/history/csv';

describe('history CSV (module 05 4.8)', () => {
  it('has the 11 columns of data-model 6.4 in order', () => {
    expect(CSV_COLUMNS).toEqual([
      'Time', 'Time zone', 'Entity type', 'Entity ID', 'Entity name', 'User', 'Source',
      'Field', 'Old value', 'New value', 'Note',
    ]);
  });
  it('starts with a BOM and uses CRLF line ends', () => {
    const csv = buildCsv([['2026-03-26 10:55:08', 'IST', 'insertion order', '1', 'IO', 'a@example.test', 'UI', 'Name', 'A', 'B', null]]);
    expect(csv.startsWith('﻿Time,Time zone,')).toBe(true);
    expect(csv.split('\r\n')).toHaveLength(3);
    expect(csv.endsWith('\r\n')).toBe(true);
  });
  it('quotes commas, quotes and new lines', () => {
    expect(csvLine(['a,b', 'say "hi"', 'x\ny', null, 5])).toBe('"a,b","say ""hi""","x\ny",,5');
  });
  it('neutralises spreadsheet formulas but keeps negative numbers', () => {
    expect(csvLine(['=SUM(A1)', '+1', '@x', '-5', '-1.5', '-abc'])).toBe("'=SUM(A1),'+1,'@x,-5,-1.5,'-abc");
  });
  it('states the 50,000 row limit as HIS-020', () => {
    expect(MAX_DOWNLOAD_ROWS).toBe(50_000);
    expect(HIS_020).toBe('[SIM] Narrow the date range to download. The limit is 50,000 rows.');
  });
});
