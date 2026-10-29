// P4-05, module 15 6.2: E2E-RES-05 custom bidding wizard happy path (and attach to a line item), E2E-RES-06
// validation errors on each step. Synthetic data only.
import { PrismaClient } from '@prisma/client';
import { expect, test, type Page } from '@playwright/test';
import { cleanup } from '../auth/fixtures';
import { createShellWorld, type ShellWorld } from '../shell/e2e-world';

const db = new PrismaClient({
  datasources: { db: { url: process.env.DATABASE_URL_TEST ?? process.env.DATABASE_URL } },
});
let w: ShellWorld;
let readOnly: ShellWorld;

const adv = (world: ShellWorld = w) => `/p/${world.ids.pid}/a/${world.ids.aid}`;

test.beforeAll(async () => {
  const tag = `pw15cb-${Date.now()}`;
  w = await createShellWorld(db, { tag });
  readOnly = await createShellWorld(db, { tag: `${tag}-ro`, role: 'READ_ONLY' });
});
test.afterAll(async () => {
  await cleanup(db, {
    userIds: [...w.userIds, ...readOnly.userIds],
    classroomIds: [w.classroomId, readOnly.classroomId],
  });
  await db.$disconnect();
});

async function signIn(page: Page, world: ShellWorld = w) {
  await page.goto('/sim/login');
  await page.getByLabel('Email').fill(world.email);
  await page.getByLabel('Password').fill(world.password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.waitForURL((url) => !url.pathname.startsWith('/sim/login'));
}

test('E2E-RES-05: build an algorithm with a rule and two multipliers, test it, save it as training', async ({
  page,
}) => {
  await signIn(page);
  await page.goto(`${adv()}/custom-bidding`);
  await expect(page.getByText('No custom bidding algorithms yet')).toBeVisible();
  await page.getByRole('link', { name: 'New algorithm' }).click();

  // Step 1: Set up.
  await page.locator('#custom-bidding-name').fill('PW viewable value');
  await page.getByRole('radio', { name: /Brand awareness/ }).check();
  await page.getByRole('button', { name: 'Add rule' }).click();
  await expect(page.getByLabel('Rule 1 signal')).toBeVisible();
  await page.getByRole('button', { name: 'Add multiplier' }).click();
  await page.getByRole('button', { name: 'Add multiplier' }).click();
  await page.getByLabel('Ad position Above the fold factor').fill('2');
  await page.getByRole('button', { name: 'Next' }).click();

  // Step 2: Test. Next stays disabled until a run exists.
  await expect(page).toHaveURL(/step=test/);
  await expect(page.getByRole('button', { name: 'Next' })).toBeDisabled();
  await page.getByRole('button', { name: 'Run test' }).click();
  await expect(page.getByText('Passed ✓')).toBeVisible();
  await expect(page.getByText('2,000')).toBeVisible();
  await expect(page.getByRole('region', { name: 'Score histogram' })).toBeVisible();
  await page.getByRole('button', { name: 'Next' }).click();

  // Step 3: Save.
  await expect(page).toHaveURL(/step=save/);
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await page.waitForURL(`**${adv()}/custom-bidding`);
  const row = page.getByRole('row', { name: /PW viewable value/ });
  await expect(row).toBeVisible();
  await expect(row).toContainText('Training');
  await expect(row).toContainText('Rule based');

  const alg = await db.customBiddingAlgorithm.findFirstOrThrow({
    where: { sandboxId: w.sandboxId, name: 'PW viewable value' },
    include: { rules: true, multipliers: { include: { values: true } } },
  });
  expect(alg).toMatchObject({ status: 'TRAINING', readinessPct: 0, isDraft: false });
  expect(alg.rules).toHaveLength(1);
  expect(alg.multipliers.map((m) => m.kind).sort()).toEqual(['AD_POSITION', 'CREATIVE_DIMENSION']);

  // A saved algorithm opens in the same wizard and goes to Suspended and back from the list.
  await row.getByRole('button', { name: 'Suspend' }).click();
  await expect(row).toContainText('Suspended');
  await row.getByRole('button', { name: 'Activate' }).click();
  await expect(row).toContainText('Training');
  await db.customBiddingAlgorithm.update({
    where: { id: alg.id },
    data: { status: 'ACTIVE', readinessPct: 100, modelReadiness: 'READY' },
  });
  await page.reload();
  await expect(page.getByRole('row', { name: /PW viewable value/ })).toContainText('Active');

  // History shows the create.
  const groups = await db.changeGroup.findMany({
    where: { sandboxId: w.sandboxId, entityId: alg.id },
  });
  expect(groups.length).toBeGreaterThanOrEqual(1);
});

test('E2E-RES-06: each step blocks with the module 15 messages', async ({ page }) => {
  await signIn(page);
  await page.goto(`${adv()}/custom-bidding/new`);

  // Step 1: nothing filled in.
  await page.getByRole('button', { name: 'Next' }).click();
  await expect(page.getByText('Enter a value').first()).toBeVisible();
  await expect(page.getByText('A selection is required')).toBeVisible();
  await expect(page.getByText('At least 1 rule is required')).toBeVisible();

  // A fifth multiplier and a duplicate type.
  await page.locator('#custom-bidding-name').fill('PW errors');
  await page.getByRole('radio', { name: /Clicks/ }).check();
  await page.getByRole('button', { name: 'Add rule' }).click();
  for (let i = 0; i < 5; i += 1) await page.getByRole('button', { name: 'Add multiplier' }).click();
  await page.getByRole('button', { name: 'Next' }).click();
  await expect(page.getByText('You can add up to 4 multipliers.')).toBeVisible();
  await page.getByRole('button', { name: 'Remove multiplier 5' }).click();
  await page.getByLabel('Multiplier 2 type').click();
  await page.getByRole('option', { name: 'Ad position' }).click();
  await page.getByRole('button', { name: 'Next' }).click();
  await expect(page.getByText('Each multiplier can only be used once.')).toBeVisible();

  // A factor out of range.
  await page.getByRole('button', { name: 'Remove multiplier 4' }).click();
  await page.getByRole('button', { name: 'Remove multiplier 3' }).click();
  await page.getByRole('button', { name: 'Remove multiplier 2' }).click();
  await page.getByLabel('Ad position Above the fold factor').fill('11');
  await page.getByRole('button', { name: 'Next' }).click();
  await expect(page.getByText('Enter a number between 0.1 and 10.')).toBeVisible();
  await page.getByLabel('Ad position Above the fold factor').fill('1.5');
  await page.getByRole('button', { name: 'Next' }).click();

  // Step 2: Next waits for a test. Step 3 cannot be opened by the address before one exists.
  await expect(page).toHaveURL(/step=test/);
  await expect(page.getByRole('button', { name: 'Next' })).toBeDisabled();
  const url = new URL(page.url());
  await page.goto(`${url.pathname}?step=save`);
  await expect(page.getByRole('heading', { name: 'Test' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Save', exact: true })).toHaveCount(0);
});

test('E2E-RES-08 (custom bidding): a read-only user sees the list but cannot create', async ({
  page,
}) => {
  await signIn(page, readOnly);
  await page.goto(`${adv(readOnly)}/custom-bidding`);
  await expect(page.getByRole('heading', { name: 'Custom bidding' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'New algorithm' })).toBeDisabled();
});
