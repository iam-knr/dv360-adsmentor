// Fidelity audit 1, Campaigns (CAM-003..012, 034, 036, 037, 038..050, 052, 054, 059..067): the Campaigns list, the date
// range presets, the chip filter bar, the New campaign form and the campaign detail page match real DV360.
// Synthetic student in the test database, signed in through /sim/login (same pattern as campaigns.spec.ts).
import { PrismaClient } from '@prisma/client';
import { expect, test, type Page } from '@playwright/test';
import { cleanup } from '../auth/fixtures';
import { createShellWorld, type ShellWorld } from '../shell/e2e-world';
import { advPath, seedCampaign, signIn } from '../services/campaigns/e2e-helpers';
import { simDateIn } from '@/lib/metrics/date-range';

const db = new PrismaClient({
  datasources: { db: { url: process.env.DATABASE_URL_TEST ?? process.env.DATABASE_URL } },
});
let w: ShellWorld;
let simToday = '';
let campaign: { id: string; publicId: string };

test.beforeAll(async () => {
  w = await createShellWorld(db, { tag: `fidcam-${Date.now()}` });
  const clock = await db.simClock.findUniqueOrThrow({ where: { sandboxId: w.sandboxId } });
  const simNow = new Date(clock.simStart.getTime() + Number(clock.tickIndex) * 3_600_000);
  const adv = await db.advertiser.findUniqueOrThrow({ where: { id: w.rows.advertiserId } });
  simToday = simDateIn(simNow, adv.timeZone);
  campaign = await seedCampaign(db, w, 'FID Alpha Campaign', { status: 'ACTIVE' });
  await seedCampaign(db, w, 'FID Beta Campaign', { status: 'PAUSED' });
});
test.afterAll(async () => {
  await cleanup(db, { userIds: w.userIds, classroomIds: [w.classroomId] });
  await db.$disconnect();
});

const A = (sub = '') => advPath(w, sub);
const login = (page: Page) => signIn(page, w);
const label = (iso: string) =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  });

test.describe('Campaigns list', () => {
  test('CAM-003/004/007/009/010/011/012/036/037/052: tabs, toolbar, menu and the fixed column set', async ({
    page,
  }) => {
    await login(page);
    await page.goto(A('/cs'));
    await expect(page.getByRole('tab', { name: 'Campaigns' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    await expect(page.getByRole('tab', { name: 'Insertion orders' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'New campaign' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Columns' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'SDF', exact: true })).toHaveCount(0);
    await page.getByRole('button', { name: 'More actions' }).click();
    for (const item of ['Download', 'Upload', 'Download metadata', 'Download QA'])
      await expect(page.getByRole('menuitem', { name: item, exact: true })).toBeVisible();
    await page.keyboard.press('Escape');

    const headers = page.getByRole('columnheader');
    for (const h of ['Name', 'Budget', 'Spent', 'KPI Goal', 'KPI Actual', 'KPI Actual TrueView'])
      await expect(headers.filter({ hasText: new RegExp(`^${h}$`) }).first()).toBeVisible();
    for (const g of ['Campaign', 'Delivery'])
      await expect(headers.filter({ hasText: new RegExp(`^${g}$`) }).first()).toBeVisible();
    await expect(page.getByRole('columnheader', { name: /^ID$/ })).toHaveCount(0);
    await expect(page.getByRole('row').filter({ hasText: /^Total/ })).toHaveCount(0);
    // the ID sits in grey beside the name, 12 px (CAM-011, CAM-030)
    const id = page.getByTestId('campaign-id').first();
    await expect(id).toHaveText(campaign.publicId);
    expect(await id.evaluate((el) => getComputedStyle(el).fontSize)).toBe('12px');
    // KPI columns are right-aligned (CAM-054)
    const kpi = page.getByRole('columnheader', { name: /^KPI Goal$/ });
    expect(await kpi.evaluate((el) => getComputedStyle(el).textAlign)).toBe('right');
  });

  test('CAM-008/057: the Intelligence panel is open on every load', async ({ page }) => {
    await login(page);
    for (let i = 0; i < 2; i++) {
      await page.goto(A('/cs'));
      await expect(page.getByText(/^advertiser health$/i)).toBeVisible();
      await expect(page.getByText(/^optimization suggestions$/i)).toBeVisible();
    }
  });

  test('CAM-005/034: date presets, and Today is the sim date', async ({ page }) => {
    await login(page);
    await page.goto(A('/cs'));
    await page
      .getByRole('button', { name: /^(?!More)[A-Z][a-z]{2} \d/ })
      .first()
      .click();
    const presets = page.getByRole('menu', { name: 'Date presets' });
    await expect(presets.getByRole('menuitem')).toHaveText([
      'Custom',
      'Today',
      'Yesterday',
      'Last 7 days',
      'Last 14 days',
      'Last 30 days',
      'Month to date',
      'Quarter to date',
      'Year to date',
      'Lifetime',
      /days up to today$/,
      /days up to yesterday$/,
    ]);
    await expect(page.getByLabel('Start date')).toBeVisible();
    await presets.getByRole('menuitem', { name: 'Today', exact: true }).click();
    await expect(page.getByLabel('Start date')).toHaveValue(simToday);
    await expect(page.getByLabel('End date')).toHaveValue(simToday);
    await page.getByRole('button', { name: 'Apply' }).click();
    await expect(page).toHaveURL(/[?&]d=TODAY/);
    await expect(page.getByRole('button', { name: label(simToday), exact: true })).toBeVisible();
  });

  test('CAM-006/065: filter chips, search text and clear all', async ({ page }) => {
    await login(page);
    await page.goto(A('/cs'));
    const bar = page.getByRole('search', { name: 'Campaign filters' });
    await expect(bar.getByRole('button', { name: 'Status: Active' })).toBeVisible();
    await expect(bar.getByRole('button', { name: /Filters, 1 active/ })).toBeVisible();
    await expect(bar.getByPlaceholder('Enter a search term or select filters')).toBeVisible();
    await expect(page.getByRole('link', { name: 'FID Alpha Campaign' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'FID Beta Campaign' })).toHaveCount(0);

    // remove the Status chip: both campaigns, then search by name and by ID
    await bar.getByRole('img', { name: 'Remove filter Status: Active' }).click();
    await expect(page.getByRole('link', { name: 'FID Beta Campaign' })).toBeVisible();
    const input = page.locator('input[aria-label="Search or filter"]');
    await input.fill('beta');
    await input.press('Escape'); // closes the suggestion popover, which hides the page from role queries
    await expect(page.getByRole('link', { name: 'FID Alpha Campaign' })).toHaveCount(0);
    await input.fill(campaign.publicId);
    await input.press('Escape');
    await expect(page.getByRole('link', { name: 'FID Alpha Campaign' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'FID Beta Campaign' })).toHaveCount(0);
    await input.press('Enter');
    await expect(bar.getByRole('button', { name: `Name/ID: ${campaign.publicId}` })).toBeVisible();
    await bar.getByRole('button', { name: 'Clear all' }).click();
    await expect(page.getByRole('link', { name: 'FID Beta Campaign' })).toBeVisible();

    // the funnel lists the filter fields
    await bar.getByRole('button', { name: /Filters/ }).click();
    for (const f of ['Status', 'Goal', 'Budget'])
      await expect(page.getByRole('button', { name: f, exact: true }).last()).toBeVisible();
    await page.keyboard.press('Escape');
  });

  test('CAM-003: the Insertion orders tab keeps the list chrome', async ({ page }) => {
    await login(page);
    await page.goto(A('/cs'));
    await page.getByRole('tab', { name: 'Insertion orders' }).click();
    await page.waitForURL(/\/explorerios/);
    await expect(page.getByRole('tab', { name: 'Insertion orders' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    await expect(page.getByRole('search', { name: 'Insertion order filters' })).toBeVisible();
    await page.getByRole('tab', { name: 'Campaigns' }).click();
    await page.waitForURL(/\/cs(\?|$)/);
  });
});

test.describe('New campaign form', () => {
  test('CAM-038..050: real order, wording and no sticky footer', async ({ page }) => {
    await login(page);
    await page.goto(A('/cs/new'));
    await expect(
      page.getByText(
        'Inventory source and Targeting settings are now managed at the line item level. Use targeting templates for easy reuse.',
      ),
    ).toBeVisible();
    await expect(page.getByText("These settings don't impact serving.")).toBeVisible();
    await expect(page.getByPlaceholder('Enter name')).toBeVisible();
    await expect(page.getByRole('combobox', { name: 'Status' })).toContainText('Active');
    await expect(
      page.getByRole('button', { name: 'Copy settings from an existing campaign' }),
    ).toBeVisible();
    await expect(page.locator('#kpi-value')).toHaveCount(0);
    await expect(page.getByText('*', { exact: true })).toHaveCount(0);

    // field order, top to bottom
    const order = [
      'Campaign name',
      'Overall campaign goal',
      'KPI',
      'Creative type you expect to use',
      'Planned spend',
      'Planned dates',
      'Additional budget details',
      'Frequency cap',
      'Additional details',
      'Landing page URLs',
      'Keywords',
    ];
    const ys: number[] = [];
    for (const t of order) {
      const box = await page
        .getByText(new RegExp(`^${t}`))
        .first()
        .boundingBox();
      expect(box, t).not.toBeNull();
      ys.push(box!.y);
    }
    expect(ys).toEqual([...ys].sort((a, b) => a - b));
    await expect(page.getByLabel('Display')).toBeVisible();
    await expect(page.getByLabel('Video')).toBeVisible();
    await expect(page.getByLabel('Audio')).toBeVisible();
    await expect(page.getByText('End date (optional)')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Add another url' })).toBeVisible();
    await expect(page.getByPlaceholder('Add keywords separated by a comma')).toBeVisible();
    await expect(
      page.getByText('Enter up to 5 keywords to help improve recommendations.'),
    ).toBeVisible();
    await expect(page.getByText('No limit')).toBeVisible();
    await page.getByRole('radio', { name: /Limit frequency to/ }).check();
    await page.getByRole('combobox', { name: 'Period' }).click();
    await expect(page.getByRole('option', { name: 'Month', exact: true })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(
      page.getByText(
        'You can also set specific frequency caps on each insertion order and line item in this campaign.',
      ),
    ).toBeVisible();

    // Create and Cancel are the last things on the scrolling page, not a sticky footer (CAM-046)
    const create = page.getByRole('button', { name: 'Create' });
    await create.scrollIntoViewIfNeeded();
    expect(
      await create.evaluate((el) => getComputedStyle(el.closest('footer') ?? el).position),
    ).not.toBe('sticky');
    await expect(page.getByRole('button', { name: 'Cancel' })).toBeVisible();
  });

  test('CAM-047/048: a campaign with landing URLs and keywords is created', async ({ page }) => {
    await login(page);
    await page.goto(A('/cs/new'));
    await page.locator('#name').fill('FID Created Campaign');
    await page.getByRole('combobox', { name: /Overall campaign goal/ }).click();
    await page.getByRole('option', { name: /Raise awareness/ }).click();
    await page.getByRole('combobox', { name: /^KPI/ }).click();
    await page.getByRole('option', { name: /^CPM/ }).first().click();
    await page.getByRole('checkbox', { name: 'Display' }).check();
    await page.getByLabel('Landing page URL 1').fill('https://example.com/offer');
    await page.getByPlaceholder('Add keywords separated by a comma').fill('shoes, festive');
    await page.getByRole('button', { name: 'Create' }).click();
    await page.waitForURL(/\/c\/\d+\/explorerios/);
    const row = await db.campaign.findFirst({
      where: { name: 'FID Created Campaign', sandboxId: w.sandboxId },
    });
    expect(row?.landingPageUrls).toEqual(['https://example.com/offer']);
    expect(row?.keywords).toEqual(['shoes', 'festive']);
  });
});

test.describe('Campaign detail', () => {
  test('CAM-059..067: breadcrumb, fixed chart cards, table toolbar, groups and columns', async ({
    page,
  }) => {
    await login(page);
    await page.goto(A(`/c/${campaign.publicId}`));
    await page.waitForURL(/\/explorerios/);
    await expect(page.getByRole('navigation', { name: /Breadcrumb/ }).first()).toContainText(
      'FID Alpha Campaign',
    );
    await expect(page.getByText('Campaign FID Alpha Campaign')).toHaveCount(0);

    // five fixed cards (CAM-063)
    const cards = page.getByTestId('chart-cards').getByRole('region');
    await expect(
      cards.filter({
        hasText:
          /^(Total cost|Avg\. performance|Impressions lost|Added impression reach|Explore budget options)/,
      }),
    ).toHaveCount(5);
    await expect(page.getByRole('button', { name: /Scroll charts/ })).toHaveCount(0);
    await expect(page.getByText('No spend yet for this period.')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Help: Impressions lost' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Help: Added impression reach' })).toBeVisible();

    // table toolbar (CAM-064) and search bar (CAM-065)
    await expect(page.getByRole('link', { name: 'New Insertion Order' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Performance' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Segment by' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Download table' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Fullscreen' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'More actions' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Status: Active ▾' })).toHaveCount(0);
    await expect(page.getByPlaceholder('Enter a search term or select filters')).toBeVisible();

    // column groups and columns (CAM-066, CAM-067)
    const headers = page.getByRole('columnheader');
    for (const g of [
      'Settings',
      'Goal',
      'Delivery',
      'Interactions',
      'Conversions',
      'Custom Bidding',
    ])
      await expect(headers.filter({ hasText: new RegExp(`^${g}$`) }).first()).toBeVisible();
    for (const c of [
      'Id',
      'Type',
      'Budget',
      'Goal',
      'Impr.',
      'Revenue',
      'Interactions',
      'Conv.',
      'CPA',
      'Custom Impr. value / cost',
    ])
      await expect(
        headers.filter({ hasText: new RegExp(`^${c.replace(/[.]/g, '\\.')}$`) }).first(),
      ).toBeVisible();

    // no NEW badge on the Alerts nav item (CAM-060)
    const alerts = page.getByRole('link', { name: /^Alerts/ }).first();
    await expect(alerts).not.toContainText('NEW');
  });
});
