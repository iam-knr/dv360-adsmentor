// Plan seed of module 04 (3.3): twelve plans per advertiser: 8 past-dated (locked, one Trafficked), 3 future-dated
// and 1 starting today; two to five rows each; a forecast snapshot per plan. Relative imports: runs under tsx too.
import type { Prisma, PrismaClient } from '@prisma/client';
import { countryForCurrency, DEFAULT_DEMOGRAPHICS, PER_USD } from './countries';
import { forecastPlan } from './forecast';
import { fnv1a } from './hash';
import { dbDate, forecastInputOf, forecastRowData } from './persist';
import { PLAN_PARAMS } from './params';
import type { PlanBuyingMethodKey, PlanChannelKey } from './types';

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
];
const ROW_NAMES = [
  'Open auction display',
  'Open auction video',
  'New Custom Affinity - Suggested',
  '{Theme} - Interest',
  'Remarketing - Existing customers',
];

export interface SeedPlansInput {
  sandboxId: string;
  template: string;
  seedValue: number;
  /** Sim today, YYYY-MM-DD. */
  today: string;
}

/** Number of plans written. The blank template has none. */
export async function seedPlans(tx: Db, input: SeedPlansInput): Promise<number> {
  if (input.template === 'blank') return 0;
  const advertisers = await tx.advertiser.findMany({
    where: { sandboxId: input.sandboxId },
    select: { id: true, currencyCode: true },
    orderBy: { publicId: 'asc' },
  });
  let made = 0;
  for (const adv of advertisers) {
    const country = countryForCurrency(adv.currencyCode);
    for (let i = 0; i < 12; i++) {
      const h = fnv1a(`${input.seedValue}|${adv.id}|plan|${i}`);
      const past = i < 8;
      const startsToday = i === 11;
      const length = 28 + (h % 60);
      const start = past
        ? addDays(input.today, -(60 + (7 - i) * 35 + (h % 10)))
        : startsToday
          ? input.today
          : addDays(input.today, 7 + (i - 8) * 21);
      const end = addDays(start, length - 1);
      const channels: PlanChannelKey[] =
        i === 9 ? ['DIGITAL', 'TV'] : i >= 10 ? ['DIGITAL', 'TV', 'CROSS_MEDIA'] : ['DIGITAL'];
      const rowCount = 2 + (h % 4);
      const trafficked = i === 7;
      const plan = await tx.plan.create({
        data: {
          sandboxId: input.sandboxId,
          advertiserId: adv.id,
          name: PLAN_NAMES[i] as string,
          status: trafficked ? 'TRAFFICKED' : 'PLANNED',
          locationCountry: country.code,
          currencyCode: adv.currencyCode,
          startDate: dbDate(start),
          endDate: dbDate(end),
          channels,
          demographics: DEFAULT_DEMOGRAPHICS as unknown as Prisma.InputJsonValue,
          additionalSettings: { frequencyGoal: 3, reachBasis: 'CENSUS', includeYoutube: true },
          frequencyGoal: 3,
          reachBasis: 'CENSUS',
          includeYoutube: true,
          forecastStale: false,
          savedAt: new Date(`${addDays(start, -3)}T10:00:00Z`),
          savedAtSim: new Date(`${addDays(start, -3)}T10:00:00Z`),
        },
      });
      let total = 0;
      for (let r = 0; r < rowCount; r++) {
        const method: PlanBuyingMethodKey =
          i === 3 && r === 1 ? 'PROGRAMMATIC_GUARANTEED' : 'OPEN_AUCTION';
        const usd = 3_000 + ((h >>> (r * 3)) % 40) * 900;
        const net = Math.round((usd * (PER_USD[adv.currencyCode] ?? 1)) / 100) * 100;
        const fee = PLAN_PARAMS.fees.default;
        const gross = Math.round(net * (1 + fee) * 100) / 100;
        total += gross;
        await tx.planRow.create({
          data: {
            sandboxId: input.sandboxId,
            planId: plan.id,
            ordinal: r,
            name: (ROW_NAMES[r % ROW_NAMES.length] as string).replace('{Theme}', 'Sports'),
            buyingMethod: method,
            locations: [country.code],
            startDate: dbDate(start),
            endDate: dbDate(end),
            targeting: {},
            audienceRefs: r === 2 ? ['Sports fans'] : [],
            pricing: method === 'OPEN_AUCTION' ? 'Auction' : 'Fixed',
            feePct: fee,
            budgetNet: net,
            budgetTotal: gross,
            maxCpm: method === 'OPEN_AUCTION' && r === 0 ? Math.round(country.cpmUsd * 2.4 * 100) / 100 : null,
            isCpmLocked: method !== 'OPEN_AUCTION',
          },
        });
      }
      await tx.plan.update({ where: { id: plan.id }, data: { totalBudget: total } });
      const full = await tx.plan.findUniqueOrThrow({
        where: { id: plan.id },
        include: { rows: { orderBy: { ordinal: 'asc' } } },
      });
      const f = forecastPlan(
        forecastInputOf(String(input.seedValue), full, full.rows, `${addDays(start, -3)}T10:00:00.000Z`),
      );
      await tx.planForecast.create({ data: forecastRowData(input.sandboxId, plan.id, f) });
      made++;
    }
  }
  return made;
}
