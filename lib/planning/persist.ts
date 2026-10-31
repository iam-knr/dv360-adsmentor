// Mapping between the plan tables and the pure forecast (no server-only imports: the seed runs under tsx too).
import type { Plan, PlanForecast as PlanForecastRow, PlanRow, Prisma } from '@prisma/client';
import { DEFAULT_DEMOGRAPHICS, type PlanDemographics } from './countries';
import type { ForecastInput } from './forecast';
import type { TargetingCriteria } from '../targeting/types';
import type { PlanAdditional, PlanBuyingMethodKey, PlanForecast, PlanRowDto } from './types';
import { LOCKED_CPM_METHODS } from './types';

export const iso = (d: Date): string => d.toISOString().slice(0, 10);
export const dbDate = (s: string): Date => new Date(`${s}T00:00:00.000Z`);
const num = (d: Prisma.Decimal | number | bigint | null | undefined): number =>
  d == null ? 0 : Number(d);

export function demographicsOf(plan: Pick<Plan, 'demographics'>): PlanDemographics {
  const d = (plan.demographics ?? {}) as Partial<PlanDemographics>;
  return {
    genders: d.genders && d.genders.length ? d.genders : DEFAULT_DEMOGRAPHICS.genders,
    ageMin: d.ageMin ?? DEFAULT_DEMOGRAPHICS.ageMin,
    ageMax: d.ageMax ?? DEFAULT_DEMOGRAPHICS.ageMax,
  };
}

export const additionalOf = (plan: Plan): PlanAdditional => {
  const extra = (plan.additionalSettings ?? {}) as Partial<PlanAdditional>;
  return {
    frequencyGoal: plan.frequencyGoal,
    reachBasis: plan.reachBasis,
    includeYoutube: plan.includeYoutube,
    inventoryQuality: extra.inventoryQuality ?? 'AUTHORIZED_AND_NON_PARTICIPATING',
    publicInventory: extra.publicInventory ?? true,
    viewability: extra.viewability ?? 'NONE',
    brandSuitability: extra.brandSuitability ?? 'NO_RESTRICTIONS',
  };
};

export function rowDto(r: PlanRow): PlanRowDto {
  return {
    id: r.id,
    ordinal: r.ordinal,
    name: r.name,
    buyingMethod: r.buyingMethod,
    dealId: r.dealId,
    locations: r.locations,
    startDate: iso(r.startDate),
    endDate: iso(r.endDate),
    targeting: (r.targeting ?? {}) as Record<string, unknown>,
    audienceRefs: Array.isArray(r.audienceRefs) ? (r.audienceRefs as string[]) : [],
    budgetNet: num(r.budgetNet),
    budgetTotal: num(r.budgetTotal),
    feePct: num(r.feePct),
    maxCpm: r.maxCpm == null ? null : num(r.maxCpm),
    isCpmLocked: r.isCpmLocked,
    pricing: r.pricing,
  };
}

export const isLockedMethod = (m: PlanBuyingMethodKey): boolean => LOCKED_CPM_METHODS.includes(m);

export function forecastInputOf(
  seed: string,
  plan: Plan,
  rows: PlanRow[],
  asOf: string,
): ForecastInput {
  return {
    seed,
    planId: plan.id,
    country: plan.locationCountry,
    currency: plan.currencyCode,
    demographics: demographicsOf(plan),
    reachBasis: plan.reachBasis,
    includeYoutube: plan.includeYoutube,
    startDate: iso(plan.startDate),
    endDate: iso(plan.endDate),
    asOf,
    rows: rows.map((r) => ({
      key: r.id,
      name: r.name,
      buyingMethod: r.buyingMethod,
      budgetNet: num(r.budgetNet),
      feePct: num(r.feePct),
      maxCpm: r.maxCpm == null ? null : num(r.maxCpm),
      audienceRefs: audienceRefsOf(r),
    })),
  };
}

export function forecastRowData(
  sandboxId: string,
  planId: string,
  f: PlanForecast,
): Prisma.PlanForecastUncheckedCreateInput {
  return {
    sandboxId,
    planId,
    asOf: new Date(f.asOf),
    onTargetReachPct: f.reachPct,
    avgFrequency: f.avgFrequency,
    totalCpm: f.totalCpm,
    onTargetCpm: f.onTargetCpm,
    censusTrps: f.trps,
    censusCpp: f.cpp,
    censusPopulation: BigInt(f.population.census),
    digitalPopulation: BigInt(f.population.digital),
    tvPopulation: BigInt(f.population.tv),
    youtubePopulation: BigInt(f.population.youtube),
    actionCpa: f.actionCpa,
    cpa: f.cpa,
    viewableCpm: f.viewableCpm,
    viewabilityRate: f.viewabilityRate,
    perRow: f.perRow as unknown as Prisma.InputJsonValue,
    curves: {
      reach: f.reach,
      budget: f.budget,
      plannedBudget: f.plannedBudget ?? f.budget,
      impressions: f.impressions,
    },
    reachByFrequency: f.reachByFrequency,
    tabs: f.tabs,
    inputsHash: f.inputsHash,
  };
}

export function forecastFromRow(r: PlanForecastRow): PlanForecast {
  const curves = (r.curves ?? {}) as {
    reach?: number;
    budget?: number;
    plannedBudget?: number;
    impressions?: number;
  };
  return {
    asOf: r.asOf.toISOString(),
    reachPct: num(r.onTargetReachPct),
    reach: curves.reach ?? 0,
    avgFrequency: num(r.avgFrequency),
    totalCpm: num(r.totalCpm),
    onTargetCpm: num(r.onTargetCpm),
    trps: num(r.censusTrps),
    cpp: num(r.censusCpp),
    population: {
      census: num(r.censusPopulation),
      digital: num(r.digitalPopulation),
      tv: num(r.tvPopulation),
      youtube: num(r.youtubePopulation),
    },
    cpa: r.cpa == null ? null : num(r.cpa),
    actionCpa: r.actionCpa == null ? null : num(r.actionCpa),
    viewableCpm: num(r.viewableCpm),
    viewabilityRate: r.viewabilityRate == null ? null : num(r.viewabilityRate),
    reachByFrequency: (r.reachByFrequency ?? []) as number[],
    budget: curves.budget ?? 0,
    ...(curves.plannedBudget === undefined ? {} : { plannedBudget: curves.plannedBudget }),
    impressions: curves.impressions ?? 0,
    perRow: (r.perRow ?? {}) as unknown as PlanForecast['perRow'],
    tabs: (r.tabs ?? {}) as unknown as PlanForecast['tabs'],
    inputsHash: r.inputsHash ?? '',
  };
}

/** Targeting a plan row carries: the shared targeting panel's criteria (gap p4-08 #2). Older rows have `{}`. */
export function criteriaOf(r: { targeting?: unknown }): TargetingCriteria {
  const t = (r.targeting ?? {}) as { criteria?: TargetingCriteria };
  return t.criteria && typeof t.criteria === 'object' ? t.criteria : {};
}

/** Lists that narrow the row's audience: the older free-text tags plus every list included in the panel. */
export function audienceRefsOf(r: { targeting?: unknown; audienceRefs?: unknown }): string[] {
  const tags = Array.isArray(r.audienceRefs) ? (r.audienceRefs as string[]) : [];
  const a = criteriaOf(r).audienceLists?.include;
  const ids = a ? [...a.firstPartyGroups.flat(), ...a.google, ...a.combined, ...a.custom] : [];
  return [...new Set([...tags, ...ids])];
}
