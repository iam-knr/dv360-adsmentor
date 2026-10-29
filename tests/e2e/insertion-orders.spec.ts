// P3-06b module 07: PW-07-02 to PW-07-07, PW-07-09, PW-07-13, PW-07-15, plus the fee menu (AC-07-08), the inherited
// frequency note (AC-07-07) and the IO page tabs (AC-07-18). PW-07-01 lives in campaigns.spec.ts (it starts from the
// campaign create flow). PW-07-08 needs a YouTube line item (P3-06c), PW-07-10 to 12 and 14 are Phase 4.
// Note: spend comes from getGridMetrics, a zero stub until P3-09, so IO-026 (below spent) is proved by validation
// cases and not here; the inline editor is checked with IO-022 and a successful save.
import { PrismaClient } from '@prisma/client';
import { expect, test } from '@playwright/test';
import { cleanup } from '../auth/fixtures';
import { createShellWorld, type ShellWorld } from '../shell/e2e-world';
import { advPath, seedCampaign, seedIo, signIn } from '../services/campaigns/e2e-helpers';

const db = new PrismaClient({
  datasources: { db: { url: process.env.DATABASE_URL_TEST ?? process.env.DATABASE_URL } },
});
let w: ShellWorld;
let wRo: ShellWorld;

test.beforeAll(async () => {
  w = await createShellWorld(db, { tag: `pw07-${Date.now()}` });
  wRo = await createShellWorld(db, { tag: `pw07-ro-${Date.now()}`, role: 'READ_ONLY' });
});
test.afterAll(async () => {
  await cleanup(db, {
    userIds: [...w.userIds, ...wRo.userIds],
    classroomIds: [w.classroomId, wRo.classroomId],
  });
  await db.$disconnect();
});

const A = (sub = '') => advPath(w, sub);
const step2 = (cid: string, type = 'STANDARD', objective = 'BRAND_AWARENESS') =>
  A(`/c/${cid}/ios/new?type=${type}&objective=${objective}`);

test('PW-07-02 CTV and OTT disables the Clicks objective', async ({ page }) => {
  const c = await seedCampaign(db, w, 'PW07 Step1 CTV');
  await signIn(page, w);
  await page.goto(A(`/c/${c.publicId}/ios/new`));
  await page.getByRole('radio', { name: /Connected TV and OTT streaming/ }).check();
  await expect(page.getByRole('radio', { name: /^Clicks/ })).toBeDisabled();
  await expect(page.getByRole('radio', { name: /^Brand awareness/ })).toBeEnabled();
});

test('PW-07-03 DOOH enables only "without objective"', async ({ page }) => {
  const c = await seedCampaign(db, w, 'PW07 Step1 DOOH');
  await signIn(page, w);
  await page.goto(A(`/c/${c.publicId}/ios/new`));
  await page.getByRole('radio', { name: /Digital out of home/ }).check();
  await expect(page.getByRole('radio', { name: /without objective/ })).toBeEnabled();
  for (const name of [/^Brand awareness/, /^Clicks/, /^Conversions/, /^Custom/])
    await expect(page.getByRole('radio', { name })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Next' })).toBeDisabled();
});

test('PW-07-04 an empty form shows the catalogue errors and stays on the page', async ({
  page,
}) => {
  const c = await seedCampaign(db, w, 'PW07 Empty');
  await signIn(page, w);
  await page.goto(step2(c.publicId));
  await page.getByRole('button', { name: 'Create' }).click();
  await expect(page.getByText('Enter a value').first()).toBeVisible();
  await expect(page).toHaveURL(/\/ios\/new\?type=STANDARD&objective=BRAND_AWARENESS/);
});

test('PW-07-05 Daily pacing offers Even and ASAP and needs a daily amount', async ({ page }) => {
  const c = await seedCampaign(db, w, 'PW07 Pacing');
  await signIn(page, w);
  await page.goto(step2(c.publicId));
  await page.getByRole('combobox', { name: 'Pacing period' }).click();
  await page.getByRole('option', { name: 'Daily' }).click();
  await page.getByRole('combobox', { name: 'Pacing type' }).click();
  await expect(page.getByRole('option')).toHaveText([/Even/, /ASAP/]);
  await page.keyboard.press('Escape');
  await page.locator('#name').fill('PW07 Daily');
  await page.getByLabel('Segment 1 budget').fill('1000');
  await page.getByLabel('KPI value').fill('50');
  await page.getByRole('button', { name: 'Create' }).click();
  await expect(page.getByLabel('Daily amount')).toHaveAttribute('aria-invalid', 'true');
  await expect(page).toHaveURL(/\/ios\/new/);
});

test('PW-07-06 overlapping budget segments are refused', async ({ page }) => {
  const c = await seedCampaign(db, w, 'PW07 Overlap');
  await signIn(page, w);
  await page.goto(step2(c.publicId));
  await page.locator('#name').fill('PW07 Overlap IO');
  await page.getByLabel('KPI value').fill('50');
  await page.getByLabel('Segment 1 budget').fill('1000');
  await page.getByLabel('Segment 1 start').fill('2026-01-01');
  await page.getByLabel('Segment 1 end').fill('2026-03-31');
  await page.getByRole('button', { name: 'Add budget segment' }).click();
  await page.getByLabel('Segment 2 budget').fill('500');
  await page.getByLabel('Segment 2 start').fill('2026-03-01');
  await page.getByLabel('Segment 2 end').fill('2026-04-30');
  await page.getByRole('button', { name: 'Create' }).click();
  await expect(page.getByText(/Budget segments can.t overlap/)).toBeVisible();
  await expect(page).toHaveURL(/\/ios\/new/);
});

test('PW-07-07 objective "without objective" is saved and then the dropdown has nothing else', async ({
  page,
}) => {
  const c = await seedCampaign(db, w, 'PW07 Objective');
  const io = await seedIo(db, w, c.id, 'PW07 Objective IO');
  await signIn(page, w);
  await page.goto(A(`/c/${c.publicId}/io/${io.publicId}/details`));
  const objective = page.getByRole('combobox', { name: 'Objective' });
  await objective.click();
  await expect(page.getByRole('option')).toHaveText([/Clicks/, /without objective/]);
  await page.getByRole('option', { name: /without objective/ }).click();
  await page.getByRole('button', { name: 'Save' }).click();
  await expect
    .poll(async () => (await db.insertionOrder.findUnique({ where: { id: io.id } }))?.objective)
    .toBe('NONE');
  await page.reload();
  await expect(page.getByRole('combobox', { name: 'Objective' })).toBeDisabled();
  await expect(page.getByRole('combobox', { name: 'Objective' })).toContainText(
    'without objective',
  );
});

test('PW-07-09 inline budget edit validates and updates the cell', async ({ page }) => {
  const c = await seedCampaign(db, w, 'PW07 Inline');
  const io = await seedIo(db, w, c.id, 'PW07 Inline IO', { status: 'ACTIVE' });
  await signIn(page, w);
  await page.goto(A(`/c/${c.publicId}/explorerios`));
  await page.getByRole('button', { name: /Edit Budget of PW07 Inline IO/ }).click();
  const input = page.getByRole('textbox', { name: 'Budget of PW07 Inline IO' });
  await input.fill('0');
  await input.press('Enter');
  await expect(page.getByText('Enter a number greater than 0')).toBeVisible();
  await input.fill('2500');
  await input.press('Enter');
  await expect
    .poll(async () =>
      Number((await db.budgetSegment.findUnique({ where: { id: io.segmentId } }))?.amount),
    )
    .toBe(2500);
});

test('PW-07-13 the advertiser tab has no New Insertion Order, the campaign tab has it', async ({
  page,
}) => {
  const c = await seedCampaign(db, w, 'PW07 Tabs Buttons');
  await signIn(page, w);
  await page.goto(A('/explorerios'));
  await expect(
    page.getByRole('grid', { name: /Insertion orders/ }).or(page.getByText('No insertion orders')),
  ).toBeVisible();
  await expect(page.getByText('New Insertion Order')).toHaveCount(0);
  await page.goto(A(`/c/${c.publicId}/explorerios`));
  await expect(page.getByText('New Insertion Order')).toBeVisible();
});

test('PW-07-15 a read-only user sees Limited Access and cannot save', async ({ page }) => {
  const c = await seedCampaign(db, wRo, 'PW07 RO');
  const io = await seedIo(db, wRo, c.id, 'PW07 RO IO');
  await signIn(page, wRo);
  await page.goto(advPath(wRo, `/c/${c.publicId}/io/${io.publicId}/details`));
  await expect(page.getByText('Limited Access').first()).toBeVisible();
  await expect(page.locator('#name')).not.toBeEditable();
  await expect(page.getByRole('button', { name: 'Save' })).toHaveCount(0);
});

test('AC-07-07 an unlimited IO shows the real campaign frequency cap', async ({ page }) => {
  const c = await seedCampaign(db, w, 'PW07 Cap', { freqMax: 7 });
  await signIn(page, w);
  await page.goto(step2(c.publicId));
  await expect(
    page.getByText("The campaign's frequency cap is set to 7 exposures per month"),
  ).toBeVisible();
});

test('AC-07-08 Add fee menu adds CPM or Media fees, up to 5 each; media fee 1 is locked', async ({
  page,
}) => {
  const c = await seedCampaign(db, w, 'PW07 Fees');
  await signIn(page, w);
  await page.goto(step2(c.publicId));
  await expect(page.getByRole('combobox', { name: 'Media fees 1 type' })).toBeDisabled();
  const cpm = page.getByRole('combobox', { name: /^CPM fees \d+ type$/ });
  for (let i = 0; i < 6; i += 1) {
    await page.getByRole('button', { name: 'Add fee' }).click();
    const item = page.getByRole('menuitem', { name: 'CPM fee' });
    if (await item.isDisabled()) {
      await page.keyboard.press('Escape');
      break;
    }
    await item.click();
  }
  await expect(cpm).toHaveCount(5);
  await page.getByRole('button', { name: 'Add fee' }).click();
  await expect(page.getByRole('menuitem', { name: 'CPM fee' })).toBeDisabled();
  await expect(page.getByRole('menuitem', { name: 'Media fee' })).toBeEnabled();
  await page.keyboard.press('Escape');
  await cpm.first().click();
  await expect(page.getByRole('option', { name: 'Scope3' })).toBeVisible();
  await expect(page.getByRole('option', { name: 'Custom Fee 5' })).toBeVisible();
});

test('AC-07-18 IO page tabs route and Overview returns to the campaign', async ({ page }) => {
  const c = await seedCampaign(db, w, 'PW07 IO Tabs');
  const io = await seedIo(db, w, c.id, 'PW07 Tabs IO');
  await signIn(page, w);
  await page.goto(A(`/c/${c.publicId}/io/${io.publicId}`));
  await page.waitForURL(/\/explorerlis/);
  await expect(page.getByRole('heading', { name: 'PW07 Tabs IO', level: 1 })).toBeVisible();
  await page.getByRole('tab', { name: 'Insertion order details' }).click();
  await page.waitForURL(/\/details/);
  await page.getByRole('tab', { name: 'History' }).click();
  await page.waitForURL(/\/history/);
  await page.getByRole('link', { name: 'Overview' }).click();
  await page.waitForURL(new RegExp(`/c/${c.publicId}/`));
});
