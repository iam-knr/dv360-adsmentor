// XLSX writer (module 16 4.4): sheet "Report" (bold frozen header, number formats, auto width) and sheet "Info".
import ExcelJS from 'exceljs';
import type { QueryResult } from '../types';
import { footerLines, type FileMeta } from './layout';

const FORMAT: Record<string, string> = {
  INT: '#,##0',
  DECIMAL: '#,##0.00',
  MONEY: '#,##0.00',
  PERCENT: '0.00"%"',
};

export async function buildXlsx(r: QueryResult, meta: FileMeta, rowCap: number): Promise<Uint8Array> {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'DV360 Simulator';
  const ws = wb.addWorksheet('Report', { views: [{ state: 'frozen', ySplit: 1 }] });
  ws.addRow(r.columns.map((c) => c.label)).font = { bold: true };
  for (const row of r.rows) ws.addRow(row.map((v) => (v === undefined ? null : v)));
  r.columns.forEach((c, i) => {
    const col = ws.getColumn(i + 1);
    const fmt = FORMAT[c.dataType];
    if (fmt && c.kind === 'METRIC') col.numFmt = fmt;
    let width = c.label.length;
    for (const row of r.rows.slice(0, 500)) {
      const v = row[i];
      if (v !== null && v !== undefined) width = Math.max(width, String(v).length);
    }
    col.width = Math.min(60, Math.max(10, width + 2));
  });
  const info = wb.addWorksheet('Info');
  for (const [k, v] of footerLines(r, meta, rowCap)) info.addRow([k, v]).getCell(1).font = { bold: true };
  info.getColumn(1).width = 16;
  info.getColumn(2).width = 60;
  return new Uint8Array(await wb.xlsx.writeBuffer());
}
