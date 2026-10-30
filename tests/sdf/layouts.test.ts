// V-11-01..03, V-11-09: the layout registry, the version detector and the value codec.
import { describe, expect, it } from 'vitest';
import {
  decBool,
  decDate,
  decList,
  decNum,
  decTuples,
  encBool,
  encDate,
  encList,
  encNum,
  encTuples,
  parseCsv,
  writeCsv,
} from '@/lib/sdf/codec';
import { detectEntity, detectVersion, headerProblems } from '@/lib/sdf/detect';
import { columnsFor, headerFor } from '@/lib/sdf/layouts';
import { SDF_VERSIONS } from '@/lib/sdf/versions';

describe('layout registry (V-11-01)', () => {
  const has = (
    e: Parameters<typeof headerFor>[0],
    v: (typeof SDF_VERSIONS)[number],
    name: string,
  ) => headerFor(e, v).includes(name);

  it('applies the version matrix of 4.4', () => {
    for (const v of ['9', '9.1', '9.2'] as const) {
      expect(has('CAMPAIGNS', v, 'Geography Targeting - Include')).toBe(true);
      expect(has('INSERTION_ORDERS', v, 'Inventory Source Targeting - Include')).toBe(true);
    }
    for (const v of ['10', '10.1', '11'] as const) {
      expect(has('CAMPAIGNS', v, 'Geography Targeting - Include')).toBe(false);
      expect(has('INSERTION_ORDERS', v, 'Geography Targeting - Include')).toBe(false);
    }
    expect(has('LINE_ITEMS', '9', 'Target Curated CTV')).toBe(false);
    expect(has('LINE_ITEMS', '9.1', 'Target Curated CTV')).toBe(true);
    expect(has('LINE_ITEMS', '9.1', 'Contains EU Political Ads')).toBe(false);
    expect(has('LINE_ITEMS', '9.2', 'Contains EU Political Ads')).toBe(true);
    expect(has('LINE_ITEMS', '9.1', 'Inventory Source Targeting - Include')).toBe(true);
    expect(has('LINE_ITEMS', '9.2', 'Inventory Source Targeting - Include')).toBe(false);
    expect(has('LINE_ITEMS', '9.2', 'Target Frequency Exposures')).toBe(false);
    expect(has('LINE_ITEMS', '10', 'Target Frequency Exposures')).toBe(true);
    expect(has('INSERTION_ORDERS', '9.2', 'Youtube Reach Frequency Optimization')).toBe(false);
    expect(has('INSERTION_ORDERS', '10', 'Youtube Reach Frequency Optimization')).toBe(true);
    expect(has('AD_GROUPS', '9', 'Audience Expansion')).toBe(false);
    expect(has('AD_GROUPS', '9.1', 'Audience Expansion')).toBe(true);
    expect(has('ADS', '10', 'Business Name')).toBe(false);
    expect(has('ADS', '10.1', 'Business Name')).toBe(true);
    expect(has('ADS', '10.1', 'Impression Tracker URL')).toBe(false);
    expect(has('ADS', '11', 'Impression Tracker URL')).toBe(true);
  });

  it('keeps every entity header unique per version and the id column first', () => {
    for (const e of [
      'CAMPAIGNS',
      'INSERTION_ORDERS',
      'LINE_ITEMS',
      'AD_GROUPS',
      'ADS',
      'MEDIA_PRODUCTS',
    ] as const)
      for (const v of SDF_VERSIONS) {
        const h = headerFor(e, v);
        expect(new Set(h).size).toBe(h.length);
        expect(columnsFor(e, v)[0]!.required).toBe(true);
      }
  });
});

describe('detection (V-11-02)', () => {
  it('detects the entity from the id column', () => {
    expect(detectEntity(headerFor('LINE_ITEMS', '11'))).toBe('LINE_ITEMS');
    expect(detectEntity(headerFor('INSERTION_ORDERS', '11'))).toBe('INSERTION_ORDERS');
    expect(detectEntity(headerFor('ADS', '11'))).toBe('ADS');
    expect(detectEntity(['Foo'])).toBeNull();
  });
  it('returns the version whose column set equals the headers, in any order', () => {
    const h = [...headerFor('CAMPAIGNS', '9.1')].reverse();
    expect(detectVersion('CAMPAIGNS', h)).toBe('9');
    expect(detectVersion('CAMPAIGNS', headerFor('CAMPAIGNS', '10'))).toBe('10');
    expect(detectVersion('LINE_ITEMS', headerFor('LINE_ITEMS', '9.2'))).toBe('9.2');
    expect(detectVersion('CAMPAIGNS', [...headerFor('CAMPAIGNS', '10'), 'Extra'])).toBeNull();
  });
  it('reports unknown columns and missing required ones (BLK-021)', () => {
    const p = headerProblems('CAMPAIGNS', '11', [
      'Campaign Id',
      'Name',
      'Geography Targeting - Include',
    ]);
    expect(p.unknown).toEqual(['Geography Targeting - Include']);
    expect(p.missingRequired).toContain('Advertiser Id');
  });
});

describe('codec (V-11-03)', () => {
  it('round trips booleans, dates, numbers, lists and tuples', () => {
    expect(decBool(encBool(true))).toBe(true);
    expect(decBool(encBool(false))).toBe(false);
    expect(decBool('')).toBeNull();
    expect(() => decBool('yes')).toThrow();
    expect(encDate('2026-10-31')).toBe('10/31/2026');
    expect(decDate('10/31/2026')).toBe('2026-10-31');
    expect(() => decDate('2026-10-31')).toThrow();
    expect(() => decDate('02/30/2026')).toThrow();
    expect(encNum(1500)).toBe('1500.00');
    expect(decNum('1500.50')).toBe(1500.5);
    expect(() => decNum('1,500')).toThrow();
    expect(decList(encList(['a', 'b']))).toEqual(['a', 'b']);
    const t = [
      ['5000.00', '10/01/2026', '10/31/2026', 'Diwali'],
      ['7000.00', '11/01/2026', '11/30/2026', ''],
    ];
    expect(encTuples(t)).toBe(
      '(5000.00;10/01/2026;10/31/2026;Diwali);(7000.00;11/01/2026;11/30/2026;)',
    );
    expect(decTuples(encTuples(t))).toEqual(t);
    expect(() => decTuples('5000')).toThrow();
  });

  it('writes BOM, CRLF and RFC 4180 quoting and parses it back', () => {
    const rows = [
      ['a, b', 'say "hi"', 'line\nbreak'],
      ['', 'x', 'y'],
    ];
    const text = writeCsv(['One', 'Two', 'Three'], rows);
    expect(text.startsWith('﻿')).toBe(true);
    expect(text).toContain('\r\n');
    expect(parseCsv(text)).toEqual({ headers: ['One', 'Two', 'Three'], rows });
    expect(parseCsv('')).toBeNull();
  });
});
