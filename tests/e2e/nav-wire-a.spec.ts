// NAV-WIRE-A: module 02 pages that replaced the "Not built yet" placeholders. Each page: render, save, validation.
// AC-02-5 (create advertiser), AC-02-7/8/9 (basic details), AC-02-11 (exchanges), AC-02-15 (targeting defaults),
// AC-02-16 (configurations), AC-02-18 (brand controls), AC-02-20 to AC-02-22 (users), AC-02-26 (email preferences).
// Synthetic data only.
import { PrismaClient } from '@prisma/client';
import { expect, test, type Page } from '@playwright/test';
import { cleanup } from '../auth/fixtures';
import { createShellWorld, type ShellWorld } from '../shell/e2e-world';

const db = new PrismaClient({
  datasources: { db: { url: process.env.DATABASE_URL_TEST ?? process.env.DATABASE_URL } },
});
let admin: ShellWorld;
let student: ShellWorld;
let readOnly: ShellWorld;
let networkExchangeCode = '';

const part = (w: ShellWorld) => `/p/${w.ids.pid}`;

test.beforeAll(async () => {
  const tag = `pwnav-${Date.now()}`;
  admin = await createShellWorld(db, { tag: `${tag}-a`, role: 'ADMIN' });
  student = await createShellWorld(db, { tag: `${tag}-s` });
  readOnly = await createShellWorld(db, { tag: `${tag}-r`, role: 'READ_ONLY' });
  // A seeded exchange that asks for Network ID and Agency ID. No global rows are written here: an extra Exchange row
  // would reach every sandbox that is provisioned while the suite runs.
  const gam = await db.exchange.findFirst({
    where: { needsNetworkId: true },
    orderBy: { code: 'asc' },
  });
  if (!gam) throw new Error('db:seed has not run: no exchange needs a Network ID');
  networkExchangeCode = gam.code;
});
test.afterAll(async () => {
  await cleanup(db, {
    userIds: [...admin.userIds, ...student.userIds, ...readOnly.userIds],
    classroomIds: [admin.classroomId, student.classroomId, readOnly.classroomId],
  });
  await db.$disconnect();
});

async function signIn(page: Page, world: ShellWorld) {
  await page.goto('/sim/login');
  await page.getByLabel('Email').fill(world.email);
  await page.getByLabel('Password').fill(world.password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.waitForURL((url) => !url.pathname.startsWith('/sim/login'));
}

test('Basic details: render, locked fields, save, validation (AC-02-7, AC-02-9, AC-02-10)', async ({
  page,
}) => {
  await signIn(page, admin);
  await page.goto(`${part(admin)}/details`);
  await expect(page.getByRole('heading', { name: 'Basic details' })).toBeVisible();
  await expect(page.getByLabel('Currency')).toHaveAttribute('readonly', '');
  await expect(page.getByLabel('Timezone')).toHaveAttribute('readonly', '');
  const save = page.getByRole('button', { name: 'Save' });
  await expect(save).toBeDisabled();

  await page.getByLabel(/^Name/).first().fill('Renamed Agency');
  await expect(save).toBeEnabled();
  await save.click();
  await expect(page.getByText('Saved', { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByLabel(/^Name/).first()).toHaveValue('Renamed Agency');

  // validation: empty name and a bad administrator email
  await page.getByLabel(/^Name/).first().fill('');
  await page.getByLabel('SDF Administrator email').fill('not-an-email');
  await save.click();
  await expect(page.getByText('Enter a value').first()).toBeVisible();
  await expect(page.getByText('Enter a valid email address.')).toBeVisible();
});

test('Basic details: Exchanges panel asks for the extra IDs (AC-02-11)', async ({ page }) => {
  await signIn(page, admin);
  await page.goto(`${part(admin)}/details`);
  await page.getByRole('button', { name: 'Edit exchanges' }).click();
  const panel = page.getByRole('dialog', { name: 'Exchanges' });
  await panel.getByTestId(`exchange-${networkExchangeCode}`).check();
  await expect(panel.getByLabel('Network ID')).toBeVisible();
  await expect(panel.getByLabel('Agency ID')).toBeVisible();
  await panel.getByRole('button', { name: 'Apply' }).click();
  await expect(page.getByTestId('exchange-count')).toContainText('1 Exchanges enabled');
  await page.getByLabel(/^Name/).first().fill('Exchange agency');
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(
    page.getByText('Enter a value for the exchange IDs', { exact: false }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Edit exchanges' }).click();
  await expect(
    page.getByRole('dialog', { name: 'Exchanges' }).getByText('Enter a value').first(),
  ).toBeVisible();
});

test('Basic details: a read only role cannot save (AC-02-8)', async ({ page }) => {
  await signIn(page, readOnly);
  await page.goto(`${part(readOnly)}/details`);
  await expect(page.getByText('Limited Access').first()).toBeVisible();
  await expect(page.getByLabel(/^Name/).first()).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Save' })).toHaveCount(0);
});

test('Targeting defaults: render, edit Environment, save (AC-02-15)', async ({ page }) => {
  await signIn(page, admin);
  await page.goto(`${part(admin)}/targeting`);
  await expect(page.getByTestId('default-GEOGRAPHY')).toContainText('All locations');
  await expect(page.getByTestId('default-ENVIRONMENT')).toContainText(
    'No restrictions for environment',
  );
  await expect(page.getByTestId('default-POSITION')).toContainText('All positions selected');
  await expect(page.getByTestId('default-APPS_URLS')).toContainText('No restrictions');
  await expect(page.getByTestId('public-inventory')).toContainText('Exchanges and 0 Subexchanges');

  await page.getByRole('button', { name: 'Edit Environment' }).click();
  const editor = page.getByRole('dialog', { name: 'Environment' });
  await editor.getByRole('checkbox', { name: /^Web/ }).check();
  await editor.getByRole('button', { name: 'Apply' }).click();
  await expect(page.getByTestId('default-ENVIRONMENT')).toContainText('Include: Web');
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByText('Saved', { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByTestId('default-ENVIRONMENT')).toContainText('Include: Web');
});

test('Advertiser configurations: render, product improvement lock, PRT-014 (AC-02-16)', async ({
  page,
}) => {
  await signIn(page, admin);
  await page.goto(`${part(admin)}/third-party-configuration`);
  for (const title of [
    'Enhanced automation settings',
    'Product improvement',
    'Google & partner inventory',
    'YouTube guaranteed instant deals',
    'Auto-tagging',
    'Advanced ad serving',
  ])
    await expect(page.getByRole('region', { name: title })).toBeVisible();
  await expect(page.getByTestId('flag-ENHANCED_AUTOMATION')).toBeChecked();
  await expect(page.getByTestId('flag-PRODUCT_IMPROVEMENT')).toBeDisabled();
  // Enhanced automation off: Product improvement becomes editable
  await page.getByTestId('flag-ENHANCED_AUTOMATION').uncheck();
  await expect(page.getByTestId('flag-PRODUCT_IMPROVEMENT')).toBeEnabled();

  // no advertiser chosen -> PRT-014
  await page.getByTestId('config-AUTO_TAGGING').getByRole('button', { name: 'Clear' }).click();
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(
    page.getByTestId('config-AUTO_TAGGING').getByText('A selection is required'),
  ).toBeVisible();

  // fix it and save
  await page
    .getByTestId('config-AUTO_TAGGING')
    .getByRole('button', { name: 'Select Advertisers' })
    .click();
  const again = page.getByRole('dialog', { name: 'Select advertisers' });
  await again.getByText(admin.names.advertiser).click();
  await again.getByRole('button', { name: 'Apply' }).click();
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByText('Saved', { exact: true })).toBeVisible();
});

test('Brand controls: two tabs, one row per advertiser, four bars (AC-02-18)', async ({ page }) => {
  await signIn(page, student);
  await page.goto(`${part(student)}/brand/controls`);
  await expect(page.getByRole('heading', { name: 'Brand controls' })).toBeVisible();
  await expect(page.getByRole('tab', { name: 'Display and video' })).toBeVisible();
  await expect(page.getByRole('tab', { name: 'YouTube' })).toBeVisible();
  await expect(page.getByRole('link', { name: student.names.advertiser })).toBeVisible();
  for (const h of [
    'Digital content label exclusions',
    'Apps / URL and channel exclusions',
    'Keyword exclusions',
    'Authorized sellers',
  ])
    await expect(page.getByRole('columnheader', { name: h })).toBeVisible();
  await expect(page.getByRole('progressbar')).toHaveCount(4);
  await page.getByRole('tab', { name: 'YouTube' }).click();
  await expect(page.getByRole('link', { name: student.names.advertiser })).toBeVisible();
});

test('Users: profile and grid, New user disabled for a student (AC-02-20)', async ({ page }) => {
  await signIn(page, student);
  await page.goto('/users');
  await expect(page.getByRole('heading', { name: 'Users', exact: true }).first()).toBeVisible();
  await expect(page.getByText('Your profile')).toBeVisible();
  await expect(page.getByRole('button', { name: 'New user' })).toBeDisabled();
  await expect(page.getByText('No other users have access')).toBeVisible();
  await page.goto('/users/new');
  await expect(page.getByText(/page you're looking for wasn't found/)).toBeVisible();
});

test('Users: Admin adds a user with two roles, duplicate email is refused, edit and remove (AC-02-21, AC-02-22)', async ({
  page,
}) => {
  await signIn(page, admin);
  await page.goto('/users');
  await page
    .getByRole('link', { name: 'New user' })
    .or(page.getByRole('button', { name: 'New user' }))
    .first()
    .click();
  await expect(page).toHaveURL(/\/users\/new/);
  await expect(
    page.getByText(
      'You can give users different roles for each advertiser or partner they have access to',
    ),
  ).toBeVisible();
  const save = page.getByRole('button', { name: 'Save' });
  await expect(save).toBeDisabled();

  await page.getByLabel(/^Name/).fill('Colleague One');
  await page.getByLabel(/^Email/).fill('colleague.one@example.com');
  await page.getByRole('button', { name: 'Add partners or advertisers' }).click();
  const dialog = page.getByRole('dialog', { name: 'Select partners and advertisers' });
  await dialog.getByText(/^Partner \d+$/).click();
  await dialog.getByText(admin.names.advertiser, { exact: true }).click();
  await dialog.getByRole('button', { name: 'Select' }).click();
  await expect(save).toBeDisabled(); // roles missing
  const rows = page.getByTestId('access-row');
  await expect(rows).toHaveCount(2);
  await rows.nth(0).getByRole('combobox').click();
  await page.getByRole('option', { name: 'Standard', exact: true }).click();
  await rows.nth(1).getByRole('combobox').click();
  await page.getByRole('option', { name: 'Read only', exact: true }).click();
  await expect(save).toBeEnabled();
  await save.click();
  await expect(page).toHaveURL(/\/users$/);
  const row = page.getByRole('row', { name: /Colleague One/ });
  await expect(row).toContainText('Standard, Read only');

  // duplicate email
  await page.goto('/users/new');
  await page.getByLabel(/^Name/).fill('Colleague Again');
  await page.getByLabel(/^Email/).fill('colleague.one@example.com');
  await page.getByRole('button', { name: 'Add partners or advertisers' }).click();
  const d2 = page.getByRole('dialog', { name: 'Select partners and advertisers' });
  await d2.getByText(/^Partner \d+$/).click();
  await d2.getByRole('button', { name: 'Select' }).click();
  await page.getByTestId('access-row').getByRole('combobox').click();
  await page.getByRole('option', { name: 'Standard', exact: true }).click();
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByText('A user with this email already exists.')).toBeVisible();

  // empty name -> Enter a value
  await page.getByLabel(/^Name/).fill('');
  await page.getByLabel(/^Email/).fill('colleague.two@example.com');
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByText('Enter a value').first()).toBeVisible();

  // edit and remove
  await page.goto('/users');
  await page.getByRole('link', { name: 'Colleague One' }).click();
  await expect(page.getByRole('heading', { name: 'Edit user' })).toBeVisible();
  await page.getByRole('button', { name: 'Remove user' }).click();
  await page
    .getByRole('dialog', { name: 'Remove user' })
    .getByRole('button', { name: 'Remove' })
    .click();
  await expect(page).toHaveURL(/\/users$/);
  await expect(page.getByRole('link', { name: 'Colleague One' })).toHaveCount(0);
});

test('Top bar: User management opens the Users page (AC-02-20)', async ({ page }) => {
  await signIn(page, student);
  await page.goto(`${part(student)}/advertisers`);
  await page.getByRole('button', { name: 'User management and email preferences' }).click();
  await page.getByRole('menuitem', { name: 'User management' }).click();
  await expect(page).toHaveURL(/\/users$/);
  await expect(page.getByText('Your profile')).toBeVisible();
});

test('Email preferences: toggles save and survive a reload (AC-02-26)', async ({ page }) => {
  await signIn(page, student);
  await page.goto('/email-preferences');
  await expect(page.getByRole('heading', { name: 'Email preferences' })).toBeVisible();
  const alerts = page.getByTestId('email-alerts');
  const news = page.getByTestId('email-news');
  await expect(alerts).toBeChecked();
  const save = page.getByRole('button', { name: 'Save' });
  await expect(save).toBeDisabled();
  await alerts.uncheck();
  await news.uncheck();
  await save.click();
  await expect(page.getByText('Email preferences saved.')).toBeVisible();
  await page.reload();
  await expect(page.getByTestId('email-alerts')).not.toBeChecked();
  await expect(page.getByTestId('email-news')).not.toBeChecked();
});

test('Create advertiser: validation, URL check and success (AC-02-5)', async ({ page }) => {
  await signIn(page, admin);
  await page.goto(`${part(admin)}/advertisers/new`);
  await expect(page.getByRole('heading', { name: 'New advertiser' })).toBeVisible();
  await page.getByRole('button', { name: 'Create' }).click();
  await expect(page.getByText('Enter a value')).toHaveCount(2);
  await expect(page.getByLabel('Name', { exact: false }).first()).toBeFocused();

  await page.getByLabel('Name', { exact: false }).first().fill('Nav Wire Advertiser');
  await page.getByLabel('Website', { exact: false }).fill('not a url');
  await page.getByRole('button', { name: 'Create' }).click();
  await expect(page.getByText('Enter a valid URL.')).toBeVisible();

  await page.getByLabel('Website', { exact: false }).fill('https://www.example.com');
  await page.getByRole('button', { name: 'Create' }).click();
  await expect(page).toHaveURL(/\/a\/\d+\/cs/);
  await page.goto(`${part(admin)}/advertisers`);
  await expect(page.getByRole('link', { name: 'Nav Wire Advertiser' })).toBeVisible();
});
