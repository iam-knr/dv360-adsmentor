// Engine hook of module 09 (T09-08, V-09-13, AC-09-11, AC-09-18): ad review decisions and the two YouTube alerts.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { prisma } from '@/lib/db';
import { syncYoutube } from '@/lib/engine/io/youtube';
import { dropWorld } from '../db/helpers';
import { createLiWorld, type World } from '../services/line-items/helpers';

let w: World;
let liId: string;
let groupId: string;
const NOW = Date.parse('2026-11-02T10:00:00Z');

const run = (ms = NOW) =>
  prisma.$transaction((tx) =>
    syncYoutube(tx, { sandboxId: w.sandboxId, classroomId: w.classroomId }, ms),
  );
const alerts = (code: string) =>
  prisma.alert.findMany({
    where: { sandboxId: w.sandboxId, diagnosticCode: code },
    orderBy: { firstSeenAt: 'asc' },
  });

beforeAll(async () => {
  w = await createLiWorld('ytengine');
  const io = await prisma.insertionOrder.findUniqueOrThrow({ where: { id: w.ioId } });
  const li = await prisma.lineItem.create({
    data: {
      sandboxId: w.sandboxId,
      ioId: io.id,
      campaignId: io.campaignId,
      advertiserId: w.advertiserId,
      name: 'Engine YT LI',
      type: 'YT_VIDEO',
      ytSubtype: 'EFFICIENT_REACH',
      status: 'ACTIVE',
    },
  });
  liId = li.id;
  const g = await prisma.adGroup.create({
    data: {
      sandboxId: w.sandboxId,
      lineItemId: li.id,
      advertiserId: w.advertiserId,
      name: 'Empty group',
    },
  });
  groupId = g.id;
});
afterAll(async () => {
  await dropWorld(w);
  await prisma.$disconnect();
});

describe('YouTube engine sync', () => {
  it('raises AD_GROUP_NOT_RUNNING for an active group without ads and resolves it when an ad arrives', async () => {
    expect((await run()).raised).toContain('AD_GROUP_NOT_RUNNING');
    const [open] = await alerts('AD_GROUP_NOT_RUNNING');
    expect(open).toMatchObject({
      state: 'OPEN',
      severity: 'NEEDS_ATTENTION',
      lineItemId: liId,
      type: 'AD_GROUP_NOT_RUNNING',
    });
    expect((await run(NOW + 3_600_000)).raised).toEqual([]); // not raised twice
    expect(await alerts('AD_GROUP_NOT_RUNNING')).toHaveLength(1);

    await prisma.ad.create({
      data: {
        sandboxId: w.sandboxId,
        adGroupId: groupId,
        advertiserId: w.advertiserId,
        name: 'Engine ad',
        youtubeVideoId: 'ytengVid001',
        landingPageUrl: 'https://example.test',
        reviewStatus: 'APPROVED',
      },
    });
    await run(NOW + 2 * 3_600_000);
    expect((await alerts('AD_GROUP_NOT_RUNNING'))[0]?.state).toBe('RESOLVED');
  });

  it('raises AD_GROUP_NOT_RUNNING when the only ad group is paused (V-09-13)', async () => {
    await prisma.adGroup.update({ where: { id: groupId }, data: { status: 'PAUSED' } });
    await run(NOW + 3 * 3_600_000);
    const all = await alerts('AD_GROUP_NOT_RUNNING');
    expect(all.filter((a) => a.state === 'OPEN')).toHaveLength(1);
    await prisma.adGroup.update({ where: { id: groupId }, data: { status: 'ACTIVE' } });
    await run(NOW + 4 * 3_600_000);
    expect((await alerts('AD_GROUP_NOT_RUNNING')).filter((a) => a.state === 'OPEN')).toHaveLength(
      0,
    );
  });

  it('decides a due review and raises YT_AD_REJECTED, then resolves it when the ad is removed', async () => {
    const ad = await prisma.ad.create({
      data: {
        sandboxId: w.sandboxId,
        adGroupId: groupId,
        advertiserId: w.advertiserId,
        name: 'Claims ad',
        youtubeVideoId: 'ytengVid001',
        landingPageUrl: 'https://example.test',
        reviewStatus: 'PENDING',
        reviewDecideAt: new Date(NOW + 5 * 3_600_000),
        plannedVerdict: 'REJECTED',
      },
    });
    expect((await run(NOW + 4 * 3_600_000 + 1)).decided).toBe(0); // not due yet
    const res = await run(NOW + 6 * 3_600_000);
    expect(res.decided).toBe(1);
    expect(res.raised).toContain('YT_AD_REJECTED');
    const stored = await prisma.ad.findUniqueOrThrow({ where: { id: ad.id } });
    expect(stored).toMatchObject({ reviewStatus: 'REJECTED', reviewDecideAt: null });
    expect(stored.reviewFeedback).toMatch(/Misleading/);
    const [alert] = await alerts('YT_AD_REJECTED');
    expect(alert).toMatchObject({
      state: 'OPEN',
      severity: 'CRITICAL',
      title: '1 YouTube ad rejected',
      affectedCount: 1,
    });
    // the decision is a SIM_ENGINE change group stamped with the due time
    const group = await prisma.changeGroup.findFirstOrThrow({
      where: { entityType: 'AD', entityId: ad.id, actorType: 'SYSTEM' },
    });
    expect(group.systemActor).toBe('SIM_ENGINE');

    await prisma.ad.delete({ where: { id: ad.id } });
    await run(NOW + 7 * 3_600_000);
    expect((await alerts('YT_AD_REJECTED'))[0]?.state).toBe('RESOLVED');
  });
});
