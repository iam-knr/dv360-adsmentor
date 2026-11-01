import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';
import { theme } from '@/lib/theme/theme';
import { breakpoints, colors, shadows, sizes, zLayers } from '@/lib/theme/tokens';

const ROOT = join(__dirname, '..', '..');

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}

describe('tokens and theme', () => {
  it('uses a 4 px spacing unit so spacing(4) is 16 px', () => {
    expect(theme.spacing(4)).toBe('16px');
    expect(theme.spacing(2)).toBe('8px');
    expect(theme.spacing(6)).toBe('24px');
  });

  it('exposes the palette roles of design-system 1.1', () => {
    expect(theme.palette.primary.main).toBe(colors.primary.main);
    expect(theme.palette.background.default).toBe('#f8f9fa');
    expect(theme.palette.status.active).toBe('#1e8e3e');
    expect(theme.palette.banner.warning.bg).toBe('#fef7e0');
    expect(theme.palette.chart).toHaveLength(7);
    expect(theme.palette.link).toBe('#1a73e8');
  });

  it('defines the typography variants of design-system 1.2', () => {
    expect(theme.typography.pageTitle).toMatchObject({ fontSize: 22, lineHeight: '28px' });
    expect(theme.typography.tableHeader).toMatchObject({ fontSize: 12, fontWeight: 500 });
    expect(theme.typography.kpiValue).toMatchObject({ fontSize: 28 });
    expect(theme.typography.panelOverline).toMatchObject({
      textTransform: 'uppercase',
      letterSpacing: '0.8px',
    });
    expect(theme.typography.button).toMatchObject({ textTransform: 'none' });
    expect(String(theme.typography.pageTitle.fontFamily)).toContain('Google Sans');
    expect(String(theme.typography.fontFamily)).toContain('Roboto');
  });

  it('sets breakpoints, component sizes and the shadow ramp', () => {
    expect(theme.breakpoints.values).toEqual(breakpoints);
    expect(theme.custom.appBarHeight).toBe(56);
    expect(theme.custom.navWidth).toBe(256);
    expect(theme.custom.navRailWidth).toBe(72);
    expect(theme.custom.footerHeight).toBe(64);
    expect(sizes.slideOver).toEqual({ default: 480, wide: 640, xwide: 960 });
    expect(theme.shadows[0]).toBe('none');
    expect(theme.shadows[4]).toBe(shadows[4]);
    expect(theme.shadows[24]).toBe(shadows[4]);
  });

  it('layers z-indexes as specified', () => {
    expect(theme.zIndex.appBar).toBe(zLayers.appBar);
    expect(theme.zIndex.nav).toBeLessThan(theme.zIndex.appBar);
    expect(theme.zIndex.slideOver).toBeLessThan(theme.zIndex.modal);
    expect(theme.zIndex.modal).toBeLessThan(theme.zIndex.popover);
    expect(theme.zIndex.toast).toBeLessThan(theme.zIndex.tooltip);
  });

  it('keeps buttons at 36 px and inputs at 40 px, sentence case', () => {
    const button = theme.components?.MuiButton?.styleOverrides?.root as { height: number };
    expect(button.height).toBe(36);
    const input = theme.components?.MuiOutlinedInput?.styleOverrides?.root as { height: number };
    expect(input.height).toBe(40);
  });
});

describe('no hard-coded colours', () => {
  const files = [
    ...walk(join(ROOT, 'components')),
    ...walk(join(ROOT, 'lib', 'theme')),
    ...walk(join(ROOT, 'app', '(dev)')),
  ]
    .filter((f) => /\.(ts|tsx)$/.test(f))
    .filter((f) => !f.endsWith(join('lib', 'theme', 'tokens.ts')))
    // Other sessions own these stubs; the rule is about the files P3-04 owns.
    .filter((f) => !f.includes(join('components', 'targeting')));

  it('finds the files it is meant to check', () => {
    expect(files.length).toBeGreaterThan(30);
  });

  it.each(files.map((f) => [relative(ROOT, f), f]))(
    '%s has no hex colour literal',
    (_name, file) => {
      const text = readFileSync(file, 'utf8');
      const hex = (text.match(/#[0-9a-fA-F]{3,8}\b/g) ?? []).filter((h) =>
        [4, 5, 7, 9].includes(h.length),
      );
      expect(hex).toEqual([]);
    },
  );

  it('never references a Google asset, logo or font', () => {
    const banned = /google sans|product sans|gstatic|googleusercontent|fonts\.googleapis/i;
    for (const f of files) expect(readFileSync(f, 'utf8')).not.toMatch(banned);
  });
});
