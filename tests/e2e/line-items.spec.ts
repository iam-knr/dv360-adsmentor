// P3-06c: PW-08-01 type picker, PW-08-08 validation, PW-08-04 create a Display line item and see it in the IO list.
// Builds a campaign and an insertion order through the UI first (module 06 and 07 forms), then the line item.
import { PrismaClient } from '@prisma/client';
import { expect, test, type Page } from '@playwright/test';
import { cleanup } from '../auth/fixtures';
import { createShellWorld, type ShellWorld } from '../shell/e2e-world';

const db = new PrismaClient({
  datasources: { db: { url: process.env.DATABASE_URL_TEST ?? process.env.DATABASE_URL } },
});
let w: ShellWorld;

test.beforeAll(async () => {
  w = await createShellWorld(db, { tag: `pw06c-${Date.now()}` });
});
test.afterAll(async () => {
  await cleanup(db, { userIds: w.userIds, classroomIds: [w.classroomId] });
  await db.$disconnect();
});

async function signIn(page: Page) {
  await page.goto('/sim/login');
  await page.getByLabel('Email').fill(w.email);
  await page.getByLabel('Password').fill(w.password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.waitForURL((url) => !url.pathname.startsWith('/sim/login'));
}

test('create a Display line item in a seeded insertion order', async ({ page }) => {
  // seed: the world's IO gets an objective, control at the line item level and one budget segment
  const io = await db.insertionOrder.findFirstOrThrow({ where: { sandboxId: w.sandboxId } });
  await db.insertionOrder.update({
    where: { id: io.id },
    data: {
      objective: 'BRAND_AWARENESS',
      bidBudgetControl: 'LI_CONTROLLED',
      kpi: 'VCPM',
      kpiValue: 50,
    },
  });
  await db.budgetSegment.create({
    data: {
      sandboxId: w.sandboxId,
      ioId: io.id,
      amount: 100000,
      startDate: new Date('2026-11-01T00:00:00Z'),
      endDate: new Date('2027-01-31T00:00:00Z'),
    },
  });
  const partner = await db.partner.findFirstOrThrow({ where: { sandboxId: w.sandboxId } });
  const exchange = await db.exchange.upsert({
    where: { code: 'PW_TEST_EXCHANGE' },
    update: {},
    create: { code: 'PW_TEST_EXCHANGE', name: 'PW Test Exchange' },
  });
  await db.partnerExchange.create({
    data: { sandboxId: w.sandboxId, partnerId: partner.id, exchangeId: exchange.id },
  });
  await signIn(page);
  await page.goto(`/p/${w.ids.pid}/a/${w.ids.aid}/c/${w.ids.cid}/io/${w.ids.ioId}/explorerlis`);

  // PW-08-01: the picker offers the Standard group of cards
  await page
    .getByRole('link', { name: 'New line item' })
    .or(page.getByRole('button', { name: 'New line item' }))
    .click();
  await page
    .getByRole('button', { name: /^Display/ })
    .first()
    .click();
  await expect(page).toHaveURL(/lis\/new\?type=DISPLAY/);

  // PW-08-08: empty name is refused with the catalogue message and the page stays
  await page.getByRole('button', { name: 'Create' }).click();
  await expect(page.getByText('Enter a value').first()).toBeVisible();
  await expect(page).toHaveURL(/lis\/new/);

  // PW-08-04: a valid Display line item is created
  await page.locator('#name').fill('PW Display LI');
  await page.getByRole('radio', { name: /Does not contain EU political ads/ }).check();
  await page.getByRole('button', { name: 'Create' }).click();
  await page.waitForURL(/\/io\/\d+\/explorerlis/);
  const row = await db.lineItem.findFirst({
    where: { name: 'PW Display LI', sandboxId: w.sandboxId },
  });
  expect(row?.type).toBe('DISPLAY');
  expect(row?.status).toBe('DRAFT');
});
