// P4-07, module 16 6.2: E2E-RPT-01 hub and template run, 02 build/save/save as, 03 visualisations, 04 offline Floodlight,
// 05 schedule, 06 share, 07 role matrix, 08 generate report. Synthetic data only.
import { readFileSync } from 'node:fs';
import { PrismaClient } from '@prisma/client';
import { expect, test, type Page } from '@playwright/test';
import { addDaysIso, simDateIn } from '@/lib/metrics/date-range';
import { cleanup, createAccount } from '../auth/fixtures';
import { createShellWorld, type ShellWorld } from '../shell/e2e-world';

const db = new PrismaClient({
  datasources: { db: { url: process.env.DATABASE_URL_TEST ?? process.env.DATABASE_URL } },
});
const bypass = process.env.VERCEL_AUTOMATION_BYPASS_SECRET;

let w: ShellWorld;
let ro: ShellWorld;
let reportingOnly: ShellWorld;
let client: ShellWorld;
let other: { email: string; password: string; id: string };
let totals = { impressions: 0, clicks: 0 };

const hub = (world: ShellWorld = w) => `/p/${world.ids.pid}/reporting`;

async function seedMetrics(world: ShellWorld): Promise<{ impressions: number; clicks: number }> {
  const li = await db.lineItem.findFirstOrThrow({
    where: { sandboxId: world.sandboxId },
    select: { id: true },
  });
  await db.lineItem.update({ where: { id: li.id }, data: { status: 'ACTIVE' } });
  await db.simClock.update({ where: { sandboxId: world.sandboxId }, data: { state: 'PAUSED' } });
  const clock = await db.simClock.findUniqueOrThrow({ where: { sandboxId: world.sandboxId } });
  const simNow = new Date(clock.simStart.getTime() + Number(clock.tickIndex) * 3_600_000);
  const today = simDateIn(simNow, 'Asia/Kolkata');
  let impressions = 0;
  let clicks = 0;
  for (let i = 1; i <= 5; i++) {
    const imp = 10_000 + i * 1_000;
    const clk = 30 + i;
    impressions += imp;
    clicks += clk;
    await db.simDailyMetric.create({
      data: {
        sandboxId: world.sandboxId,
        classroomId: world.classroomId,
        lineItemId: li.id,
        simDate: new Date(`${addDaysIso(today, -i)}T00:00:00Z`),
        impressions: BigInt(imp),
        clicks: BigInt(clk),
        revenue: String(imp / 10),
        totalMediaCost: String(imp / 12),
        convTotal: '2',
      },
    });
  }
  return { impressions, clicks };
}

test.beforeAll(async () => {
  const tag = `pw16-${Date.now().toString(36)}`;
  w = await createShellWorld(db, { tag });
  totals = await seedMetrics(w);
  ro = await createShellWorld(db, { tag: `${tag}-ro`, role: 'READ_ONLY' });
  reportingOnly = await createShellWorld(db, { tag: `${tag}-rep`, role: 'REPORTING_ONLY' });
  client = await createShellWorld(db, { tag: `${tag}-pc`, role: 'PARTNER_CLIENT' });
  // a second person with access to the first sandbox, for sharing
  const acct = await createAccount(db, { tag: `${tag}-other`, role: 'USER' });
  other = { email: acct.user.email, password: acct.password, id: acct.user.id };
  const partner = await db.partner.findFirstOrThrow({ where: { sandboxId: w.sandboxId } });
  await db.userAccessGrant.create({
    data: { userId: other.id, sandboxId: w.sandboxId, partnerId: partner.id, role: 'STANDARD' },
  });
});

test.afterAll(async () => {
  await cleanup(db, {
    userIds: [...w.userIds, ...ro.userIds, ...reportingOnly.userIds, ...client.userIds, other.id],
    classroomIds: [w.classroomId, ro.classroomId, reportingOnly.classroomId, client.classroomId],
  });
  await db.$disconnect();
});

test.beforeEach(async ({ context }) => {
  const ip = `10.${Math.floor(Math.random() * 250) + 1}.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}`;
  await context.setExtraHTTPHeaders({
    ...(bypass ? { 'x-vercel-protection-bypass': bypass } : {}),
    'x-forwarded-for': ip,
  });
});

async function signIn(page: Page, world: { email: string; password: string } = w) {
  await page.goto('/sim/login');
  await page.getByLabel('Email').fill(world.email);
  await page.getByLabel('Password').fill(world.password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.waitForURL((url) => !url.pathname.startsWith('/sim/login'));
}

/** The builder reloads its saved copy after the first save of a new report; wait for that before opening dialogs. */
async function settle(page: Page) {
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1500);
}

async function addField(page: Page, label: string) {
  const search = page.getByPlaceholder('Search metrics and dimensions');
  await search.fill(label);
  await page.getByRole('button', { name: `Add ${label}`, exact: true }).first().click();
  await search.fill('');
}

test('E2E-RPT-01: hub lists the seven templates; a template runs, the file matches the preview', async ({ page }) => {
  await signIn(page);
  await page.goto(hub());
  await expect(page.getByText('Suggested templates')).toBeVisible();
  for (const t of [
    'Advertiser Overview',
    'Insertion Order Pacing',
    'App/URL Viewability',
    'Unique Reach',
    'Unique Reach and Cost',
    'Unique Household Reach',
    'Video Performance',
  ])
    await expect(page.getByRole('list', { name: 'Suggested templates' }).getByText(t, { exact: true })).toBeVisible();
  await expect(page.getByTestId('created-by-chip')).toBeVisible();
  await page.getByTestId('created-by-chip').locator('.MuiChip-deleteIcon').click();
  await expect(page.getByTestId('created-by-chip')).toHaveCount(0);

  await page
    .getByRole('listitem')
    .filter({ hasText: 'Advertiser Overview' })
    .getByRole('button', { name: /Open template/ })
    .click();
  await page.waitForURL(/instant\/new\?template=advertiser-overview/);
  await page.getByRole('button', { name: 'Run report' }).click();
  const table = page.getByTestId('report-table');
  await expect(table).toBeVisible();
  const impr = Math.round(totals.impressions);
  await expect(table).toContainText(impr.toLocaleString('en-US'));

  // saved by the run: files page lists it and the CSV equals the preview
  await expect(page.getByText('Report ready')).toBeVisible();
  const saved = await db.report.findFirstOrThrow({
    where: { sandboxId: w.sandboxId, name: 'Advertiser Overview' },
    orderBy: { createdAt: 'desc' },
  });
  await page.goto(`${hub()}/instant/${saved.id}/runs`);
  await expect(page.getByTestId('run-row')).toHaveCount(1);
  const href = await page.getByRole('link', { name: 'CSV' }).first().getAttribute('href');
  const res = await page.request.get(href!);
  expect(res.ok()).toBe(true);
  const csv = await res.text();
  expect(csv.split('\n')[0]).toContain('Advertiser,Impressions,Clicks');
  expect(csv).toContain(String(impr));
  expect(csv).toContain('Date Range:,');
  const xlsx = await page.request.get(href!.replace('format=csv', 'format=xlsx'));
  expect(xlsx.ok()).toBe(true);
  expect((await xlsx.body()).subarray(0, 2).toString()).toBe('PK');
});

test('E2E-RPT-02: build from scratch, undo and redo, bulk edit, save, rename, save as', async ({ page }) => {
  await signIn(page);
  await page.goto(`${hub()}/instant/new`);
  await expect(page.getByTestId('canvas-empty')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Schedule' })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Run report' })).toBeDisabled();
  await addField(page, 'Impressions');
  await expect(page.getByTestId('zone-chip-impressions')).toBeVisible();
  await page.getByRole('button', { name: 'Undo' }).click();
  await expect(page.getByTestId('zone-chip-impressions')).toHaveCount(0);
  await page.getByRole('button', { name: 'Redo' }).click();
  await expect(page.getByTestId('zone-chip-impressions')).toBeVisible();

  await page.getByRole('button', { name: 'Bulk edit' }).click();
  await page.getByLabel('Dimensions (one per line)').fill('Advertiser');
  await page.getByLabel('Metrics (one per line)').fill('Impressions\nClicks\nNot a field');
  await page.getByRole('button', { name: 'Apply' }).click();
  await expect(page.getByText(/Unknown fields: "Not a field"/)).toBeVisible();
  await page.getByLabel('Metrics (one per line)').fill('Impressions\nClicks');
  await page.getByRole('button', { name: 'Apply' }).click();
  await expect(page.getByTestId('zone-chip-advertiser')).toBeVisible();
  await expect(page.getByTestId('zone-chip-clicks')).toBeVisible();

  // RPT-001: the name is required
  await page.getByRole('button', { name: 'Rename report' }).click();
  await page.getByLabel('Report name').fill('');
  await page.getByLabel('Report name').blur();
  await expect(page.getByText('Enter a value').first()).toBeVisible();
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByText('Report saved')).toHaveCount(0);
  await page.getByRole('button', { name: 'Rename report' }).click();
  await page.getByLabel('Report name').fill('PW scratch report');
  await page.getByLabel('Report name').blur();
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await page.waitForURL(/instant\/[a-z0-9]+$/);
  await expect(page.getByTestId('report-title')).toHaveText('PW scratch report');
  await expect(page.getByRole('button', { name: 'Schedule' })).toBeEnabled();

  await settle(page);
  await page.getByRole('button', { name: 'Save as' }).click();
  await page.getByLabel('Report name').fill('PW scratch copy');
  await page.getByRole('dialog').getByRole('button', { name: 'Save' }).click();
  await expect(page.getByTestId('report-title')).toHaveText('PW scratch copy');
  const ids = await db.report.findMany({
    where: { sandboxId: w.sandboxId, name: { startsWith: 'PW scratch' } },
    select: { publicId: true, name: true },
  });
  expect(ids).toHaveLength(2);
  expect(new Set(ids.map((i) => i.publicId)).size).toBe(2);
});

test('E2E-RPT-03: chart types and their constraints', async ({ page }) => {
  await signIn(page);
  await page.goto(`${hub()}/instant/new`);
  await addField(page, 'Date');
  await addField(page, 'Impressions');
  await page.getByRole('combobox', { name: /Visualization/ }).click();
  await page.getByRole('option', { name: 'Time series chart' }).click();
  await page.getByRole('button', { name: 'Run report' }).click();
  await expect(page.getByTestId('report-canvas')).toBeVisible();
  await expect(page.getByText('Report ready')).toBeVisible();
  // Pie needs exactly one dimension and one metric: Date + Impressions is fine
  await page.getByRole('combobox', { name: /Visualization/ }).click();
  await page.getByRole('option', { name: 'Pie chart' }).click();
  await page.getByRole('button', { name: 'Run report' }).click();
  await expect(page.getByTestId('report-canvas')).toBeVisible();
  // Scatter needs two metrics: only one is selected
  await page.getByRole('combobox', { name: /Visualization/ }).click();
  await page.getByRole('option', { name: 'Scatter chart' }).click();
  await expect(page.getByText(/This chart needs/)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Run report' })).toBeDisabled();
  // Time series without Date is blocked
  await page.getByRole('button', { name: 'Reset' }).click();
  await addField(page, 'Advertiser');
  await addField(page, 'Impressions');
  await page.getByRole('combobox', { name: /Visualization/ }).click();
  await page.getByRole('option', { name: 'Time series chart' }).click();
  await expect(page.getByText(/This chart needs/)).toBeVisible();
});

test('E2E-RPT-04: offline Floodlight report: validation, SAVE AND RUN, schedule summary', async ({ page }) => {
  await signIn(page);
  await page.goto(`${hub()}/offline/new?type=floodlight`);
  // the template is prefilled
  await expect(page.getByTestId('offline-metrics')).toContainText('Floodlight Impressions');
  await expect(page.getByLabel('Report template')).toContainText('Floodlight Impressions');
  await page.getByLabel('Active').check();
  await page.getByLabel('Report name').fill('PW floodlight');
  // RPT-004 empty file name, RPT-003 expires before starts
  await page.getByLabel('File name').fill('');
  await page.getByRole('button', { name: 'SAVE AND RUN' }).click();
  await expect(page.getByText('Enter a value').first()).toBeVisible();
  await page.getByLabel('File name').fill('pw_floodlight');
  await page.getByLabel('Starts').fill('10/10/2026');
  await page.getByLabel('Expires').fill('10/01/2026');
  await page.getByRole('button', { name: 'SAVE AND RUN' }).click();
  await expect(page.getByText('End date must be on or after the start date.').first()).toBeVisible();
  await page.getByLabel('Expires').fill('12/31/2026');
  await expect(page.getByTestId('schedule-summary')).toHaveText(
    'Runs every day at 12 am in Pacific Time (GMT-08:00) until 12/31/2026',
  );
  await page.getByRole('button', { name: 'SAVE AND RUN' }).click();
  await page.waitForURL(/offline\/[a-z0-9]+\/runs$/);
  await expect(page.getByTestId('run-row')).toHaveCount(1);
  await expect(page.getByTestId('run-row')).toContainText('Sam Student');
});

test('E2E-RPT-05: scheduling an instant report stores the next run on the sim clock', async ({ page }) => {
  await signIn(page);
  await page.goto(`${hub()}/instant/new?template=advertiser-overview`);
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await page.waitForURL(/instant\/[a-z0-9]+$/);
  await settle(page);
  await page.getByRole('button', { name: 'Schedule' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('File name').fill('pw_daily');
  await dialog.getByLabel('Email owner (you get a message in the bell)').check();
  await dialog.getByRole('button', { name: 'Save schedule' }).click();
  await expect(page.getByText('Schedule saved')).toBeVisible();
  const row = await db.report.findFirstOrThrow({
    where: { sandboxId: w.sandboxId, name: 'Advertiser Overview' },
    orderBy: { updatedAt: 'desc' },
  });
  expect((row.schedule as { active: boolean }).active).toBe(true);
  expect(row.nextRunSimAt).not.toBeNull();
  expect((row.delivery as { emailOwner: boolean }).emailOwner).toBe(true);
});

test('E2E-RPT-06: share a report with a person who has access to this partner', async ({ page }) => {
  await signIn(page);
  await page.goto(`${hub()}/instant/new?template=advertiser-overview`);
  await page.getByRole('button', { name: 'Rename report' }).click();
  await page.getByLabel('Report name').fill('PW shared report');
  await page.getByLabel('Report name').blur();
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await page.waitForURL(/instant\/[a-z0-9]+$/);
  await settle(page);
  await page.getByRole('button', { name: 'Share', exact: true }).click();
  await page.getByRole('dialog').getByRole('checkbox').first().check();
  await page.getByRole('dialog').getByRole('button', { name: 'Share' }).click();
  await expect(page.getByText('Shared PW shared report')).toBeVisible();
  const shares = await db.reportShare.findMany({ where: { sandboxId: w.sandboxId } });
  expect(shares.map((x) => x.userId)).toEqual([other.id]);
  expect(shares[0]?.canEdit).toBe(false);
  // the hub marks it shared
  await page.goto(`${hub()}?createdBy=any`);
  await expect(page.getByRole('row', { name: /PW shared report/ })).toContainText('Shared');
});

test('E2E-RPT-07: role matrix', async ({ browser }) => {
  const ctxRo = await browser.newContext();
  const p1 = await ctxRo.newPage();
  await signIn(p1, ro);
  await p1.goto(hub(ro));
  await expect(p1.getByRole('button', { name: 'New instant report' }).first()).toBeDisabled();
  await p1.goto(`${hub(ro)}/instant/new`);
  await expect(p1.getByRole('button', { name: 'Run report' })).toBeDisabled();
  await expect(p1.getByRole('button', { name: 'Save', exact: true })).toBeDisabled();
  await ctxRo.close();

  const ctxRep = await browser.newContext();
  const p2 = await ctxRep.newPage();
  await signIn(p2, reportingOnly);
  await p2.goto(hub(reportingOnly));
  await expect(p2.getByRole('button', { name: 'New instant report' }).first()).toBeEnabled();
  const other404 = await p2.goto(`/p/${reportingOnly.ids.pid}/a/${reportingOnly.ids.aid}/campaigns`);
  expect(other404?.status()).toBe(404);
  await ctxRep.close();

  const ctxPc = await browser.newContext();
  const p3 = await ctxPc.newPage();
  await signIn(p3, client);
  await p3.goto(`${hub(client)}/instant/new`);
  await p3.getByPlaceholder('Search metrics and dimensions').fill('Revenue (Partner Currency)');
  await expect(p3.getByText('No matching fields.')).toBeVisible();
  await ctxPc.close();
});

test('E2E-RPT-08: Generate report maps a sentence to a definition and runs it', async ({ page }) => {
  await signIn(page);
  await page.goto(hub());
  await page.getByRole('button', { name: 'Generate report' }).click();
  await page.getByLabel('Describe the report you want').fill('impressions and clicks by device last 14 days');
  await page.getByRole('button', { name: 'Generate', exact: true }).click();
  await expect(page.getByTestId('generated-summary')).toContainText('device_type');
  await page.getByRole('button', { name: 'Open in builder' }).click();
  await page.waitForURL(/instant\/new\?generated=1/);
  await expect(page.getByTestId('zone-chip-device_type')).toBeVisible();
  await expect(page.getByTestId('zone-chip-clicks')).toBeVisible();
  await page.getByRole('button', { name: 'Run report' }).click();
  await expect(page.getByTestId('report-canvas')).toBeVisible();
});

test('FID-REP-01: instant list matches DV360 and rows can be duplicated and deleted after confirmation', async ({ page }) => {
  await signIn(page);
  // a saved report to list
  await page.goto(`${hub()}/instant/new?template=io-pacing`);
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await page.waitForURL(/instant\/[a-z0-9]+$/);
  await settle(page);
  await page.goto(hub());
  // page furniture: no cross-media link, no Tutor chip, Generate report bar with BETA
  await expect(page.getByTestId('cross-media-link')).toHaveCount(0);
  await expect(page.getByText('Tutor', { exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Generate report' })).toBeVisible();
  await expect(page.getByText('BETA')).toBeVisible();
  // seven cards with the tag above the title and a single Open template action, View All, no scroll arrows
  await expect(page.getByTestId('template-card')).toHaveCount(7);
  await expect(page.getByRole('button', { name: /Open template/ })).toHaveCount(7);
  await expect(page.getByRole('button', { name: 'View All' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Next cards' })).toHaveCount(0);
  await expect(page.getByText('Key performance metrics by advertiser')).toBeVisible();
  // filter row
  await expect(page.getByPlaceholder('Enter a search term or select filters')).toBeVisible();
  await expect(page.getByTestId('created-by-chip')).toHaveText('Created by: Me');
  // table columns and cells
  const headers = page.getByRole('table', { name: 'Reports' }).getByRole('columnheader');
  await expect(headers.filter({ hasText: /^Report name$/ })).toHaveCount(1);
  for (const h of ['Created by', 'Last modified', 'Report ID', 'Files'])
    await expect(headers.filter({ hasText: h })).toHaveCount(1);
  const row = page.getByTestId('report-row').filter({ hasText: 'Insertion Order Pacing' }).first();
  await expect(row).toContainText(w.email);
  await expect(row.getByRole('button', { name: 'View', exact: true })).toBeVisible();
  await expect(row.getByRole('cell').nth(4)).toHaveText(/^[A-Z][a-z]{2} \d{1,2}, \d{4} \d{2}:\d{2}$/);
  await expect(page.getByRole('button', { name: /^Actions for/ })).toHaveCount(0);

  // duplicate through the selection bar
  await row.getByRole('checkbox').check();
  await page.getByRole('button', { name: 'Duplicate' }).click();
  const dlg = page.getByRole('dialog');
  await dlg.getByLabel('New report name').fill('PW list copy');
  await dlg.getByRole('button', { name: 'Duplicate' }).click();
  const copy = page.getByTestId('report-row').filter({ hasText: 'PW list copy' });
  await expect(copy).toHaveCount(1);
  // delete asks first; Cancel keeps it, Delete removes it
  await copy.getByRole('checkbox').check();
  await page.getByRole('button', { name: 'Delete', exact: true }).click();
  await expect(page.getByRole('dialog')).toContainText('PW list copy and its files will be removed.');
  await page.getByRole('dialog').getByRole('button', { name: 'Cancel' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(copy).toHaveCount(1);
  await page.getByRole('button', { name: 'Delete', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Delete' }).click();
  await expect(copy).toHaveCount(0);
});

test('FID-REP-02: instant builder layout, inline rename, field groups, unsaved-changes dialog', async ({ page }) => {
  await signIn(page);
  await page.goto(`${hub()}/instant/new`);
  await expect(page.getByTestId('builder-header')).toContainText('Return to Instant Report List');
  await expect(page.getByRole('button', { name: 'Guided tour' })).toBeVisible();
  await expect(page.getByTestId('report-title')).toHaveText('Untitled Report');
  for (const n of ['Schedule', 'Bulk edit', 'Reset', 'Save', 'Save as', 'Run report', 'Download', 'Undo', 'Redo'])
    await expect(page.getByRole('button', { name: n, exact: true })).toBeVisible();
  await expect(page.getByLabel('Auto-run')).toBeVisible();
  await expect(page.getByText('Time zone: Advertiser')).toBeVisible();
  await expect(page.getByTestId('range-text')).toHaveText(/^Date range: [A-Z][a-z]{2} \d{1,2}(, \d{4})?( – (?:[A-Z][a-z]{2} )?\d{1,2}, \d{4})?$/);
  await expect(page.getByTestId('filter-bar')).toContainText(/Partner includes .+ \(\d+\)/);
  await expect(page.getByRole('button', { name: 'Add', exact: true })).toBeVisible();
  // empty state
  const empty = page.getByTestId('canvas-empty');
  await expect(empty).toContainText('Build an instant report');
  await expect(empty).toContainText('To build a report, select filters, metrics, dimensions, and a date range.');
  for (const b of ['Run report:', 'Auto-run:', 'Direct download:']) await expect(empty).toContainText(b);
  await expect(page.getByTestId('empty-illustration')).toBeVisible();
  // panel: Flat table picker, search, Custom data, no British spelling
  await expect(page.getByRole('combobox', { name: /Visualization/ })).toContainText('Flat table');
  await expect(page.getByText('Visualisation')).toHaveCount(0);
  await expect(page.getByPlaceholder('Search metrics and dimensions')).toBeVisible();
  await expect(page.getByRole('button', { name: /Custom data/ })).toBeVisible();
  // field groups: Frequently used in the DV360 order, All data, no counts, Title Case
  const picker = page.getByTestId('field-picker');
  await expect(picker).toContainText('All data');
  await expect(picker.getByRole('button', { name: /Frequently used/ })).toHaveText(/Frequently used$/);
  await expect(picker.getByTestId('picker-field')).toHaveText([
    /^abcAdvertiseradd$/,
    /^abcAdvertiser Currencyadd$/,
    /^123Clicksadd$/,
    /^123Impressionsadd$/,
    /^abcInsertion Orderadd$/,
    /^123Revenue \(Advertiser Currency\)add$/,
  ]);
  await expect(picker.getByRole('button', { name: /^Active View$/ })).toBeVisible();
  await expect(picker.getByText(/\(\d+\)/)).toHaveCount(0);
  // collapse the panel
  await page.getByRole('button', { name: 'Collapse panel' }).click();
  await expect(page.getByTestId('builder-panel')).toHaveCount(0);
  await page.getByRole('button', { name: 'Expand panel' }).click();

  // inline rename: Enter commits
  await page.getByRole('button', { name: 'Rename report' }).click();
  await page.getByLabel('Report name').fill('PW inline name');
  await page.getByLabel('Report name').press('Enter');
  await expect(page.getByTestId('report-title')).toHaveText('PW inline name');

  // leaving with changes asks first; Continue editing stays, Discard changes leaves
  await addField(page, 'Impressions');
  await page.getByRole('button', { name: /Return to Instant Report List/ }).click();
  const dlg = page.getByRole('dialog');
  await expect(dlg).toContainText('Unsaved Changes');
  await dlg.getByRole('button', { name: 'Continue editing' }).click();
  await expect(page.getByTestId('zone-chip-impressions')).toBeVisible();
  await page.getByRole('button', { name: /Return to Instant Report List/ }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Discard changes' }).click();
  await page.waitForURL((u) => u.pathname === hub() || u.pathname === `${hub()}/`);
});

test('FID-REP-03: results show a totals row, Western grouping, and the download carries the report footer', async ({ page }) => {
  await signIn(page);
  await page.goto(`${hub()}/instant/new`);
  await addField(page, 'Date');
  await addField(page, 'Impressions');
  await addField(page, 'Click Rate (CTR)');
  await page.getByRole('button', { name: 'Run report' }).click();
  const table = page.getByTestId('report-table');
  await expect(table).toBeVisible();
  const totalRow = page.getByTestId('report-totals');
  await expect(totalRow).toBeVisible();
  await expect(totalRow.getByRole('cell').first()).toHaveText('Total');
  await expect(totalRow).toContainText(totals.impressions.toLocaleString('en-US'));
  await expect(totalRow.getByRole('cell').nth(2)).toHaveText(/^\d+\.\d{2}%$/);
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    (async () => {
      await page.getByRole('button', { name: 'Download' }).click();
      await page.getByRole('menuitem', { name: 'CSV' }).click();
    })(),
  ]);
  const path = await download.path();
  const csv = readFileSync(path, 'utf8');
  const lines = csv.split('\n');
  expect(lines[0]).toBe('Date,Impressions,Click Rate (CTR)');
  expect(lines[1]).toMatch(/^\d{4}\/\d{2}\/\d{2},/);
  expect(csv).toContain('Report Time:,');
  expect(csv).toContain('Group By:,Date');
  expect(csv).not.toContain('Total,');
});

test('FID-OFF-01: offline list, then the classic builder layout with schedule and delivery', async ({ page }) => {
  await signIn(page);
  await page.goto(`${hub()}?tab=offline`);
  await expect(page.getByRole('button', { name: 'Generate report' })).toHaveCount(0);
  await expect(page.getByText('Tutor', { exact: true })).toHaveCount(0);
  await expect(page.getByTestId('cross-media-link')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'New Offline Report' })).toBeVisible();
  await page.getByRole('button', { name: 'New Offline Report' }).click();
  await expect(page.getByRole('menuitem', { name: 'Floodlight' })).toBeVisible();
  await expect(page.getByRole('menuitem', { name: 'Inventory Availability' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByText('Show rows:')).toBeVisible();
  await expect(page.getByTestId('pager-range')).toHaveText(/^\d+ - \d+$/);
  await expect(page.getByText('Scheduled', { exact: true })).toHaveCount(0);

  await page.goto(`${hub()}/offline/new?type=floodlight`);
  await expect(page.getByTestId('offline-ids')).toContainText('Report type: Floodlight');
  await expect(page.getByTestId('offline-ids')).toContainText('ID:');
  await expect(page.getByRole('combobox', { name: 'Date range' })).toContainText(/^Last 7 days : [A-Z][a-z]{2} \d{1,2}, \d{4} - [A-Z][a-z]{2} \d{1,2}, \d{4}$/);
  await expect(page.getByRole('combobox', { name: 'Language formatting' })).toContainText('English (raw)');
  await expect(page.getByText('Numbers are displayed without commas or currency symbols.')).toBeVisible();
  const filters = page.getByTestId('offline-filters');
  await expect(filters).toContainText('Partner:');
  await expect(filters).toContainText('Advertiser');
  await expect(filters.getByRole('button', { name: '+ add filter' })).toBeVisible();
  await expect(page.getByTestId('offline-metrics')).toContainText('Floodlight Impressions');
  // schedule is greyed until Active; the time zone is Pacific; dates are MM/DD/YYYY
  await expect(page.getByLabel('Starts')).toBeDisabled();
  await expect(page.getByLabel('Time zone')).toContainText('Pacific Time (GMT-08:00)');
  await page.getByLabel('Active').check();
  await expect(page.getByLabel('Starts')).toBeEnabled();
  await expect(page.getByLabel('Starts')).toHaveValue(/^\d{2}\/\d{2}\/\d{4}$/);
  await expect(page.getByLabel('Expires')).toHaveValue(/^\d{2}\/\d{2}\/\d{4}$/);
  // delivery
  await expect(page.getByLabel('Format')).toContainText('CSV');
  await expect(page.getByLabel(new RegExp(`Email owner \\(${w.email.replace('.', '\\.')}\\)`))).toBeVisible();
  await expect(page.getByText('Share with:')).toBeVisible();
  await expect(page.getByRole('button', { name: '+ add people' })).toBeDisabled();
  await expect(page.getByText('You can also access this report as an Instant Report.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'OPEN IN INSTANT REPORTING' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'SAVE AND RUN' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Save', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Cancel' })).toBeVisible();
  // unsaved-changes dialog on Cancel after an edit
  await page.getByLabel('Report name').fill('PW offline edit');
  await page.getByRole('button', { name: 'Cancel' }).click();
  await expect(page.getByRole('dialog')).toContainText('Unsaved Changes');
  await page.getByRole('dialog').getByRole('button', { name: 'Continue editing' }).click();
  // Save, then Share with is enabled
  await page.getByLabel('File name').fill('pw_offline_edit');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByText('Report saved')).toBeVisible();
  await expect(page.getByRole('button', { name: '+ add people' })).toBeEnabled();
});

test('a report route under an advertiser is the 404 page', async ({ page }) => {
  await signIn(page);
  const res = await page.goto(`/p/${w.ids.pid}/a/${w.ids.aid}/reporting`);
  expect(res?.status()).toBe(404);
});
