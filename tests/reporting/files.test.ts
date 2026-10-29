import ExcelJS from 'exceljs';
import { describe, expect, it } from 'vitest';
import { buildCsv, csvCell } from '@/lib/reporting/files/csv';
import type { FileMeta } from '@/lib/reporting/files/layout';
import { runFileName, safeFileStem } from '@/lib/reporting/files/names';
import { buildXlsx } from '@/lib/reporting/files/xlsx';
import type { QueryResult } from '@/lib/reporting/types';

const meta: FileMeta = {
  reportTime: '2026/10/28 12:00',
  timeZoneLabel: 'Asia/Kolkata',
  currency: 'INR',
};
const result: QueryResult = {
  columns: [
    { key: 'advertiser', label: 'Advertiser', kind: 'DIMENSION', dataType: 'STRING' },
    { key: 'impressions', label: 'Impressions', kind: 'METRIC', dataType: 'INT' },
    { key: 'click_rate_ctr', label: 'Click Rate (CTR)', kind: 'METRIC', dataType: 'PERCENT' },
    { key: 'revenue_adv', label: 'Revenue (Advertiser Currency)', kind: 'METRIC', dataType: 'MONEY' },
  ],
  rows: [
    ['Acme, "Prime"', 12000, 1.23, 456.5],
    ['Beta', 0, null, 0],
  ],
  truncated: false,
  totalRows: 2,
  warnings: ['APPROXIMATED_PIVOT'],
  asOf: '2026-10-28T12:00:00.000Z',
  range: { from: '2026-10-21', to: '2026-10-27' },
};

describe('csv', () => {
  it('escapes, keeps raw numbers and writes the footer block', () => {
    const lines = buildCsv(result, meta, 200_000).split('\n');
    expect(lines[0]).toBe('Advertiser,Impressions,Click Rate (CTR),Revenue (Advertiser Currency)');
    expect(lines[1]).toBe('"Acme, ""Prime""",12000,1.23,456.5');
    expect(lines[2]).toBe('Beta,0,,0');
    expect(lines[3]).toBe('');
    expect(lines.slice(4, 10)).toEqual([
      'Report Time:,2026/10/28 12:00',
      'Date Range:,2026/10/21 - 2026/10/27',
      'Group By:,Advertiser',
      'Time Zone:,Asia/Kolkata',
      'Currency:,INR',
      'Notes:,Approximated pivot',
    ]);
    expect(lines[10]).toBe('');
  });
  it('notes the truncation', () => {
    const csv = buildCsv({ ...result, truncated: true, warnings: [] }, meta, 200_000);
    expect(csv).toContain('Notes:,"Truncated at 200,000 rows"');
  });
  it('quotes only when needed', () => {
    expect(csvCell('plain')).toBe('plain');
    expect(csvCell('a\nb')).toBe('"a\nb"');
    expect(csvCell(null)).toBe('');
    expect(csvCell(0)).toBe('0');
  });
});

describe('xlsx', () => {
  it('parses back with the Report and Info sheets', async () => {
    const bytes = await buildXlsx(result, meta, 200_000);
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(Buffer.from(bytes) as unknown as ArrayBuffer);
    expect(wb.worksheets.map((w) => w.name)).toEqual(['Report', 'Info']);
    const report = wb.getWorksheet('Report');
    expect(report?.getRow(1).values).toEqual([undefined, 'Advertiser', 'Impressions', 'Click Rate (CTR)', 'Revenue (Advertiser Currency)']);
    expect(report?.getRow(2).getCell(2).value).toBe(12000);
    expect(report?.getRow(3).getCell(3).value).toBeNull();
    expect(report?.getRow(1).font?.bold).toBe(true);
    expect(report?.views[0]).toMatchObject({ state: 'frozen', ySplit: 1 });
    expect(wb.getWorksheet('Info')?.getRow(2).getCell(2).value).toBe('2026/10/21 - 2026/10/27');
  });
});

describe('names', () => {
  it('stems and stamps', () => {
    expect(safeFileStem('IO pacing / July?')).toBe('IO_pacing_July');
    expect(runFileName('IO pacing', new Date('2026-10-28T09:05:00Z'), 'XLSX')).toBe(
      'IO_pacing_20261028_0905.xlsx',
    );
  });
});
