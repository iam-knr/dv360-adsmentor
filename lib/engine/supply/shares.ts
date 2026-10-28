// Per-dimension targeting pass fractions (engine.md 2.3). A line item's targeting is compiled once
// per tick into a plan; the funnel multiplies the passes in canonical order and blames the first
// failing dimension (3.4).

import type { Params } from '../params/schema';
import { clamp } from '../math';
import { viewabilityPass } from '../params/rates';
import type { Cell } from '../types';
import type { AudienceEntity, LineItemEntity, ListSelection, TargetingSpec } from '../world';

export const TARGETING_ORDER = [
  'INVENTORY_SOURCE',
  'ENVIRONMENT',
  'DEVICE_TYPE',
  'GEO',
  'LANGUAGE',
  'DAYPART',
  'DEVICE_DETAIL',
  'BROWSER',
  'CONNECTION',
  'CARRIER_ISP',
  'VIEWABILITY',
  'POSITION',
  'CONTENT_CATEGORY',
  'KEYWORD',
  'APP_URL',
  'BRAND_SUITABILITY',
  'VERIFICATION_3P',
  'DEMOGRAPHICS',
  'AUDIENCE',
] as const;
export type TargetingDim = (typeof TARGETING_ORDER)[number];

export interface TargetingCtx {
  params: Params;
  tick: number;
  /** Advertiser-tz hour and day-of-week of the tick (0 = Monday). */
  advHour: number;
  advDow: number;
  audiences: Map<string, AudienceEntity>;
}

export interface PlannedDim {
  dim: TargetingDim;
  pass: (cell: Cell) => number;
}

export interface TargetingPlan {
  dims: PlannedDim[];
  /** Premium kind of the dominant included audience, for price and rate lifts. */
  audienceKind: 'none' | AudienceEntity['type'];
  /** Whether any audience or demographic dimension is on. */
  hasProfileTargeting: boolean;
  /** Wider pass share from optimized targeting (applied inside AUDIENCE and DEMOGRAPHICS). */
  optimizedTargeting: boolean;
  /** Viewability threshold (0 when none). */
  viewabilityMin: number;
  /** Aggregate share of kept supply for position choices, for price and rate multipliers. */
  positionMix: { above_fold: number; below_fold: number; unknown: number } | null;
  /** Share of the LI's included audience that is restricted by policy. */
  restrictedAudience: boolean;
  verificationOptions: string[];
}

/** Share of a table kept by a selection. Include keeps the sum of included keys, exclude removes. */
export function allocShare(table: Record<string, number>, sel: ListSelection | undefined): number {
  if (!sel) return 1;
  const exc = new Set(sel.exclude ?? []);
  let p = 1;
  if (sel.include && sel.include.length > 0) {
    p = 0;
    for (const k of sel.include) if (!exc.has(k)) p += table[k] ?? 0;
  } else if (exc.size > 0) {
    for (const k of exc) p -= table[k] ?? 0;
  }
  return clamp(p, 0, 1);
}

function hashUnit(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 100000) / 100000;
}

/** Fraction of the user pool an audience list covers (2.3 and RC-030). */
export function audienceFraction(
  a: AudienceEntity,
  params: Params,
  tick: number,
  poolScale: number,
): number {
  const cfg = params.targeting.audience;
  if (a.usableFromTick !== undefined && tick < a.usableFromTick) return 0;
  const pool = cfg.userPool * poolScale;
  if (a.type === 'first_party') {
    const size = a.size ?? 0;
    if (size < cfg.minUsableSize) return 0;
    return clamp(size / pool, 0, 1);
  }
  if (a.type === 'lookalike') {
    const seed = a.seedSize ?? a.size ?? 0;
    if (seed < cfg.minUsableSize) return 0;
    const expansion = cfg.lookalikeExpansion * ((a.reachPct ?? 5) / 5);
    return clamp((seed / pool) * expansion, 0, cfg.lookalikeCap);
  }
  if (a.sizeFraction !== undefined) return clamp(a.sizeFraction, 0, 1);
  const range = cfg.sizeRange[a.type];
  if (!range) return 0.05;
  return range[0] + (range[1] - range[0]) * hashUnit(a.id);
}

const union = (xs: number[]): number => 1 - xs.reduce((acc, s) => acc * (1 - s), 1);

export function buildTargetingPlan(
  li: LineItemEntity,
  ctx: TargetingCtx,
  poolScale: number,
): TargetingPlan {
  const t: TargetingSpec = li.targeting;
  const p = ctx.params;
  const dims: PlannedDim[] = [];
  const alloc = p.targeting.allocation;

  // 1. Inventory source: selected exchanges and authorised-seller quality tier
  const quality = p.targeting.inventoryQuality[li.inventoryQuality];
  const chosen = t.exchanges ? new Set(t.exchanges) : null;
  dims.push({
    dim: 'INVENTORY_SOURCE',
    pass: (c) =>
      chosen && !chosen.has(c.exchangeId) ? 0 : c.exchangeId === 'youtube' ? 1 : quality,
  });

  if (t.environment && t.environment.length > 0) {
    const set = new Set(t.environment);
    dims.push({ dim: 'ENVIRONMENT', pass: (c) => (set.has(c.environment) ? 1 : 0) });
  }
  if (t.devices && t.devices.length > 0) {
    const set = new Set(t.devices);
    dims.push({ dim: 'DEVICE_TYPE', pass: (c) => (set.has(c.device) ? 1 : 0) });
  }
  if (
    t.geo &&
    (t.geo.includeRegions?.length || t.geo.excludeRegions?.length || t.geo.pincodes?.length)
  ) {
    const inc = t.geo.includeRegions ? new Set(t.geo.includeRegions) : null;
    const exc = new Set(t.geo.excludeRegions ?? []);
    const pins = new Map<string, number>();
    for (const pc of t.geo.pincodes ?? [])
      pins.set(pc.region, (pins.get(pc.region) ?? 0) + pc.count);
    const restricted = inc !== null || pins.size > 0;
    dims.push({
      dim: 'GEO',
      pass: (c) => {
        if (exc.has(c.region)) return 0;
        if (!restricted) return 1;
        if (inc?.has(c.region)) return 1;
        const n = pins.get(c.region);
        if (n) return clamp(n * (p.targeting.pincodeShare[c.region] ?? 0.002), 0, 1);
        return 0;
      },
    });
  }
  if (t.languages && t.languages.length > 0) {
    const langs = t.languages;
    dims.push({
      dim: 'LANGUAGE',
      pass: (c) => {
        const table = p.targeting.languageShare[c.region] ??
          p.targeting.languageShare.default ?? { en: 1 };
        let s = 0;
        for (const l of langs) s += table[l] ?? 0;
        return clamp(s, 0, 1);
      },
    });
  }
  if (t.daypart && t.daypart.windows.length > 0) {
    const open = t.daypart.windows.some(
      (w) => w.days.includes(ctx.advDow) && ctx.advHour >= w.startHour && ctx.advHour < w.endHour,
    );
    dims.push({ dim: 'DAYPART', pass: () => (open ? 1 : 0) });
  }
  const sel = (dim: TargetingDim, table: Record<string, number>, s: ListSelection | undefined) => {
    if (!s || (!s.include?.length && !s.exclude?.length)) return;
    const share = allocShare(table, s);
    dims.push({ dim, pass: () => share });
  };
  sel('DEVICE_DETAIL', alloc.deviceDetail, t.deviceDetail);
  sel('BROWSER', alloc.browser, t.browser);
  sel('CONNECTION', alloc.connection, t.connection);
  sel('CARRIER_ISP', alloc.carrier, t.carrier);

  const vmin = t.viewabilityMin ?? 0;
  if (vmin > 0) {
    dims.push({
      dim: 'VIEWABILITY',
      pass: (c) => viewabilityPass(c.predictedViewability.mean, c.predictedViewability.kappa, vmin),
    });
  }

  let positionMix: TargetingPlan['positionMix'] = null;
  if (t.position && (t.position.include?.length || t.position.exclude?.length)) {
    const share = allocShare(alloc.position, t.position);
    dims.push({ dim: 'POSITION', pass: () => share });
    const keep = (k: string) => {
      const exc = new Set(t.position?.exclude ?? []);
      if (exc.has(k)) return 0;
      if (t.position?.include?.length)
        return t.position.include.includes(k) ? (alloc.position[k] ?? 0) : 0;
      return alloc.position[k] ?? 0;
    };
    const a = keep('above_fold');
    const b = keep('below_fold');
    const u = keep('unknown');
    const tot = a + b + u || 1;
    positionMix = { above_fold: a / tot, below_fold: b / tot, unknown: u / tot };
  }

  if (t.formats?.length || t.categories?.include?.length || t.categories?.exclude?.length) {
    const fmts = t.formats ? new Set(t.formats) : null;
    const catShare = allocShare(alloc.category, t.categories);
    dims.push({
      dim: 'CONTENT_CATEGORY',
      pass: (c) => (fmts && !fmts.has(c.format) ? 0 : catShare),
    });
  }
  if (t.keywords && (t.keywords.includeCount > 0 || (t.keywords.negativeCount ?? 0) > 0)) {
    const k = p.targeting.keyword;
    const inc =
      t.keywords.includeCount > 0
        ? k.minShare +
          (k.maxShare - k.minShare) * Math.min(1, t.keywords.includeCount / k.listSizeForMax)
        : 1;
    const neg =
      1 - Math.min(k.negativeShareMax, (t.keywords.negativeCount ?? 0) * k.negativeShareEach);
    const share = inc * neg;
    dims.push({ dim: 'KEYWORD', pass: () => share });
  }
  if (t.appUrl && ((t.appUrl.includeCount ?? 0) > 0 || (t.appUrl.excludeCount ?? 0) > 0)) {
    const cfg = p.targeting.appUrl;
    const inc =
      (t.appUrl.includeCount ?? 0) > 0
        ? Math.pow(
            Math.min(1, (t.appUrl.includeCount ?? 0) / cfg.universeSize),
            cfg.includeExponent,
          )
        : 1;
    const exc = 1 - Math.min(1, (t.appUrl.excludeCount ?? 0) / cfg.universeSize);
    const share = inc * exc;
    dims.push({ dim: 'APP_URL', pass: () => share });
  }
  if (t.brandSuitability) {
    const b = p.targeting.brandSuitability;
    const mode = t.brandSuitability.mode ?? 'standard';
    const share = clamp(
      b[mode] *
        (1 - (t.brandSuitability.excludedLabels ?? 0) * b.perLabelShare) *
        (1 - (t.brandSuitability.excludedCategories ?? 0) * b.perCategoryShare),
      0,
      1,
    );
    dims.push({ dim: 'BRAND_SUITABILITY', pass: () => share });
  }
  const verification = t.verification ?? [];
  if (verification.length > 0) {
    const set = new Set(verification);
    let keep = 1;
    for (const v of set) {
      // ABS replaces the standard brand safety and fraud options (8.4)
      if (set.has('dv_abs') && (v === 'dv_brand_safety' || v === 'dv_fraud')) continue;
      keep *= 1 - (p.targeting.verificationBlockShare[v] ?? 0);
    }
    dims.push({ dim: 'VERIFICATION_3P', pass: () => keep });
  }

  const demo = t.demographics;
  const expansion = li.optimizedTargeting ? 1 + p.targeting.optimizedExpansion : 1;
  let hasProfile = false;
  if (
    demo &&
    (demo.age?.length || demo.gender?.length || demo.parental?.length || demo.income?.length)
  ) {
    hasProfile = true;
    const share =
      allocShare(alloc.age, demo.age ? { include: demo.age } : undefined) *
      allocShare(alloc.gender, demo.gender ? { include: demo.gender } : undefined) *
      allocShare(alloc.parental, demo.parental ? { include: demo.parental } : undefined) *
      allocShare(alloc.income, demo.income ? { include: demo.income } : undefined);
    dims.push({
      dim: 'DEMOGRAPHICS',
      pass: (c) => clamp(share * c.identifiedShare * expansion, 0, 1),
    });
  }

  // Audience lists: OR inside a group, AND between include groups, minus exclusions (RC-030)
  let audienceKind: TargetingPlan['audienceKind'] = demo && hasProfile ? 'demographics' : 'none';
  let restrictedAudience = false;
  const groups = t.audiences?.includeGroups?.filter((g) => g.length > 0) ?? [];
  const excludes = t.audiences?.exclude ?? [];
  if (groups.length > 0 || excludes.length > 0) {
    hasProfile = true;
    const frac = (id: string) => {
      const a = ctx.audiences.get(id);
      if (!a) return 0;
      if (a.restricted) restrictedAudience = true;
      return audienceFraction(a, p, ctx.tick, poolScale);
    };
    let share = 1;
    let bestPremium = 0;
    for (const g of groups) {
      share *= union(g.map(frac));
      for (const id of g) {
        const a = ctx.audiences.get(id);
        const prem = a ? (p.multipliers.audiencePremium[a.type] ?? 1) : 0;
        if (a && prem > bestPremium) {
          bestPremium = prem;
          audienceKind = a.type;
        }
      }
    }
    if (excludes.length > 0) share *= 1 - union(excludes.map(frac));
    dims.push({ dim: 'AUDIENCE', pass: (c) => clamp(share * c.identifiedShare * expansion, 0, 1) });
  }

  return {
    dims,
    audienceKind,
    hasProfileTargeting: hasProfile,
    optimizedTargeting: li.optimizedTargeting,
    viewabilityMin: vmin,
    positionMix,
    restrictedAudience,
    verificationOptions: verification,
  };
}
