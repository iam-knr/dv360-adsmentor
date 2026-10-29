// Seed data of module 09 (T09-11, module 09 3.4): the global synthetic video catalogue and, per sandbox, YouTube line
// items covering every subtype with ad groups and ads in every review state. Synthetic (R5), deterministic and
// idempotent. Relative imports only: prisma/seed runs under tsx without the Next alias set.
import type { Prisma, PrismaClient } from '@prisma/client';
import { stableId } from '../seed/prng';

type Db = PrismaClient | Prisma.TransactionClient;

export interface VideoSeed {
  videoId: string;
  title: string;
  channelName: string;
  durationSec: number;
  orientation: 'HORIZONTAL' | 'VERTICAL';
  category: string;
}

/** (kind code, orientation, seconds, title stem). The ids read `SIM{kind}{0001}` and are 11 characters long. */
const KINDS = [
  ['bump', 'HORIZONTAL', 6, 'Bumper teaser'],
  ['h015', 'HORIZONTAL', 15, 'Product spot'],
  ['h030', 'HORIZONTAL', 30, 'Brand film'],
  ['h090', 'HORIZONTAL', 90, 'How it works'],
  ['v005', 'VERTICAL', 5, 'Short flash'],
  ['v020', 'VERTICAL', 20, 'Short story'],
] as const;
const CHANNELS = [
  'Lumen Studio',
  'Harbor Films',
  'Cedar Kitchen',
  'Orbit Sports',
  'Quill Learning',
];
const CATEGORIES = ['Sports', 'Food & Drink', 'Education', 'Technology', 'Travel', 'Beauty'];

/** About 60 videos: ten of each kind, the first of each kind is the stable demo video. */
export function buildVideoCatalogue(): VideoSeed[] {
  const out: VideoSeed[] = [];
  for (const [code, orientation, durationSec, stem] of KINDS) {
    for (let n = 1; n <= 10; n++) {
      out.push({
        videoId: `SIM${code}${String(n).padStart(4, '0')}`,
        title: `${stem} ${n}`,
        channelName: CHANNELS[(n + code.length) % CHANNELS.length]!,
        durationSec,
        orientation,
        category: CATEGORIES[n % CATEGORIES.length]!,
      });
    }
  }
  return out;
}

/** Idempotent: existing ids are left alone. Returns the number added. */
export async function seedYoutubeVideos(db: Db): Promise<number> {
  const rows = buildVideoCatalogue();
  const res = await db.youtubeVideo.createMany({
    data: rows.map((v) => ({ ...v, isPublic: true })),
    skipDuplicates: true,
  });
  return res.count;
}

type Subtype = NonNullable<Prisma.LineItemCreateManyInput['ytSubtype']>;

const LIS: {
  name: string;
  subtype: Subtype;
  type: 'YT_VIDEO' | 'YT_AUDIO';
  status: 'PAUSED' | 'DRAFT';
  bidGoal: 'MAX_REACH' | 'TARGET_CPM' | 'MAX_CPV';
  surfaces: ('IN_STREAM' | 'IN_FEED' | 'SHORTS')[];
  targetFreq?: boolean;
}[] = [
  {
    name: 'YouTube efficient reach',
    subtype: 'EFFICIENT_REACH',
    type: 'YT_VIDEO',
    status: 'PAUSED',
    bidGoal: 'MAX_REACH',
    surfaces: ['IN_STREAM', 'IN_FEED', 'SHORTS'],
  },
  {
    name: 'YouTube non-skippable reach',
    subtype: 'NON_SKIPPABLE_REACH',
    type: 'YT_VIDEO',
    status: 'PAUSED',
    bidGoal: 'MAX_REACH',
    surfaces: ['IN_STREAM'],
  },
  {
    name: 'YouTube target frequency',
    subtype: 'TARGET_FREQUENCY',
    type: 'YT_VIDEO',
    status: 'PAUSED',
    bidGoal: 'TARGET_CPM',
    surfaces: ['IN_STREAM', 'IN_FEED', 'SHORTS'],
    targetFreq: true,
  },
  {
    name: 'YouTube target frequency in-stream',
    subtype: 'TARGET_FREQUENCY_IN_STREAM',
    type: 'YT_VIDEO',
    status: 'PAUSED',
    bidGoal: 'TARGET_CPM',
    surfaces: ['IN_STREAM'],
    targetFreq: true,
  },
  {
    name: 'YouTube TrueView views',
    subtype: 'TRUEVIEW_VIEWS',
    type: 'YT_VIDEO',
    status: 'PAUSED',
    bidGoal: 'MAX_CPV',
    surfaces: ['IN_STREAM', 'IN_FEED', 'SHORTS'],
  },
  {
    name: 'YouTube ad sequence',
    subtype: 'AD_SEQUENCE',
    type: 'YT_VIDEO',
    status: 'DRAFT',
    bidGoal: 'TARGET_CPM',
    surfaces: ['IN_STREAM'],
  },
  {
    name: 'YouTube audio reach',
    subtype: 'AUDIO_REACH',
    type: 'YT_AUDIO',
    status: 'DRAFT',
    bidGoal: 'MAX_REACH',
    surfaces: ['IN_STREAM'],
  },
];

interface AdSeed {
  name: string;
  video: string;
  headline: string;
  longHeadline: string;
  review: 'APPROVED' | 'REJECTED' | 'RESTRICTED' | 'PENDING';
  status?: 'ACTIVE' | 'PAUSED';
}

const AD_COPY = (stem: string) => ({
  longHeadline: `${stem} made for you`,
  description: 'Discover the range and see why people love it.',
});

export interface YoutubeSeedInput {
  sandboxId: string;
  template: string;
  seedValue: number;
}

/**
 * Per advertiser (the first): a default business name and logo, and the seven YouTube line items in its first brand
 * awareness insertion order. Skips an advertiser that already has YouTube line items. Returns advertisers seeded.
 */
export async function seedYoutube(db: Db, input: YoutubeSeedInput): Promise<number> {
  const advertisers = await db.advertiser.findMany({
    where: { sandboxId: input.sandboxId },
    orderBy: { name: 'asc' },
    take: 1,
  });
  let seeded = 0;
  for (const adv of advertisers) {
    const has = await db.lineItem.count({
      where: { advertiserId: adv.id, type: { in: ['YT_VIDEO', 'YT_AUDIO'] } },
    });
    if (has > 0) continue;
    const io =
      (await db.insertionOrder.findFirst({
        where: {
          advertiserId: adv.id,
          type: 'STANDARD',
          objective: 'BRAND_AWARENESS',
          status: { in: ['DRAFT', 'ACTIVE', 'PAUSED'] },
        },
        orderBy: { name: 'asc' },
      })) ??
      (await db.insertionOrder.findFirst({
        where: {
          advertiserId: adv.id,
          type: 'STANDARD',
          status: { in: ['DRAFT', 'ACTIVE', 'PAUSED'] },
        },
        orderBy: { name: 'asc' },
      }));
    if (!io) continue;
    await db.advertiser.update({
      where: { id: adv.id },
      data: {
        googleInventoryEnabled: true,
        ytBusinessName: adv.ytBusinessName ?? adv.name.slice(0, 25),
        ytLogoAssetId: adv.ytLogoAssetId ?? 'default-logo',
      },
    });
    const ns = `${input.sandboxId}:yt:${adv.id}`;
    const business = (adv.ytBusinessName ?? adv.name).slice(0, 25);
    const now = Date.now();
    for (const [i, li] of LIS.entries()) {
      const liId = stableId(ns, `li${i}`);
      await db.lineItem.create({
        data: {
          id: liId,
          sandboxId: input.sandboxId,
          ioId: io.id,
          campaignId: io.campaignId,
          advertiserId: adv.id,
          name: `${li.name}`,
          status: li.status,
          type: li.type,
          ytSubtype: li.subtype,
          ytSurfaces: li.surfaces,
          pacingPeriod: 'DAILY',
          pacingType: 'EVEN',
          dailyMaxAmount: '5000',
          bidKind: 'AUTOMATED',
          bidGoal: li.bidGoal,
          euPoliticalAds: 'DOES_NOT_CONTAIN_EU_POLITICAL_ADS',
          ...(li.targetFreq
            ? { targetFreqExposures: 3, targetFreqUnit: 'WEEK' as const, targetFreqUnitCount: 1 }
            : {}),
        },
      });
      const groups: { name: string; status: 'ACTIVE' | 'PAUSED'; bid: string; ads: AdSeed[] }[] =
        i === 0
          ? [
              {
                name: 'Sports fans',
                status: 'ACTIVE',
                bid: '75',
                ads: [
                  {
                    name: 'Bumper ad',
                    video: 'SIMbump0001',
                    headline: 'Game on',
                    ...AD_COPY('Sport'),
                    review: 'APPROVED',
                  },
                  {
                    name: 'Skippable ad',
                    video: 'SIMh0300001',
                    headline: 'Watch more',
                    ...AD_COPY('Brand'),
                    review: 'APPROVED',
                  },
                ],
              },
              {
                name: 'Placements and keywords',
                status: 'ACTIVE',
                bid: '60',
                ads: [
                  {
                    name: 'Claims ad',
                    video: 'SIMh0150001',
                    headline: 'Guaranteed results',
                    ...AD_COPY('Claims'),
                    review: 'REJECTED',
                  },
                ],
              },
              { name: 'Paused group', status: 'PAUSED', bid: '50', ads: [] },
              { name: 'Empty group', status: 'ACTIVE', bid: '40', ads: [] },
            ]
          : i === 1
            ? [
                {
                  name: 'Non-skippable group',
                  status: 'ACTIVE',
                  bid: '90',
                  ads: [
                    {
                      name: 'Restricted ad',
                      video: 'SIMh0150002',
                      headline: 'Wine tasting night',
                      ...AD_COPY('Evening'),
                      review: 'RESTRICTED',
                    },
                    {
                      name: 'In review ad',
                      video: 'SIMh0150003',
                      headline: 'Fresh arrivals',
                      ...AD_COPY('New'),
                      review: 'PENDING',
                    },
                  ],
                },
              ]
            : [
                {
                  name: `${li.name} group`,
                  status: 'ACTIVE',
                  bid: li.bidGoal === 'MAX_CPV' ? '2' : '70',
                  ads: [
                    {
                      name: 'Main ad',
                      video: 'SIMh0300002',
                      headline: 'Meet the range',
                      ...AD_COPY('Range'),
                      review: 'APPROVED',
                    },
                  ],
                },
              ];
      for (const [g, group] of groups.entries()) {
        const agId = stableId(ns, `li${i}.ag${g}`);
        await db.adGroup.create({
          data: {
            id: agId,
            sandboxId: input.sandboxId,
            lineItemId: liId,
            advertiserId: adv.id,
            name: group.name,
            status: group.status,
            adSourceLabel: 'Display & Video 360',
            bidValue: group.bid,
          },
        });
        if (i === 0 && g === 0)
          await db.targetingAssignment.createMany({
            data: [
              {
                sandboxId: input.sandboxId,
                ownerType: 'AD_GROUP',
                adGroupId: agId,
                dimension: 'AGE',
                mode: 'INCLUDE',
                config: { min: '18', max: '34', includeUnknown: false },
              },
            ],
          });
        if (i === 0 && g === 1)
          await db.targetingAssignment.createMany({
            data: [
              {
                sandboxId: input.sandboxId,
                ownerType: 'AD_GROUP',
                adGroupId: agId,
                dimension: 'KEYWORD',
                mode: 'INCLUDE',
                valueText: 'basketball',
              },
              {
                sandboxId: input.sandboxId,
                ownerType: 'AD_GROUP',
                adGroupId: agId,
                dimension: 'KEYWORD',
                mode: 'INCLUDE',
                valueText: 'cricket',
              },
              {
                sandboxId: input.sandboxId,
                ownerType: 'AD_GROUP',
                adGroupId: agId,
                dimension: 'APPS_AND_URLS',
                mode: 'INCLUDE',
                valueText: 'example-sports.test',
                config: { kind: 'URL' },
              },
            ],
          });
        for (const [a, ad] of group.ads.entries()) {
          const feedback =
            ad.review === 'REJECTED'
              ? 'Misleading claims: the ad makes promises that cannot be verified. Edit the text and the ad is reviewed again.'
              : ad.review === 'RESTRICTED'
                ? 'Alcohol or gambling content: the ad can serve, but its reach is limited by this policy.'
                : null;
          await db.ad.create({
            data: {
              id: stableId(ns, `li${i}.ag${g}.ad${a}`),
              sandboxId: input.sandboxId,
              adGroupId: agId,
              advertiserId: adv.id,
              name: ad.name,
              status: ad.status ?? 'ACTIVE',
              format: 'RESPONSIVE',
              youtubeVideoId: ad.video,
              headline: ad.headline,
              longHeadline: ad.longHeadline,
              description: ad.description,
              businessName: business,
              logoAssetId: 'default-logo',
              displayUrl: 'example.test',
              landingPageUrl: 'https://example.test/landing',
              reviewStatus: ad.review,
              reviewFeedback: feedback,
              ...(ad.review === 'PENDING'
                ? {
                    reviewDecideAt: new Date(now + 2 * 3_600_000),
                    plannedVerdict: 'APPROVED' as const,
                  }
                : {}),
            },
          });
        }
      }
    }
    seeded++;
  }
  return seeded;
}
