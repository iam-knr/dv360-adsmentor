import { expect, test } from '@playwright/test';

test.describe('component gallery', () => {
  test('loads with every section and no console errors', async ({ page }) => {
    const problems: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error' || msg.type() === 'warning')
        problems.push(`${msg.type()}: ${msg.text()}`);
    });
    page.on('pageerror', (err) => problems.push(`pageerror: ${err.message}`));

    const res = await page.goto('/components');
    expect(res?.status()).toBe(200);
    await expect(page.getByRole('heading', { level: 1, name: 'Component gallery' })).toBeVisible();

    const sections = page.locator('main section[aria-labelledby]');
    expect(await sections.count()).toBeGreaterThanOrEqual(20);
    await expect(page.getByRole('heading', { level: 2, name: 'Grid', exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { level: 2, name: 'Date range' })).toBeVisible();

    // Let hydration and the client-only charts settle, then check for problems.
    await page.waitForLoadState('networkidle');
    await expect(page.locator('#charts [role="img"]').first()).toBeVisible();
    expect(problems).toEqual([]);
  });

  test('the app bar shows the DV360 logo lockup', async ({ page }) => {
    await page.goto('/components');
    const logo = page.locator('#shell img').first();
    await expect(logo).toBeVisible();
    expect(await logo.getAttribute('src')).toContain('dv360-logo.png');
    const naturalWidth = await logo.evaluate((img: HTMLImageElement) => img.naturalWidth);
    expect(naturalWidth).toBeGreaterThan(0);
  });

  test('keyboard: Space selects a grid row', async ({ page }) => {
    await page.goto('/components');
    await page.waitForLoadState('networkidle');
    const row = page.locator('#grid').getByRole('checkbox', { name: 'Select row c-1001' });
    await row.focus();
    await page.keyboard.press('Space');
    await expect(row).toBeChecked();
    await expect(
      page.locator('#grid').getByRole('checkbox', { name: 'Select all rows' }),
    ).toBeChecked({ checked: false });
  });

  test('opens the Unsaved Changes modal with the exact wording', async ({ page }) => {
    await page.goto('/components');
    await page.waitForLoadState('networkidle');
    await page
      .locator('#modals')
      .getByRole('button', { name: 'Unsaved Changes', exact: true })
      .click();
    const dialog = page.getByRole('dialog', { name: 'Unsaved Changes' });
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText(
      'You have made changes that have not been saved and will be lost.',
    );
    await expect(dialog.getByRole('button', { name: 'Continue editing' })).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
  });
});
