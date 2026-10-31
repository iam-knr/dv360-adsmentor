// Plan seed of module 04 (3.3), widened by plan-parity: 22 plans per advertiser in every status (Planned, Trafficked,
// Archived), past-dated (locked) and future-dated (editable), in nine countries, with two to five rows each (ad formats,
// buying methods, targeting panel criteria, audiences), a forecast snapshot per plan, and Cross-media reach reports.
// Deterministic (hash of the seed value). Relative imports: runs under tsx too.
import type { Prisma, PrismaClient } from '@prisma/client';
import {
  CROSS_MEDIA_COUNTRIES,
  DEFAULT_DEMOGRAPHICS,
  PER_USD,
  PLAN_COUNTRIES,
  countryForCurrency,
  type PlanDemographics,
} from './countries';
import { crossMediaMath } from './cross-media';
import { forecastPlan } from './forecast';
import { fnv1a } from './hash';
import { dbDate, forecastInputOf, forecastRowData } from './persist';
import { PLAN_PARAMS } from './params';
import { tvCampaigns } from './tv-catalogue';
import { AD_FORMATS, type PlanBuyingMethodKey, type PlanChannelKey } from './types';
import type { TargetingCriteria } from '../targeting/types';

type Db = PrismaClient | Prisma.TransactionClient;

const DAY = 86_400_000;
const addDays = (d: string, n: number): string =>
  new Date(Date.parse(`${d}T00:00:00Z`) + n * DAY).toISOString().slice(0, 10);

const PLAN_NAMES = [
  'Spring awareness plan',
  'Always-on reach plan',
  'Summer launch - Interest',
  'Festive season plan',
  'Back to school - Interest',
  'Brand lift plan',
  'Video first plan',
  'Q4 retention plan',
  'New year awareness plan',
  'Linear TV and digital split',
  'Cross-media reach test',
  'Cross-media always-on',
  'Product launch - Custom Affinity',
  'Mobile-first awareness',
  'Holiday gifting plan',
  'Loyalty and retention plan',
  'YouTube reach and frequency',
  'Regional expansion plan',
  'Quarter-end performance push',
  'Competitor conquest - Intent',
  'Archived: pilot reach plan',
  'Archived: last year always-on',
];
const COUNTRY_ROTATION = [
  'HOME',
  'SG',
  'HOME',
  'IN',
  'AE',
  'HOME',
  'AU',
  'UK',
  'HOME',
  'US',
  'DE',
  'HOME',
  'BR',
  'JP',
  'HOME',
  'MX',
  'ID',
  'HOME',
  'CA',
  'FR',
  'HOME',
  'HOME',
];
const DEMOS: PlanDemographics[] = [
  DEFAULT_DEMOGRAPHICS,
  { genders: ['FEMALE'], ageMin: 25, ageMax: 44 },
  { genders: ['MALE'], ageMin: 18, ageMax: 34 },
  { genders: ['MALE', 'FEMALE'], ageMin: 35, ageMax: 64 },
  { genders: ['MALE', 'FEMALE', 'UNKNOWN'], ageMin: 18, ageMax: 24 },
];
const THEMES = ['Sports', 'Travel', 'Home', 'Gaming', 'Fitness', 'Food'];
const GOOGLE_AUDIENCE_IDS = ['7000037', '7000074', '7000111'];

export interface SeedPlansInput {
  sandboxId: string;
  template: string;
  seedValue: number;
  /** Sim today, YYYY-MM-DD. */
  today: string;
}

/** Plans per advertiser. */
export const PLANS_PER_ADVERTISER = PLAN_NAMES.length;

function rowTargeting(
  h: number,
  r: number,
  country: string,
  ownAudiences: string[],
): TargetingCriteria {
  const criteria: TargetingCriteria = {};
  if (r % 3 === 1) criteria.environment = { web: true, app: r % 2 === 0 };
  if (r % 2 === 0)
    criteria.keywords = { include: [THEMES[(h + r) % THEMES.length]!.toLowerCase()], exclude: [] };
  if (r % 4 === 2)
    criteria.demographics = {
      gender: ['MALE', 'FEMALE'],
      ageRange: [25, 55],
      ageUnknown: false,
      parental: [],
      income: [],
    };
  if (r === 2 || (h + r) % 5 === 0) {
    const own = ownAudiences[(h + r) % Math.max(1, ownAudiences.length)];
    criteria.audienceLists = {
      include: {
        firstPartyGroups: own && r % 2 === 0 ? [[own]] : [],
        google: [GOOGLE_AUDIENCE_IDS[(h + r) % GOOGLE_AUDIENCE_IDS.length]!],
        combined: [],
        custom: own && r % 2 === 1 ? [own] : [],
      },
      exclude: { firstParty: [], google: [] },
    };
  }
  void country;
  return criteria;
}

/** Number of plans written. The blank template has none. */
export async function seedPlans(tx: Db, input: SeedPlansInput): Promise<number> {
  if (input.template === 'blank') return 0;
  const advertisers = await tx.advertiser.findMany({
    where: { sandboxId: input.sandboxId },
    select: { id: true, partnerId: true, currencyCode: true },
    orderBy: { publicId: 'asc' },
  });
  const deals = new Map<string, string[]>();
  let made = 0;
  for (const adv of advertisers) {
    const home = countryForCurrency(adv.currencyCode);
    if (!deals.has(adv.partnerId))
      deals.set(
        adv.partnerId,
        (
          await tx.inventorySourceDeal.findMany({
            where: { partnerId: adv.partnerId },
            select: { id: true },
            orderBy: { name: 'asc' },
            take: 3,
          })
        ).map((d) => d.id),
      );
    const dealIds = deals.get(adv.partnerId) ?? [];
    const campaigns = await tx.campaign.findMany({
      where: { advertiserId: adv.id },
      select: { id: true },
      orderBy: { publicId: 'asc' },
      take: 2,
    });
    const ownAudiences = (
      await tx.audience.findMany({
        where: {
          advertiserId: adv.id,
          type: { in: ['TAG_BASED', 'CUSTOM_AFFINITY', 'CUSTOM_INTENT_DISPLAY_VIDEO'] },
        },
        select: { id: true },
        orderBy: { createdAt: 'asc' },
        take: 6,
      })
    ).map((a) => a.id);
    for (let i = 0; i < PLAN_NAMES.length; i++) {
      const h = fnv1a(`${input.seedValue}|${adv.id}|plan|${i}`);
      const archived = i >= 20;
      const past = i < 10 || archived;
      const startsToday = i === 10;
      const length = 28 + (h % 60);
      const start = archived
        ? addDays(input.today, -(200 + (i - 20) * 90))
        : past
          ? addDays(input.today, -(60 + (9 - i) * 30 + (h % 10)))
          : startsToday
            ? input.today
            : addDays(input.today, 3 + (i - 11) * 17);
      const end = addDays(start, length - 1);
      const channels: PlanChannelKey[] =
        i % 7 === 6
          ? ['DIGITAL', 'TV', 'CROSS_MEDIA']
          : i % 5 === 4
            ? ['DIGITAL', 'TV']
            : ['DIGITAL'];
      const rotation = COUNTRY_ROTATION[i] as string;
      const country =
        rotation === 'HOME' ? home : (PLAN_COUNTRIES.find((c) => c.code === rotation) ?? home);
      const demo = DEMOS[(h >>> 3) % DEMOS.length] as PlanDemographics;
      const rowCount = 2 + (h % 4);
      const trafficked = (i === 7 || i === 15) && campaigns.length > 0;
      const status = archived ? 'ARCHIVED' : trafficked ? 'TRAFFICKED' : 'PLANNED';
      const stale = i === 17;
      const savedAt = new Date(`${addDays(start, -3 - (h % 4))}T10:00:00Z`);
      const plan = await tx.plan.create({
        data: {
          sandboxId: input.sandboxId,
          advertiserId: adv.id,
          name: PLAN_NAMES[i] as string,
          status,
          locationCountry: country.code,
          currencyCode: adv.currencyCode,
          startDate: dbDate(start),
          endDate: dbDate(end),
          channels,
          demographics: demo as unknown as Prisma.InputJsonValue,
          additionalSettings: {
            frequencyGoal: 2 + (h % 5),
            reachBasis: i % 4 === 3 ? 'DIGITAL' : 'CENSUS',
            includeYoutube: i % 6 !== 5,
            inventoryQuality: 'AUTHORIZED_AND_NON_PARTICIPATING',
            publicInventory: true,
            viewability: i % 3 === 0 ? 'MRC_50' : 'NONE',
            brandSuitability: 'NO_RESTRICTIONS',
          },
          frequencyGoal: 2 + (h % 5),
          reachBasis: i % 4 === 3 ? 'DIGITAL' : 'CENSUS',
          includeYoutube: i % 6 !== 5,
          forecastStale: stale,
          savedAt,
          savedAtSim: savedAt,
          ...(trafficked
            ? {
                convertedCampaignId: (
                  campaigns[i === 7 ? 0 : campaigns.length - 1] as { id: string }
                ).id,
              }
            : {}),
        },
      });
      let total = 0;
      const used = new Set<string>();
      for (let r = 0; r < rowCount; r++) {
        // ad formats rotate through the catalogue; deal formats only when the partner has a deal
        let fmt = AD_FORMATS[(h + r * 3) % AD_FORMATS.length]!;
        if (
          fmt.buyingMethod !== 'OPEN_AUCTION' &&
          fmt.buyingMethod !== 'YOUTUBE_RESERVE' &&
          dealIds.length === 0
        )
          fmt = AD_FORMATS[r % 2]!;
        while (used.has(fmt.id))
          fmt = AD_FORMATS[(AD_FORMATS.indexOf(fmt) + 1) % AD_FORMATS.length]!;
        used.add(fmt.id);
        const method: PlanBuyingMethodKey =
          fmt.buyingMethod !== 'OPEN_AUCTION' &&
          fmt.buyingMethod !== 'YOUTUBE_RESERVE' &&
          dealIds.length === 0
            ? 'OPEN_AUCTION'
            : fmt.buyingMethod;
        const usd = 3_000 + ((h >>> (r * 3)) % 40) * 900;
        const net = Math.round((usd * (PER_USD[adv.currencyCode] ?? 1)) / 100) * 100;
        const fee = PLAN_PARAMS.fees.default;
        const gross = Math.round(net * (1 + fee) * 100) / 100;
        total += gross;
        const needsDeal =
          method === 'PROGRAMMATIC_GUARANTEED' ||
          method === 'PREFERRED_DEAL' ||
          method === 'PRIVATE_AUCTION';
        const criteria = rowTargeting(h, r, country.code, ownAudiences);
        const audienceRefs = criteria.audienceLists
          ? [
              ...criteria.audienceLists.include.firstPartyGroups.flat(),
              ...criteria.audienceLists.include.google,
              ...criteria.audienceLists.include.custom,
            ]
          : [];
        await tx.planRow.create({
          data: {
            sandboxId: input.sandboxId,
            planId: plan.id,
            ordinal: r,
            name: r % 3 === 0 ? `${fmt.label} - ${THEMES[(h + r) % THEMES.length]}` : fmt.label,
            buyingMethod: method,
            locations: r === 1 && rotation !== 'HOME' ? [country.code, home.code] : [country.code],
            startDate: dbDate(start),
            endDate: dbDate(end),
            targeting: {
              version: 1,
              lineItemType: 'DISPLAY',
              criteria,
            } as unknown as Prisma.InputJsonValue,
            audienceRefs,
            pricing:
              method === 'OPEN_AUCTION' || method === 'PRIVATE_AUCTION' ? 'Auction' : 'Fixed',
            dealId: needsDeal ? (dealIds[r % dealIds.length] ?? null) : null,
            feePct: fee,
            budgetNet: net,
            budgetTotal: gross,
            maxCpm:
              method === 'OPEN_AUCTION' && r === 0
                ? Math.round(country.cpmUsd * 2.4 * 100) / 100
                : null,
            isCpmLocked: method !== 'OPEN_AUCTION' && method !== 'PRIVATE_AUCTION',
          },
        });
      }
      await tx.plan.update({ where: { id: plan.id }, data: { totalBudget: total } });
      const full = await tx.plan.findUniqueOrThrow({
        where: { id: plan.id },
        include: { rows: { orderBy: { ordinal: 'asc' } } },
      });
      const f = forecastPlan(
        forecastInputOf(String(input.seedValue), full, full.rows, savedAt.toISOString()),
      );
      await tx.planForecast.create({ data: forecastRowData(input.sandboxId, plan.id, f) });
      made++;
    }
  }
  return made;
}

/** Cross-media reach reports of the sandbox (module 04 S7/S8): a few per advertiser and two at partner level. */
export async function seedCrossMediaReports(
  tx: Db,
  input: { sandboxId: string; ownerUserId: string | null; seedValue: number; today: string },
): Promise<number> {
  if (!input.ownerUserId) return 0;
  const partner = await tx.partner.findFirst({
    where: { sandboxId: input.sandboxId },
    select: { id: true },
  });
  if (!partner) return 0;
  const advertisers = await tx.advertiser.findMany({
    where: { sandboxId: input.sandboxId },
    select: { id: true, currencyCode: true },
    orderBy: { publicId: 'asc' },
  });
  let made = 0;
  const specs: {
    country: string;
    scope: 'NATIONAL' | 'SUB_LOCATION';
    ios: number;
    tvs: number;
    atPartner: boolean;
    name: string;
  }[] = [];
  // The home country of an advertiser is often not a Cross-media country (India, Singapore), so each advertiser takes
  // three of the thirteen in turn: two national reports and one by sub-location.
  for (const [ai] of advertisers.entries()) {
    const pick = (k: number) => CROSS_MEDIA_COUNTRIES[(ai * 3 + k) % CROSS_MEDIA_COUNTRIES.length]!;
    specs.push(
      {
        country: pick(0).code,
        scope: 'NATIONAL',
        ios: 2,
        tvs: 2,
        atPartner: false,
        name: `Always-on cross-media reach - ${pick(0).name}`,
      },
      {
        country: pick(1).code,
        scope: 'SUB_LOCATION',
        ios: 1,
        tvs: 1,
        atPartner: false,
        name: `Regional reach check - ${pick(1).name}`,
      },
      {
        country: pick(2).code,
        scope: 'NATIONAL',
        ios: 3,
        tvs: 3,
        atPartner: false,
        name: `Launch reach - ${pick(2).name}`,
      },
    );
  }
  specs.push({
    country: 'AU',
    scope: 'NATIONAL',
    ios: 2,
    tvs: 2,
    atPartner: true,
    name: 'Partner-wide reach - Australia',
  });
  for (const [n, sp] of specs.entries()) {
    const country = CROSS_MEDIA_COUNTRIES.find((c) => c.code === sp.country);
    if (!country?.crossMedia) continue;
    const advIndex = Math.min(Math.floor(n / 3), advertisers.length - 1);
    const adv = sp.atPartner ? null : advertisers[advIndex];
    const ios = await tx.insertionOrder.findMany({
      where: adv ? { advertiserId: adv.id } : { sandboxId: input.sandboxId },
      select: { id: true },
      orderBy: { publicId: 'asc' },
      take: sp.ios,
    });
    if (!ios.length) continue;
    const tvs = tvCampaigns(country.code).slice(n % 4, (n % 4) + sp.tvs);
    const lis = await tx.lineItem.findMany({
      where: { ioId: { in: ios.map((x) => x.id) } },
      select: { id: true, ioId: true },
    });
    const metrics = lis.length
      ? await tx.simDailyMetric.groupBy({
          by: ['lineItemId'],
          where: { lineItemId: { in: lis.map((l) => l.id) }, sliceKind: 'total' },
          _sum: { impressions: true },
        })
      : [];
    const byLi = new Map(metrics.map((m) => [m.lineItemId, Number(m._sum.impressions ?? 0)]));
    const byIo = new Map<string, number>();
    for (const l of lis) byIo.set(l.ioId, (byIo.get(l.ioId) ?? 0) + (byLi.get(l.id) ?? 0));
    const scale = sp.scope === 'SUB_LOCATION' ? 0.31 : 1;
    const math = crossMediaMath({
      population: country.digital,
      digital: ios.map((io) => ({ impressions: (byIo.get(io.id) ?? 0) * scale })),
      tv: tvs.map((t) => ({ reachPct: t.reachPct, grps: t.grps, impressions: t.impressions })),
      scale,
    });
    await tx.crossMediaReachReport.create({
      data: {
        sandboxId: input.sandboxId,
        partnerId: partner.id,
        advertiserId: adv?.id ?? null,
        createdById: input.ownerUserId,
        name: sp.name,
        country: country.crossMedia,
        currencyCode: country.currency,
        scope: sp.scope,
        subLocations: sp.scope === 'SUB_LOCATION' ? [`${country.code}-N`, `${country.code}-S`] : [],
        ioIds: ios.map((x) => x.id),
        tvCampaigns: tvs.map((t) => t.id),
        dateStart: dbDate('2025-01-01'),
        dateEnd: dbDate(addDays(input.today, -(n % 5))),
        status: 'DONE',
        result: { ...math, currency: country.currency },
      },
    });
    made++;
  }
  return made;
}
