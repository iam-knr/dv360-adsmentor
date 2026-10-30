// M18-05: a student with an account and no sandbox signs in, watches /sim/welcome build the sandbox and opens the
// simulator: Overview, a campaign, a line item and a report. The server runs with SANDBOX_ENGINE_DAYS=3
// (playwright.config.ts) so the engine part of the build takes seconds; production builds 90 days.
import { PrismaClient } from '@prisma/client';
import { expect, test, type Page } from '@playwright/test';
import { cleanup, createAccount, createClassroom } from '../auth/fixtures';
import { clearSandboxData } from '@/lib/seed/write';

const db = new PrismaClient({
  datasources: { db: { url: process.env.DATABASE_URL_TEST ?? process.env.DATABASE_URL } },
});
const created: { userIds: string[]; classroomIds: string[] } = { userIds: [], classroomIds: [] };
const sandboxIds: string[] = [];

test.afterAll(async () => {
  for (const id of sandboxIds) {
    await db.$transaction((tx) => clearSandboxData(tx, id), { timeout: 120_000 });
    await db.userAccessGrant.deleteMany({ where: { sandboxId: id } });
  }
  await cleanup(db, created);
  await db.$disconnect();
});

async function signIn(page: Page, email: string, password: string) {
  await page.goto('/sim/login');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.waitForURL((url) => !url.pathname.startsWith('/sim/login'));
}

test('a new student gets a sandbox on /sim/welcome and can open campaign, line item and report', async ({
  page,
}) => {
  test.setTimeout(420_000);
  const admin = await createAccount(db, { tag: 'prov-instr', role: 'ADMIN' });
  const classroom = await createClassroom(db, {
    tag: 'prov-open',
    ownerAdminId: admin.user.id,
    windows: 'open',
  });
  await db.classroom.update({
    where: { id: classroom.id },
    data: { defaultSeedTemplate: 'starter-agency' },
  });
  const student = await createAccount(db, {
    tag: 'prov-stu',
    role: 'USER',
    cohortId: classroom.id,
    ownerAdminId: admin.user.id,
    name: 'Fresh Student',
    mustChangePassword: false,
  });
  await db.classroomMember.create({ data: { classroomId: classroom.id, userId: student.user.id } });
  created.userIds.push(admin.user.id, student.user.id);
  created.classroomIds.push(classroom.id);
  expect(await db.sandbox.count({ where: { ownerUserId: student.user.id } })).toBe(0);

  await signIn(page, student.user.email, student.password);
  await expect(page).toHaveURL(/\/sim\/welcome$/);

  // the page starts the build and reports progress until the way in appears
  const open = page.getByRole('link', { name: 'Open Overview' });
  await expect(open).toBeVisible({ timeout: 360_000 });
  const sandbox = await db.sandbox.findFirstOrThrow({ where: { ownerUserId: student.user.id } });
  sandboxIds.push(sandbox.id);
  expect(sandbox.provisionState).toBe('READY');
  expect(sandbox.resetCount).toBe(0);

  await open.click();
  await expect(page).toHaveURL(/\/p\/\d+\/home_v3$/);
  await expect(page).toHaveTitle('Overview - DV360 Simulator by Adsmetor');
  const pid = /\/p\/(\d+)\//.exec(page.url())?.[1] as string;

  // campaign, line item and report of the seeded template
  const adv = await db.advertiser.findFirstOrThrow({
    where: { sandboxId: sandbox.id },
    orderBy: { createdAt: 'asc' },
  });
  const campaign = await db.campaign.findFirstOrThrow({
    where: { sandboxId: sandbox.id, advertiserId: adv.id },
    orderBy: { createdAt: 'asc' },
  });
  const io = await db.insertionOrder.findFirstOrThrow({
    where: { sandboxId: sandbox.id, campaignId: campaign.id },
    orderBy: { createdAt: 'asc' },
  });
  const li = await db.lineItem.findFirstOrThrow({
    where: { sandboxId: sandbox.id, ioId: io.id },
    orderBy: { createdAt: 'asc' },
  });
  const base = `/p/${pid}/a/${adv.publicId}`;
  await page.goto(`${base}/cs`);
  await expect(page.getByText(campaign.name).first()).toBeVisible();
  await page.goto(`${base}/c/${campaign.publicId}/io/${io.publicId}/li/${li.publicId}/details`);
  await expect(page.locator('#name')).toHaveValue(li.name);
  await page.goto(`/p/${pid}/reporting`);
  await expect(page.getByText('Suggested templates')).toBeVisible();
});
