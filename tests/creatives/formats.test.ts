import { describe, expect, it } from 'vitest';
import { FORMATS, FORMAT_TABS, listFormats, supportedLiTypes } from '@/lib/creatives/formats';
import { resolveKind } from '@/lib/creatives/kinds';

describe('format gallery catalogue', () => {
  it('Parallax and Swirl are Details only, the three recommended formats can be created', () => {
    for (const key of ['PARALLAX', 'SWIRL']) {
      const f = FORMATS.find((x) => x.key === key)!;
      expect(f.buildable).toBe(false);
      expect(f.badges).toContain('ONLY IN GWD');
      expect(f.createKind).toBeUndefined();
    }
    const rec = listFormats('ALL').recommended.map((f) => f.name);
    expect(rec).toEqual(['Optimized', 'Native display', 'Native video']);
    expect(listFormats('ALL').recommended.every((f) => f.buildable)).toBe(true);
  });
  it('every Create opens a known kind', () => {
    for (const f of FORMATS.filter((x) => x.buildable))
      expect(resolveKind({ kind: f.createKind }), f.key).not.toBeNull();
  });
  it('tabs filter the cards', () => {
    expect(
      listFormats('VIDEO')
        .all.map((f) => f.key)
        .sort(),
    ).toEqual(['NATIVE_VIDEO', 'VIDEO_FILE']);
    expect(listFormats('OPTIMIZED').all.map((f) => f.key)).toEqual(['OPTIMIZED']);
    expect(
      listFormats('NATIVE')
        .all.map((f) => f.key)
        .sort(),
    ).toEqual(['NATIVE_DISPLAY', 'NATIVE_VIDEO']);
    expect(listFormats('ALL').all).toHaveLength(FORMATS.length);
    expect(FORMAT_TABS).toHaveLength(5);
  });
  it('Details lists the line item types of MX-09', () => {
    const video = FORMATS.find((f) => f.key === 'VIDEO_FILE')!;
    expect(supportedLiTypes(video)).toEqual(expect.arrayContaining(['VIDEO', 'CTV', 'DOOH_VIDEO']));
    expect(supportedLiTypes(video)).not.toContain('DISPLAY');
    expect(supportedLiTypes(FORMATS.find((f) => f.key === 'PARALLAX')!)).toEqual([]);
  });
});
