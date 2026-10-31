// P4-10b, module 17 6.2: E2E-EXP-01 Experiments page and roles, 02 create and report, 03 A/B validation, 04 Settings panel
// and full page, 05 End, 06 lift create to report, 07 Not eligible and Review & fix, 08 Add flight and End.
// Synthetic data only. The engine is not run: spend rows are written to SimDailyMetric and the clock is set by hand.
import { PrismaClient } from '@prisma/client';
import { expect, test, type Page } from '@playwright/test';
import { cleanup } from '../auth/fixtures';
import { createShellWorld, type ShellWorld } from '../shell/e2e-world';
import { advanceLiftStudies } from '../../lib/experiments/advance';

const db = new PrismaClient({
  datasources: { db: { url: process.env.DATABASE_URL_TEST ?? process.env.DATABASE_URL } },
});
let w: ShellWorld;
let readOnly: ShellWorld;
const adv = (world: ShellWorld = w) => `/p/${world.ids.pid}/a/${world.ids.aid}`;
const day = (s: string) => new Date(`${s}T00:00:00.000Z`);
const addDays = (s: string, n: number) => new Date(day(s).getTime() + n * 86_400_000).toISOString().slice(0, 10);

async function expWorld(tag: string, role?: 'READ_ONLY') {
  const world = await createShellWorld(db, { tag, ...(role ? { role } : {}) });
  // the sim clock runs in real time; hold it at day 0 (2026-01-01) so the dates below stay put
  await db.simClock.update({ where: { sandboxId: world.sandboxId }, data: { state: 'PAUSED', tickIndex: 0 } });
  return world;
}

const ios: Record<string, { id: string; liId: string; publicId: string }> = {};
async function addIo(name: string) {
  const advertiserId = w.rows.advertiserId;
  const campaign = await db.campaign.findFirstOrThrow({ where: { sandboxId: w.sandboxId, advertiserId } });
  const io = await db.insertionOrder.create({
    data: { sandboxId: w.sandboxId, campaignId: campaign.id, advertiserId, name, objective: 'CLICKS', status: 'ACTIVE' },
  });
  const li = await db.lineItem.create({
    data: { sandboxId: w.sandboxId, ioId: io.id, campaignId: campaign.id, advertiserId, name: `${name} LI`, type: 'DISPLAY', status: 'ACTIVE' },
  });
  ios[name] = { id: io.id, liId: li.id, publicId: io.publicId.toString() };
}

async function spend(liId: string, from: string, days: number, o: { cost: number; impressions: number; clicks: number }) {
  for (let d = 0; d < days; d++) {
    await db.simDailyMetric.create({
      data: {
        sandboxId: w.sandboxId,
        classroomId: w.classroomId,
        lineItemId: liId,
        simDate: day(addDays(from, d)),
        impressions: BigInt(o.impressions),
        billableImpressions: BigInt(o.impressions),
        clicks: BigInt(o.clicks),
        viewableImpressions: BigInt(Math.round(o.impressions * 0.6)),
        measurableImpressions: BigInt(Math.round(o.impressions * 0.9)),
        mediaCost: o.cost,
        totalMediaCost: o.cost,
        revenue: o.cost,
      },
    });
  }
}

test.beforeAll(async () => {
  const tag = `pw17-${Date.now()}`;
  w = await expWorld(tag);
  readOnly = await expWorld(`${tag}-ro`, 'READ_ONLY');
  for (const n of ['Exp IO A', 'Exp IO B', 'Exp IO C', 'Exp IO D', 'Exp IO E', 'Exp IO F', 'Lift IO ok', 'Lift IO low']) await addIo(n);
  // A and B: 7 days of clearly different click through rates; C to F stay empty
  await spend(ios['Exp IO A']!.liId, '2026-01-01', 7, { cost: 5_000, impressions: 20_000, clicks: 200 });
  await spend(ios['Exp IO B']!.liId, '2026-01-01', 7, { cost: 5_000, impressions: 20_000, clicks: 300 });
  // the eligible lift IO has 10 days of spend ending on sim day 0 (630,000 against the 470,000 required)
  await spend(ios['Lift IO ok']!.liId, '2025-12-23', 9, { cost: 70_000, impressions: 60_000, clicks: 600 });
  await spend(ios['Lift IO low']!.liId, '2025-12-23', 9, { cost: 1_000, impressions: 5_000, clicks: 50 });
});
test.afterAll(async () => {
  await cleanup(db, { userIds: [...w.userIds, ...readOnly.userIds], classroomIds: [w.classroomId, readOnly.classroomId] });
  await db.$disconnect();
});

async function signIn(page: Page, world: ShellWorld = w) {
  await page.goto('/sim/login');
  await page.getByLabel('Email').fill(world.email);
  await page.getByLabel('Password').fill(world.password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.waitForURL((url) => !url.pathname.startsWith('/sim/login'));
}

async function pick(page: Page, arm: number, names: string[]) {
  await page.getByTestId(`arm-${arm}`).getByRole('button', { name: /^Select (insertion orders|line items)$/ }).click();
  const dialog = page.getByRole('dialog', { name: /^Select (insertion orders|line items)$/ });
  for (const n of names) await dialog.getByRole('checkbox', { name: new RegExp(n) }).check();
  await dialog.getByRole('button', { name: 'Done' }).click();
  await expect(dialog).toBeHidden();
}

const nameField = (page: Page) => page.getByRole('textbox', { name: /^Name/ });

async function createTest(page: Page, name: string, a: string, b: string) {
  await page.goto(`${adv()}/experiments/new`);
  await nameField(page).fill(name);
  await pick(page, 1, [a]);
  await pick(page, 2, [b]);
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await page.waitForURL(/\/e\/\d+$/);
}

async function setSimDay(n: number, hour = 12) {
  await db.simClock.update({ where: { sandboxId: w.sandboxId }, data: { tickIndex: n * 24 + hour } });
}

test('E2E-EXP-01: Experiments page has two tabs and the columns; read-only roles cannot create', async ({ page, browser }) => {
  await signIn(page);
  await page.goto(`${adv()}/experiments`);
  await expect(page.getByRole('heading', { name: 'Experiments' })).toBeVisible();
  await expect(page.getByRole('tab', { name: 'A/B tests' })).toBeVisible();
  await expect(page.getByRole('tab', { name: 'Lift studies' })).toBeVisible();
  for (const h of ['Test name', 'Participants', 'Status', 'Actions']) await expect(page.getByRole('columnheader', { name: h }).first()).toBeVisible();
  await expect(page.getByText('No A/B tests yet')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Create new' }).first()).toBeEnabled();
  await page.getByRole('tab', { name: 'Lift studies' }).click();
  await page.waitForURL(/brand-lift-measurements/);
  for (const h of ['Study name', 'Insertion orders', 'Brand Lift', 'Search Lift', 'Lift Actions']) await expect(page.getByRole('columnheader', { name: h }).first()).toBeVisible();
  await expect(page.getByText('No lift studies yet')).toBeVisible();

  const ro = await (await browser.newContext()).newPage();
  await signIn(ro, readOnly);
  await ro.goto(`${adv(readOnly)}/experiments`);
  await expect(ro.getByText('Limited Access')).toBeVisible();
  await expect(ro.getByRole('button', { name: 'Create new' }).first()).toBeDisabled();
});

test('E2E-EXP-02: create an A/B test with two IOs, then read the report', async ({ page }) => {
  await signIn(page);
  await page.goto(`${adv()}/experiments/new`);
  // defaults (AC 3)
  await expect(page.getByTestId('arm-1').getByRole('textbox', { name: /Arm name/ })).toHaveValue('Arm 1');
  await expect(page.getByTestId('arm-2').getByRole('textbox', { name: /Arm name/ })).toHaveValue('Arm 2');
  await expect(page.getByTestId('arm-1').getByRole('spinbutton', { name: /Audience split/ })).toHaveValue('50');
  await expect(page.getByLabel('Start date')).toHaveValue('2026-01-01');
  await expect(page.getByLabel('End date (optional)')).toHaveValue('');
  await expect(page.getByRole('combobox', { name: 'Measurement goal' })).toContainText('Conversions');
  await expect(page.getByRole('combobox', { name: 'Confidence level' })).toContainText('90%');
  await nameField(page).fill('Click rate test');
  await pick(page, 1, ['Exp IO A']);
  await pick(page, 2, ['Exp IO B']);
  await page.getByRole('combobox', { name: 'Measurement goal' }).click();
  await page.getByRole('option', { name: 'Clicks' }).click();
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await page.waitForURL(/\/e\/\d+$/);
  await expect(page.getByTestId('ab-status')).toHaveText('Active');
  await expect(page.getByTestId('ab-subtitle')).toHaveText('2 arm test comparing 2 insertion orders');
  // "fast-forward" to day 6: the spend rows exist already
  await setSimDay(6);
  await page.reload();
  await expect(page.getByTestId('tile-clicks')).toBeVisible();
  await expect(page.getByTestId('tile-ctr')).toBeVisible();
  await expect(page.getByTestId('tile-cpc')).toBeVisible();
  await expect(page.getByTestId('tile-revenue')).toBeVisible();
  await expect(page.getByTestId('tile-clicks')).toContainText('1,400');
  await expect(page.getByTestId('tile-clicks')).toContainText('2,100');
  await expect(page.getByTestId('best-ctr')).toHaveText('Best: Arm 2');
  await expect(page.getByTestId('ab-best')).toContainText('Best arm: Arm 2');
  await expect(page.getByRole('table', { name: 'Arms by metric' })).toContainText('Arm 1 (control)');
  await expect(page.getByTestId('ab-chart')).toBeVisible();
  // the same data at another control arm changes the comparison
  await page.getByRole('combobox', { name: 'Control arm' }).click();
  await page.getByRole('option', { name: 'Arm 2' }).click();
  await expect(page.getByTestId('best-ctr')).toHaveText('Best: Arm 2');
  // the test is in the list
  await page.goto(`${adv()}/experiments`);
  const row = page.getByRole('row', { name: /Click rate test/ });
  await expect(row).toContainText('2 arms');
  await expect(row).toContainText('Active');
  await expect(row).toContainText('End date not set');
  await setSimDay(0);
});

test('E2E-EXP-03: A/B validation messages', async ({ page }) => {
  await signIn(page);
  await page.goto(`${adv()}/experiments/new`);
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByText('Enter a value').first()).toBeVisible();
  await expect(page.getByText('Select at least one insertion order for each arm.').first()).toBeVisible();
  // a third arm starts at 0%
  await page.getByRole('button', { name: 'Add arm' }).click();
  await expect(page.getByTestId('arm-3').getByRole('spinbutton', { name: /Audience split/ })).toHaveValue('0');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByText('Enter a larger number')).toBeVisible();
  // splits that do not add up
  await page.getByRole('button', { name: 'Delete Arm 3' }).click();
  await page.getByTestId('arm-1').getByRole('spinbutton', { name: /Audience split/ }).fill('60');
  await page.getByTestId('arm-2').getByRole('spinbutton', { name: /Audience split/ }).fill('30');
  await nameField(page).fill('Invalid test');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByTestId('arms-error')).toHaveText('Audience splits must add up to 100%.');
  await page.getByTestId('arm-2').getByRole('spinbutton', { name: /Audience split/ }).fill('40');
  // the same IO in two arms
  await pick(page, 1, ['Exp IO C']);
  await page.getByTestId('arm-2').getByRole('button', { name: 'Select insertion orders' }).click();
  const dialog = page.getByRole('dialog', { name: 'Select insertion orders' });
  await expect(dialog.getByRole('checkbox', { name: /Exp IO C/ })).toBeDisabled();
  await dialog.getByRole('button', { name: 'Cancel' }).click();
  // no control: the radio is the only way to choose one, so there are always one
  await expect(page.getByRole('radio', { name: 'Control Arm 1' })).toBeChecked();
  await page.getByRole('radio', { name: 'Control Arm 2' }).check();
  await expect(page.getByRole('radio', { name: 'Control Arm 1' })).not.toBeChecked();
  // line items disable the lift section; cross exchange IOs offer "Exclude unidentified users" with a warning
  await expect(page.getByTestId('participation')).toBeVisible();
  await page.getByRole('switch', { name: 'Exclude unidentified users' }).check();
  await expect(page.getByText('Excluding traffic without third-party IDs can make results less representative.')).toBeVisible();
  await expect(page.getByText('Lift studies are not applicable for line items, or cross-exchange insertion orders…')).toBeVisible();
  await page.getByRole('radio', { name: 'Line items' }).check();
  await expect(page.getByTestId('participation')).toBeHidden();
  await expect(page.getByRole('checkbox', { name: 'Brand lift' })).toBeDisabled();
});

test('E2E-EXP-04: Settings opens over the report on a soft navigation and as a full page on a hard one', async ({ page }) => {
  await signIn(page);
  await createTest(page, 'Panel test', 'Exp IO C', 'Exp IO D');
  const reportUrl = page.url();
  await page.getByTestId('ab-settings-open').click();
  await page.waitForURL(/\/report\/settings$/);
  const panel = page.getByRole('dialog', { name: 'Panel test' });
  await expect(panel).toBeVisible();
  await expect(panel.getByTestId('open-full-page')).toBeVisible();
  await expect(page.getByTestId('ab-report')).toBeVisible(); // the report is still there below the panel
  // started: name and end date change, dates and arms are locked
  await expect(panel.getByLabel('Start date')).toBeDisabled();
  await expect(panel.getByRole('textbox', { name: /^Name/ })).toBeEnabled();
  await expect(panel.getByRole('spinbutton', { name: /Audience split/ }).first()).toBeDisabled();
  await panel.getByRole('textbox', { name: /^Name/ }).fill('Panel test renamed');
  await panel.getByRole('button', { name: 'Save changes' }).click();
  await expect(page.getByText('Changes saved.')).toBeVisible();
  // Difference tab: identical IOs apart from their names
  await panel.getByRole('tab', { name: 'Difference' }).click();
  await expect(panel.getByTestId('ab-diff')).toContainText('No results');
  // hard navigation to the same URL: a full page, no dialog
  const settingsUrl = page.url();
  await page.goto(settingsUrl);
  await expect(page.getByTestId('ab-settings')).toBeVisible();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByRole('textbox', { name: /^Name/ })).toHaveValue('Panel test renamed');
  await page.goto(reportUrl);
  await expect(page.getByTestId('ab-report')).toContainText('Panel test renamed');
});

test('E2E-EXP-05: End a test: Completed, End disabled', async ({ page }) => {
  await signIn(page);
  await createTest(page, 'Test to end', 'Exp IO E', 'Exp IO F');
  await page.goto(`${adv()}/experiments`);
  const row = page.getByRole('row', { name: /Test to end/ });
  await row.getByRole('button', { name: 'End' }).click();
  const dialog = page.getByRole('dialog', { name: 'End Test to end?' });
  await expect(dialog).toContainText("Ending stops the test. This can't be undone.");
  await dialog.getByRole('button', { name: 'End' }).click();
  await expect(row).toContainText('Completed');
  await expect(row.getByRole('button', { name: 'End' })).toBeDisabled();
  // the settings of an ended test are read-only
  await row.getByRole('link', { name: 'View report' }).click();
  await expect(page.getByTestId('ab-status')).toHaveText('Completed');
  await page.getByTestId('ab-settings-open').click();
  await expect(page.getByRole('dialog').getByRole('button', { name: 'Save changes' })).toHaveCount(0);
  await expect(page.getByRole('dialog').getByRole('textbox', { name: /^Name/ })).toBeDisabled();
});

async function fillSurvey(page: Page, brand = 'Demo brand') {
  await page.getByRole('checkbox', { name: 'Awareness' }).check();
  await page.getByRole('textbox', { name: /Your brand\/product name/ }).fill(brand);
  await page.getByRole('combobox', { name: 'Object type' }).click();
  await page.getByRole('option', { name: 'Brand', exact: true }).click();
}

async function chooseIo(page: Page, name: string) {
  await page.getByRole('button', { name: 'Select insertion orders' }).click();
  const dialog = page.getByRole('dialog', { name: 'Select insertion orders' });
  await dialog.getByRole('checkbox', { name: new RegExp(name) }).check();
  await dialog.getByRole('button', { name: 'Select', exact: true }).click();
  await expect(dialog).toBeHidden();
}

test('E2E-EXP-06: lift study for an eligible IO, eligibility rail, list text, report views and slices', async ({ page }) => {
  await signIn(page);
  await page.goto(`${adv()}/brand-lift-measurements/new`);
  // before an IO is chosen the lift types are disabled and Create fails with LS-003
  await expect(page.getByRole('checkbox', { name: 'Brand lift' })).toBeDisabled();
  await page.getByRole('textbox', { name: /Lift study name/ }).fill('Awareness lift study');
  await page.getByRole('button', { name: 'Create', exact: true }).click();
  await expect(page.getByTestId('io-error')).toHaveText('Select at least one eligible insertion order to add a lift study');
  await chooseIo(page, 'Lift IO ok');
  const rail = page.getByTestId('eligibility-rail');
  await expect(rail.getByTestId('elig-BRAND_LIFT')).toContainText('Eligible');
  await expect(rail.getByTestId('required-BRAND_LIFT')).toContainText('4,70,000.00');
  await expect(rail.getByTestId('yours-BRAND_LIFT')).toContainText('6,30,000.00');
  await expect(page.getByTestId('measurable-BRAND_LIFT')).toHaveText('1');
  await page.getByRole('checkbox', { name: 'Brand lift' }).check();
  await fillSurvey(page);
  // four metrics are not allowed: the fourth box is disabled
  for (const m of ['Consideration', 'Favorability']) await page.getByRole('checkbox', { name: m }).check();
  await expect(page.getByRole('checkbox', { name: 'Association' })).toBeDisabled();
  await page.getByRole('checkbox', { name: 'Consideration' }).uncheck();
  await page.getByRole('checkbox', { name: 'Favorability' }).uncheck();
  // Enhanced strength is YouTube only and triples the requirement
  await page.getByRole('radio', { name: /Enhanced lift/ }).check();
  await expect(rail.getByTestId('required-BRAND_LIFT')).toContainText('14,10,000.00');
  await page.getByRole('button', { name: 'Create', exact: true }).click();
  await expect(page.getByText('Enhanced lift is only available for YouTube and needs 3 times the standard budget.')).toBeVisible();
  await page.getByRole('radio', { name: /Standard lift/ }).check();
  await page.getByRole('button', { name: 'Create', exact: true }).click();
  await page.waitForURL(/brand-lift-measurements$/);
  const row = page.getByRole('row', { name: /Awareness lift study/ });
  await expect(row.getByTestId('flight-brand')).toContainText('Flight 1 (0% complete) In progress');
  await expect(row.getByTestId('flight-brand').getByRole('button', { name: 'View report' })).toBeDisabled();

  // spend accrues: 40%, then complete (the engine step runs here)
  await spend(ios['Lift IO ok']!.liId, '2026-01-01', 1, { cost: 188_000, impressions: 150_000, clicks: 1_500 });
  const tick = (hours: number) =>
    db.$transaction((tx) => advanceLiftStudies(tx as never, w.sandboxId, w.rows.advertiserId, Date.UTC(2026, 0, 1) + hours * 3_600_000));
  await tick(30);
  await page.reload();
  await expect(page.getByTestId('flight-brand')).toContainText('Flight 1 (40% complete) In progress');
  await spend(ios['Lift IO ok']!.liId, '2026-01-02', 1, { cost: 400_000, impressions: 300_000, clicks: 3_000 });
  await tick(54);
  await page.reload();
  await expect(page.getByTestId('flight-brand')).toContainText('Flight 1 (Complete)');
  await page.getByTestId('flight-brand').getByRole('link', { name: 'View report' }).click();
  await page.waitForURL(/\/report$/);

  // the report: Cross Exchange tab holds the display line item
  await page.getByRole('tab', { name: 'Cross Exchange' }).click();
  const awareness = page.getByTestId('metric-AWARENESS');
  await expect(awareness).toBeVisible();
  const absolute = await page.getByTestId('lift-value-AWARENESS').textContent();
  await page.getByRole('combobox', { name: 'Lift type' }).click();
  await page.getByRole('option', { name: 'Relative lift' }).click();
  await expect(page.getByTestId('lift-value-AWARENESS')).not.toHaveText(absolute ?? '');
  await page.getByRole('button', { name: 'Age' }).click();
  await expect(page.getByRole('table', { name: /Awareness by Age/ })).toContainText('25-34');
  await page.getByRole('button', { name: 'Line item' }).click();
  await expect(page.getByRole('table', { name: /Awareness by Line item/ })).toBeVisible();
  await page.getByRole('tab', { name: 'YouTube & Demand Gen' }).click();
  await expect(page.getByText('No reports available')).toBeVisible();
});

test('E2E-EXP-07: a Not eligible study is fixed with Review & fix', async ({ page }) => {
  await signIn(page);
  await page.goto(`${adv()}/brand-lift-measurements/new`);
  await page.getByRole('textbox', { name: /Lift study name/ }).fill('Low spend study');
  await chooseIo(page, 'Lift IO low');
  await expect(page.getByTestId('elig-BRAND_LIFT')).toContainText('Not eligible');
  await page.getByRole('checkbox', { name: 'Brand lift' }).check();
  await fillSurvey(page);
  await page.getByRole('button', { name: 'Create', exact: true }).click();
  await page.waitForURL(/brand-lift-measurements$/);
  const row = page.getByRole('row', { name: /Low spend study/ });
  await expect(row.getByTestId('flight-brand')).toContainText('Flight 1 (Not eligible) Paused');
  const fix = row.getByRole('link', { name: 'Review & fix' });
  await expect(fix).toBeVisible();
  // the spend arrives, then the student saves the fix
  await db.simDailyMetric.updateMany({ where: { lineItemId: ios['Lift IO low']!.liId }, data: { mediaCost: 70_000 } });
  await fix.click();
  await page.waitForURL(/\/edit$/);
  await expect(page.getByRole('checkbox', { name: 'Brand lift' })).toBeDisabled(); // lift types are locked
  await expect(page.getByTestId('elig-BRAND_LIFT')).toContainText('Eligible');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await page.waitForURL(/brand-lift-measurements$/);
  await expect(page.getByRole('row', { name: /Low spend study/ }).getByTestId('flight-brand')).toContainText('Flight 1 (0% complete) In progress');
});

test('E2E-EXP-08: Add flight and End on a study', async ({ page }) => {
  await signIn(page);
  const study = await db.liftStudy.findFirstOrThrow({ where: { sandboxId: w.sandboxId, name: 'Awareness lift study' } });
  await page.goto(`${adv()}/brand-lift-measurements`);
  const row = page.getByRole('row', { name: /Awareness lift study/ });
  await expect(row.getByTestId('flight-brand')).toContainText('Flight 1 (Complete)');
  // End is disabled for a complete flight; Add flight starts flight 2
  await expect(row.getByRole('button', { name: /^End Brand Lift/ })).toBeDisabled();
  await row.getByRole('button', { name: /^Add flight Brand Lift/ }).click();
  await expect(page.getByText('Flight 2 added.')).toBeVisible();
  await expect(row.getByTestId('flight-brand')).toContainText('Flight 2');
  // the open flight can be ended, after confirmation
  await expect(row.getByRole('button', { name: /^Add flight Brand Lift/ })).toBeDisabled();
  await row.getByRole('button', { name: /^End Brand Lift/ }).click();
  const dialog = page.getByRole('dialog', { name: 'End Awareness lift study?' });
  await expect(dialog).toContainText("Ending stops the study. This can't be undone.");
  await dialog.getByRole('button', { name: 'End' }).click();
  await expect(row.getByTestId('flight-brand')).toContainText('Flight 2 (Ended)');
  await expect(row.getByRole('button', { name: /^Add flight Brand Lift/ })).toBeEnabled();
  const flights = await db.liftFlight.findMany({ where: { studyId: study.id }, orderBy: { number: 'asc' } });
  expect(flights.map((f) => f.status)).toEqual(['COMPLETE', 'ENDED']);
});
