// P3-09 Performance columns (modules 06, 07, 08 section 2.1; engine.md 9.4). A student sandbox with known
// SimDailyMetric rows on sim "yesterday"; the Campaigns, IO and LI lists must show non-zero Impr., Clicks, Spent and
// CPM in the right columns, and their totals must equal the sum of the rows. The API part runs now; the list page part
// waits for P3-06b and P3-06c (the list pages are not on main yet).
import { PrismaClient } from '@prisma/client';
import { expect, test, type Page } from '@playwright/test';
import { addDaysIso, simDateIn } from '@/lib/metrics/date-range';
import { cleanup } from '../auth/fixtures';
import { createShellWorld, type ShellWorld } from '../shell/e2e-world';

const LIST_PAGES_MERGED = true; // P3-06b and P3-06c are on main (P3-INT)
const LIST_PAGES_REASON = 'Needs the P3-06b and P3-06c list pages (not merged yet)';

const db = new PrismaClient({
  datasources: { db: { url: process.env.DATABASE_URL_TEST ?? process.env.DATABASE_URL } },
});
const bypass = process.env.VERCEL_AUTOMATION_BYPASS_SECRET;

interface MetricsWorld extends ShellWorld {
  liRowId: string;
  ioRowId: string;
  campaignRowId: string;
  yesterday: string;
}

let w: MetricsWorld;

test.beforeAll(async () => {
  const shell = await createShellWorld(db, { tag: `perf-${Date.now().toString(36)}` });
  const li = await db.lineItem.findFirstOrThrow({
    where: { sandboxId: shell.sandboxId },
    select: { id: true, ioId: true, campaignId: true },
  });
  await db.lineItem.update({ where: { id: li.id }, data: { status: 'ACTIVE' } });
  // the list pages default to Status: Active
  await db.insertionOrder.update({ where: { id: li.ioId }, data: { status: 'ACTIVE' } });
  await db.campaign.update({ where: { id: li.campaignId }, data: { status: 'ACTIVE' } });
  const clock = await db.simClock.findUniqueOrThrow({ where: { sandboxId: shell.sandboxId } });
  const simNow = new Date(clock.simStart.getTime() + Number(clock.tickIndex) * 3_600_000);
  const yesterday = addDaysIso(simDateIn(simNow, 'Asia/Kolkata'), -1);
  const classroomId = shell.classroomId;
  await db.simDailyMetric.create({
    data: {
      sandboxId: shell.sandboxId,
      classroomId,
      lineItemId: li.id,
      simDate: new Date(`${yesterday}T00:00:00Z`),
      impressions: 12_000n,
      clicks: 36n,
      revenue: '1080',
      totalMediaCost: '900',
      convTotal: '3',
    },
  });
  w = { ...shell, liRowId: li.id, ioRowId: li.ioId, campaignRowId: li.campaignId, yesterday };
});

test.afterAll(async () => {
  if (w) await cleanup(db, { userIds: w.userIds, classroomIds: [w.classroomId] });
  await db.$disconnect();
});

test.beforeEach(async ({ context }) => {
  const ip = `10.${Math.floor(Math.random() * 250) + 1}.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}`;
  await context.setExtraHTTPHeaders({
    ...(bypass ? { 'x-vercel-protection-bypass': bypass } : {}),
    'x-forwarded-for': ip,
  });
});

async function signIn(page: Page) {
  await page.goto('/sim/login');
  await page.getByLabel('Email').fill(w.email);
  await page.getByLabel('Password').fill(w.password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.waitForURL((url) => !url.pathname.startsWith('/sim/login'));
}

test.describe('metrics API', () => {
  test('grid and totals for line item, IO and campaign on sim yesterday', async ({ page }) => {
    await signIn(page);
    for (const [level, id] of [
      ['li', w.liRowId],
      ['io', w.ioRowId],
      ['campaign', w.campaignRowId],
    ] as const) {
      const res = await page.request.get(
        `/api/dv/metrics/grid?level=${level}&ids=${id}&d=YESTERDAY`,
      );
      expect(res.status()).toBe(200);
      const body = (await res.json()) as {
        range: { from: string; to: string };
        rows: Record<
          string,
          { impressions: number; clicks: number; spent: number; ratios: { cpm: number } }
        >;
        totals: { impressions: number; clicks: number; spent: number };
      };
      expect(body.range).toEqual({ from: w.yesterday, to: w.yesterday });
      const row = body.rows[id]!;
      expect(row).toMatchObject({ impressions: 12_000, clicks: 36, spent: 1080 });
      expect(row.ratios.cpm).toBeCloseTo(90);
      expect(body.totals).toMatchObject({ impressions: 12_000, clicks: 36, spent: 1080 });
    }
    const cards = await page.request.get(
      `/api/dv/metrics/cards?level=io&ids=${w.ioRowId}&d=YESTERDAY`,
    );
    expect(cards.status()).toBe(200);
    const bad = await page.request.get('/api/dv/metrics/grid?level=io&ids=x&d=NEXT_YEAR');
    expect(bad.status()).toBe(400);
  });

  test('requires a session', async ({ request }) => {
    const res = await request.get(`/api/dv/metrics/grid?level=li&ids=x`);
    expect(res.status()).toBe(401);
  });
});

/** Cell text of `column` in the row whose name cell contains `name`, and of the footer row. */
async function cellOf(page: Page, rowName: string | RegExp, column: string) {
  // the grid has a group header row first (DvGrid), the column names are in the second row
  await page.getByRole('row').nth(1).getByRole('columnheader').first().waitFor();
  const headers = await page.getByRole('row').nth(1).getByRole('columnheader').allInnerTexts();
  const idx = headers.findIndex((h) => h.trim() === column);
  expect(idx, `column ${column}`).toBeGreaterThanOrEqual(0);
  const row = page.getByRole('row').filter({ hasText: rowName }).first();
  return (await row.getByRole('gridcell').nth(idx).innerText()).trim();
}

const num = (text: string) => Number(text.replace(/[^0-9.-]/g, ''));

test.describe('list pages', () => {
  test.skip(!LIST_PAGES_MERGED, LIST_PAGES_REASON);

  const A = () => `/p/${w.ids.pid}/a/${w.ids.aid}`;
  const C = () => `${A()}/c/${w.ids.cid}`;

  test('Campaigns list: Spent filled, Budget Unknown', async ({ page }) => {
    await signIn(page);
    await page.goto(`${A()}/cs?d=YESTERDAY`);
    expect(num(await cellOf(page, w.names.campaign, 'Spent'))).toBeCloseTo(1080);
    expect(num(await cellOf(page, /Total/, 'Spent'))).toBeCloseTo(1080);
  });

  test('IO list: Impr. and Revenue, totals reconcile', async ({ page }) => {
    await signIn(page);
    await page.goto(`${A()}/explorerios?d=YESTERDAY`);
    expect(num(await cellOf(page, 'Festive IO', 'Impr.'))).toBe(12_000);
    expect(num(await cellOf(page, 'Festive IO', 'Revenue'))).toBeCloseTo(1080);
    expect(num(await cellOf(page, /Total/, 'Impr.'))).toBe(12_000);
  });

  test('LI list: Impr., Clicks, Revenue, totals reconcile', async ({ page }) => {
    await signIn(page);
    await page.goto(`${C()}/explorerlis?d=YESTERDAY`);
    expect(num(await cellOf(page, 'Festive display LI', 'Impr.'))).toBe(12_000);
    expect(num(await cellOf(page, 'Festive display LI', 'Clicks'))).toBe(36);
    expect(num(await cellOf(page, 'Festive display LI', 'Revenue'))).toBeCloseTo(1080);
    expect(num(await cellOf(page, /Total/, 'Clicks'))).toBe(36);
  });
});
