// Lift study maths (engine.md 6.8, module 17 4.3). Pure: requirement and survey simulation. Randomness is a hash
// based generator seeded per (sandbox seed, study, metric, slice) so a report is the same every time.
import type { BrandLiftMetric, LiftSlice, LiftStrength, LiftType } from '@prisma/client';
import {
  AGE_BANDS,
  BRAND_PARAM_KEY,
  BRAND_WINDOW_DAYS,
  ENHANCED_FACTOR,
  LS_MIN_SLICE_RESPONSES,
  SEARCH_BASE_INR,
  SEARCH_WINDOW_DAYS,
} from './constants';

export interface LiftParams {
  costPerResponse: number;
  baseline: Record<string, number>;
  maxRelLift: Record<string, number>;
}

/** Z of the one-sided alpha 0.05 (90% two-sided) and 80% power used by the power formula. */
const Z_ALPHA = 1.645;
const Z_BETA = 0.84;
/** Reach (users) at which the saturating effect is 1 - 1/e; reference reach of the study pool. */
export const R0 = 0.15;
export const REFERENCE_POOL = 1_500_000;

/** Responses per arm needed to detect an absolute lift `d` from baseline `p` (engine 6.8). */
export function nPerArm(p: number, d: number): number {
  return Math.ceil((2 * p * (1 - p) * (Z_ALPHA + Z_BETA) ** 2) / (d * d));
}

/** Required media cost in INR: standard 2% lift at the awareness baseline, rounded up to 10,000 (about 470,000). */
export function brandRequirementInr(params: LiftParams): number {
  const p = params.baseline.awareness ?? 0.3;
  const n = nPerArm(p, 0.02);
  return Math.ceil((2 * n * params.costPerResponse) / 10_000) * 10_000;
}

export const strengthFactor = (s: LiftStrength): number => (s === 'ENHANCED' ? ENHANCED_FACTOR : 1);

/** Single source for the validation constant and the eligibility endpoint (Δ17-15). `fx` converts INR to the currency. */
export function liftRequirement(
  type: LiftType,
  strength: LiftStrength,
  params: LiftParams,
  inrTo: number,
): number {
  const base = type === 'BRAND_LIFT' ? brandRequirementInr(params) : SEARCH_BASE_INR;
  return Math.round(base * strengthFactor(strength) * inrTo * 100) / 100;
}

export const windowDays = (type: LiftType): number =>
  type === 'BRAND_LIFT' ? BRAND_WINDOW_DAYS : SEARCH_WINDOW_DAYS;

export const pctComplete = (soFar: number, required: number): number =>
  required > 0 ? Math.min(100, Math.floor((soFar / required) * 100)) : 0;

// ---------------------------------------------------------------------------------------------
// Deterministic randomness
// ---------------------------------------------------------------------------------------------

export function hash32(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Standard normal draws from a seeded mulberry32 and Box-Muller. */
export function normalDraw(seed: string): number {
  let a = hash32(seed) || 1;
  const next = () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const u1 = Math.max(next(), 1e-12);
  const u2 = next();
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}

/** Binomial(n, p) by the normal approximation with a seeded draw, clamped to 0..n. */
export function binomialDraw(n: number, p: number, seed: string): number {
  if (n <= 0) return 0;
  const mean = n * p;
  const sd = Math.sqrt(n * p * (1 - p));
  return Math.max(0, Math.min(n, Math.round(mean + sd * normalDraw(seed))));
}

// ---------------------------------------------------------------------------------------------
// Survey simulation
// ---------------------------------------------------------------------------------------------

export const freqShape = (f: number): number =>
  f <= 3 ? Math.max(0, Math.min(1, f / 3)) : Math.max(0.2, 1 - 0.04 * (f - 3));

export interface Exposure {
  /** Viewable reach of the study entities, users. */
  reach: number;
  avgFrequency: number;
  /** Viewability, 0..1, as the quality multiplier. */
  quality: number;
}

export function relLift(metric: BrandLiftMetric, params: LiftParams, exp: Exposure): number {
  const key = BRAND_PARAM_KEY[metric];
  const max = params.maxRelLift[key] ?? 0.1;
  const effReach = Math.max(0, exp.reach) / REFERENCE_POOL;
  return max * (1 - Math.exp(-effReach / R0)) * Math.max(0.5, Math.min(1.2, exp.quality)) * freqShape(exp.avgFrequency);
}

export interface SurveyResult {
  responses: number;
  baselineRate: number;
  exposedRate: number;
  absoluteLift: number;
  relativeLift: number;
  headroomLift: number;
  /** Interval of the absolute lift. */
  ci: [number, number];
  significant: boolean;
}

/** One metric in one slice: `n` responses per arm (exposed and control), the slice's own lift multiplier. */
export function simulateSurvey(args: {
  metric: BrandLiftMetric;
  params: LiftParams;
  exposure: Exposure;
  responsesPerArm: number;
  sliceMult: number;
  seed: string;
}): SurveyResult {
  const key = BRAND_PARAM_KEY[args.metric];
  const base = args.params.baseline[key] ?? 0.2;
  const n = Math.max(0, Math.floor(args.responsesPerArm));
  const trueExposed = Math.min(0.99, base * (1 + relLift(args.metric, args.params, args.exposure) * args.sliceMult));
  const kE = binomialDraw(n, trueExposed, `${args.seed}|exposed`);
  const kC = binomialDraw(n, base, `${args.seed}|control`);
  const pE = n > 0 ? kE / n : base;
  const pC = n > 0 ? kC / n : base;
  const abs = pE - pC;
  const se = n > 0 ? Math.sqrt((pE * (1 - pE)) / n + (pC * (1 - pC)) / n) : 0;
  const half = Z_ALPHA * se;
  return {
    responses: n * 2,
    baselineRate: pC,
    exposedRate: pE,
    absoluteLift: abs,
    relativeLift: pC > 0 ? abs / pC : 0,
    headroomLift: pC < 1 ? abs / (1 - pC) : 0,
    ci: [abs - half, abs + half],
    significant: n > 0 && (abs - half > 0 || abs + half < 0),
  };
}

export type LiftMeasureKey = 'ABSOLUTE' | 'RELATIVE' | 'HEADROOM';

/** Value and interval of the chosen measure: the absolute interval scaled by the same factor as the point estimate. */
export function measureOf(r: Pick<SurveyResult, 'absoluteLift' | 'relativeLift' | 'headroomLift' | 'ci' | 'baselineRate'>, m: LiftMeasureKey): { value: number; ci: [number, number] } {
  const scale = m === 'ABSOLUTE' ? 1 : m === 'RELATIVE' ? (r.baselineRate > 0 ? 1 / r.baselineRate : 0) : r.baselineRate < 1 ? 1 / (1 - r.baselineRate) : 0;
  const value = m === 'ABSOLUTE' ? r.absoluteLift : m === 'RELATIVE' ? r.relativeLift : r.headroomLift;
  return { value, ci: [r.ci[0] * scale, r.ci[1] * scale] };
}

export const enoughResponses = (n: number): boolean => n >= LS_MIN_SLICE_RESPONSES;

/** Slice catalogue: value, share of responses and lift multiplier (`sliceLiftMult`, engine 6.8). */
export interface SliceDef {
  value: string;
  share: number;
  mult: number;
}

export function fixedSlices(slice: LiftSlice): SliceDef[] | null {
  switch (slice) {
    case 'OVERALL':
      return [{ value: 'Overall', share: 1, mult: 1 }];
    case 'AGE': {
      const shares = [0.18, 0.27, 0.22, 0.15, 0.1, 0.08];
      const mult = [1.15, 1.05, 1, 0.95, 0.9, 0.85];
      return AGE_BANDS.map((value, i) => ({ value, share: shares[i] as number, mult: mult[i] as number }));
    }
    case 'GENDER':
      return [
        { value: 'Female', share: 0.48, mult: 1.02 },
        { value: 'Male', share: 0.46, mult: 0.98 },
        { value: 'Unknown', share: 0.06, mult: 1 },
      ];
    case 'DEVICE':
      return [
        { value: 'Computer', share: 0.2, mult: 0.95 },
        { value: 'Smartphone', share: 0.62, mult: 1.05 },
        { value: 'Tablet', share: 0.06, mult: 0.9 },
        { value: 'Connected TV', share: 0.12, mult: 1.2 },
      ];
    case 'PUBLISHER_DOMAIN':
      return [
        { value: 'news.example.com', share: 0.34, mult: 1 },
        { value: 'sports.example.com', share: 0.26, mult: 1.1 },
        { value: 'video.example.com', share: 0.24, mult: 1.05 },
        { value: 'lifestyle.example.com', share: 0.16, mult: 0.9 },
      ];
    case 'PUBLISHER_VERTICAL':
      return [
        { value: 'News', share: 0.3, mult: 1 },
        { value: 'Sports', share: 0.25, mult: 1.1 },
        { value: 'Entertainment', share: 0.28, mult: 1.05 },
        { value: 'Lifestyle', share: 0.17, mult: 0.9 },
      ];
    default:
      return null;
  }
}

/** Slices offered on the report tabs (S8). */
export const SLICES_YT_DG: LiftSlice[] = ['OVERALL', 'AGE', 'GENDER', 'INSERTION_ORDER', 'LINE_ITEM', 'DEVICE', 'YOUTUBE_AD_VIDEO'];
export const SLICES_CROSS: LiftSlice[] = ['OVERALL', 'AGE', 'GENDER', 'INSERTION_ORDER', 'LINE_ITEM', 'DEVICE', 'CREATIVE', 'PUBLISHER_DOMAIN', 'PUBLISHER_VERTICAL'];

/** Search lift: `0.5 * brand relLift` per term group, drawn once with noise. */
export function searchUplift(brandRel: number, groupIndex: number, seed: string): { relUplift: number; significant: boolean } {
  const noise = normalDraw(`${seed}|search|${groupIndex}`) * 0.015;
  const rel = Math.max(0, 0.5 * brandRel + noise);
  return { relUplift: rel, significant: rel > 0.02 };
}
