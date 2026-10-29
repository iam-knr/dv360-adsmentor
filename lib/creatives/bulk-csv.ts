// Bulk add creatives: templates, CSV parser and row mapping (module 12 S8, 4.3). Pure. Column layouts are `[SIM]`
// (module 12 Q4: the real template layout is blocked in the demo).
import type { CreativeKind } from '@prisma/client';
import type { CreativeAssetInput, CreativeInput } from '@/lib/validation/types';
import { CREATIVE_LIMITS } from './limits';

export const BULK_KINDS = [
  'audio',
  'html5-or-image',
  'native-site',
  'native-video',
  'third-party-audio',
  'third-party-display',
  'third-party-video',
] as const;
export type BulkCreativeKind = (typeof BULK_KINDS)[number];

export const BULK_KIND_LABEL: Record<BulkCreativeKind, string> = {
  audio: 'Audio',
  'html5-or-image': 'HTML5 or image',
  'native-site': 'Native site',
  'native-video': 'Native video',
  'third-party-audio': 'Third-party audio',
  'third-party-display': 'Third-party display',
  'third-party-video': 'Third-party video',
};

export const isBulkKind = (v: string): v is BulkCreativeKind =>
  (BULK_KINDS as readonly string[]).includes(v);

const COMMON = ['Name', 'Landing page URL', 'Integration code', 'Notes'] as const;

export const BULK_COLUMNS: Record<BulkCreativeKind, readonly string[]> = {
  audio: [
    'Name',
    'File name',
    'Duration (seconds)',
    'Landing page URL',
    'Integration code',
    'Notes',
  ],
  'html5-or-image': ['Name', 'File name', 'Width', 'Height', ...COMMON.slice(1)],
  'native-site': [
    'Name',
    'Headline',
    'Body',
    'Call to action',
    'Advertiser name',
    'Display URL',
    'Main image file name',
    'Logo file name',
    ...COMMON.slice(1),
  ],
  'native-video': [
    'Name',
    'Headline',
    'Body',
    'Call to action',
    'Advertiser name',
    'Display URL',
    'Video file name',
    'Logo file name',
    ...COMMON.slice(1),
  ],
  'third-party-audio': [
    'Name',
    'VAST tag',
    'Duration (seconds)',
    'Landing page URL',
    'Integration code',
    'Notes',
  ],
  'third-party-display': [
    'Name',
    'Width',
    'Height',
    'Third-party tag',
    'Landing page URL',
    'Integration code',
    'Notes',
  ],
  'third-party-video': [
    'Name',
    'VAST tag',
    'Duration (seconds)',
    'Skippable',
    'Skip offset (seconds)',
    'Landing page URL',
    'Integration code',
    'Notes',
  ],
};

/** Columns that must be present in the header (the rest may be left out). */
const REQUIRED: Record<BulkCreativeKind, readonly string[]> = {
  audio: ['Name', 'File name'],
  'html5-or-image': ['Name', 'File name'],
  'native-site': ['Name', 'Headline', 'Main image file name', 'Logo file name'],
  'native-video': ['Name', 'Headline', 'Video file name', 'Logo file name'],
  'third-party-audio': ['Name', 'VAST tag'],
  'third-party-display': ['Name', 'Third-party tag'],
  'third-party-video': ['Name', 'VAST tag'],
};

export function csvEscape(value: string | number | null | undefined): string {
  const text = value === null || value === undefined ? '' : String(value);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export const toCsv = (rows: readonly (readonly (string | number | null | undefined)[])[]): string =>
  `${rows.map((r) => r.map(csvEscape).join(',')).join('\r\n')}\r\n`;

/** The downloadable template: header plus one example row. */
export function templateCsv(kind: BulkCreativeKind): string {
  const example: Record<string, string> = {
    Name: 'Example creative',
    'Landing page URL': 'https://example.com/landing',
    Width: '300',
    Height: '250',
    'Third-party tag':
      '<a href="${CLICK_URL}https://example.com"><img src="https://example.com/ad.png"></a>',
    'VAST tag': 'https://example.com/vast.xml',
    'Duration (seconds)': '15',
    Skippable: 'FALSE',
    'Skip offset (seconds)': '5',
    'File name': 'creative-file',
    Headline: 'Example headline',
    Body: 'A short description',
    'Call to action': 'Learn more',
    'Advertiser name': 'Example brand',
    'Display URL': 'example.com',
    'Main image file name': 'main.png',
    'Video file name': 'clip.mp4',
    'Logo file name': 'logo.png',
  };
  const cols = BULK_COLUMNS[kind];
  return toCsv([cols, cols.map((c) => example[c] ?? '')]);
}

/** RFC 4180 reader: quoted fields, doubled quotes, CRLF or LF, a leading BOM. */
export function parseCsv(text: string): string[][] {
  const src = text.replace(/^﻿/, '');
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < src.length; i++) {
    const ch = src[i]!;
    if (quoted) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          field += '"';
          i++;
        } else quoted = false;
      } else field += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') {
      row.push(field);
      field = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && src[i + 1] === '\n') i++;
      row.push(field);
      field = '';
      rows.push(row);
      row = [];
    } else field += ch;
  }
  if (field !== '' || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((c) => c.trim() !== ''));
}

export interface BulkRow {
  /** 1 based, counted from the first data row (the header is row 0). */
  rowNumber: number;
  input: CreativeInput;
  /** Columns that name a file the row needs but none was found in the ZIP. */
  missingFiles: { column: string; fileName: string }[];
}

export type BulkParse =
  { ok: false; message: string } | { ok: true; rows: BulkRow[]; truncated: boolean };

const KIND_OF: Record<BulkCreativeKind, (fileName: string) => CreativeKind> = {
  audio: () => 'AUDIO_FILE',
  'html5-or-image': (f) => (f.toLowerCase().endsWith('.zip') ? 'STANDARD_HTML5' : 'STANDARD_IMAGE'),
  'native-site': () => 'NATIVE_SITE',
  'native-video': () => 'NATIVE_VIDEO',
  'third-party-audio': () => 'THIRD_PARTY_AUDIO',
  'third-party-display': () => 'THIRD_PARTY_DISPLAY',
  'third-party-video': () => 'THIRD_PARTY_VIDEO',
};

const truthy = (v: string): boolean => ['true', 'yes', '1', 'y'].includes(v.trim().toLowerCase());

/** Parse the uploaded CSV into creative inputs. `files` are the assets of the optional ZIP, by lower case file name. */
export function parseBulkCsv(
  kind: BulkCreativeKind,
  text: string,
  files: ReadonlyMap<string, CreativeAssetInput> = new Map(),
): BulkParse {
  const table = parseCsv(text);
  const header = table[0]?.map((h) => h.trim());
  if (!header) return { ok: false, message: 'The file is empty.' };
  const missing = REQUIRED[kind].filter((c) => !header.includes(c));
  if (missing.length) return { ok: false, message: `Missing columns: ${missing.join(', ')}.` };
  const data = table.slice(1);
  const rows = data.slice(0, CREATIVE_LIMITS.BULK_MAX_ROWS).map((cells, i): BulkRow => {
    const get = (col: string): string => (cells[header.indexOf(col)] ?? '').trim();
    const missingFiles: BulkRow['missingFiles'] = [];
    const file = (col: string): CreativeAssetInput | null => {
      const name = get(col);
      if (!name) return null;
      const hit = files.get(name.toLowerCase());
      if (!hit) missingFiles.push({ column: col, fileName: name });
      return hit ?? null;
    };
    const base: CreativeInput = {
      kind: KIND_OF[kind](get('File name')),
      name: get('Name'),
      landingPageUrl: get('Landing page URL') || null,
      integrationCode: get('Integration code') || null,
      notes: get('Notes') || null,
    };
    switch (kind) {
      case 'third-party-display':
        Object.assign(base, {
          width: get('Width'),
          height: get('Height'),
          thirdPartyTag: get('Third-party tag'),
        });
        break;
      case 'third-party-video':
      case 'third-party-audio':
        Object.assign(base, {
          vastTag: get('VAST tag'),
          durationSeconds: get('Duration (seconds)'),
        });
        if (kind === 'third-party-video')
          Object.assign(base, {
            skippable: truthy(get('Skippable')),
            skipOffsetSec: get('Skip offset (seconds)'),
          });
        break;
      case 'html5-or-image': {
        const asset = file('File name');
        Object.assign(base, { mainAsset: asset, width: get('Width'), height: get('Height') });
        if (asset?.fileName.toLowerCase().endsWith('.zip')) base.kind = 'STANDARD_HTML5';
        break;
      }
      case 'audio': {
        const asset = file('File name');
        Object.assign(base, { mainAsset: asset, durationSeconds: get('Duration (seconds)') });
        break;
      }
      case 'native-site':
      case 'native-video':
        Object.assign(base, {
          native: {
            headline: get('Headline'),
            body: get('Body'),
            callToAction: get('Call to action'),
            advertiserName: get('Advertiser name'),
            displayUrl: get('Display URL'),
          },
          mainAsset: file(kind === 'native-site' ? 'Main image file name' : 'Video file name'),
          logoAsset: file('Logo file name'),
        });
        break;
    }
    return { rowNumber: i + 1, input: base, missingFiles };
  });
  return { ok: true, rows, truncated: data.length > CREATIVE_LIMITS.BULK_MAX_ROWS };
}

export interface BulkResultRow {
  rowNumber: number;
  name: string;
  status: 'OK' | 'FAILED';
  ruleId?: string | null;
  message?: string | null;
}

/** "Creative-bulk-result.csv" (CRE-050). */
export function resultCsv(rows: readonly BulkResultRow[]): string {
  return toCsv([
    ['Row', 'Name', 'Status', 'Rule ID', 'Message'],
    ...rows.map((r) => [r.rowNumber, r.name, r.status, r.ruleId ?? '', r.message ?? '']),
  ]);
}
