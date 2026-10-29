// Resource seed data (module 15 3.3, M15-01) and the engine wiring of M15-09: Floodlight windows and tag fault read from
// the group, custom bidding readiness advanced from labelled impressions.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { prisma, withBypass } from '@/lib/db';
import { defaultParams } from '@/lib/engine/params/load';
import { loadClock, loadWorlds } from '@/lib/engine/io/loadWorld';
import { advanceCustomBidding } from '@/lib/resources/custom-bidding-training';
import { seedResources } from '@/lib/resources/seed';
import { createEnv, dropEnv, TODAY, type Env } from '../engine-io/fixtures';
import { provisionSandbox } from '@/lib/seed/sandbox';

let env: Env;
let lab: string;

beforeAll(async () => {
  env = await createEnv(1, 'resources');
  const r = await provisionSandbox(prisma, {
    classroomId: env.classroomId,
    ownerUserId: null,
    name: 'Resources lab',
    template: 'troubleshooting-lab',
    kind: 'DEMO',
    seedValue: 9300,
    partnerName: 'Sandbox RES-LAB',
    today: TODAY,
  });
  lab = r.sandboxId;
  env.sandboxIds.push(lab);
}, 600_000);

afterAll(async () => {
  await dropEnv(env);
  await prisma.$disconnect();
});

describe('seeded resources per advertiser', () => {
  it('builds the module 15 rows for every advertiser', async () => {
    const [sandboxId] = env.sandboxIds as [string];
    const advertisers = await prisma.advertiser.findMany({ where: { sandboxId } });
    expect(advertisers.length).toBeGreaterThan(0);
    for (const adv of advertisers) {
      const group = await prisma.floodlightGroup.findFirstOrThrow({
        where: { advertiserId: adv.id },
        include: { activities: true, models: true, variables: true, conversionGroups: true },
      });
      expect(adv.floodlightGroupId).toBe(group.id);
      expect(group).toMatchObject({ clickWindowDays: 30, impressionWindowDays: 1 });
      expect(group.activities).toHaveLength(6);
      expect(group.models).toHaveLength(2);
      expect(group.variables).toHaveLength(10);
      expect(group.conversionGroups).toHaveLength(2);

      const channels = await prisma.channel.findMany({
        where: { advertiserId: adv.id },
        include: { _count: { select: { entries: true } } },
      });
      expect(channels).toHaveLength(3);
      expect(Math.max(...channels.map((c) => c._count.entries))).toBeGreaterThanOrEqual(200);

      const lists = await prisma.keywordList.findMany({
        where: { advertiserId: adv.id },
        include: { _count: { select: { entries: true } } },
        orderBy: { name: 'asc' },
      });
      expect(lists.map((l) => l._count.entries).sort((a, b) => a - b)).toEqual([40, 120]);

      const locs = await prisma.locationList.findMany({
        where: { advertiserId: adv.id },
        include: { _count: { select: { entries: true } } },
      });
      expect(Object.fromEntries(locs.map((l) => [l.type, l._count.entries]))).toEqual({
        REGIONAL: 12,
        PROXIMITY: 5,
      });

      const algs = await prisma.customBiddingAlgorithm.findMany({
        where: { advertiserId: adv.id },
        orderBy: { readinessPct: 'desc' },
      });
      expect(algs.map((a) => [a.status, a.readinessPct])).toEqual([
        ['ACTIVE', 100],
        ['TRAINING', 35],
      ]);

      const assets = await prisma.youtubeAsset.groupBy({
        by: ['kind'],
        where: { advertiserId: adv.id },
        _count: { _all: true },
      });
      expect(Object.fromEntries(assets.map((a) => [a.kind, a._count._all]))).toEqual({
        LOCATION: 4,
        AFFILIATE_LOCATION: 2,
        SITELINK: 5,
      });
    }
    expect(await prisma.appCatalog.count()).toBeGreaterThanOrEqual(300);
  });

  it('is idempotent: seeding again adds nothing', async () => {
    const [sandboxId] = env.sandboxIds as [string];
    const before = await prisma.channel.count({ where: { sandboxId } });
    const added = await prisma.$transaction((tx) =>
      seedResources(tx, { sandboxId, template: 'starter-agency', seedValue: 9100 }),
    );
    expect(added).toBe(0);
    expect(await prisma.channel.count({ where: { sandboxId } })).toBe(before);
  });

  it('is deterministic: the same seed value gives the same channel entries', async () => {
    const [sandboxId] = env.sandboxIds as [string];
    const adv = await prisma.advertiser.findFirstOrThrow({
      where: { sandboxId },
      orderBy: { id: 'asc' },
    });
    const entries = await prisma.channelEntry.findMany({
      where: { channel: { advertiserId: adv.id, name: 'Block list: low quality sites' } },
      orderBy: { value: 'asc' },
      take: 5,
    });
    expect(entries.length).toBe(5);
    expect(entries.every((e) => e.kind === 'URL' && e.value.endsWith('.example.com'))).toBe(true);
  });

  it('troubleshooting-lab has one advertiser whose tag is broken', async () => {
    const groups = await prisma.floodlightGroup.findMany({ where: { sandboxId: lab } });
    expect(groups.filter((g) => g.tagStatus === 'broken')).toHaveLength(1);
  });

  it('line items count the Purchase conversion', async () => {
    const [sandboxId] = env.sandboxIds as [string];
    const n = await prisma.lineItemFloodlightActivity.count({ where: { sandboxId } });
    expect(n).toBeGreaterThan(0);
  });
});

describe('engine reads the group (M15-09)', () => {
  it('passes the group windows to the line item selections and the tag fault to the activities', async () => {
    const [sandboxId] = env.sandboxIds as [string];
    const adv = await prisma.advertiser.findFirstOrThrow({
      where: { sandboxId },
      orderBy: { id: 'asc' },
    });
    await prisma.floodlightGroup.updateMany({
      where: { advertiserId: adv.id },
      data: { clickWindowDays: 45, impressionWindowDays: 3 },
    });
    const worlds = await withBypass(async (tx) => {
      const clock = (await loadClock(tx, sandboxId))!;
      return loadWorlds(tx, clock, defaultParams());
    });
    const w = worlds.worlds.find((x) => x.advertiserId === adv.id)!;
    const selections = w.world.lineItems.flatMap((l) => l.floodlight);
    expect(selections.length).toBeGreaterThan(0);
    expect(
      selections.every((s) => s.postClickWindowDays === 45 && s.postViewWindowDays === 3),
    ).toBe(true);
    expect(w.world.floodlightActivities.every((a) => a.tagStatus === 'active')).toBe(true);

    await prisma.floodlightGroup.updateMany({
      where: { advertiserId: adv.id },
      data: { tagStatus: 'broken' },
    });
    const broken = await withBypass(async (tx) => {
      const clock = (await loadClock(tx, sandboxId))!;
      return loadWorlds(tx, clock, defaultParams());
    });
    const bw = broken.worlds.find((x) => x.advertiserId === adv.id)!;
    expect(bw.world.floodlightActivities.length).toBeGreaterThan(0);
    expect(bw.world.floodlightActivities.every((a) => a.tagStatus === 'broken')).toBe(true);
  });

  it('custom bidding: labelled impressions raise readiness and a full model turns ACTIVE', async () => {
    const [sandboxId] = env.sandboxIds as [string];
    const adv = await prisma.advertiser.findFirstOrThrow({
      where: { sandboxId },
      orderBy: { id: 'asc' },
    });
    const li = await prisma.lineItem.findFirstOrThrow({
      where: { advertiserId: adv.id, status: 'ACTIVE' },
    });
    const training = await prisma.customBiddingAlgorithm.findFirstOrThrow({
      where: { advertiserId: adv.id, status: 'TRAINING' },
    });
    await prisma.lineItem.update({
      where: { id: li.id },
      data: { customBiddingAlgorithmId: training.id },
    });

    const step = (impressions: number) =>
      withBypass((tx) =>
        advanceCustomBidding(tx, sandboxId, [{ lineItemId: li.id, metrics: { impressions } }]),
      );
    expect(await step(1000)).toBe(1);
    let row = await prisma.customBiddingAlgorithm.findUniqueOrThrow({ where: { id: training.id } });
    expect(row).toMatchObject({ readinessPct: 55, status: 'TRAINING', modelReadiness: 'TRAINING' });
    expect(row.activeLineItems).toBe(1);
    expect(Number(row.errorPct)).toBe(0.5);

    await step(3250);
    row = await prisma.customBiddingAlgorithm.findUniqueOrThrow({ where: { id: training.id } });
    expect(row).toMatchObject({ readinessPct: 100, status: 'ACTIVE', modelReadiness: 'READY' });

    expect(await step(0)).toBe(0);
  });
});
