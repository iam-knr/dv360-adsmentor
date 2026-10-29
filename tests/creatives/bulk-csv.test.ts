// Template header per kind, row parser, 500-row cap, per-row failures carry rule IDs (module 12 6.3).
import { describe, expect, it } from 'vitest';
import {
  BULK_COLUMNS,
  BULK_KINDS,
  parseBulkCsv,
  parseCsv,
  resultCsv,
  templateCsv,
  toCsv,
} from '@/lib/creatives/bulk-csv';
import { ids, run } from './fixtures';

describe('templates', () => {
  it.each(BULK_KINDS)('%s template has its header and one example row', (kind) => {
    const rows = parseCsv(templateCsv(kind));
    expect(rows[0]).toEqual([...BULK_COLUMNS[kind]]);
    expect(rows).toHaveLength(2);
    expect(rows[1]).toHaveLength(BULK_COLUMNS[kind].length);
  });
  it('lists the seven kinds of the menu', () => expect(BULK_KINDS).toHaveLength(7));
});

describe('csv reader', () => {
  it('handles quotes, commas, doubled quotes, CRLF and a BOM', () => {
    const text = '﻿a,b\r\n"x, y","say ""hi"""\r\n\r\nlast,';
    expect(parseCsv(text)).toEqual([
      ['a', 'b'],
      ['x, y', 'say "hi"'],
      ['last', ''],
    ]);
  });
  it('round trips through toCsv', () => {
    const rows = [
      ['Name', 'Tag'],
      ['One', '<a href="x">y</a>, z'],
    ];
    expect(parseCsv(toCsv(rows))).toEqual(rows);
  });
});

describe('row parser', () => {
  const header = 'Name,Width,Height,Third-party tag,Landing page URL';
  const row = (
    name: string,
    w = '300',
    h = '250',
    tag = '<a href="${CLICK_URL}">x</a>',
    url = 'https://e.com',
  ) => toCsv([[name, w, h, tag, url]]).trim();

  it('maps third-party display rows to creative inputs', () => {
    const parsed = parseBulkCsv('third-party-display', `${header}\n${row('One')}`);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.rows[0]?.input).toMatchObject({
      kind: 'THIRD_PARTY_DISPLAY',
      name: 'One',
      width: '300',
      landingPageUrl: 'https://e.com',
    });
    expect(parsed.rows[0]?.rowNumber).toBe(1);
  });
  it('reports missing required columns', () => {
    const parsed = parseBulkCsv('third-party-display', 'Name,Width\nx,1');
    expect(parsed).toEqual({ ok: false, message: 'Missing columns: Third-party tag.' });
    expect(parseBulkCsv('audio', '')).toEqual({ ok: false, message: 'The file is empty.' });
  });
  it('caps at 500 rows', () => {
    const body = Array.from({ length: 501 }, (_, i) => row(`R${i}`)).join('\n');
    const parsed = parseBulkCsv('third-party-display', `${header}\n${body}`);
    expect(parsed.ok && parsed.rows.length).toBe(500);
    expect(parsed.ok && parsed.truncated).toBe(true);
  });
  it('each failing row carries the rule id of its first blocking issue', () => {
    const parsed = parseBulkCsv(
      'third-party-display',
      `${header}\n${row('Good')}\n${row('')}\n${row('Zero', '0', '0')}`,
    );
    if (!parsed.ok) throw new Error('parse');
    const outcome = parsed.rows.map((r) => ids(run(r.input), 'error')[0] ?? null);
    expect(outcome).toEqual([null, 'CRE-001', 'CRE-003']);
  });
  it('matches file names against the ZIP assets, case insensitive, and reports missing files', () => {
    const csv =
      'Name,File name,Width,Height,Landing page URL\nA,Banner.PNG,300,250,https://e.com\nB,gone.png,,,https://e.com';
    const files = new Map([
      ['banner.png', { fileName: 'banner.png', mimeType: 'image/png', sizeBytes: 100 }],
    ]);
    const parsed = parseBulkCsv('html5-or-image', csv, files);
    if (!parsed.ok) throw new Error('parse');
    expect(parsed.rows[0]?.input.mainAsset?.fileName).toBe('banner.png');
    expect(parsed.rows[1]?.missingFiles).toEqual([{ column: 'File name', fileName: 'gone.png' }]);
    expect(ids(run(parsed.rows[1]!.input))).toContain('CRE-020');
    expect(parsed.rows[0]?.input.kind).toBe('STANDARD_IMAGE');
  });
  it('turns a zip file into an HTML5 creative', () => {
    const files = new Map([
      [
        'ad.zip',
        { fileName: 'ad.zip', mimeType: 'application/zip', sizeBytes: 10, entryHtml: true },
      ],
    ]);
    const parsed = parseBulkCsv('html5-or-image', 'Name,File name\nZ,ad.zip', files);
    expect(parsed.ok && parsed.rows[0]?.input.kind).toBe('STANDARD_HTML5');
  });
});

describe('result file', () => {
  it('lists every row with its status and rule id', () => {
    const csv = resultCsv([
      { rowNumber: 1, name: 'Good', status: 'OK' },
      { rowNumber: 2, name: 'Bad', status: 'FAILED', ruleId: 'CRE-001', message: 'Enter a value' },
    ]);
    expect(parseCsv(csv)).toEqual([
      ['Row', 'Name', 'Status', 'Rule ID', 'Message'],
      ['1', 'Good', 'OK', '', ''],
      ['2', 'Bad', 'FAILED', 'CRE-001', 'Enter a value'],
    ]);
  });
});
