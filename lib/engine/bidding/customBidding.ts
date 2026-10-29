// Custom bidding score model and Test step sampler (engine.md 4.3, module 15 4.3, Δ15-14). Pure: no I/O, no clock.
// An algorithm scores an impression as `Σ matched rule scores × Π multipliers`. A rule matches when the impression
// carries the signal with the rule's value; multipliers look up one attribute of the impression. Scripts are out of
// scope in v1 (RC-037), so there is no evaluator beyond this.
import { rng } from '../rng/streams';

export type CbFormat = 'DISPLAY' | 'VIDEO' | 'AUDIO';

export type CbObjectiveKey = 'BRAND_AWARENESS' | 'CLICKS' | 'CONVERSIONS' | 'CUSTOM';

export type CbMultiplierKindKey =
  | 'AD_POSITION'
  | 'CREATIVE_DIMENSION'
  | 'DAY_AND_TIME'
  | 'DEVICE_TYPE'
  | 'GENRE'
  | 'DELIVERY_TYPE'
  | 'DURATION';

export interface CbOption {
  key: string;
  label: string;
}

/** Test step sample size (module 15 4.3). */
export const TEST_SAMPLE_SIZE = 2000;
/** `passed` needs at least this share of the sample matched by one rule. */
export const MIN_MATCHED_PCT = 2;
export const HISTOGRAM_BINS = 20;
export const MULTIPLIER_MIN = 0.1;
export const MULTIPLIER_MAX = 10;
export const MAX_MULTIPLIERS = 4;
/** Extra error share when a multiplier signal is not available for a format (engine 4.3). */
export const UNAVAILABLE_SIGNAL_ERROR_PCT = 20;

// ---------------------------------------------------------------------------------------------
// Catalogue
// ---------------------------------------------------------------------------------------------

export interface CbSignal {
  key: string;
  label: string;
  /** Formats whose impressions can carry the signal. */
  formats: readonly CbFormat[];
}

export interface CbRuleGroup {
  groupKey: string;
  signals: readonly CbSignal[];
}

const ALL: readonly CbFormat[] = ['DISPLAY', 'VIDEO', 'AUDIO'];

const VIEWABILITY: CbRuleGroup = {
  groupKey: 'Viewability rules',
  signals: [
    { key: 'VIEWABLE', label: 'Viewable', formats: ['DISPLAY', 'VIDEO'] },
    {
      key: 'TIME_ON_SCREEN_10S',
      label: 'Time on screen 10 seconds',
      formats: ['DISPLAY', 'VIDEO'],
    },
  ],
};
const VIDEO_RULES: CbRuleGroup = {
  groupKey: 'Video rules',
  signals: [
    {
      key: 'AUDIBLE_AND_VIEWABLE_AT_COMPLETION',
      label: 'Audible and viewable at completion',
      formats: ['VIDEO'],
    },
    { key: 'VIDEO_COMPLETED', label: 'Video completed', formats: ['VIDEO', 'AUDIO'] },
  ],
};
const CLICK_RULES: CbRuleGroup = {
  groupKey: 'Click rules',
  signals: [{ key: 'CLICKED', label: 'Clicked', formats: ALL }],
};
const CONVERSION_RULES: CbRuleGroup = {
  groupKey: 'Conversion rules',
  signals: [
    { key: 'CONVERTED_POST_CLICK', label: 'Converted post click', formats: ALL },
    { key: 'CONVERTED_POST_VIEW', label: 'Converted post view', formats: ALL },
  ],
};

/** Rule groups per objective (module 15 4.3); `CUSTOM` offers every group. */
export const RULE_GROUPS: Record<CbObjectiveKey, readonly CbRuleGroup[]> = {
  BRAND_AWARENESS: [VIEWABILITY, VIDEO_RULES],
  CLICKS: [CLICK_RULES],
  CONVERSIONS: [CONVERSION_RULES],
  CUSTOM: [VIEWABILITY, VIDEO_RULES, CLICK_RULES, CONVERSION_RULES],
};

export const ACTIVITY_SIGNAL_PREFIX = 'ACTIVITY:';
export const ACTIVITY_GROUP_KEY = 'Conversion rules';

export const OBJECTIVES: readonly { key: CbObjectiveKey; label: string; description: string }[] = [
  { key: 'BRAND_AWARENESS', label: 'Brand awareness', description: 'Viewability and video rules' },
  { key: 'CLICKS', label: 'Clicks', description: 'Click rules' },
  { key: 'CONVERSIONS', label: 'Conversions', description: 'Conversion rules' },
  { key: 'CUSTOM', label: 'Custom', description: 'Any combination of rules' },
];

const SIZES = ['300x250', '728x90', '160x600', '320x50', '300x600', '970x250', '336x280', '468x60'];
const GENRES = [
  'Action',
  'Comedy',
  'Drama',
  'News',
  'Sports',
  'Music',
  'Documentary',
  'Kids',
  'Reality',
  'Lifestyle',
  'Gaming',
  'Education',
];
const PARTS = [
  ['MORNING', 'Morning'],
  ['AFTERNOON', 'Afternoon'],
  ['EVENING', 'Evening'],
  ['NIGHT', 'Night'],
] as const;

export interface CbMultiplierDef {
  kind: CbMultiplierKindKey;
  label: string;
  /** Formats where the attribute exists; elsewhere the multiplier is unavailable (soft warning). */
  formats: readonly CbFormat[];
  options: readonly CbOption[];
}

export const MULTIPLIER_DEFS: readonly CbMultiplierDef[] = [
  {
    kind: 'AD_POSITION',
    label: 'Ad position',
    formats: ['DISPLAY', 'VIDEO'],
    options: [
      { key: 'ABOVE_FOLD', label: 'Above the fold' },
      { key: 'BELOW_FOLD', label: 'Below the fold' },
      { key: 'UNKNOWN', label: 'Unknown' },
    ],
  },
  {
    kind: 'CREATIVE_DIMENSION',
    label: 'Creative dimension',
    formats: ['DISPLAY'],
    options: SIZES.map((s) => ({ key: s, label: s })),
  },
  {
    kind: 'DAY_AND_TIME',
    label: 'Day and time',
    formats: ALL,
    options: [
      ...PARTS.map(([k, l]) => ({ key: `WEEKDAY_${k}`, label: `Weekday ${l.toLowerCase()}` })),
      ...PARTS.map(([k, l]) => ({ key: `WEEKEND_${k}`, label: `Weekend ${l.toLowerCase()}` })),
    ],
  },
  {
    kind: 'DEVICE_TYPE',
    label: 'Device type',
    formats: ALL,
    options: [
      { key: 'COMPUTER', label: 'Computer' },
      { key: 'SMARTPHONE', label: 'Smartphone' },
      { key: 'TABLET', label: 'Tablet' },
      { key: 'CONNECTED_TV', label: 'Connected TV' },
    ],
  },
  {
    kind: 'GENRE',
    label: 'Genre',
    formats: ['VIDEO', 'AUDIO'],
    options: GENRES.map((g) => ({ key: g.toUpperCase(), label: g })),
  },
  {
    kind: 'DELIVERY_TYPE',
    label: 'Delivery type',
    formats: ALL,
    options: [
      { key: 'OPEN_AUCTION', label: 'Open auction' },
      { key: 'DEAL', label: 'Deal' },
      { key: 'PROGRAMMATIC_GUARANTEED', label: 'Programmatic guaranteed' },
    ],
  },
  {
    kind: 'DURATION',
    label: 'Duration',
    formats: ['VIDEO', 'AUDIO'],
    options: [
      { key: 'UP_TO_15', label: '15 seconds or less' },
      { key: 'FROM_16_TO_30', label: '16 to 30 seconds' },
      { key: 'FROM_31_TO_60', label: '31 to 60 seconds' },
      { key: 'OVER_60', label: 'More than 60 seconds' },
    ],
  },
];

export const MULTIPLIER_KINDS: readonly CbMultiplierKindKey[] = MULTIPLIER_DEFS.map((d) => d.kind);

export function multiplierDef(kind: CbMultiplierKindKey): CbMultiplierDef {
  return MULTIPLIER_DEFS.find((d) => d.kind === kind)!;
}

export function isMultiplierKind(v: string): v is CbMultiplierKindKey {
  return (MULTIPLIER_KINDS as readonly string[]).includes(v);
}

/** The signal definition for a key, or null for an unknown one. Activity signals are open ended. */
export function signalOf(signalKey: string): CbSignal | null {
  if (signalKey.startsWith(ACTIVITY_SIGNAL_PREFIX)) {
    return { key: signalKey, label: 'Floodlight activity', formats: ALL };
  }
  for (const groups of Object.values(RULE_GROUPS)) {
    for (const g of groups) {
      const s = g.signals.find((x) => x.key === signalKey);
      if (s) return s;
    }
  }
  return null;
}

/** Whether a rule signal belongs to the objective's groups. */
export function signalAllowed(objective: CbObjectiveKey, signalKey: string): boolean {
  if (signalKey.startsWith(ACTIVITY_SIGNAL_PREFIX)) {
    return objective === 'CONVERSIONS' || objective === 'CUSTOM';
  }
  return RULE_GROUPS[objective].some((g) => g.signals.some((s) => s.key === signalKey));
}

// ---------------------------------------------------------------------------------------------
// Model
// ---------------------------------------------------------------------------------------------

export interface CbRuleDef {
  groupKey: string;
  signalKey: string;
  /** `true`/`false` for the boolean signals. */
  value: boolean;
  score: number;
}

export interface CbMultiplierSpec {
  kind: CbMultiplierKindKey;
  values: readonly { valueKey: string; multiplier: number }[];
}

export interface CbModel {
  rules: readonly CbRuleDef[];
  multipliers: readonly CbMultiplierSpec[];
}

export interface SampleImpression {
  format: CbFormat;
  /** Boolean signals by key. */
  signals: Readonly<Record<string, boolean>>;
  /** Multiplier attribute value keys by kind. */
  attrs: Partial<Record<CbMultiplierKindKey, string>>;
}

/** What the sampler needs to know about an advertiser's current supply (`world` in the engine API). */
export interface SampleMix {
  /** Relative weight of each format across the advertiser's active line items. */
  formatWeights: Readonly<Record<CbFormat, number>>;
  /** Floodlight activity ids of the advertiser, for `ACTIVITY:{id}` signals. */
  activityIds: readonly string[];
}

export const DEFAULT_MIX: SampleMix = {
  formatWeights: { DISPLAY: 0.6, VIDEO: 0.3, AUDIO: 0.1 },
  activityIds: [],
};

/** Score of one impression: Σ matched rule scores × Π multipliers; 0 when no rule matches. */
export function scoreImpression(model: CbModel, imp: SampleImpression): number {
  let base = 0;
  for (const r of model.rules) {
    const sig = signalOf(r.signalKey);
    const present = imp.signals[r.signalKey];
    if (!sig || present === undefined) continue; // the signal does not exist for this format
    if (present === r.value) base += r.score;
  }
  if (base === 0) return 0;
  let factor = 1;
  for (const m of model.multipliers) {
    const attr = imp.attrs[m.kind];
    if (attr === undefined) continue;
    const hit = m.values.find((v) => v.valueKey === attr);
    if (hit) factor *= hit.multiplier;
  }
  return base * factor;
}

// ---------------------------------------------------------------------------------------------
// Sampler
// ---------------------------------------------------------------------------------------------

function pick<T>(r: ReturnType<typeof rng>, items: readonly T[], weights?: readonly number[]): T {
  if (!weights) return items[Math.min(items.length - 1, Math.floor(r.next() * items.length))]!;
  const total = weights.reduce((s, w) => s + w, 0);
  let x = r.next() * total;
  for (let i = 0; i < items.length; i += 1) {
    x -= weights[i]!;
    if (x <= 0) return items[i]!;
  }
  return items[items.length - 1]!;
}

/**
 * `engine.sampleImpressions(world, algorithmId, n)` (Δ15-14): n synthetic impressions drawn from the advertiser's
 * supply mix. Same inputs give the same sample (own stream per impression index).
 */
export function sampleImpressions(mix: SampleMix, n: number, seed: string): SampleImpression[] {
  const formats: CbFormat[] = ['DISPLAY', 'VIDEO', 'AUDIO'];
  const weights = formats.map((f) => Math.max(0, mix.formatWeights[f]));
  const usable = weights.some((w) => w > 0) ? weights : [1, 0, 0];
  const out: SampleImpression[] = [];
  for (let i = 0; i < n; i += 1) {
    const r = rng(seed, 'cb-sample', i);
    const format = pick(r, formats, usable);
    const signals: Record<string, boolean> = {};
    const flag = (key: string, p: number) => {
      signals[key] = r.next() < p;
    };
    if (format !== 'AUDIO') {
      flag('VIEWABLE', format === 'VIDEO' ? 0.62 : 0.55);
      flag('TIME_ON_SCREEN_10S', signals.VIEWABLE ? 0.35 : 0.04);
    }
    if (format !== 'DISPLAY') flag('VIDEO_COMPLETED', format === 'VIDEO' ? 0.4 : 0.55);
    if (format === 'VIDEO') {
      flag('AUDIBLE_AND_VIEWABLE_AT_COMPLETION', signals.VIDEO_COMPLETED ? 0.5 : 0);
    }
    flag('CLICKED', format === 'DISPLAY' ? 0.006 : format === 'VIDEO' ? 0.012 : 0.003);
    const click = signals.CLICKED === true;
    flag('CONVERTED_POST_CLICK', click ? 0.08 : 0);
    flag('CONVERTED_POST_VIEW', signals.VIEWABLE ? 0.002 : 0.0004);
    for (const id of mix.activityIds) {
      signals[`${ACTIVITY_SIGNAL_PREFIX}${id}`] =
        signals.CONVERTED_POST_CLICK === true || signals.CONVERTED_POST_VIEW === true
          ? r.next() < 0.6
          : false;
    }
    const attrs: SampleImpression['attrs'] = {};
    for (const def of MULTIPLIER_DEFS) {
      if (!def.formats.includes(format)) continue;
      attrs[def.kind] = pick(
        r,
        def.options.map((o) => o.key),
      );
    }
    if (attrs.DEVICE_TYPE !== undefined) {
      attrs.DEVICE_TYPE = pick(
        r,
        ['COMPUTER', 'SMARTPHONE', 'TABLET', 'CONNECTED_TV'],
        format === 'DISPLAY' ? [0.35, 0.55, 0.1, 0] : [0.3, 0.4, 0.1, 0.2],
      );
    }
    if (attrs.DELIVERY_TYPE !== undefined) {
      attrs.DELIVERY_TYPE = pick(
        r,
        ['OPEN_AUCTION', 'DEAL', 'PROGRAMMATIC_GUARANTEED'],
        [0.75, 0.2, 0.05],
      );
    }
    out.push({ format, signals, attrs });
  }
  return out;
}

// ---------------------------------------------------------------------------------------------
// Test step
// ---------------------------------------------------------------------------------------------

export interface CbTestResult {
  sampleSize: number;
  matchedPct: number;
  /** Counts of scored impressions per bin over `[0, maxScore]`. */
  histogram: number[];
  histogramMax: number;
  meanScore: number;
  p90Score: number;
  warnings: { kind: 'HARD' | 'SOFT'; message: string }[];
  passed: boolean;
}

/** Formats present in the mix (weight above zero). */
export function mixFormats(mix: SampleMix): CbFormat[] {
  return (['DISPLAY', 'VIDEO', 'AUDIO'] as const).filter((f) => mix.formatWeights[f] > 0);
}

/** Deterministic dry run of an algorithm against a sample (module 15 4.3). */
export function runTest(
  model: CbModel,
  mix: SampleMix,
  seed: string,
  n: number = TEST_SAMPLE_SIZE,
): CbTestResult {
  const sample = sampleImpressions(mix, n, seed);
  const scores = sample.map((s) => scoreImpression(model, s));
  const matched = scores.filter((s) => s > 0);
  const matchedPct = n === 0 ? 0 : Math.round((matched.length / n) * 1000) / 10;
  const max = matched.length ? Math.max(...matched) : 1;
  const histogram = new Array<number>(HISTOGRAM_BINS).fill(0);
  for (const s of matched) {
    histogram[Math.min(HISTOGRAM_BINS - 1, Math.floor((s / max) * HISTOGRAM_BINS))]! += 1;
  }
  const sorted = [...scores].sort((a, b) => a - b);
  const p90 = n === 0 ? 0 : sorted[Math.min(n - 1, Math.floor(n * 0.9))]!;
  const meanScore = n === 0 ? 0 : scores.reduce((s, x) => s + x, 0) / n;

  const warnings: CbTestResult['warnings'] = [];
  const formats = mixFormats(mix);
  if (matched.length === 0) {
    warnings.push({ kind: 'HARD', message: 'No rule matches any impression in the sample.' });
  }
  for (const m of model.multipliers) {
    const def = multiplierDef(m.kind);
    const available = formats.filter((f) => def.formats.includes(f));
    if (available.length === 0) {
      warnings.push({
        kind: 'HARD',
        message: `The ${def.label} multiplier isn't available for any of your line item formats.`,
      });
    } else if (available.length < formats.length) {
      const missing = formats.filter((f) => !def.formats.includes(f));
      warnings.push({
        kind: 'SOFT',
        message: `The ${def.label} multiplier isn't available for ${missing
          .map((f) => f.toLowerCase())
          .join(' and ')}.`,
      });
    }
  }
  const passed = matchedPct >= MIN_MATCHED_PCT && !warnings.some((w) => w.kind === 'HARD');
  return {
    sampleSize: n,
    matchedPct,
    histogram,
    histogramMax: Math.round(max * 1000) / 1000,
    meanScore: Math.round(meanScore * 1000) / 1000,
    p90Score: Math.round(p90 * 1000) / 1000,
    warnings,
    passed,
  };
}

/** Share of impressions where a rule could not be evaluated: base 0.5 % plus 20 % per unavailable signal (engine 4.3). */
export function errorPctFor(model: CbModel, mix: SampleMix, base: number): number {
  const formats = mixFormats(mix);
  const unavailable = model.multipliers.some((m) => {
    const def = multiplierDef(m.kind);
    return formats.some((f) => !def.formats.includes(f));
  });
  return (
    Math.round(base * (unavailable ? 1 + UNAVAILABLE_SIGNAL_ERROR_PCT / 100 : 1) * 1000) / 1000
  );
}
