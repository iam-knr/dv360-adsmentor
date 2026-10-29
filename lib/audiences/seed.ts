// Audience seed (module 14 3.3, M14-01): on top of the six lists plus the small list the sandbox plan writes per
// advertiser, add tag rules and uploads to them, a small tag-based list, one list still PROCESSING, a YouTube users
// list with its linked channel, a lookalike with a seed below 1,000 users (teaches AUD-041), custom list entries, two
// combined audiences and two commerce partner lists. Deterministic and idempotent: skipped for an advertiser that
// already has a combined audience. Relative imports only: prisma/seed runs under tsx without the Next alias set.
import type { Prisma, PrismaClient } from '@prisma/client';
import googleAudiencesJson from '../../data/reference/google-audiences.json';
import { hashString } from '../seed/prng';
import { combinedSize, googleAudienceSize, spreadSizes, type SizeMap } from './sizes';

type Db = PrismaClient | Prisma.TransactionClient;

export interface AudienceSeedInput {
  sandboxId: string;
  template: string;
  seedValue: number;
}

const HOUR = 3_600_000;
const sizeData = (s: SizeMap) => ({
  sizeDisplay: BigInt(s.display),
  sizeYoutube: BigInt(s.youtube),
  sizeMobileApp: BigInt(s.mobileApp),
  sizeCtv: BigInt(s.ctv),
});
const google = googleAudiencesJson as { id: string; kind: string; name: string }[];

/** Returns the number of advertisers seeded. */
export async function seedAudiences(db: Db, input: AudienceSeedInput): Promise<number> {
  const { sandboxId } = input;
  const clock = await db.simClock.findUnique({ where: { sandboxId } });
  const now = clock ? new Date(clock.simStart.getTime() + Number(clock.tickIndex) * HOUR) : new Date();
  const advertisers = await db.advertiser.findMany({
    where: { sandboxId },
    orderBy: { id: 'asc' },
    select: { id: true, name: true },
  });
  let seeded = 0;
  for (const adv of advertisers) {
    if ((await db.audience.count({ where: { advertiserId: adv.id, type: 'COMBINED' } })) > 0) continue;
    const mine = await db.audience.findMany({
      where: { advertiserId: adv.id },
      orderBy: { createdAt: 'asc' },
      select: { id: true, type: true, name: true, sizeDisplay: true },
    });
    const byType = (t: string) => mine.filter((a) => a.type === t);
    const activity = await db.floodlightActivity.findFirst({
      where: { group: { advertiserId: adv.id }, remarketingEnabled: true },
      orderBy: { name: 'asc' },
      select: { id: true },
    });
    const created = (n: number) => new Date(now.getTime() - n * 24 * HOUR);
    const base = { sandboxId, advertiserId: adv.id, source: 'DISPLAY_VIDEO_360' as const };

    // Tag rules on the two big tag-based lists
    if (activity) {
      for (const a of byType('TAG_BASED')) {
        await db.audience.update({ where: { id: a.id }, data: { floodlightActivityId: activity.id } });
        await db.audienceTagRule.create({
          data: { sandboxId, audienceId: a.id, activityId: activity.id, variableKey: 'u1', operator: 'GREATER_THAN', value: '0', ordinal: 0 },
        });
      }
    }
    // Customer match uploads (match rates 55% and 38%)
    const cms = byType('CUSTOMER_MATCH');
    for (const [i, a] of cms.entries()) {
      const matched = Number(a.sizeDisplay ?? 0);
      const rate = i === 0 ? 0.55 : 0.38;
      const rows = Math.round(matched / rate);
      await db.customerMatchUpload.create({
        data: {
          sandboxId,
          audienceId: a.id,
          contactType: 'EMAIL',
          fileName: i === 0 ? 'crm-customers.csv' : 'premium-club.csv',
          rowCount: rows,
          matchedCount: matched,
          matchRatePct: (rate * 100).toFixed(2),
          status: 'DONE',
        },
      });
      await db.audience.update({
        where: { id: a.id },
        data: { dataSource: 'UPLOAD', consentAck: true, config: { contactType: 'EMAIL' } },
      });
    }
    // Lookalike of customers: seeds
    const look = byType('LOOKALIKE')[0];
    const bigSeed = cms[0] ?? byType('TAG_BASED')[0];
    if (look && bigSeed) {
      await db.audienceSeed.create({ data: { sandboxId, audienceId: look.id, seedAudienceId: bigSeed.id } });
      await db.audience.update({ where: { id: look.id }, data: { reachExpansion: '4.00' } });
    }
    // Custom list entries
    for (const a of byType('CUSTOM_AFFINITY')) {
      await db.customListEntry.createMany({
        data: [
          { sandboxId, audienceId: a.id, kind: 'INTEREST', value: 'gadgets', ordinal: 0 },
          { sandboxId, audienceId: a.id, kind: 'INTEREST', value: 'consumer electronics', ordinal: 1 },
          { sandboxId, audienceId: a.id, kind: 'URL', value: 'gsmarena.com', ordinal: 2 },
        ],
      });
    }
    for (const a of byType('CUSTOM_INTENT_DISPLAY_VIDEO')) {
      await db.customListEntry.createMany({
        data: [
          { sandboxId, audienceId: a.id, kind: 'KEYWORD', value: 'buy smartphone', ordinal: 0 },
          { sandboxId, audienceId: a.id, kind: 'KEYWORD', value: 'best phone under 20000', ordinal: 1 },
        ],
      });
    }

    // Small tag-based lists: `< 1K` and `1K-10K`
    const tiny = await db.audience.create({
      data: { ...base, name: `${adv.name} Loyalty app openers`, type: 'TAG_BASED', status: 'ACTIVE', membershipDays: 30, floodlightActivityId: activity?.id ?? null, ...sizeData(spreadSizes(640)), availableAt: created(40), createdAt: created(45) },
      select: { id: true },
    });
    const small = await db.audience.create({
      data: { ...base, name: `${adv.name} Newsletter readers`, type: 'TAG_BASED', status: 'ACTIVE', membershipDays: 60, floodlightActivityId: activity?.id ?? null, ...sizeData(spreadSizes(5_200)), availableAt: created(40), createdAt: created(44) },
      select: { id: true },
    });
    if (activity) {
      for (const a of [tiny, small])
        await db.audienceTagRule.create({
          data: { sandboxId, audienceId: a.id, activityId: activity.id, variableKey: 'u4', operator: 'EQUALS', value: 'IN', ordinal: 0 },
        });
    }
    // One list still PROCESSING (available two sim hours ahead)
    await db.audience.create({
      data: {
        ...base,
        name: `${adv.name} Wishlist visitors`,
        type: 'TAG_BASED',
        status: 'PROCESSING',
        membershipDays: 30,
        floodlightActivityId: activity?.id ?? null,
        availableAt: new Date(now.getTime() + 2 * HOUR),
        config: { targetSizes: spreadSizes(18_000) },
      },
    });
    // YouTube users with a linked channel
    const channel = await db.linkedAccount.create({
      data: {
        sandboxId,
        advertiserId: adv.id,
        type: 'YOUTUBE_CHANNEL',
        externalId: `UC${String(hashString(`${sandboxId}:${adv.id}:yt`)).padStart(10, '0')}`,
        displayName: `${adv.name} channel`,
      },
      select: { id: true },
    });
    await db.audience.create({
      data: {
        ...base,
        name: `${adv.name} Channel viewers`,
        type: 'YOUTUBE_USERS',
        source: 'YOUTUBE',
        status: 'ACTIVE',
        membershipDays: 90,
        ...sizeData(spreadSizes(145_000, { youtube: 1, mobileApp: 0.3, ctv: 0.3 })),
        availableAt: created(30),
        createdAt: created(32),
        config: { linkedAccountId: channel.id, action: 'VIEWED_ANY_VIDEO', videoIds: [] },
      },
    });
    // Lookalike whose seed is below 1,000 users (AUD-041 story)
    const smallSeed = mine.find((a) => a.name.endsWith('Premium club members'));
    const look2 = await db.audience.create({
      data: {
        ...base,
        name: `${adv.name} Lookalike of premium club`,
        type: 'LOOKALIKE',
        status: 'ACTIVE',
        lookalikeReachPct: '5.0',
        lookalikeCountries: ['IN'],
        reachExpansion: '4.00',
        ...sizeData(spreadSizes(0)),
        availableAt: created(20),
        createdAt: created(24),
      },
      select: { id: true },
    });
    if (smallSeed) await db.audienceSeed.create({ data: { sandboxId, audienceId: look2.id, seedAudienceId: smallSeed.id } });

    // Combined audiences: members are real lists plus one Google audience
    const a0 = mine.find((a) => a.type === 'TAG_BASED');
    const a1 = mine.find((a) => a.type === 'CUSTOMER_MATCH');
    const aff = google.find((g) => g.kind === 'AFFINITY');
    const inm = google.find((g) => g.kind === 'IN_MARKET');
    const sz = (n: bigint | null) => Number(n ?? 0);
    const nAll = (a: { sizeDisplay: bigint | null } | undefined) => sz(a?.sizeDisplay ?? null);
    if (a0 && a1 && aff && inm) {
      const c1 = await db.audience.create({
        data: {
          ...base,
          name: `${adv.name} Visitors who are customers`,
          type: 'COMBINED',
          status: 'ACTIVE',
          ...sizeData(spreadSizes(combinedSize([[nAll(a0)], [nAll(a1)]], []), { youtube: 0.6, mobileApp: 0.5, ctv: 0.2 })),
          availableAt: created(15),
          createdAt: created(15),
        },
        select: { id: true },
      });
      await db.combinedAudienceTerm.createMany({
        data: [
          { sandboxId, audienceId: c1.id, mode: 'INCLUDE', groupIndex: 0, memberKind: 'AUDIENCE', memberId: a0.id },
          { sandboxId, audienceId: c1.id, mode: 'INCLUDE', groupIndex: 1, memberKind: 'AUDIENCE', memberId: a1.id },
        ],
      });
      const c2Sizes = googleAudienceSize(inm.id, inm.kind);
      const c2 = await db.audience.create({
        data: {
          ...base,
          name: `${adv.name} Shoppers and fans, excluding customers`,
          type: 'COMBINED',
          status: 'ACTIVE',
          ...sizeData({
            display: combinedSize([[googleAudienceSize(aff.id, aff.kind).display, c2Sizes.display]], [nAll(a1)]),
            youtube: combinedSize([[googleAudienceSize(aff.id, aff.kind).youtube, c2Sizes.youtube]], [sz(null)]),
            mobileApp: combinedSize([[googleAudienceSize(aff.id, aff.kind).mobileApp, c2Sizes.mobileApp]], []),
            ctv: combinedSize([[googleAudienceSize(aff.id, aff.kind).ctv, c2Sizes.ctv]], []),
          }),
          availableAt: created(10),
          createdAt: created(10),
        },
        select: { id: true },
      });
      await db.combinedAudienceTerm.createMany({
        data: [
          { sandboxId, audienceId: c2.id, mode: 'INCLUDE', groupIndex: 0, memberKind: 'GOOGLE_AUDIENCE', memberId: aff.id },
          { sandboxId, audienceId: c2.id, mode: 'INCLUDE', groupIndex: 0, memberKind: 'GOOGLE_AUDIENCE', memberId: inm.id },
          { sandboxId, audienceId: c2.id, mode: 'EXCLUDE', groupIndex: 0, memberKind: 'AUDIENCE', memberId: a1.id },
        ],
      });
    }
    // Commerce partner lists (read only)
    for (const [i, name] of ['Retail shoppers (commerce partner)', 'Grocery buyers (commerce partner)'].entries()) {
      await db.audience.create({
        data: {
          ...base,
          name,
          type: 'PARTNER',
          source: 'COMMERCE_PARTNER',
          status: 'ACTIVE',
          ...sizeData(spreadSizes(i === 0 ? 2_400_000 : 910_000)),
          availableAt: created(60),
          createdAt: created(60),
        },
      });
    }
    seeded++;
  }
  return seeded;
}
