// P3-INT: the classroom demo path of docs/demo-script.md, run end to end against the seeded test database.
// Steps 1 to 2 use a Super admin and a student created with the shared fixtures (synthetic data only); the
// student then walks Overview -> advertiser -> campaign -> IO (validation error, then success) -> Display line item
// with a creative -> activate -> engine ticks through POST /api/sim/engine/tick -> Performance columns show numbers.
import { PrismaClient } from '@prisma/client';
import { expect, test, type Page } from '@playwright/test';
import { cleanup, createAccount } from '../auth/fixtures';
import { createShellWorld, type ShellWorld } from '../shell/e2e-world';

const db = new PrismaClient({
  datasources: { db: { url: process.env.DATABASE_URL_TEST ?? process.env.DATABASE_URL } },
});
// Test-only value; playwright.config.ts passes the same default to the server it starts.
const CRON_SECRET = process.env.CRON_SECRET ?? 'e2e-demo-cron-secret';

let w: ShellWorld;
const created: { userIds: string[]; classroomIds: string[] } = { userIds: [], classroomIds: [] };

async function signIn(page: Page, email: string, password: string) {
  await page.goto('/sim/login');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.waitForURL((url) => !url.pathname.startsWith('/sim/login'));
}

test.beforeAll(async () => {
  w = await createShellWorld(db, { tag: `demo-${Date.now().toString(36)}` });
  // the engine needs an exchange the partner has enabled
  const partner = await db.partner.findFirstOrThrow({ where: { sandboxId: w.sandboxId } });
  const exchange = await db.exchange.upsert({
    where: { code: 'DEMO_EXCHANGE' },
    update: {},
    create: { code: 'DEMO_EXCHANGE', name: 'Demo Exchange' },
  });
  await db.partnerExchange.create({
    data: { sandboxId: w.sandboxId, partnerId: partner.id, exchangeId: exchange.id },
  });
  // No creative upload exists before P4-01 and the review step needs real time, so the fixture is already reviewed.
  const creative = await db.creative.create({
    data: {
      sandboxId: w.sandboxId,
      advertiserId: w.rows.advertiserId,
      name: 'Demo banner 300x250',
      kind: 'STANDARD_IMAGE',
      width: 300,
      height: 250,
      dv360Review: 'SERVABLE',
    },
  });
  await db.creativeReview.create({
    data: {
      sandboxId: w.sandboxId,
      creativeId: creative.id,
      exchangeId: exchange.id,
      status: 'APPROVED',
      sslStatus: 'APPROVED',
    },
  });
  created.userIds.push(...w.userIds);
  created.classroomIds.push(w.classroomId);
});

test.afterAll(async () => {
  await cleanup(db, created);
  await db.$disconnect();
});

test('demo path: Super admin, student, campaign to metrics', async ({ page, browser }) => {
  test.setTimeout(240_000);
  const base = `/p/${w.ids.pid}/a/${w.ids.aid}`;

  await test.step('1. the Super admin signs in and lands on the console', async () => {
    const admin = await createAccount(db, { tag: 'demo-super', role: 'SUPER_ADMIN' });
    created.userIds.push(admin.user.id);
    const ctx = await browser.newContext();
    const console_ = await ctx.newPage();
    await signIn(console_, admin.user.email, admin.password);
    await expect(console_).toHaveURL(/\/manage\/accounts$/);
    await ctx.close();
  });

  await test.step('2. student signs in and opens the Overview', async () => {
    await signIn(page, w.email, w.password);
    // A student lands on /sim/welcome, which opens the sandbox home as soon as the sandbox is ready (it is here).
    await expect(page).toHaveURL(/\/home_v3$/);
    await expect(page).toHaveTitle('Overview - DV360 Simulator by Adsmetor');
  });

  await test.step('3. opens the advertiser and creates a campaign', async () => {
    await page.goto(`${base}/cs`);
    await page
      .getByRole('link', { name: 'New campaign' })
      .or(page.getByRole('button', { name: 'New campaign' }))
      .click();
    await page.waitForURL(/\/cs\/new/);
    await page.locator('#name').fill('Demo Diwali Launch');
    await page.getByRole('combobox', { name: /Campaign goal/ }).click();
    await page.getByRole('option', { name: /Raise awareness/ }).click();
    await page.getByRole('combobox', { name: /Goal KPI/ }).click();
    await page.getByRole('option', { name: /^CPM/ }).first().click();
    await page.locator('#kpi-value').fill('50');
    await page.getByRole('checkbox', { name: 'Display' }).check();
    await page.getByRole('button', { name: 'Create' }).click();
    await page.waitForURL(/\/c\/\d+\/explorerios/);
  });

  await test.step('4. insertion order: validation error, then success', async () => {
    await page
      .getByRole('link', { name: 'New Insertion Order' })
      .or(page.getByRole('button', { name: 'New Insertion Order' }))
      .click();
    await page.getByRole('radio', { name: /Standard/ }).check();
    await page.getByRole('radio', { name: /Brand awareness/ }).check();
    await page.getByRole('button', { name: 'Next' }).click();
    await expect(page).toHaveURL(/type=STANDARD&objective=BRAND_AWARENESS/);
    await page.getByRole('button', { name: 'Create' }).click();
    await expect(page.getByText('Enter a value').first()).toBeVisible();
    await expect(page).toHaveURL(/type=STANDARD&objective=BRAND_AWARENESS/);

    await page.locator('#name').fill('Demo IO');
    await page.getByLabel('Segment 1 budget').fill('100000');
    await page.getByLabel('KPI value').fill('50');
    await page.getByRole('button', { name: 'Create' }).click();
    await page.waitForURL(/\/io\/\d+\/explorerlis/);
  });

  await test.step('5. Display line item with a creative', async () => {
    await page
      .getByRole('link', { name: 'New line item' })
      .or(page.getByRole('button', { name: 'New line item' }))
      .click();
    await page
      .getByRole('button', { name: /^Display/ })
      .first()
      .click();
    await expect(page).toHaveURL(/lis\/new\?type=DISPLAY/);
    await page.locator('#name').fill('Demo Display LI');
    await page.getByRole('checkbox', { name: /Demo banner/ }).check();
    await page.getByRole('radio', { name: /Does not contain EU political ads/ }).check();
    await page.getByRole('button', { name: 'Create' }).click();
    await page.waitForURL(/\/li\/\d+\/details/);
    await expect(page.getByRole('combobox', { name: 'Status' })).toContainText('Draft');
  });

  const li = await db.lineItem.findFirstOrThrow({
    where: { sandboxId: w.sandboxId, name: 'Demo Display LI' },
  });

  await test.step('6. activates the line item (and its parents)', async () => {
    // Activation of the chain: the parents are activated first, as a student would on the list pages.
    await db.campaign.updateMany({
      where: { sandboxId: w.sandboxId, name: 'Demo Diwali Launch' },
      data: { status: 'ACTIVE' },
    });
    await db.insertionOrder.updateMany({
      where: { sandboxId: w.sandboxId, name: 'Demo IO' },
      data: { status: 'ACTIVE' },
    });
    await page.getByRole('combobox', { name: 'Status' }).click();
    await page.getByRole('option', { name: 'Active' }).click();
    await page.getByRole('button', { name: 'Save' }).click();
    await expect
      .poll(async () => (await db.lineItem.findUnique({ where: { id: li.id } }))?.status)
      .toBe('ACTIVE');
  });

  await test.step('7. the engine ticks (timer endpoint) and delivery appears', async () => {
    // five real minutes at 5 minutes per sim day are 24 owed ticks
    await db.simClock.update({
      where: { sandboxId: w.sandboxId },
      data: {
        lastAdvanceRealAt: new Date(Date.now() - 5 * 60_000),
        remainderMs: 0,
      },
    });
    const res = await page.request.post('/api/sim/engine/tick', {
      headers: { 'x-cron-secret': CRON_SECRET },
    });
    expect(res.status()).toBe(200);
    const body = (await res.json()) as { ok: boolean; ticks: number };
    expect(body.ok).toBe(true);
    expect(body.ticks).toBeGreaterThan(0);
  });

  await test.step('8. Performance columns show numbers', async () => {
    // 24 ticks from sim day 3 are all of sim "yesterday"
    const campaign = await db.campaign.findUniqueOrThrow({ where: { id: li.campaignId } });
    await page.goto(`${base}/c/${campaign.publicId}/explorerlis?d=YESTERDAY`);
    const header = page.getByRole('row').nth(1);
    await header.getByRole('columnheader').first().waitFor();
    const names = await header.getByRole('columnheader').allInnerTexts();
    const imprIdx = names.findIndex((n) => n.trim() === 'Impr.');
    expect(imprIdx).toBeGreaterThanOrEqual(0);
    const row = page.getByRole('row').filter({ hasText: 'Demo Display LI' }).first();
    const impressions = Number(
      (await row.getByRole('gridcell').nth(imprIdx).innerText()).replace(/[^0-9]/g, ''),
    );
    expect(impressions).toBeGreaterThan(0);
  });
});
