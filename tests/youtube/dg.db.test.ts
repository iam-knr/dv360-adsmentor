// Demand Gen ad groups and ads through the YouTube service (module 09 4.6, T09-09).
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { prisma } from '@/lib/db';
import { DG_AD_GROUP_TARGETING_TYPE, emptyTargetingState } from '@/lib/targeting';
import {
  createAd,
  createAdGroup,
  getAdDetail,
  getAdGroupDetail,
  getAdGroupDraft,
  listAdGroups,
  updateAd,
} from '@/lib/youtube/service';
import { EMPTY_AD_FORM, type AdFormValue } from '@/lib/youtube/types';
import { dropWorld } from '../db/helpers';
import { createLiWorld, userFor, type World } from '../services/line-items/helpers';

let w: World;
let liId: string;
let groupId: string;
const VIDEO = 'ytdgVid0001';

beforeAll(async () => {
  w = await createLiWorld('ytdg');
  const io = await prisma.insertionOrder.findUniqueOrThrow({ where: { id: w.ioId } });
  const li = await prisma.lineItem.create({
    data: {
      sandboxId: w.sandboxId,
      ioId: io.id,
      campaignId: io.campaignId,
      advertiserId: w.advertiserId,
      name: 'DG LI',
      type: 'DEMAND_GEN',
    },
  });
  liId = li.id;
  await prisma.advertiser.update({
    where: { id: w.advertiserId },
    data: { ytBusinessName: 'Dg Co' },
  });
  await prisma.youtubeVideo.create({
    data: {
      videoId: VIDEO,
      title: 'Dg film',
      channelName: 'Dg',
      durationSec: 30,
      orientation: 'HORIZONTAL',
    },
  });
});
afterAll(async () => {
  await prisma.youtubeVideo.deleteMany({ where: { videoId: VIDEO } });
  await dropWorld(w);
  await prisma.$disconnect();
});

const ad = (over: Partial<AdFormValue> = {}): AdFormValue => ({
  ...EMPTY_AD_FORM,
  name: 'DG ad',
  dgFormat: 'DEMAND_GEN_IMAGE',
  imageAssetIds: ['img-1'],
  headline: 'Fresh arrivals',
  description: 'Shop today',
  businessName: 'Dg Co',
  landingPage: 'example.test/dg',
  ...over,
});
const rules = (r: { ok: boolean; issues?: { ruleId: string }[] }) =>
  r.ok ? [] : (r.issues ?? []).map((i) => i.ruleId);

describe('Demand Gen ad group', () => {
  it('has no bid of its own and a Demand Gen targeting card', async () => {
    const draft = await getAdGroupDraft(userFor(w), liId);
    expect(draft?.kind).toBe('DEMAND_GEN');
    expect(draft?.value.targetingState.lineItemType).toBe(DG_AD_GROUP_TARGETING_TYPE);
    const res = await createAdGroup(userFor(w), liId, { ...draft!.value, name: 'DG group' });
    if (!res.ok) throw new Error(JSON.stringify(res.issues));
    groupId = res.data.id;
    const detail = await getAdGroupDetail(userFor(w), groupId);
    expect(detail).toMatchObject({ kind: 'DEMAND_GEN', value: { bid: '' } });
  });

  it('accepts device targeting (DG column) and refuses keywords (AG-006)', async () => {
    const base = emptyTargetingState(DG_AD_GROUP_TARGETING_TYPE);
    const device = {
      ...base,
      criteria: {
        device: { types: [{ id: 'SMARTPHONE', mode: 'INCLUDE' as const }], os: [], makeModel: [] },
      },
    };
    const okRes = await createAdGroup(userFor(w), liId, {
      name: 'DG device',
      status: 'ACTIVE',
      bid: '',
      targetingState: device,
    });
    expect(okRes.ok).toBe(true);
    const bad = { ...base, criteria: { keywords: { include: ['shoes'], exclude: [] } } };
    expect(
      rules(
        await createAdGroup(userFor(w), liId, {
          name: 'DG kw',
          status: 'ACTIVE',
          bid: '',
          targetingState: bad,
        }),
      ),
    ).toContain('AG-006');
  });

  it('lists with the Demand Gen line item type', async () => {
    const list = await listAdGroups(userFor(w), liId);
    expect(list?.lineItem.type).toBe('DEMAND_GEN');
    expect(list?.rows.map((r) => r.name)).toContain('DG group');
  });
});

describe('Demand Gen ads', () => {
  it('enforces 40 / 90 / 25 and the media of the format (AC-09-23)', async () => {
    const u = userFor(w);
    expect(rules(await createAd(u, groupId, ad({ headline: 'x'.repeat(41) })))).toEqual([
      'LI-DG-007',
    ]);
    expect(rules(await createAd(u, groupId, ad({ description: 'y'.repeat(91) })))).toEqual([
      'LI-DG-008',
    ]);
    expect(rules(await createAd(u, groupId, ad({ businessName: '' })))).toEqual(['LI-DG-009']);
    expect(rules(await createAd(u, groupId, ad({ imageAssetIds: [] })))).toEqual(['AD-DG-003']);
    expect(rules(await createAd(u, groupId, ad({ name: '' })))).toContain('AD-001');
    expect(rules(await createAd(u, groupId, ad({ landingPage: '' })))).toContain('AD-016');
    expect(
      rules(
        await createAd(u, groupId, ad({ dgFormat: 'DEMAND_GEN_VIDEO', videoRef: 'zzzzzzzzzzz' })),
      ),
    ).toEqual(['AD-DG-002']);
  });

  it('creates an image, a video and a carousel ad with the right columns', async () => {
    const u = userFor(w);
    const image = await createAd(u, groupId, ad());
    const video = await createAd(
      u,
      groupId,
      ad({ name: 'DG video', dgFormat: 'DEMAND_GEN_VIDEO', videoRef: VIDEO, imageAssetIds: [] }),
    );
    const carousel = await createAd(
      u,
      groupId,
      ad({
        name: 'DG carousel',
        dgFormat: 'DEMAND_GEN_CAROUSEL',
        imageAssetIds: ['i1', 'i2', 'i3'],
      }),
    );
    for (const r of [image, video, carousel]) expect(r.ok).toBe(true);
    if (!image.ok || !video.ok || !carousel.ok) return;
    const rows = await prisma.ad.findMany({
      where: { adGroupId: groupId },
      orderBy: { name: 'asc' },
    });
    expect(
      rows.map((r) => [r.name, r.format, r.youtubeVideoId, r.imageAssetIds.length, r.longHeadline]),
    ).toEqual([
      ['DG ad', 'DEMAND_GEN_IMAGE', null, 1, null],
      ['DG carousel', 'DEMAND_GEN_CAROUSEL', null, 3, null],
      ['DG video', 'DEMAND_GEN_VIDEO', VIDEO, 0, null],
    ]);
    const detail = await getAdDetail(u, image.data.id);
    expect(detail).toMatchObject({
      dg: true,
      value: { dgFormat: 'DEMAND_GEN_IMAGE', headline: 'Fresh arrivals' },
    });
    expect(detail?.imageUrls).toHaveLength(1);
  });

  it('keeps the format after create and sends an edited image set back to review', async () => {
    const u = userFor(w);
    const row = await prisma.ad.findFirstOrThrow({ where: { adGroupId: groupId, name: 'DG ad' } });
    await prisma.ad.update({
      where: { id: row.id },
      data: { reviewStatus: 'APPROVED', reviewDecideAt: null },
    });
    const detail = await getAdDetail(u, row.id);
    const same = await updateAd(
      u,
      row.id,
      { ...detail!.value, name: 'DG ad renamed' },
      { expectedVersion: detail!.version },
    );
    expect(same.ok).toBe(true);
    expect((await prisma.ad.findUniqueOrThrow({ where: { id: row.id } })).reviewStatus).toBe(
      'APPROVED',
    );
    const fresh = await getAdDetail(u, row.id);
    const forged = await updateAd(u, row.id, {
      ...fresh!.value,
      dgFormat: 'DEMAND_GEN_VIDEO',
      videoRef: VIDEO,
      imageAssetIds: [],
    });
    // the stored image format wins over the forged one, so the video value is not stored
    expect(forged.ok).toBe(false);
    const edited = await updateAd(u, row.id, { ...fresh!.value, imageAssetIds: ['img-2'] });
    expect(edited.ok).toBe(true);
    const stored = await prisma.ad.findUniqueOrThrow({ where: { id: row.id } });
    expect(stored).toMatchObject({
      format: 'DEMAND_GEN_IMAGE',
      reviewStatus: 'PENDING',
      imageAssetIds: ['img-2'],
    });
  });
});
