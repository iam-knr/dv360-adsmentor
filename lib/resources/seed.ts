// Seed data of module 15 (M15-01): the global `AppCatalog` and, per advertiser, one Floodlight group with activities,
// channels, negative keyword lists, location lists, custom bidding algorithms and YouTube assets (module 15 3.3).
// Everything is synthetic (R5) and deterministic: the same sandbox seed value builds the same rows. Idempotent.
// Relative imports only: prisma/seed runs under tsx without the Next alias set.
import type { Prisma, PrismaClient } from '@prisma/client';
import appsJson from '../../data/reference/apps.json';
import { hashString, Rng, stableId } from '../seed/prng';

type Db = PrismaClient | Prisma.TransactionClient;

const WORDS_A = [
  'Pixel',
  'Lumen',
  'Cedar',
  'Juniper',
  'Quill',
  'Harbor',
  'Maple',
  'Orbit',
  'Tidal',
  'Ember',
  'Nimbus',
  'Atlas',
  'Birch',
  'Comet',
  'Delta',
  'Echo',
  'Fable',
  'Glow',
  'Haven',
  'Iris',
];
const WORDS_B = [
  'Play',
  'Pay',
  'Rides',
  'Fit',
  'Notes',
  'Shop',
  'Cast',
  'Maps',
  'Chat',
  'Learn',
  'Cook',
  'Stream',
  'Bank',
  'Travel',
  'Games',
  'News',
  'Photo',
  'Sound',
  'Watch',
  'Track',
];
const CATEGORIES = [
  'Games',
  'Finance',
  'Shopping',
  'Travel',
  'Health & Fitness',
  'Music',
  'News',
  'Education',
  'Social',
  'Productivity',
];

export interface AppCatalogRow {
  platform: 'ANDROID' | 'IOS' | 'CTV';
  appId: string;
  name: string;
  category: string | null;
}

/** About 300 synthetic apps: the 20 of data/reference/apps.json plus generated ones (Android, iOS, CTV). */
export function buildAppCatalog(): AppCatalogRow[] {
  const rows: AppCatalogRow[] = (
    appsJson as { id: string; name: string; platform: string; category: string }[]
  ).map((a) => ({
    platform: a.platform === 'IOS' ? 'IOS' : 'ANDROID',
    appId: a.platform === 'IOS' ? String(100_000_000 + (hashString(a.id) % 899_999_999)) : a.id,
    name: a.name,
    category: a.category,
  }));
  const seen = new Set(rows.map((r) => `${r.platform}:${r.appId}`));
  let i = 0;
  while (rows.length < 300 && i < 5000) {
    const a = WORDS_A[i % WORDS_A.length]!;
    const b = WORDS_B[Math.floor(i / WORDS_A.length) % WORDS_B.length]!;
    const n = Math.floor(i / (WORDS_A.length * WORDS_B.length));
    const base = `${a} ${b}${n > 0 ? ` ${n + 1}` : ''}`;
    const slug = `${a}.${b}${n > 0 ? n + 1 : ''}`.toLowerCase();
    const platform = (['ANDROID', 'IOS', 'CTV'] as const)[i % 3]!;
    const appId =
      platform === 'ANDROID'
        ? `com.example.${slug}`
        : platform === 'IOS'
          ? String(300_000_000 + (hashString(base) % 600_000_000))
          : `ctv.example.${slug}`;
    const key = `${platform}:${appId}`;
    if (!seen.has(key)) {
      seen.add(key);
      rows.push({ platform, appId, name: base, category: CATEGORIES[i % CATEGORIES.length]! });
    }
    i += 1;
  }
  return rows;
}

export async function seedAppCatalog(db: Db): Promise<number> {
  const rows = buildAppCatalog();
  const existing = await db.appCatalog.count();
  if (existing >= rows.length) return 0;
  const res = await db.appCatalog.createMany({ data: rows, skipDuplicates: true });
  return res.count;
}

const POSTAL_BASE = [
  '560001',
  '560034',
  '560066',
  '400001',
  '400051',
  '110001',
  '110011',
  '600001',
  '600028',
  '700001',
  '500001',
  '411001',
];
const ADDRESSES = [
  '12 Orchard Lane, Bengaluru',
  '48 Harbour Road, Mumbai',
  '7 Maple Street, New Delhi',
  '210 Lakeview Avenue, Chennai',
  '5 Cedar Court, Hyderabad',
];
const SITE_WORDS = [
  'daily',
  'gadget',
  'travel',
  'recipe',
  'sports',
  'finance',
  'garden',
  'movie',
  'music',
  'health',
  'auto',
  'style',
];
const KEYWORDS_A = [
  'free',
  'cheap',
  'crack',
  'torrent',
  'gambling',
  'casino',
  'lottery',
  'rumor',
  'scam',
  'fake',
  'violent',
  'adult',
  'weapon',
  'tobacco',
  'vape',
];
const KEYWORDS_B = [
  'download',
  'review',
  'news',
  'video',
  'game',
  'offer',
  'deal',
  'trailer',
  'movie',
  'forum',
];

export interface ResourceSeedInput {
  sandboxId: string;
  template: string;
  seedValue: number;
}

function siteLines(
  rng: Rng,
  n: number,
): { kind: 'URL' | 'ANDROID_APP' | 'IOS_APP'; value: string }[] {
  const out: { kind: 'URL' | 'ANDROID_APP' | 'IOS_APP'; value: string }[] = [];
  const seen = new Set<string>();
  let i = 0;
  while (out.length < n && i < n * 4) {
    i += 1;
    const w = SITE_WORDS[rng.int(0, SITE_WORDS.length - 1)]!;
    const v = SITE_WORDS[rng.int(0, SITE_WORDS.length - 1)]!;
    const value = `${w}-${v}${rng.int(1, 999)}.example.com`;
    if (seen.has(value)) continue;
    seen.add(value);
    out.push({ kind: 'URL', value });
  }
  return out;
}

/**
 * Builds the resources of every advertiser of the sandbox that has no Floodlight group yet. Safe to run again.
 * Returns the number of advertisers seeded.
 */
export async function seedResources(db: Db, input: ResourceSeedInput): Promise<number> {
  const { sandboxId } = input;
  const advertisers = await db.advertiser.findMany({
    where: { sandboxId, floodlightGroupId: null },
    orderBy: { id: 'asc' },
    select: { id: true, name: true, partnerId: true },
  });
  const apps = await db.appCatalog.findMany({ orderBy: { appId: 'asc' }, take: 300 });
  const options = await db.targetingOption.findMany({
    where: { dimension: 'GEOGRAPHY' },
    select: { id: true, code: true, meta: true },
  });
  let index = 0;
  for (const adv of advertisers) {
    const rng = new Rng(hashString(`resources:${input.seedValue}:${adv.id}`));
    const lab = input.template === 'troubleshooting-lab';

    // Floodlight group ------------------------------------------------------------------------
    const group = await db.floodlightGroup.create({
      data: {
        sandboxId,
        advertiserId: adv.id,
        name: `${adv.name} Floodlight`,
        clickWindowDays: 30,
        impressionWindowDays: 1,
        googleTagId: `GT-${String(1_000_000_000 + (hashString(adv.id) % 8_999_999_999)).padStart(10, '0')}`,
        tagStatus: lab && index === advertisers.length - 1 ? 'broken' : 'active',
        lastSeenAt: new Date(Date.UTC(2026, 9, 27, 6, 0, 0)),
      },
      select: { id: true },
    });
    await db.advertiser.update({ where: { id: adv.id }, data: { floodlightGroupId: group.id } });
    await db.floodlightAttributionModel.createMany({
      data: [
        { sandboxId, groupId: group.id, name: 'Last click', kind: 'LAST_CLICK', isPrimary: true },
        { sandboxId, groupId: group.id, name: 'Linear', kind: 'LINEAR', isPrimary: false },
      ],
    });
    await db.floodlightVariable.createMany({
      data: Array.from({ length: 10 }, (_, i) => ({
        sandboxId,
        groupId: group.id,
        key: `u${i + 1}`,
        name: [
          'Order value',
          'Coupon',
          'Plan',
          'Region',
          'Segment',
          'Device',
          'Channel',
          'Campaign tag',
          'Item count',
          'Loyalty tier',
        ][i]!,
        dataType: i === 0 || i === 8 ? ('NUMBER' as const) : ('STRING' as const),
        ordinal: i,
      })),
    });
    const defs = [
      {
        name: 'Purchase',
        type: 'SALE',
        countingMethod: 'TRANSACTIONS',
        category: 'PURCHASE',
        remarketing: false,
      },
      {
        name: 'Add to cart',
        type: 'COUNTER',
        countingMethod: 'STANDARD',
        category: 'ADD_TO_CART',
        remarketing: false,
      },
      {
        name: 'Sign-up',
        type: 'COUNTER',
        countingMethod: 'UNIQUE',
        category: 'SIGN_UP',
        remarketing: false,
      },
      {
        name: 'Page view',
        type: 'COUNTER',
        countingMethod: 'STANDARD',
        category: 'PAGE_VIEW',
        remarketing: true,
      },
      {
        name: 'Begin checkout',
        type: 'COUNTER',
        countingMethod: 'PER_SESSION',
        category: 'BEGIN_CHECKOUT',
        remarketing: false,
      },
      {
        name: 'Contact',
        type: 'COUNTER',
        countingMethod: 'STANDARD',
        category: 'CONTACT',
        remarketing: false,
      },
    ] as const;
    const activities: { id: string; name: string }[] = [];
    for (const d of defs) {
      const a = await db.floodlightActivity.create({
        data: {
          // stable, so a rebuild of the sandbox simulates the same conversions (the engine orders and seeds by id)
          id: stableId(sandboxId, `fl-activity:${adv.id}:${d.name}`),
          sandboxId,
          groupId: group.id,
          name: d.name,
          platform: 'WEB',
          format: 'GOOGLE_TAG',
          type: d.type,
          countingMethod: d.countingMethod,
          category: d.category,
          remarketingEnabled: d.remarketing,
          youtubeEnabled: d.name === 'Purchase',
          customVariableKeys: d.name === 'Purchase' ? ['u1', 'u2'] : [],
        },
        select: { id: true, name: true },
      });
      activities.push(a);
    }
    for (const [i, name] of ['Purchase funnel', 'Engagement'].entries()) {
      const cg = await db.conversionGroup.create({
        data: { sandboxId, groupId: group.id, name },
        select: { id: true },
      });
      const members = i === 0 ? activities.slice(0, 2) : activities.slice(2, 5);
      await db.conversionGroupActivity.createMany({
        data: members.map((m) => ({ sandboxId, conversionGroupId: cg.id, activityId: m.id })),
      });
    }
    // Line items count the Purchase conversion, so the engine has something to generate (module 15 3.3).
    const lis = await db.lineItem.findMany({
      where: {
        sandboxId,
        advertiserId: adv.id,
        type: { notIn: ['YT_VIDEO', 'YT_AUDIO', 'YT_ON_CTV', 'DEMAND_GEN'] },
      },
      select: { id: true },
      orderBy: { id: 'asc' },
    });
    await db.lineItemFloodlightActivity.createMany({
      data: lis.map((l) => ({ sandboxId, lineItemId: l.id, activityId: activities[0]!.id })),
      skipDuplicates: true,
    });

    // Channels ---------------------------------------------------------------------------------
    const mixedApps = apps.slice(0, 40).map((a) => ({
      kind:
        a.platform === 'ANDROID'
          ? ('ANDROID_APP' as const)
          : a.platform === 'IOS'
            ? ('IOS_APP' as const)
            : ('CTV_APP' as const),
      value: a.appId,
      displayName: a.name,
    }));
    const channelDefs = [
      {
        name: 'Trusted news and finance sites',
        entries: [...siteLines(rng, 160).map((s) => ({ ...s, displayName: null })), ...mixedApps],
      },
      {
        name: 'Block list: low quality sites',
        entries: siteLines(rng, 60).map((s) => ({ ...s, displayName: null })),
      },
      { name: 'Premium app placements', entries: mixedApps.slice(0, 15) },
    ];
    for (const c of channelDefs) {
      const ch = await db.channel.create({
        data: { sandboxId, advertiserId: adv.id, name: c.name },
        select: { id: true },
      });
      const seen = new Set<string>();
      const entries = c.entries.filter((e) => {
        const k = `${e.kind}:${e.value}`;
        if (seen.has(k)) return false;
        seen.add(k);
        return true;
      });
      await db.channelEntry.createMany({
        data: entries.map((e) => ({
          sandboxId,
          channelId: ch.id,
          kind: e.kind,
          value: e.value,
          displayName: e.displayName,
        })),
      });
    }

    // Negative keyword lists -----------------------------------------------------------------------
    for (const [name, n] of [
      ['Brand safety keywords', 120],
      ['Competitor and spam terms', 40],
    ] as const) {
      const kl = await db.keywordList.create({
        data: { sandboxId, advertiserId: adv.id, name },
        select: { id: true },
      });
      const words = new Set<string>();
      let guard = 0;
      while (words.size < n && guard++ < n * 20) {
        words.add(
          `${KEYWORDS_A[rng.int(0, KEYWORDS_A.length - 1)]!} ${KEYWORDS_B[rng.int(0, KEYWORDS_B.length - 1)]!}${words.size % 7 === 0 ? ` ${rng.int(1, 99)}` : ''}`,
        );
      }
      await db.keywordListEntry.createMany({
        data: [...words].map((keyword) => ({ sandboxId, keywordListId: kl.id, keyword })),
      });
    }

    // Location lists ---------------------------------------------------------------------------
    const country = options.find(
      (o) => (o.meta as { kind?: string } | null)?.kind === 'COUNTRY' && o.code === 'IN',
    );
    const regional = await db.locationList.create({
      data: { sandboxId, advertiserId: adv.id, name: 'Metro postal codes', type: 'REGIONAL' },
      select: { id: true },
    });
    await db.locationListEntry.createMany({
      data: POSTAL_BASE.map((code) => ({
        sandboxId,
        locationListId: regional.id,
        value: code,
        resolvedOptionId: country?.id ?? null,
        resolvedLabel: `${code} (postal code, India)`,
        radiusKm: null,
      })),
    });
    const proximity = await db.locationList.create({
      data: { sandboxId, advertiserId: adv.id, name: 'Store neighbourhoods', type: 'PROXIMITY' },
      select: { id: true },
    });
    await db.locationListEntry.createMany({
      data: ADDRESSES.map((address, i) => ({
        sandboxId,
        locationListId: proximity.id,
        value: i % 2 === 0 ? address : `${address}; 10`,
        resolvedLabel: address,
        lat: 12 + ((hashString(address) % 100_000) / 100_000) * 10,
        lng: 72 + ((hashString(`${address}:lng`) % 100_000) / 100_000) * 8,
        radiusKm: i % 2 === 0 ? 5 : 10,
      })),
    });

    // Custom bidding (list rows only; the wizard is session P4-05) -----------------------------------
    for (const [name, status, readiness, pct, objective, signal] of [
      ['Click value algorithm', 'ACTIVE', 'READY', 100, 'CLICKS', 'CLICKED'],
      ['New awareness algorithm', 'TRAINING', 'TRAINING', 35, 'BRAND_AWARENESS', 'VIEWABLE'],
    ] as const) {
      const alg = await db.customBiddingAlgorithm.create({
        data: {
          sandboxId,
          advertiserId: adv.id,
          name,
          status,
          objective,
          modelReadiness: readiness,
          readinessPct: pct,
          trainingImpressions: BigInt(pct * 50),
          errorPct: 0.5,
        },
        select: { id: true },
      });
      await db.customBiddingRule.create({
        data: {
          sandboxId,
          algorithmId: alg.id,
          groupKey: objective === 'CLICKS' ? 'Click rules' : 'Viewability rules',
          signal,
          signalKey: signal,
          value: 'true',
          score: 1,
          ordinal: 0,
        },
      });
    }

    // YouTube assets -----------------------------------------------------------------------------
    const mk = (
      kind: 'LOCATION' | 'AFFILIATE_LOCATION' | 'SITELINK',
      names: string[],
      filters: object | null,
    ) =>
      names.map((name) => ({
        sandboxId,
        advertiserId: adv.id,
        kind,
        name,
        filters: filters ?? undefined,
      }));
    await db.youtubeAsset.createMany({
      data: [
        ...mk('LOCATION', ['Downtown store', 'Airport kiosk', 'Mall counter', 'Warehouse outlet'], {
          Campaigns: 'All',
        }),
        ...mk('AFFILIATE_LOCATION', ['Partner mart north', 'Partner mart south'], {
          Chain: 'Sample retail chain',
        }),
        ...mk(
          'SITELINK',
          [
            'Shop new arrivals',
            'Store locator',
            'Gift cards',
            'Support centre',
            'Offers of the week',
          ],
          null,
        ),
      ],
    });
    index += 1;
  }
  return advertisers.length;
}
