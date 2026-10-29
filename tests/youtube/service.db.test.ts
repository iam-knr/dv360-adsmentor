// Ad group and ad service against the real schema (module 09 V-09-10, AC-09-10..21).
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { prisma } from '@/lib/db';
import {
  createAd,
  createAdGroup,
  deleteAd,
  deleteAdGroup,
  getAdDetail,
  getAdGroupDetail,
  getAdDraft,
  getAdGroupDraft,
  listAdGroups,
  lookupVideos,
  setAdGroupStatus,
  setAdStatus,
  updateAd,
  updateAdGroup,
} from '@/lib/youtube/service';
import { EMPTY_AD_FORM, type AdFormValue } from '@/lib/youtube/types';
import { dropWorld } from '../db/helpers';
import { createLiWorld, userFor, type World } from '../services/line-items/helpers';

let w: World;
let liId: string;
const VIDEO_BUMPER = 'ytsvcBmp001';
const VIDEO_LONG = 'ytsvcLng001';

beforeAll(async () => {
  w = await createLiWorld('ytsvc');
  const li = await prisma.lineItem.create({
    data: {
      sandboxId: w.sandboxId,
      ioId: w.ioId,
      campaignId: (await prisma.insertionOrder.findUniqueOrThrow({ where: { id: w.ioId } }))
        .campaignId,
      advertiserId: w.advertiserId,
      name: 'YT LI',
      type: 'YT_VIDEO',
      ytSubtype: 'EFFICIENT_REACH',
      ytSurfaces: ['IN_STREAM', 'IN_FEED', 'SHORTS'],
    },
  });
  liId = li.id;
  await prisma.advertiser.update({
    where: { id: w.advertiserId },
    data: { ytBusinessName: 'Acme Co', ytLogoAssetId: 'logo-default' },
  });
  await prisma.youtubeVideo.createMany({
    data: [
      {
        videoId: VIDEO_BUMPER,
        title: 'Svc bumper',
        channelName: 'Svc',
        durationSec: 6,
        orientation: 'HORIZONTAL',
      },
      {
        videoId: VIDEO_LONG,
        title: 'Svc long',
        channelName: 'Svc',
        durationSec: 30,
        orientation: 'HORIZONTAL',
      },
    ],
    skipDuplicates: true,
  });
});
afterAll(async () => {
  await prisma.youtubeVideo.deleteMany({ where: { videoId: { in: [VIDEO_BUMPER, VIDEO_LONG] } } });
  await dropWorld(w);
  await prisma.$disconnect();
});

async function kindsOf(entityType: 'AD' | 'AD_GROUP', entityId: string): Promise<string[]> {
  const groups = await prisma.changeGroup.findMany({
    where: { entityType, entityId },
    include: { entries: true },
    orderBy: { occurredAt: 'asc' },
  });
  return groups.map((g) => [...new Set(g.entries.map((e) => e.kind))].join('+'));
}

const adForm = (over: Partial<AdFormValue> = {}): AdFormValue => ({
  ...EMPTY_AD_FORM,
  name: 'Ad one',
  videoRef: `https://www.youtube.com/watch?v=${VIDEO_BUMPER}`,
  longHeadline: 'A long headline',
  description: 'A description',
  businessName: 'Acme Co',
  logoAssetId: 'logo-default',
  landingPage: 'example.com/landing',
  ...over,
});

describe('video lookup (Y16)', () => {
  it('resolves URLs and ids, searches titles, hides unknown ids', async () => {
    const user = userFor(w);
    expect((await lookupVideos(user, `https://youtu.be/${VIDEO_BUMPER}`))[0]?.videoId).toBe(
      VIDEO_BUMPER,
    );
    expect((await lookupVideos(user, VIDEO_LONG))[0]?.durationSec).toBe(30);
    expect((await lookupVideos(user, 'svc long')).map((v) => v.videoId)).toContain(VIDEO_LONG);
    expect(await lookupVideos(user, 'zzzzzzzzzzz')).toEqual([]);
  });
});

describe('ad groups', () => {
  let groupId: string;

  it('validates name and bid (AG-001, AG-003)', async () => {
    const draft = await getAdGroupDraft(userFor(w), liId);
    expect(draft?.lineItemBidKind).toBe('TARGET_CPM');
    const res = await createAdGroup(userFor(w), liId, draft!.value);
    expect(res.ok).toBe(false);
    if (!res.ok)
      expect(res.issues.map((i) => i.ruleId)).toEqual(expect.arrayContaining(['AG-001', 'AG-003']));
  });

  it('creates, logs, lists with the no-ads alert and updates with a version check', async () => {
    const draft = await getAdGroupDraft(userFor(w), liId);
    const res = await createAdGroup(userFor(w), liId, {
      ...draft!.value,
      name: 'Group A',
      bid: '75',
    });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    groupId = res.data.id;
    expect(await kindsOf('AD_GROUP', groupId)).toEqual(['CREATE']);

    const list = await listAdGroups(userFor(w), liId);
    const row = list?.rows.find((r) => r.id === groupId);
    expect(row).toMatchObject({ name: 'Group A', status: 'ACTIVE', adCount: 0, alertCount: 1 });

    const detail = await getAdGroupDetail(userFor(w), groupId);
    expect(detail?.value.bid).toBe('75');
    const saved = await updateAdGroup(
      userFor(w),
      groupId,
      { ...detail!.value, name: 'Group A2' },
      { expectedVersion: detail!.version },
    );
    expect(saved).toMatchObject({ ok: true, data: { version: detail!.version + 1 } });
    const stale = await updateAdGroup(userFor(w), groupId, detail!.value, {
      expectedVersion: detail!.version,
    });
    expect(stale).toMatchObject({ ok: false, code: 'CONFLICT' });
  });

  it('pauses and activates (Y8)', async () => {
    expect(await setAdGroupStatus(userFor(w), groupId, 'PAUSED')).toMatchObject({ ok: true });
    expect((await getAdGroupDetail(userFor(w), groupId))?.value.status).toBe('PAUSED');
    await setAdGroupStatus(userFor(w), groupId, 'ACTIVE');
  });

  it('rejects dimensions the ad group cannot hold (AG-006)', async () => {
    const draft = await getAdGroupDraft(userFor(w), liId);
    const state = {
      ...draft!.value.targetingState,
      criteria: {
        device: { types: [{ id: 'SMARTPHONE', mode: 'INCLUDE' }], os: [], makeModel: [] },
      },
    } as never;
    const res = await createAdGroup(userFor(w), liId, {
      ...draft!.value,
      name: 'Bad',
      bid: '10',
      targetingState: state,
    });
    if (res.ok) throw new Error('expected AG-006');
    expect(res.issues.some((i) => i.ruleId === 'AG-006')).toBe(true);
  });

  it('forged writes from a read-only role are FORBIDDEN (AC-09-19)', async () => {
    const ro = userFor(w, 'READ_ONLY');
    const detail = await getAdGroupDetail(ro, groupId);
    expect(detail?.readOnly).toBe(true);
    expect(await updateAdGroup(ro, groupId, detail!.value)).toMatchObject({ code: 'FORBIDDEN' });
    expect(await deleteAdGroup(ro, groupId)).toMatchObject({ code: 'FORBIDDEN' });
    expect(await setAdGroupStatus(ro, groupId, 'PAUSED')).toMatchObject({ code: 'FORBIDDEN' });
    expect(await createAd(ro, groupId, adForm())).toMatchObject({ code: 'FORBIDDEN' });
  });

  describe('ads', () => {
    let adId: string;

    it('prefills the advertiser defaults and validates (AD-004, AD-017)', async () => {
      const draft = await getAdDraft(userFor(w), groupId);
      expect(draft?.value.businessName).toBe('Acme Co');
      expect(draft?.value.logoAssetId).toBe('logo-default');
      const unknown = await createAd(userFor(w), groupId, adForm({ videoRef: 'zzzzzzzzzzz' }));
      if (unknown.ok) throw new Error('expected AD-004');
      expect(unknown.issues.some((i) => i.ruleId === 'AD-004')).toBe(true);
      const noBusiness = await createAd(userFor(w), groupId, adForm({ businessName: '' }));
      if (noBusiness.ok) throw new Error('expected AD-013');
      expect(noBusiness.issues.some((i) => i.ruleId === 'AD-013')).toBe(true);
    });

    it('creates an ad in review with derived formats (V-09-02)', async () => {
      const res = await createAd(userFor(w), groupId, adForm());
      expect(res.ok).toBe(true);
      if (!res.ok) return;
      adId = res.data.id;
      const detail = await getAdDetail(userFor(w), adId);
      expect(detail).toMatchObject({ reviewStatus: 'PENDING', formats: ['BUMPER'] });
      expect(detail?.video?.videoId).toBe(VIDEO_BUMPER);
      expect(detail?.value.landingPage).toBe('example.com/landing');
    });

    it('settles a due review through SIM_ENGINE (AC-09-21)', async () => {
      await prisma.ad.update({
        where: { id: adId },
        data: { reviewDecideAt: new Date('2000-01-01T00:00:00Z') },
      });
      const detail = await getAdDetail(userFor(w), adId);
      expect(detail?.reviewStatus).toBe('APPROVED');
      expect((await kindsOf('AD', adId)).sort()).toEqual(['CREATE', 'UPDATE']);
    });

    it('editing the video sends the ad back to review; unrelated edits do not', async () => {
      const detail = await getAdDetail(userFor(w), adId);
      const same = await updateAd(
        userFor(w),
        adId,
        { ...detail!.value, name: 'Ad renamed' },
        { expectedVersion: detail!.version },
      );
      expect(same.ok).toBe(true);
      expect((await getAdDetail(userFor(w), adId))?.reviewStatus).toBe('APPROVED');
      const next = await getAdDetail(userFor(w), adId);
      const edited = await updateAd(userFor(w), adId, { ...next!.value, videoRef: VIDEO_LONG });
      expect(edited.ok).toBe(true);
      const after = await getAdDetail(userFor(w), adId);
      expect(after?.reviewStatus).toBe('PENDING');
      expect(after?.formats).toEqual(['IN_STREAM_SKIPPABLE', 'IN_FEED']);
    });

    it('a misleading claim is rejected by the review and shows feedback', async () => {
      const res = await createAd(
        userFor(w),
        groupId,
        adForm({ name: 'Bad claim', headline: 'Guaranteed results' }),
      );
      expect(res.ok).toBe(true);
      if (!res.ok) return;
      await prisma.ad.update({
        where: { id: res.data.id },
        data: { reviewDecideAt: new Date('2000-01-01T00:00:00Z') },
      });
      const detail = await getAdDetail(userFor(w), res.data.id);
      expect(detail?.reviewStatus).toBe('REJECTED');
      expect(detail?.reviewFeedback).toMatch(/Misleading/);
      const list = await listAdGroups(userFor(w), liId);
      expect(list?.rows.find((r) => r.id === groupId)?.alertCount).toBe(1);
    });

    it('toggles status (AC-09-17) and deletes one ad', async () => {
      expect(await setAdStatus(userFor(w), adId, 'PAUSED')).toMatchObject({ ok: true });
      expect((await getAdDetail(userFor(w), adId))?.value.status).toBe('PAUSED');
      expect(await deleteAd(userFor(w), adId)).toMatchObject({ ok: true });
      expect(await getAdDetail(userFor(w), adId)).toBeNull();
    });

    it('deleting the ad group cascades its ads and keeps the DELETE entry (V-09-10)', async () => {
      const before = await prisma.ad.count({ where: { adGroupId: groupId } });
      expect(before).toBeGreaterThan(0);
      expect(await deleteAdGroup(userFor(w), groupId)).toMatchObject({ ok: true });
      expect(await prisma.ad.count({ where: { adGroupId: groupId } })).toBe(0);
      expect(await kindsOf('AD_GROUP', groupId)).toContain('DELETE');
    });
  });
});
