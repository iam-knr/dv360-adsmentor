// Fixtures for the db project. Builds one complete sandbox (a row in every tenant table) with the plain client,
// which connects as the table owner and is therefore not subject to RLS.
import { prisma } from '@/lib/db';

let counter = 0;
const uniq = (tag: string) => `${tag}-${Date.now().toString(36)}-${(counter++).toString(36)}`;

export interface World {
  tag: string;
  ownerId: string;
  classroomId: string;
  sandboxId: string;
  partnerId: string;
  advertiserId: string;
  campaignId: string;
  ioId: string;
  lineItemId: string;
  adGroupId: string;
  creativeId: string;
  exchangeId: string;
  userId: string;
}

export async function ensureExchange(): Promise<string> {
  const row = await prisma.exchange.upsert({
    where: { code: 'test-exchange' },
    create: { code: 'test-exchange', name: 'Test Exchange' },
    update: {},
  });
  return row.id;
}

/** One user (the sandbox owner), one classroom, one sandbox and a row in every tenant table. */
export async function createWorld(tag: string): Promise<World> {
  const t = uniq(tag);
  const exchangeId = await ensureExchange();
  const owner = await prisma.user.create({
    data: { email: `${t}-admin@example.test`, name: `Admin ${t}`, appRole: 'ADMIN' },
  });
  const student = await prisma.user.create({
    data: { email: `${t}-user@example.test`, name: `User ${t}`, ownerAdminId: owner.id },
  });
  const classroom = await prisma.classroom.create({
    data: { name: `Cohort ${t}`, code: `code-${t}`, ownerAdminId: owner.id },
  });
  const sandbox = await prisma.sandbox.create({
    data: {
      classroomId: classroom.id,
      ownerUserId: student.id,
      name: `Sandbox ${t}`,
      seedValue: 1,
    },
  });
  const sandboxId = sandbox.id;
  await prisma.simClock.create({
    data: {
      sandboxId,
      simStart: new Date('2026-01-01T00:00:00Z'),
      marketSeed: 'm',
      sandboxSeed: 's',
    },
  });
  const partner = await prisma.partner.create({ data: { sandboxId, name: `Partner ${t}` } });
  await prisma.partnerExchange.create({ data: { sandboxId, partnerId: partner.id, exchangeId } });
  const advertiser = await prisma.advertiser.create({
    data: {
      sandboxId,
      partnerId: partner.id,
      name: `Advertiser ${t}`,
      websiteUrl: 'https://example.test',
      currencyCode: 'INR',
      timeZone: 'Asia/Calcutta',
    },
  });
  const campaign = await prisma.campaign.create({
    data: {
      sandboxId,
      advertiserId: advertiser.id,
      name: `Campaign ${t}`,
      plannedStart: new Date('2026-01-01T00:00:00Z'),
    },
  });
  await prisma.campaignBudget.create({
    data: { sandboxId, campaignId: campaign.id, amount: '1000', name: 'Budget 1' },
  });
  const io = await prisma.insertionOrder.create({
    data: {
      sandboxId,
      campaignId: campaign.id,
      advertiserId: advertiser.id,
      name: `IO ${t}`,
      objective: 'CLICKS',
    },
  });
  await prisma.budgetSegment.create({
    data: {
      sandboxId,
      ioId: io.id,
      amount: '500',
      startDate: new Date('2026-01-01T00:00:00Z'),
      endDate: new Date('2026-02-01T00:00:00Z'),
    },
  });
  await prisma.partnerCost.create({ data: { sandboxId, ioId: io.id, kind: 'CPM_FEE', slot: 1 } });
  const lineItem = await prisma.lineItem.create({
    data: {
      sandboxId,
      ioId: io.id,
      campaignId: campaign.id,
      advertiserId: advertiser.id,
      name: `LI ${t}`,
      type: 'DISPLAY',
    },
  });
  const adGroup = await prisma.adGroup.create({
    data: { sandboxId, lineItemId: lineItem.id, advertiserId: advertiser.id, name: `AG ${t}` },
  });
  await prisma.ad.create({
    data: {
      sandboxId,
      adGroupId: adGroup.id,
      advertiserId: advertiser.id,
      name: `Ad ${t}`,
      youtubeVideoId: 'abc',
      landingPageUrl: 'https://example.test',
    },
  });
  const creative = await prisma.creative.create({
    data: { sandboxId, advertiserId: advertiser.id, name: `Creative ${t}`, kind: 'STANDARD_IMAGE' },
  });
  await prisma.creativeAsset.create({
    data: {
      sandboxId,
      advertiserId: advertiser.id,
      fileName: 'a.png',
      mimeType: 'image/png',
      sizeBytes: 10,
      storageKey: `k-${t}`,
    },
  });
  await prisma.creativeReview.create({ data: { sandboxId, creativeId: creative.id, exchangeId } });
  await prisma.creativeAssignment.create({
    data: { sandboxId, lineItemId: lineItem.id, creativeId: creative.id },
  });
  const template = await prisma.targetingTemplate.create({
    data: {
      sandboxId,
      advertiserId: advertiser.id,
      name: `Template ${t}`,
      lineItemType: 'DISPLAY',
    },
  });
  await prisma.targetingAssignment.create({
    data: { sandboxId, ownerType: 'TEMPLATE', templateId: template.id, dimension: 'GEOGRAPHY' },
  });
  await prisma.audience.create({
    data: { sandboxId, advertiserId: advertiser.id, name: `Audience ${t}`, type: 'LOOKALIKE' },
  });
  await prisma.userAccessGrant.create({
    data: { userId: student.id, sandboxId, partnerId: partner.id, role: 'STANDARD' },
  });
  await prisma.simHourlyMetric.create({
    data: { sandboxId, lineItemId: lineItem.id, simHour: new Date('2026-01-01T01:00:00Z') },
  });
  await prisma.simDailyMetric.create({
    data: {
      sandboxId,
      classroomId: classroom.id,
      lineItemId: lineItem.id,
      simDate: new Date('2026-01-01'),
    },
  });
  await prisma.deliveryDiagnostic.create({
    data: {
      sandboxId,
      lineItemId: lineItem.id,
      date: new Date('2026-01-01'),
      exchangeId: 'test-exchange',
      stage: 'AVAILABLE',
      reasonCode: 'M.AVAILABLE',
    },
  });
  const group = await prisma.changeGroup.create({
    data: {
      sandboxId,
      classroomId: classroom.id,
      entityType: 'ADVERTISER',
      entityId: advertiser.id,
      summary: '1 change to advertiser',
    },
  });
  await prisma.changeEntry.create({
    data: { groupId: group.id, sandboxId, fieldPath: 'name', label: 'Name' },
  });
  await prisma.alert.create({
    data: {
      sandboxId,
      advertiserId: advertiser.id,
      type: 'NO_SPEND',
      severity: 'CRITICAL',
      category: 'BUDGET',
      title: 'Line items not spending',
    },
  });
  return {
    tag: t,
    ownerId: owner.id,
    classroomId: classroom.id,
    sandboxId,
    partnerId: partner.id,
    advertiserId: advertiser.id,
    campaignId: campaign.id,
    ioId: io.id,
    lineItemId: lineItem.id,
    adGroupId: adGroup.id,
    creativeId: creative.id,
    exchangeId,
    userId: student.id,
  };
}

/** Removes a world: deleting the sandbox cascades through the composite foreign keys. */
export async function dropWorld(w: World): Promise<void> {
  await prisma.sandbox.deleteMany({ where: { id: w.sandboxId } });
  await prisma.changeGroup.deleteMany({ where: { sandboxId: w.sandboxId } });
  await prisma.classroom.deleteMany({ where: { id: w.classroomId } });
  await prisma.user.deleteMany({ where: { id: { in: [w.userId, w.ownerId] } } });
}
