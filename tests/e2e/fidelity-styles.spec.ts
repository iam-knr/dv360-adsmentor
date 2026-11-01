// FID-FOUNDATION: computed-style regression for the shared components. The numbers come from the owner's fidelity
// audit of real DV360 (docs/fidelity/audit-1-campaigns-reports.md, "Style measurements"): if a value here changes,
// the simulator drifts from real DV360. Runs on the component gallery (no sign in needed).
import { expect, test, type Locator } from '@playwright/test';

type Css = Record<string, string>;
const styles = (loc: Locator, props: string[]): Promise<Css> =>
  loc.evaluate((el, ps) => {
    const cs = getComputedStyle(el);
    const out: Record<string, string> = {};
    for (const p of ps) out[p] = cs.getPropertyValue(p);
    return out;
  }, props);

const GOOGLE_SANS = /^"?Google Sans"?/;
const TRANSPARENT = 'rgba(0, 0, 0, 0)';

test.describe('fidelity: computed styles of shared components', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/components');
    await page.waitForLoadState('networkidle');
  });

  test('table header and body cells (CAM-026..030, 054)', async ({ page }) => {
    const grid = page.locator('#grid');
    const header = grid.getByRole('columnheader', { name: /^Budget/ }).first();
    const h = await styles(header, [
      'font-size',
      'font-weight',
      'color',
      'background-color',
      'font-family',
    ]);
    expect(h['font-size']).toBe('12px');
    expect(h['font-weight']).toBe('500');
    expect(h['color']).toBe('rgb(60, 64, 67)');
    expect(h['background-color']).toBe(TRANSPARENT);
    expect(h['font-family']).toMatch(/^Roboto/);

    const row = grid.getByRole('row', { name: /Winter clearance/ });
    const cell = row.getByRole('gridcell').filter({ hasText: '40,000' }).first();
    const c = await styles(cell, [
      'font-size',
      'font-weight',
      'color',
      'text-align',
      'font-family',
    ]);
    expect(c['font-size']).toBe('12px');
    expect(c['font-weight']).toBe('400');
    expect(c['color']).toBe('rgb(60, 64, 67)');
    expect(c['text-align']).toBe('right');
    expect(c['font-family']).toMatch(/^Roboto/);

    const box = await row.boundingBox();
    expect(box?.height).toBeGreaterThanOrEqual(39);
    expect(box?.height).toBeLessThanOrEqual(41);

    const link = grid.getByRole('link', { name: 'Winter clearance' });
    const l = await styles(link, ['font-size', 'color']);
    expect(l['font-size']).toBe('12px');
    expect(l['color']).toBe('rgb(26, 115, 232)');

    const id = row.getByText('C-1004');
    const i = await styles(id, ['font-size', 'color']);
    expect(i['font-size']).toBe('12px');
    expect(i['color']).toBe('rgba(0, 0, 0, 0.54)');
  });

  test('primary and secondary buttons (CAM-031)', async ({ page }) => {
    const wrap = page.getByTestId('fidelity-buttons');
    const primary = wrap.getByRole('button', { name: 'New campaign' });
    const p = await styles(primary, [
      'font-family',
      'font-size',
      'font-weight',
      'color',
      'background-color',
      'height',
      'padding-top',
      'padding-right',
      'padding-left',
      'border-top-left-radius',
    ]);
    expect(p['font-family']).toMatch(GOOGLE_SANS);
    expect(p['font-size']).toBe('14px');
    expect(p['font-weight']).toBe('500');
    expect(p['color']).toBe('rgb(255, 255, 255)');
    expect(p['background-color']).toBe('rgb(26, 115, 232)');
    expect(p['height']).toBe('36px');
    expect(p['padding-top']).toBe('9px');
    expect(p['padding-right']).toBe('24px');
    expect(p['padding-left']).toBe('24px');
    expect(p['border-top-left-radius']).toBe('4px');
    const w = (await primary.boundingBox())?.width ?? 0;
    expect(w).toBeGreaterThanOrEqual(140); // real DV360: 146 px
    expect(w).toBeLessThanOrEqual(152);

    const secondary = wrap.getByRole('button', { name: 'Last 30 days' });
    const s = await styles(secondary, [
      'border-top-color',
      'border-top-width',
      'border-top-left-radius',
    ]);
    expect(s['border-top-color']).toBe('rgb(128, 134, 139)');
    expect(s['border-top-width']).toBe('1px');
    expect(s['border-top-left-radius']).toBe('4px');
  });

  test('left nav: solid blue selected pill, Google Sans 14/500, chevron left of the icon (CAM-022..024)', async ({
    page,
  }) => {
    const nav = page.getByRole('navigation', { name: 'Main', exact: true });
    const selected = nav.locator('[aria-current="page"]').first();
    const sel = await styles(selected, [
      'background-color',
      'color',
      'font-family',
      'font-size',
      'font-weight',
    ]);
    expect(sel['background-color']).toBe('rgb(26, 115, 232)');
    expect(sel['color']).toBe('rgb(255, 255, 255)');
    expect(sel['font-family']).toMatch(GOOGLE_SANS);
    expect(sel['font-size']).toBe('14px');
    expect(sel['font-weight']).toBe('500');

    const normal = nav.getByRole('button', { name: /^Audiences/ });
    const n = await styles(normal, [
      'color',
      'font-family',
      'font-size',
      'font-weight',
      'background-color',
    ]);
    expect(n['color']).toBe('rgb(32, 33, 36)');
    expect(n['font-family']).toMatch(GOOGLE_SANS);
    expect(n['font-size']).toBe('14px');
    expect(n['font-weight']).toBe('500');
    expect(n['background-color']).toBe(TRANSPARENT);

    // The chevron comes before the icon in the same row.
    const order = await normal.evaluate((el) => {
      const kids = [...el.querySelectorAll('[data-icon]')].map((k) => k.getAttribute('data-icon'));
      return kids;
    });
    expect(order[0]).toBe('expand_more');

    // Blue dot on Resources.
    await expect(
      nav.getByRole('button', { name: /^Resources/ }).getByRole('img', { name: 'New' }),
    ).toBeVisible();
  });

  test('display headings use Google Sans (CAM-025)', async ({ page }) => {
    const h1 = page.getByRole('heading', { level: 1, name: 'Component gallery' });
    const family = await h1.evaluate((el) => getComputedStyle(el).fontFamily);
    expect(family).toMatch(GOOGLE_SANS);
  });
});
