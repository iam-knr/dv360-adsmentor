// P4-06, module 09 6.2: PW-09-01..03 step 1 and creating the line item, PW-09-04 ad group, PW-09-05..09 ad panel and
// preview, PW-09-10 delete, PW-09-12 target frequency, PW-09-13 read-only. PW-09-11 (the engine raises "YouTube ads
// rejected" on the campaign Alerts page) needs the engine alert, which is not built; the rejected ad's status in the
// panel is covered instead. Synthetic data only (the video catalogue of lib/youtube/seed.ts).
import { PrismaClient } from '@prisma/client';
import { expect, test, type Page } from '@playwright/test';
import { cleanup } from '../auth/fixtures';
import { createShellWorld, type ShellWorld } from '../shell/e2e-world';
import { seedYoutubeVideos } from '../../lib/youtube/seed';

const db = new PrismaClient({
  datasources: { db: { url: process.env.DATABASE_URL_TEST ?? process.env.DATABASE_URL } },
});
let w: ShellWorld;
let readOnly: ShellWorld;
let liPublicId: string;
let liRowId: string;

const BUMPER = 'SIMbump0001'; // 6 s, horizontal: bumper only
const SPOT = 'SIMh0300001'; // 30 s, horizontal: skippable and in-feed
const base = (world: ShellWorld = w) => `/p/${world.ids.pid}/a/${world.ids.aid}/c/${world.ids.cid}`;
const newLi = (query = '') => `${base()}/io/${w.ids.ioId}/lis/new${query}`;

async function prepare(world: ShellWorld) {
  const io = await db.insertionOrder.findFirstOrThrow({ where: { sandboxId: world.sandboxId } });
  await db.insertionOrder.update({
    where: { id: io.id },
    data: { objective: 'BRAND_AWARENESS', bidBudgetControl: 'LI_CONTROLLED' },
  });
  await db.budgetSegment.create({
    data: {
      sandboxId: world.sandboxId,
      ioId: io.id,
      amount: 100000,
      startDate: new Date('2026-11-01T00:00:00Z'),
      endDate: new Date('2027-01-31T00:00:00Z'),
    },
  });
  await db.advertiser.update({
    where: { id: io.advertiserId },
    data: { ytBusinessName: 'Monsoon Footwear', ytLogoAssetId: 'default-logo' },
  });
  return io;
}

test.beforeAll(async () => {
  await seedYoutubeVideos(db);
  const tag = `pw06y-${Date.now()}`;
  w = await createShellWorld(db, { tag });
  readOnly = await createShellWorld(db, { tag: `${tag}-ro`, role: 'READ_ONLY' });
  await prepare(w);
  const roIo = await prepare(readOnly);
  // A YouTube line item with a rejected ad for the read-only user and the review display
  for (const [world, io] of [
    [w, await db.insertionOrder.findFirstOrThrow({ where: { sandboxId: w.sandboxId } })],
    [readOnly, roIo],
  ] as const) {
    const li = await db.lineItem.create({
      data: {
        sandboxId: world.sandboxId,
        ioId: io.id,
        campaignId: io.campaignId,
        advertiserId: io.advertiserId,
        name: 'PW seeded YT LI',
        type: 'YT_VIDEO',
        ytSubtype: 'EFFICIENT_REACH',
        ytSurfaces: ['IN_STREAM', 'IN_FEED', 'SHORTS'],
      },
    });
    const group = await db.adGroup.create({
      data: {
        sandboxId: world.sandboxId,
        lineItemId: li.id,
        advertiserId: io.advertiserId,
        name: 'PW seeded group',
        bidValue: 60,
      },
    });
    await db.ad.create({
      data: {
        sandboxId: world.sandboxId,
        adGroupId: group.id,
        advertiserId: io.advertiserId,
        name: 'PW rejected ad',
        youtubeVideoId: SPOT,
        headline: 'Guaranteed results',
        longHeadline: 'Long',
        description: 'Desc',
        businessName: 'Monsoon Footwear',
        logoAssetId: 'default-logo',
        landingPageUrl: 'https://example.test',
        reviewStatus: 'REJECTED',
        reviewFeedback: 'Misleading claims: the ad makes promises that cannot be verified.',
      },
    });
    if (world === w) {
      liPublicId = li.publicId.toString();
      liRowId = li.id;
    }
  }
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

test('PW-09-01..03: step 1, step 2 with the subtype line, amount required, then the Ad groups tab', async ({
  page,
}) => {
  await signIn(page);
  await page.goto(newLi());
  await page.getByRole('button', { name: /^YouTube & partners video/ }).click();
  await expect(page).toHaveURL(/type=YT_VIDEO/);

  // step 1: Reach is the default, the ad format card follows MX-07, Ad sequence is behind Show more
  const next = page.getByRole('button', { name: 'Next' });
  await expect(next).toBeDisabled();
  await expect(page.getByRole('radio', { name: /^Reach/ })).toBeChecked();
  await expect(page.getByRole('radio', { name: /Efficient ad formats/ })).toBeChecked();
  await expect(page.getByRole('radio', { name: /Ad sequence/ })).toHaveCount(0);
  await page.getByRole('button', { name: 'Show more' }).click();
  await expect(page.getByRole('radio', { name: /Ad sequence/ })).toBeVisible();
  await page.getByRole('radio', { name: /TrueView views/ }).check();
  await expect(page.getByRole('radio', { name: /Efficient ad formats/ })).toHaveCount(0);
  await page.getByRole('radio', { name: /^Reach/ }).check();
  await page.locator('#yt-name').fill('PW efficient reach');
  await next.click();

  // step 2: the subtype line, all three formats ticked, Daily amount required
  await expect(page).toHaveURL(/optimization=REACH&format=EFFICIENT/);
  await expect(page.getByTestId('yt-subtype')).toContainText('Efficient reach');
  for (const label of ['In-stream ads', 'In-feed ads', 'Shorts ads'])
    await expect(page.getByRole('checkbox', { name: new RegExp(label) })).toBeChecked();
  await expect(page.getByTestId('yt-bid')).toContainText('Maximize reach');
  await expect(page.getByText('Actual spend on a given day may vary.')).toBeVisible();
  await page.getByRole('radio', { name: /Does not contain EU political ads/ }).check();
  await page.getByRole('button', { name: 'Create' }).click();
  await expect(page.getByText('Enter a value').first()).toBeVisible();
  await expect(page).toHaveURL(/lis\/new/);

  // unticking every format raises LI-YT-005
  for (const label of ['In-stream ads', 'In-feed ads', 'Shorts ads'])
    await page.getByRole('checkbox', { name: new RegExp(label) }).uncheck();
  await page.locator('#yt-daily-amount').fill('1000');
  await page.getByRole('button', { name: 'Create' }).click();
  await expect(page.getByText('Select at least one ad format.')).toBeVisible();
  await page.getByRole('checkbox', { name: /In-stream ads/ }).check();

  await page.getByRole('button', { name: 'Create' }).click();
  await page.waitForURL(/\/li\/\d+\/adgroups/);
  await expect(page.getByRole('tab', { name: 'Ad groups' })).toBeVisible();
  await expect(page.getByText('No ad groups')).toBeVisible();
  const row = await db.lineItem.findFirstOrThrow({
    where: { name: 'PW efficient reach', sandboxId: w.sandboxId },
  });
  expect(row).toMatchObject({
    type: 'YT_VIDEO',
    ytSubtype: 'EFFICIENT_REACH',
    ytSurfaces: ['IN_STREAM'],
  });
});

test('PW-09-12: Target frequency requires the target field (LI-YT-012)', async ({ page }) => {
  await signIn(page);
  await page.goto(
    newLi(
      '?type=YT_VIDEO&name=PW+target+frequency&optimization=TARGET_FREQUENCY&format=ALL_FORMATS',
    ),
  );
  await expect(page.getByTestId('yt-subtype')).toContainText('Target frequency');
  await expect(page.locator('#yt-target-frequency')).toBeVisible();
  await page.locator('#yt-daily-amount').fill('500');
  await page.getByRole('radio', { name: /Does not contain EU political ads/ }).check();
  await page.getByRole('button', { name: 'Create' }).click();
  await expect(page.getByText('Enter a value').first()).toBeVisible();
  await page.locator('#yt-target-frequency').fill('3');
  await page.getByRole('button', { name: 'Create' }).click();
  await page.waitForURL(/\/li\/\d+\/adgroups/);
  const row = await db.lineItem.findFirstOrThrow({
    where: { name: 'PW target frequency', sandboxId: w.sandboxId },
  });
  expect(row.targetFreqExposures).toBe(3);
});

test('PW-09-04..10: ad group, ad with preview, status, delete', async ({ page }) => {
  await signIn(page);
  await page.goto(`${base()}/io/${w.ids.ioId}/li/${liPublicId}/adgroups`);

  // the seeded group shows its columns; the default filter is Status: Active
  await expect(page.getByRole('combobox', { name: 'Status filter' })).toContainText('Active');
  for (const h of [
    'Impressions',
    'Impr. (Co-viewed)',
    'Revenue',
    'Avg. CPM',
    'TrueView: Views',
    'TrueView: View Rate',
    'TrueView: Avg. CPV',
    'Avg. CPA',
  ])
    await expect(page.getByRole('columnheader', { name: h })).toBeVisible();
  await expect(page.getByText('PW seeded group')).toBeVisible();

  // PW-09-04: a new ad group needs a name and a bid
  await page.getByRole('button', { name: 'New ad group' }).first().click();
  await page.getByRole('button', { name: 'Create ad group' }).click();
  await expect(page.getByText('Enter a value').first()).toBeVisible();
  await page.locator('#adgroup-name').fill('PW group');
  await page.locator('#adgroup-bid').fill('75');
  await page.getByRole('button', { name: 'Create ad group' }).click();
  await expect(page.getByRole('button', { name: 'PW group' })).toBeVisible();
  const group = await db.adGroup.findFirstOrThrow({
    where: { name: 'PW group', sandboxId: w.sandboxId },
  });
  expect(Number(group.bidValue)).toBe(75);

  // PW-09-05: open it, the no-ads warning shows, create an ad from a pasted URL
  await page.getByRole('button', { name: 'PW group' }).click();
  await expect(page.getByTestId('ag-no-ads')).toBeVisible();
  await page.getByRole('button', { name: 'Create new ad' }).click();
  await page.locator('#ad-name').fill('PW ad');
  await page.locator('#ad-video').fill(`https://www.youtube.com/watch?v=${BUMPER}`);
  await page.locator('#ad-name').click(); // blur runs the lookup
  await expect(page.getByTestId('video-card')).toContainText('Bumper teaser 1');

  // unknown video shows AD-004
  await page.locator('#ad-video').fill('zzzzzzzzzzz');
  await page.locator('#ad-name').click();
  await expect(page.getByText("We couldn't find that video. Check the URL or ID.")).toBeVisible();
  await page.locator('#ad-video').fill(BUMPER);
  await page.locator('#ad-name').click();
  await expect(page.getByTestId('video-card')).toBeVisible();

  // business name and logo come from Advertiser settings (AC-09-12)
  await expect(page.locator('#ad-business')).toHaveValue('Monsoon Footwear');

  // PW-09-06: the caption for a 6 s video
  await page.locator('#ad-headline').fill('Step into the festive season');
  await expect(page.getByTestId('preview-caption')).toHaveText(
    'Mobile phone example of your bumper ad on YouTube',
  );

  // PW-09-08: the headline stops at 30 characters
  await page.locator('#ad-headline').fill('x'.repeat(31));
  await expect(page.locator('#ad-headline')).toHaveValue('x'.repeat(30));
  await page.locator('#ad-headline').fill('Step into the festive season');

  // PW-09-07: TV and Google TV update the caption
  await page.getByRole('button', { name: 'TV', exact: true }).click();
  await page.getByRole('tab', { name: 'Google TV' }).click();
  await expect(page.getByTestId('preview-caption')).toHaveText(
    'TV example of your bumper ad on Google TV',
  );
  await page.getByRole('button', { name: 'Mobile phone' }).click();
  await page.getByRole('tab', { name: 'YouTube', exact: true }).click();

  // required fields, then PW-09-09: Create ad
  await page.getByRole('button', { name: 'Create ad' }).click();
  await expect(page.getByText('Enter a value').first()).toBeVisible();
  await page.locator('#ad-long-headline').fill('A long headline for the festive season');
  await page.locator('#ad-description').fill('Shoes for every step');
  await page.locator('#ad-landing').fill('example.test/festive');
  await page.getByRole('button', { name: 'Create ad' }).click();
  await expect(page.getByTestId('ad-card')).toContainText('PW ad');
  await expect(page.getByTestId('ad-card')).toContainText('Responsive');
  await expect(page.getByTestId('ag-no-ads')).toHaveCount(0);
  const ad = await db.ad.findFirstOrThrow({ where: { name: 'PW ad', sandboxId: w.sandboxId } });
  expect(ad).toMatchObject({ status: 'ACTIVE', reviewStatus: 'PENDING', youtubeVideoId: BUMPER });

  // AC-09-17: the status control pauses the ad and persists
  await page.getByRole('combobox', { name: 'Status of PW ad' }).click();
  await page.getByRole('option', { name: 'Paused' }).click();
  await expect
    .poll(async () => (await db.ad.findUniqueOrThrow({ where: { id: ad.id } })).status)
    .toBe('PAUSED');

  // PW-09-10: delete the ad group after the DLG-08 confirmation; the DELETE entry stays in the change log
  await page.getByRole('button', { name: 'Delete', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Delete PW group?' })).toContainText(
    'This ad group and its ads will be deleted.',
  );
  await page.getByRole('button', { name: 'Delete', exact: true }).last().click();
  await expect(page.getByRole('button', { name: 'PW group' })).toHaveCount(0);
  expect(await db.adGroup.count({ where: { id: group.id } })).toBe(0);
  const entries = await db.changeEntry.findMany({
    where: { group: { entityType: 'AD_GROUP', entityId: group.id } },
  });
  expect(entries.some((e) => e.kind === 'DELETE')).toBe(true);
});

test('AC-09-14: the format dropdown limits the device buttons and surface tabs', async ({
  page,
}) => {
  await signIn(page);
  await page.goto(`${base()}/io/${w.ids.ioId}/li/${liPublicId}/adgroups`);
  await page.getByRole('button', { name: 'PW seeded group' }).click();
  await page.getByRole('button', { name: 'PW rejected ad' }).click();
  // AC-09-21 display: the rejected ad's review status and feedback show in the panel
  await expect(page.getByTestId('review-status')).toContainText('Rejected');
  await expect(page.getByTestId('review-status')).toContainText('Misleading claims');
  // a 30 s video offers skippable and in-feed; in-feed is not available on TV or on Google TV
  await expect(page.getByTestId('preview-caption')).toContainText('skippable in-stream');
  await page.getByRole('combobox', { name: 'Ad format' }).click();
  await page.getByRole('option', { name: 'In-feed video' }).click();
  await expect(page.getByTestId('preview-caption')).toContainText('in-feed video ad on YouTube');
  await expect(page.getByRole('button', { name: 'TV', exact: true })).toBeDisabled();
  await expect(page.getByRole('tab', { name: 'Google TV' })).toBeDisabled();
});

test('PW-09-13: a read-only user sees ad groups and ads but cannot change them', async ({
  page,
}) => {
  await signIn(page, readOnly);
  const li = await db.lineItem.findFirstOrThrow({
    where: { name: 'PW seeded YT LI', sandboxId: readOnly.sandboxId },
  });
  await page.goto(`${base(readOnly)}/io/${readOnly.ids.ioId}/li/${li.publicId}/adgroups`);
  await expect(page.getByRole('button', { name: 'New ad group' }).first()).toBeDisabled();
  await page.getByRole('button', { name: 'PW seeded group' }).click();
  await expect(page.locator('#adgroup-name')).toHaveAttribute('readonly', '');
  await expect(page.getByRole('button', { name: 'Save' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Create new ad' })).toHaveCount(0);
  await page.getByRole('button', { name: 'PW rejected ad' }).click();
  await expect(page.locator('#ad-name')).toHaveAttribute('readonly', '');
  await expect(page.getByTestId('ad-preview')).toBeVisible();
  void liRowId;
});
