// Route handlers of module 09 (routes.md 8.7): ad groups, ads, video lookup, preview, assets, bulk status.
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SessionUser } from '@/lib/auth/types';
import { prisma } from '@/lib/db';
import { setFileStore } from '@/lib/creatives/storage';
import { EMPTY_AD_FORM } from '@/lib/youtube/types';
import { dropWorld } from '../db/helpers';
import { createLiWorld, userFor, type World } from '../services/line-items/helpers';

let current: SessionUser | null = null;
vi.mock('@/lib/auth/session', () => ({ getSessionUser: () => Promise.resolve(current) }));

const { GET: listGroups, POST: createGroup } =
  await import('@/app/api/dv/line-items/[liId]/ad-groups/route');
const {
  GET: groupDetail,
  PUT: updateGroup,
  DELETE: removeGroup,
} = await import('@/app/api/dv/ad-groups/[id]/route');
const { POST: groupStatus } = await import('@/app/api/dv/ad-groups/[id]/status/route');
const { GET: groupAds, POST: createAdRoute } =
  await import('@/app/api/dv/ad-groups/[id]/ads/route');
const { POST: bulk } = await import('@/app/api/dv/ad-groups/bulk/route');
const {
  GET: adDetail,
  PUT: updateAdRoute,
  DELETE: removeAd,
} = await import('@/app/api/dv/ads/[id]/route');
const { POST: adStatus } = await import('@/app/api/dv/ads/[id]/status/route');
const { POST: preview } = await import('@/app/api/dv/ads/preview/route');
const { GET: lookup } = await import('@/app/api/dv/youtube/video-lookup/route');
const { POST: upload } = await import('@/app/api/dv/youtube/assets/route');
const { GET: asset } = await import('@/app/api/dv/youtube/assets/[id]/route');

let w: World;
let liId: string;
const VIDEO = 'ytapiVid001';
const req = (method: string, b?: unknown) => ({
  method,
  body: b === undefined ? undefined : JSON.stringify(b),
});
const ctxOf = <K extends string>(key: K, id: string) => ({
  params: Promise.resolve({ [key]: id } as Record<K, string>),
});
const read = async <T>(r: Response): Promise<T> => (await r.json()) as T;
const U = 'http://localhost/api/dv';

beforeAll(async () => {
  w = await createLiWorld('ytapi');
  const io = await prisma.insertionOrder.findUniqueOrThrow({ where: { id: w.ioId } });
  const li = await prisma.lineItem.create({
    data: {
      sandboxId: w.sandboxId,
      ioId: io.id,
      campaignId: io.campaignId,
      advertiserId: w.advertiserId,
      name: 'API YT LI',
      type: 'YT_VIDEO',
      ytSubtype: 'TRUEVIEW_VIEWS',
      ytSurfaces: ['IN_STREAM', 'IN_FEED', 'SHORTS'],
    },
  });
  liId = li.id;
  await prisma.advertiser.update({
    where: { id: w.advertiserId },
    data: { ytBusinessName: 'Api Co' },
  });
  await prisma.youtubeVideo.create({
    data: {
      videoId: VIDEO,
      title: 'Api spot',
      channelName: 'Api',
      durationSec: 30,
      orientation: 'HORIZONTAL',
    },
  });
});
afterAll(async () => {
  await prisma.youtubeVideo.deleteMany({ where: { videoId: VIDEO } });
  setFileStore(null);
  await dropWorld(w);
  await prisma.$disconnect();
});
beforeEach(() => {
  current = userFor(w);
});

describe('ad group and ad routes', () => {
  let groupId: string;
  let adId: string;

  it('401 without a session', async () => {
    current = null;
    expect((await listGroups(new Request(`${U}/x`), ctxOf('liId', liId))).status).toBe(401);
  });

  it('creates an ad group (Max CPV for TrueView) and lists it', async () => {
    const bad = await createGroup(
      new Request(U, req('POST', { value: { name: '', status: 'ACTIVE', bid: '' } })),
      ctxOf('liId', liId),
    );
    expect(bad.status).toBe(422);
    const ok = await createGroup(
      new Request(
        U,
        req('POST', {
          value: {
            name: 'API group',
            status: 'ACTIVE',
            bid: '2',
            targetingState: { version: 1, lineItemType: 'YT_AD_GROUP', criteria: {} },
          },
        }),
      ),
      ctxOf('liId', liId),
    );
    expect(ok.status).toBe(201);
    groupId = (await read<{ data: { id: string } }>(ok)).data.id;
    const list = await read<{
      rows: { id: string; name: string }[];
      lineItem: { bidKind: string };
    }>(await listGroups(new Request(U), ctxOf('liId', liId)));
    expect(list.rows.map((r) => r.id)).toContain(groupId);
    expect(list.lineItem.bidKind).toBe('MAX_CPV');
  });

  it('updates with an expected version and answers 409 for a stale one', async () => {
    const d = await read<{ version: number; value: Record<string, unknown> }>(
      await groupDetail(new Request(U), ctxOf('id', groupId)),
    );
    const ok = await updateGroup(
      new Request(
        U,
        req('PUT', { value: { ...d.value, name: 'API group 2' }, expectedVersion: d.version }),
      ),
      ctxOf('id', groupId),
    );
    expect(ok.status).toBe(200);
    const stale = await updateGroup(
      new Request(U, req('PUT', { value: d.value, expectedVersion: d.version })),
      ctxOf('id', groupId),
    );
    expect(stale.status).toBe(409);
  });

  it('looks up a video and builds a preview (Y16, Y17)', async () => {
    const hits = await read<{ rows: { videoId: string }[] }>(
      await lookup(new Request(`${U}/youtube/video-lookup?q=${VIDEO}`)),
    );
    expect(hits.rows.map((r) => r.videoId)).toEqual([VIDEO]);
    const res = await preview(
      new Request(
        U,
        req('POST', {
          adGroupId: groupId,
          videoRef: VIDEO,
          headline: 'Hi',
          device: 'TV',
          surface: 'GOOGLE_TV',
        }),
      ),
    );
    const model = await read<{ caption: string; selected: { format: string; device: string } }>(
      res,
    );
    expect(model.selected.device).toBe('TV');
    expect(model.caption).toBe('TV example of your skippable in-stream ad on Google TV');
    expect((await preview(new Request(U, req('POST', {})))).status).toBe(400);
  });

  it('creates, reads, edits, toggles and deletes an ad', async () => {
    const value = {
      ...EMPTY_AD_FORM,
      name: 'API ad',
      videoRef: VIDEO,
      longHeadline: 'Long',
      description: 'Desc',
      businessName: 'Api Co',
      logoAssetId: 'logo',
      landingPage: 'example.com',
    };
    const created = await createAdRoute(
      new Request(U, req('POST', { value })),
      ctxOf('id', groupId),
    );
    expect(created.status).toBe(201);
    adId = (await read<{ data: { id: string } }>(created)).data.id;
    expect(
      (await read<{ rows: unknown[] }>(await groupAds(new Request(U), ctxOf('id', groupId)))).rows,
    ).toHaveLength(1);
    const d = await read<{ version: number; value: typeof value }>(
      await adDetail(new Request(U), ctxOf('id', adId)),
    );
    expect(
      (
        await updateAdRoute(
          new Request(
            U,
            req('PUT', { value: { ...d.value, name: 'API ad 2' }, expectedVersion: d.version }),
          ),
          ctxOf('id', adId),
        )
      ).status,
    ).toBe(200);
    expect(
      (await adStatus(new Request(U, req('POST', { status: 'PAUSED' })), ctxOf('id', adId))).status,
    ).toBe(200);
    expect(
      (await adStatus(new Request(U, req('POST', { status: 'GONE' })), ctxOf('id', adId))).status,
    ).toBe(400);
    expect((await removeAd(new Request(U), ctxOf('id', adId))).status).toBe(200);
    expect((await adDetail(new Request(U), ctxOf('id', adId))).status).toBe(404);
  });

  it('bulk pauses and activates ad groups; read-only is refused (Y10)', async () => {
    expect(
      (await bulk(new Request(U, req('POST', { ids: [groupId], action: 'PAUSE' })))).status,
    ).toBe(200);
    expect((await prisma.adGroup.findUniqueOrThrow({ where: { id: groupId } })).status).toBe(
      'PAUSED',
    );
    expect(
      (await groupStatus(new Request(U, req('POST', { status: 'ACTIVE' })), ctxOf('id', groupId)))
        .status,
    ).toBe(200);
    expect(
      (await bulk(new Request(U, req('POST', { ids: [groupId], action: 'ARCHIVE' })))).status,
    ).toBe(400);
    current = userFor(w, 'READ_ONLY');
    expect(
      (await bulk(new Request(U, req('POST', { ids: [groupId], action: 'PAUSE' })))).status,
    ).toBe(403);
    expect((await removeGroup(new Request(U), ctxOf('id', groupId))).status).toBe(403);
  });

  it('uploads a logo, serves it back and refuses other types and big files (Y18)', async () => {
    const form = (file: File, role = 'LOGO') => {
      const f = new FormData();
      f.set('file', file);
      f.set('role', role);
      f.set('adGroupId', groupId);
      return new Request(`${U}/youtube/assets`, { method: 'POST', body: f });
    };
    const png = new File([new Uint8Array([137, 80, 78, 71])], 'logo.png', { type: 'image/png' });
    const ok = await upload(form(png));
    expect(ok.status).toBe(201);
    const { id } = (await read<{ data: { id: string } }>(ok)).data;
    const got = await asset(new Request(U), ctxOf('id', id));
    expect(got.status).toBe(200);
    expect(got.headers.get('Content-Type')).toBe('image/png');
    expect((await upload(form(new File(['x'], 'a.pdf', { type: 'application/pdf' })))).status).toBe(
      422,
    );
    expect(
      (
        await upload(
          form(new File([new Uint8Array(5 * 1024 * 1024 + 1)], 'big.png', { type: 'image/png' })),
        )
      ).status,
    ).toBe(422);
  });

  it('deletes the ad group', async () => {
    expect((await removeGroup(new Request(U), ctxOf('id', groupId))).status).toBe(200);
    expect((await groupDetail(new Request(U), ctxOf('id', groupId))).status).toBe(404);
  });
});
