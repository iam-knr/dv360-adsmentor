// Channel sites parser (module 15 4.1, CH-003, CH-007).
import { describe, expect, it } from 'vitest';
import {
  countSiteLines,
  formatSites,
  normaliseUrl,
  parseSites,
  statsOf,
} from '@/lib/resources/parse-sites';

describe('parseSites', () => {
  it('accepts URLs with and without a scheme and normalises them', () => {
    const r = parseSites('https://News.Example.com/\nexample.org/path/\nwww.shop.example.in');
    expect(r.invalidLines).toEqual([]);
    expect(r.entries.map((e) => e.value)).toEqual([
      'news.example.com',
      'example.org/path',
      'www.shop.example.in',
    ]);
    expect(r.entries.every((e) => e.kind === 'URL')).toBe(true);
  });

  it('recognises an Android package, an iOS id with or without "id" and a CTV display form', () => {
    const r = parseSites(
      'com.example.lumen.pay\nid123456789\n987654321\nHarbor Play - CTV (ctv.example.harbor)',
    );
    expect(r.entries.map((e) => [e.kind, e.value])).toEqual([
      ['ANDROID_APP', 'com.example.lumen.pay'],
      ['IOS_APP', '123456789'],
      ['IOS_APP', '987654321'],
      ['CTV_APP', 'ctv.example.harbor'],
    ]);
  });

  it('accepts the display forms as pasted and keeps the app name', () => {
    const r = parseSites(
      'Lumen Pay - Android (com.example.lumen.pay)\nPixel Harbor - iOS (id555666777)',
    );
    expect(r.invalidLines).toEqual([]);
    expect(r.entries[0]).toMatchObject({ kind: 'ANDROID_APP', displayName: 'Lumen Pay' });
    expect(r.entries[1]).toMatchObject({
      kind: 'IOS_APP',
      value: '555666777',
      displayName: 'Pixel Harbor',
    });
  });

  it('resolves app names through the lookup', () => {
    const r = parseSites('com.example.lumen.pay', (kind, value) =>
      kind === 'ANDROID_APP' && value === 'com.example.lumen.pay' ? 'Lumen Pay' : null,
    );
    expect(r.entries[0]?.displayName).toBe('Lumen Pay');
  });

  it('numbers invalid lines from 1, counting blank lines', () => {
    const r = parseSites('good.example.com\n\nnot a url\n   \nhttp://nodot');
    expect(r.invalidLines).toEqual([
      { line: 3, text: 'not a url' },
      { line: 5, text: 'http://nodot' },
    ]);
  });

  it('removes duplicates and reports the count (CH-007)', () => {
    const r = parseSites(
      'a.example.com\nA.EXAMPLE.com\nhttps://a.example.com/\ncom.example.app.one\ncom.example.app.one',
    );
    expect(r.entries).toHaveLength(2);
    expect(r.duplicates).toBe(3);
    expect(statsOf(r)).toEqual({ urls: 1, apps: 1, duplicates: 3, invalid: 0 });
  });

  it('counts non-blank lines for the n / 10000 counter', () => {
    expect(countSiteLines('a\n\n b \n')).toBe(2);
  });

  it('rejects spaces inside a URL', () => {
    expect(normaliseUrl('exa mple.com')).toBeNull();
  });

  it('formatSites is the inverse of parseSites for stored entries', () => {
    const r = parseSites('news.example.com\nLumen Pay - Android (com.example.lumen.pay)');
    expect(formatSites(r.entries)).toBe(
      'news.example.com\nLumen Pay - Android (com.example.lumen.pay)',
    );
  });
});
