// ADV-DETAILS-FIX: every editable field of the advertiser Basic details form (and the other settings forms of PR 48/49)
// accepts real keyboard input, saves and survives a reload. Synthetic data only.
import { PrismaClient } from '@prisma/client';
import { expect, test, type Page } from '@playwright/test';
import { cleanup } from '../auth/fixtures';
import { createShellWorld, type ShellWorld } from '../shell/e2e-world';

const db = new PrismaClient({
  datasources: { db: { url: process.env.DATABASE_URL_TEST ?? process.env.DATABASE_URL } },
});
let student: ShellWorld;
let admin: ShellWorld;

const adv = (world: ShellWorld) => `/p/${world.ids.pid}/a/${world.ids.aid}`;

test.beforeAll(async () => {
  const tag = `pwadf-${Date.now()}`;
  student = await createShellWorld(db, { tag });
  admin = await createShellWorld(db, { tag: `${tag}-adm`, role: 'ADMIN' });
  await db.thirdPartyVendor.upsert({
    where: { key: 'pwadf_viewability' },
    update: {},
    create: { key: 'pwadf_viewability', name: 'PW Viewability Co', group: 'VIEWABILITY' },
  });
});
test.afterAll(async () => {
  await cleanup(db, {
    userIds: [...student.userIds, ...admin.userIds],
    classroomIds: [student.classroomId, admin.classroomId],
  });
  await db.thirdPartyVendor.deleteMany({ where: { key: 'pwadf_viewability' } });
  await db.$disconnect();
});

async function signIn(page: Page, world: ShellWorld) {
  await page.goto('/sim/login');
  await page.getByLabel('Email').fill(world.email);
  await page.getByLabel('Password').fill(world.password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.waitForURL((url) => !url.pathname.startsWith('/sim/login'));
}

const saveBtn = (page: Page) => page.getByRole('button', { name: 'Save', exact: true });

// Save finished with the success banner (or the Demand Gen warning that replaces it), never an error banner.
async function expectSaved(page: Page) {
  await expect(
    page.getByText(/Advertiser details saved\.|Demand Gen line items? will stop/).last(),
  ).toBeVisible();
  await expect(
    page.getByText(/Fix the highlighted fields|were not saved|changed elsewhere/),
  ).toHaveCount(0);
}

async function typeInto(page: Page, name: string, text: string) {
  const box = page.getByRole('textbox', { name, exact: true });
  await box.click();
  await page.keyboard.press('ControlOrMeta+A');
  await page.keyboard.press('Delete');
  await page.keyboard.type(text);
  await expect(box).toHaveValue(text);
}

test('Basic details: every editable field takes keyboard input, saves and persists (student)', async ({
  page,
}) => {
  await signIn(page, student);
  await page.goto(`${adv(student)}/details`);
  await expect(page.getByRole('heading', { name: 'Basic details' })).toBeVisible();

  // Text fields typed with the real keyboard.
  await typeInto(page, 'Advertiser name', 'Nimbus Labs typed');
  await typeInto(page, 'Website', 'https://nimbus-typed.example.com');
  await typeInto(page, 'Administrator email', 'sdf-admin@example.com');
  await typeInto(page, 'Business name', 'Nimbus Business');
  await expect(page.getByText('15 / 25')).toHaveCount(1);
  await page.getByText('Additional settings').click();
  await typeInto(page, 'Integration code', 'INT-CODE-123');

  // Selects.
  await page.getByRole('combobox', { name: 'Status' }).click();
  await page.getByRole('option', { name: 'Paused' }).click();
  await page.getByRole('combobox', { name: 'SDF version' }).click();
  await page.getByRole('option', { name: '10.1', exact: true }).click();

  // Authorizations, EU political ads, Demand Gen switch.
  const prisma = page.getByRole('checkbox', { name: 'Enable Order ID reporting for pixels' });
  const orderBefore = await prisma.isChecked();
  await prisma.setChecked(!orderBefore);
  const badging = page.getByRole('checkbox', { name: /Use ad badging/ });
  const badgingBefore = await badging.isChecked();
  await badging.setChecked(!badgingBefore);
  await page.getByRole('radio', { name: /Yes, it contains EU political ads/ }).check();
  const dg = page.getByRole('checkbox', { name: /Use Floodlight data for conversion/ });
  const dgBefore = await dg.isChecked();
  await dg.setChecked(!dgBefore);

  await expect(saveBtn(page)).toBeEnabled();
  await saveBtn(page).click();
  await expectSaved(page);

  await page.reload();
  await expect(page.getByRole('textbox', { name: 'Advertiser name' })).toHaveValue(
    'Nimbus Labs typed',
  );
  await expect(page.getByRole('textbox', { name: 'Website' })).toHaveValue(
    'https://nimbus-typed.example.com',
  );
  await expect(page.getByRole('textbox', { name: 'Administrator email' })).toHaveValue(
    'sdf-admin@example.com',
  );
  await expect(page.getByRole('textbox', { name: 'Business name' })).toHaveValue('Nimbus Business');
  await expect(page.getByText('15 / 25')).toHaveCount(1);
  await page.getByText('Additional settings').click();
  await expect(page.getByRole('textbox', { name: 'Integration code' })).toHaveValue('INT-CODE-123');
  await expect(page.getByRole('combobox', { name: 'Status' })).toContainText('Paused');
  await expect(page.getByRole('combobox', { name: 'SDF version' })).toContainText('10.1');
  await expect(
    page.getByRole('checkbox', { name: 'Enable Order ID reporting for pixels' }),
  ).toBeChecked({
    checked: !orderBefore,
  });
  await expect(page.getByRole('checkbox', { name: /Use ad badging/ })).toBeChecked({
    checked: !badgingBefore,
  });
  await expect(
    page.getByRole('radio', { name: /Yes, it contains EU political ads/ }),
  ).toBeChecked();
  await expect(
    page.getByRole('checkbox', { name: /Use Floodlight data for conversion/ }),
  ).toBeChecked({
    checked: !dgBefore,
  });

  // page.fill works on the same fields (what the first bug report tried).
  await page.getByRole('textbox', { name: 'Business name' }).fill('Filled Name');
  await saveBtn(page).click();
  await expectSaved(page);
  await page.reload();
  await expect(page.getByRole('textbox', { name: 'Business name' })).toHaveValue('Filled Name');
});

test('Basic details: validation messages (required, URL, e-mail, max lengths)', async ({
  page,
}) => {
  await signIn(page, student);
  await page.goto(`${adv(student)}/details`);

  // Business name stops at 25 characters while typing (maxLength) and the counter shows it.
  await typeInto(page, 'Business name', 'x'.repeat(25));
  await page.keyboard.type('yyyy');
  await expect(page.getByRole('textbox', { name: 'Business name' })).toHaveValue('x'.repeat(25));
  await expect(page.getByText('25 / 25')).toHaveCount(1);

  await page.getByRole('textbox', { name: 'Advertiser name' }).fill('');
  await page.getByRole('textbox', { name: 'Website' }).fill('not a url');
  await page.getByRole('textbox', { name: 'Administrator email' }).fill('bad-email');
  await page.getByText('Additional settings').click();
  await page.getByRole('textbox', { name: 'Integration code' }).fill('z'.repeat(501));
  await saveBtn(page).click();
  await expect(page.getByText('Enter a value').first()).toBeVisible();
  await expect(page.getByText(/valid URL|valid web address/i).first()).toBeVisible();
  await expect(page.getByText(/valid email|e-mail/i).first()).toBeVisible();
  await expect(page.getByText(/500/).first()).toBeVisible();
  // Nothing was saved.
  await page.reload();
  await expect(page.getByRole('textbox', { name: 'Advertiser name' })).not.toHaveValue('');
});

test('Basic details: the panels and Schedule for deletion are Admin only and say so (student)', async ({
  page,
}) => {
  await signIn(page, student);
  await page.goto(`${adv(student)}/details`);
  await expect(page.getByRole('button', { name: 'Schedule for deletion' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Edit ad server and attribution' }).click();
  await expect(page.getByText('Only an Admin can change these settings.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Apply' })).toBeDisabled();
});

test('Basic details: ad server, attribution, third-party services and deletion (admin)', async ({
  page,
}) => {
  const a = await db.advertiser.findFirstOrThrow({ where: { sandboxId: admin.sandboxId } });
  await db.floodlightGroup.create({
    data: { sandboxId: admin.sandboxId, advertiserId: a.id, name: 'PW attribution group' },
  });
  await signIn(page, admin);
  await page.goto(`${adv(admin)}/details`);

  // The EU political ads answer is required (ADV-011): saving without it shows the message.
  await page.getByRole('button', { name: 'Edit ad server and attribution' }).click();
  await page.getByRole('combobox', { name: 'Ad server' }).click();
  await page.getByRole('option', { name: 'Campaign Manager 360' }).click();
  await page.getByRole('combobox', { name: 'Attribution settings' }).click();
  await page.getByRole('option', { name: 'PW attribution group' }).click();
  await page.getByRole('button', { name: 'Apply' }).click();

  await page.getByText('Additional settings').click();
  await page.getByRole('button', { name: 'Edit third-party services' }).click();
  const ias = page.getByRole('spinbutton', { name: 'Integral Ad Science client ID' });
  await ias.click();
  await page.keyboard.press('ControlOrMeta+A');
  await page.keyboard.type('4242');
  await expect(ias).toHaveValue('4242');
  await page.getByRole('checkbox', { name: 'PW Viewability Co' }).check();
  await page.getByRole('button', { name: 'Apply' }).click();

  await saveBtn(page).click();
  await expect(
    page.getByText('Select whether this advertiser plans to serve EU political ads.').first(),
  ).toBeVisible();
  await page.getByRole('radio', { name: /No, it doesn't contain EU political ads/ }).check();
  await saveBtn(page).click();
  await expectSaved(page);
  await page.reload();
  await expect(page.getByText('Ad server: Campaign Manager 360')).toBeVisible();
  await expect(page.getByText('Attribution settings: PW attribution group')).toBeVisible();
  await page.getByText('Additional settings').click();
  await expect(page.getByText(/1 selected, IAS client ID\s*4242/)).toBeVisible();

  await page.getByRole('button', { name: 'Schedule for deletion' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Schedule for deletion' }).click();
  await expect(page.getByText('This advertiser is scheduled for deletion').first()).toBeVisible();
  await page.getByRole('button', { name: 'Cancel deletion' }).click();
  await expect(page.getByText('This advertiser is scheduled for deletion')).toHaveCount(0);
});

test('Email preferences: both toggles save and persist', async ({ page }) => {
  await signIn(page, student);
  await page.goto('/email-preferences');
  const alerts = page.getByTestId('email-alerts');
  const news = page.getByTestId('email-news');
  const a0 = await alerts.isChecked();
  const n0 = await news.isChecked();
  await alerts.setChecked(!a0);
  await news.setChecked(!n0);
  await saveBtn(page).click();
  await expect(page.getByText('Email preferences saved.')).toBeVisible();
  await page.reload();
  await expect(page.getByTestId('email-alerts')).toBeChecked({ checked: !a0 });
  await expect(page.getByTestId('email-news')).toBeChecked({ checked: !n0 });
});

test('Targeting template: name typed with the keyboard persists on create and edit', async ({
  page,
}) => {
  await signIn(page, student);
  await page.goto(`${adv(student)}/templates/new?type=display`);
  const name = page.getByRole('textbox', { name: /^Name/ });
  await name.click();
  await page.keyboard.type('Typed template');
  await expect(name).toHaveValue('Typed template');
  await page.getByRole('button', { name: 'Create' }).click();
  await page.waitForURL((u) => u.pathname.endsWith('/templates'));
  await page.getByRole('link', { name: 'Typed template' }).click();
  const edit = page.getByRole('textbox', { name: /^Name/ });
  await expect(edit).toHaveValue('Typed template');
  await edit.click();
  await page.keyboard.press('ControlOrMeta+A');
  await page.keyboard.type('Typed template 2');
  await saveBtn(page).click();
  await page.waitForURL((u) => u.pathname.endsWith('/templates'));
  await page.getByRole('link', { name: 'Typed template 2' }).click();
  await expect(page.getByRole('textbox', { name: /^Name/ })).toHaveValue('Typed template 2');
});

test('Data manager / Linked accounts: Admin types an account name and it persists', async ({
  page,
}) => {
  await signIn(page, admin);
  await page.goto(`${adv(admin)}/linked-accounts`);
  await page.getByRole('button', { name: 'Link new account' }).click();
  await page.getByRole('menuitem', { name: 'Google Ads' }).click();
  const acct = page.getByLabel(/Account name/);
  await acct.click();
  await page.keyboard.type('Typed Ads account');
  await expect(acct).toHaveValue('Typed Ads account');
  await page.getByRole('button', { name: 'Link', exact: true }).click();
  await expect(page.getByText('Account linked.')).toBeVisible();
  await page.reload();
  await expect(page.getByText(/Typed Ads account/)).toBeVisible();
});

test('Users: New user and Edit user need Admin (RC-048); the student sees the list read only', async ({
  page,
}) => {
  await signIn(page, student);
  await page.goto('/users/new');
  await expect(page.getByRole('heading', { name: 'Page not found' })).toBeVisible();
  await page.goto('/users');
  await expect(page.getByRole('heading', { name: 'Users', exact: true, level: 1 })).toBeVisible();
  await expect(page.getByRole('button', { name: 'New user' })).toBeDisabled();
});

test('Users: an Admin can type into the New user form', async ({ page }) => {
  const tag = Date.now();
  await signIn(page, admin);
  await page.goto('/users/new');
  const name = page.getByRole('textbox', { name: 'Name' });
  await name.click();
  await page.keyboard.type('Typed User');
  await expect(name).toHaveValue('Typed User');
  const mail = page.getByRole('textbox', { name: 'Email' });
  await mail.click();
  await page.keyboard.type(`typed-${tag}@example.com`);
  await expect(mail).toHaveValue(`typed-${tag}@example.com`);
});
