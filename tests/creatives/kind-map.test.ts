// RC-007: wire kind, type/hostingSrc codes, database kind and MX-09 key round trip for every kind.
import { describe, expect, it } from 'vitest';
import {
  CREATIVE_KINDS,
  formatLabel,
  KIND_META,
  mx09FormatOf,
  resolveKind,
  wireKindOf,
} from '@/lib/creatives/kinds';
import { CREATIVE_FORMATS } from '@/lib/validation/constants/creatives';

describe('kind map', () => {
  it.each(CREATIVE_KINDS)('%s round trips through ?kind= and type/hostingSrc', (kind) => {
    const meta = KIND_META[kind];
    expect(resolveKind({ kind: meta.wire })).toEqual({ kind, formatKey: null });
    // image and HTML5 share type=0&hostingSrc=0: the file dropped on Main asset decides (module 12 K2)
    const byCodes = kind === 'STANDARD_HTML5' ? 'STANDARD_IMAGE' : kind;
    expect(resolveKind({ type: String(meta.type), hostingSrc: String(meta.hostingSrc) })).toEqual({
      kind: byCodes,
      formatKey: null,
    });
    expect(wireKindOf(kind)).toBe(meta.wire);
    expect(CREATIVE_FORMATS).toContain(mx09FormatOf(kind));
  });
  it('the wire codes are unique and the MX-09 keys cover all ten formats', () => {
    expect(new Set(CREATIVE_KINDS.map((k) => KIND_META[k].wire)).size).toBe(CREATIVE_KINDS.length);
    expect(new Set(CREATIVE_KINDS.map(mx09FormatOf)).size).toBe(CREATIVE_FORMATS.length);
  });
  it('the seen form is type=0&hostingSrc=1, third-party display', () => {
    expect(resolveKind({ type: '0', hostingSrc: '1' })?.kind).toBe('THIRD_PARTY_DISPLAY');
  });
  it('Optimized is native site plus a format key', () => {
    expect(resolveKind({ kind: 'format-optimized' })).toEqual({
      kind: 'NATIVE_SITE',
      formatKey: 'OPTIMIZED',
    });
    expect(wireKindOf('NATIVE_SITE', 'OPTIMIZED')).toBe('format-optimized');
    expect(formatLabel('NATIVE_SITE', 'OPTIMIZED')).toBe('Optimized');
    expect(formatLabel('NATIVE_SITE')).toBe('Native site');
  });
  it('unknown kinds give null', () => {
    expect(resolveKind({ kind: 'nope' })).toBeNull();
    expect(resolveKind({})).toBeNull();
    expect(resolveKind({ type: '9', hostingSrc: '9' })).toBeNull();
  });
  it('Type column is Standard for uploads and Third party for tags', () => {
    expect(KIND_META.STANDARD_IMAGE.typeLabel).toBe('Standard');
    expect(KIND_META.THIRD_PARTY_VIDEO.typeLabel).toBe('Third party');
  });
});
