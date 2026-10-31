// P4-07, module 16 6.2: E2E-RPT-01 hub and template run, 02 build/save/save as, 03 visualisations, 04 offline Floodlight,
// 05 schedule, 06 share, 07 role matrix, 08 generate report. Synthetic data only.
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
    'Advertiser overview',
    'Insertion order pacing',
    'App/URL viewability',
    'Unique reach',
    'Unique reach and cost',
    'Unique household reach',
    'Video performance',
  ])
    await expect(page.getByRole('list', { name: 'Suggested templates' }).getByText(t, { exact: true })).toBeVisible();
  await expect(page.getByTestId('created-by-chip')).toBeVisible();
  await page.getByTestId('created-by-chip').locator('.MuiChip-deleteIcon').click();
  await expect(page.getByText('Created by: Anyone with access')).toBeVisible();

  await page
    .getByRole('listitem')
    .filter({ hasText: 'Advertiser overview' })
    .getByRole('button')
    .first()
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
    where: { sandboxId: w.sandboxId, name: 'Advertiser overview' },
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
  await page.getByRole('combobox', { name: /Visualisation/ }).click();
  await page.getByRole('option', { name: 'Time series chart' }).click();
  await page.getByRole('button', { name: 'Run report' }).click();
  await expect(page.getByTestId('report-canvas')).toBeVisible();
  await expect(page.getByText('Report ready')).toBeVisible();
  // Pie needs exactly one dimension and one metric: Date + Impressions is fine
  await page.getByRole('combobox', { name: /Visualisation/ }).click();
  await page.getByRole('option', { name: 'Pie chart' }).click();
  await page.getByRole('button', { name: 'Run report' }).click();
  await expect(page.getByTestId('report-canvas')).toBeVisible();
  // Scatter needs two metrics: only one is selected
  await page.getByRole('combobox', { name: /Visualisation/ }).click();
  await page.getByRole('option', { name: 'Scatter chart' }).click();
  await expect(page.getByText(/This chart needs/)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Run report' })).toBeDisabled();
  // Time series without Date is blocked
  await page.getByRole('button', { name: 'Reset' }).click();
  await addField(page, 'Advertiser');
  await addField(page, 'Impressions');
  await page.getByRole('combobox', { name: /Visualisation/ }).click();
  await page.getByRole('option', { name: 'Time series chart' }).click();
  await expect(page.getByText(/This chart needs/)).toBeVisible();
});

test('E2E-RPT-04: offline Floodlight report: validation, SAVE AND RUN, schedule summary', async ({ page }) => {
  await signIn(page);
  await page.goto(`${hub()}/offline/new?type=floodlight`);
  await page.getByLabel('Report template').click();
  await page.getByRole('option', { name: 'Floodlight Impressions' }).click();
  await expect(page.getByTestId('offline-metrics')).toContainText('Impressions');
  await page.getByLabel('Report name').fill('PW floodlight');
  // RPT-004 empty file name, RPT-003 expires before starts
  await page.getByLabel('File name').fill('');
  await page.getByRole('button', { name: 'SAVE AND RUN' }).click();
  await expect(page.getByText('Enter a value').first()).toBeVisible();
  await page.getByLabel('File name').fill('pw_floodlight');
  await page.getByLabel('Starts').fill('2026-10-10');
  await page.getByLabel('Expires').fill('2026-10-01');
  await page.getByRole('button', { name: 'SAVE AND RUN' }).click();
  await expect(page.getByText('End date must be on or after the start date.').first()).toBeVisible();
  await page.getByLabel('Expires').fill('2026-12-31');
  await expect(page.getByTestId('schedule-summary')).toHaveText(
    'Runs every day at 12 am in UTC until 2026-12-31',
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
    where: { sandboxId: w.sandboxId, name: 'Advertiser overview' },
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
  await page.goto(hub());
  await page.getByTestId('created-by-chip').locator('.MuiChip-deleteIcon').click();
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

test('a report route under an advertiser is the 404 page', async ({ page }) => {
  await signIn(page);
  const res = await page.goto(`/p/${w.ids.pid}/a/${w.ids.aid}/reporting`);
  expect(res?.status()).toBe(404);
});
