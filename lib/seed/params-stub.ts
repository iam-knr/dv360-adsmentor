// Constants copied from engine.md 2.7 (engine/params.json) for the closed-form history stub.
// The engine is not imported on purpose (build-plan P3-05b item 3); P3-INT replaces the stub with engine.fastForward.
import type { Format } from './types';

export interface FormatParams {
  /** Median clearing price, INR per 1,000 impressions. */
  clearCpm: number;
  ctr: number;
  measurable: number;
  viewable: number;
  cvrClick: number;
  cvrView: number;
  engagementRate: number;
  startRate: number;
  quartiles: readonly [number, number, number, number];
  skippableViewRate: number;
}

export const FORMAT_PARAMS: Record<Format, FormatParams> = {
  display: {
    clearCpm: 65,
    ctr: 0.0014,
    measurable: 0.88,
    viewable: 0.52,
    cvrClick: 0.02,
    cvrView: 0.0001,
    engagementRate: 0.004,
    startRate: 0,
    quartiles: [0, 0, 0, 0],
    skippableViewRate: 0,
  },
  native: {
    clearCpm: 110,
    ctr: 0.004,
    measurable: 0.85,
    viewable: 0.62,
    cvrClick: 0.024,
    cvrView: 0.00012,
    engagementRate: 0,
    startRate: 0,
    quartiles: [0, 0, 0, 0],
    skippableViewRate: 0,
  },
  video_instream: {
    clearCpm: 260,
    ctr: 0.003,
    measurable: 0.97,
    viewable: 0.7,
    cvrClick: 0.018,
    cvrView: 0.0002,
    engagementRate: 0,
    startRate: 0.94,
    quartiles: [0.82, 0.68, 0.62, 0.62],
    skippableViewRate: 0.28,
  },
  ctv: {
    clearCpm: 700,
    ctr: 0.0005,
    measurable: 0.99,
    viewable: 0.95,
    cvrClick: 0.01,
    cvrView: 0.00015,
    engagementRate: 0,
    startRate: 0.99,
    quartiles: [0.98, 0.97, 0.96, 0.95],
    skippableViewRate: 0,
  },
  audio: {
    clearCpm: 320,
    ctr: 0.001,
    measurable: 0.9,
    viewable: 0.88,
    cvrClick: 0.012,
    cvrView: 0.00008,
    engagementRate: 0,
    startRate: 0.97,
    quartiles: [0.95, 0.92, 0.9, 0.88],
    skippableViewRate: 0,
  },
  // Not in the engine spec (DOOH is out of the engine's formats): invented, same order of magnitude as CTV.
  dooh: {
    clearCpm: 420,
    ctr: 0,
    measurable: 0.9,
    viewable: 0.9,
    cvrClick: 0,
    cvrView: 0.00005,
    engagementRate: 0,
    startRate: 0,
    quartiles: [0, 0, 0, 0],
    skippableViewRate: 0,
  },
};

export const DEVICE_SHARE: Record<Format, readonly (readonly [string, number])[]> = {
  display: [
    ['COMPUTER', 0.28],
    ['SMARTPHONE', 0.66],
    ['TABLET', 0.06],
  ],
  native: [
    ['COMPUTER', 0.28],
    ['SMARTPHONE', 0.66],
    ['TABLET', 0.06],
  ],
  video_instream: [
    ['COMPUTER', 0.3],
    ['SMARTPHONE', 0.64],
    ['TABLET', 0.06],
  ],
  ctv: [['CONNECTED_TV', 1]],
  audio: [
    ['SMARTPHONE', 0.88],
    ['COMPUTER', 0.1],
    ['TABLET', 0.02],
  ],
  dooh: [],
};

export const DEVICE_MULTIPLIER: Record<string, { price: number; ctr: number; view: number }> = {
  COMPUTER: { price: 1, ctr: 0.85, view: 1 },
  SMARTPHONE: { price: 0.82, ctr: 1.1, view: 0.95 },
  TABLET: { price: 0.9, ctr: 0.95, view: 1 },
  CONNECTED_TV: { price: 1, ctr: 1, view: 1 },
  NONE: { price: 1, ctr: 1, view: 1 },
};

/** Engine class shares per format (exchangeShare in ENG 2.7). Class keys are mapped to exchange codes below. */
export const EXCHANGE_SHARE: Record<Format, readonly (readonly [string, number])[]> = {
  display: [
    ['google_ad_manager', 0.38],
    ['index_exchange', 0.1],
    ['pubmatic', 0.1],
    ['openx', 0.08],
    ['magnite', 0.08],
    ['equativ', 0.06],
    ['adform', 0.04],
    ['gumgum', 0.02],
    ['long_tail', 0.14],
  ],
  native: [
    ['triplelift', 0.35],
    ['google_ad_manager', 0.3],
    ['equativ', 0.15],
    ['long_tail', 0.2],
  ],
  video_instream: [
    ['google_ad_manager', 0.34],
    ['freewheel_ssp', 0.16],
    ['magnite', 0.14],
    ['index_exchange', 0.1],
    ['pubmatic', 0.08],
    ['long_tail', 0.18],
  ],
  ctv: [
    ['freewheel_ssp', 0.3],
    ['magnite_springserve', 0.28],
    ['google_ad_manager', 0.22],
    ['index_exchange', 0.1],
    ['long_tail', 0.1],
  ],
  audio: [
    ['adswizz', 0.42],
    ['spotify_ad_exchange', 0.3],
    ['google_ad_manager', 0.2],
    ['long_tail', 0.08],
  ],
  dooh: [['hivestack', 1]],
};

/** simClass (or invented class) to the Exchange.code of the row that stands for it in slices and reviews. */
export const CLASS_TO_EXCHANGE_CODE: Record<string, string> = {
  google_ad_manager: 'google-ad-manager',
  index_exchange: 'index-exchange',
  pubmatic: 'pubmatic',
  openx: 'openx',
  magnite: 'magnite-dv',
  magnite_springserve: 'magnite-springserve',
  equativ: 'equativ',
  adform: 'adform',
  gumgum: 'gumgum',
  triplelift: 'triplelift',
  freewheel_ssp: 'freewheel-ssp',
  adswizz: 'adswizz',
  spotify_ad_exchange: 'spotify-ad-exchange',
  hivestack: 'hivestack',
};

/** Representative exchange row for the long tail, per format. */
export const LONG_TAIL_EXCHANGE: Record<Format, string> = {
  display: 'sovrn',
  native: 'sharethrough',
  video_instream: 'spotx',
  ctv: 'smartstreamtv',
  audio: 'triton',
  dooh: 'hivestack',
};

export const EXCHANGE_PRICE_IDX: Record<string, number> = {
  'google-ad-manager': 1.08,
  'index-exchange': 1.0,
  pubmatic: 0.95,
  openx: 0.9,
};
export const DEFAULT_PRICE_IDX = 0.85;

export const EXCHANGE_IVT_RATE: Record<string, number> = {
  'google-ad-manager': 0.02,
  'index-exchange': 0.025,
  pubmatic: 0.03,
  openx: 0.035,
};
export const DEFAULT_IVT_RATE = 0.05;

/** hourOfDay curves, mean about 1 (ENG 2.7). */
export const HOUR_OF_DAY: Record<'default' | 'ctv' | 'audio', readonly number[]> = {
  default: [
    0.55, 0.42, 0.35, 0.32, 0.34, 0.45, 0.65, 0.85, 1.0, 1.05, 1.05, 1.05, 1.05, 1.0, 0.98, 0.98,
    1.0, 1.08, 1.2, 1.35, 1.5, 1.55, 1.4, 0.98,
  ],
  ctv: [
    0.5, 0.35, 0.28, 0.25, 0.25, 0.3, 0.45, 0.6, 0.7, 0.75, 0.8, 0.85, 0.95, 0.95, 0.9, 0.95, 1.1,
    1.45, 1.9, 2.2, 2.3, 2.1, 1.55, 0.9,
  ],
  audio: [
    0.3, 0.2, 0.18, 0.2, 0.35, 0.7, 1.3, 1.8, 1.9, 1.3, 1.1, 1.0, 1.0, 1.0, 1.0, 1.1, 1.4, 1.9, 1.8,
    1.2, 0.9, 0.7, 0.5, 0.35,
  ],
};

export function hourCurve(format: Format): readonly number[] {
  if (format === 'ctv') return HOUR_OF_DAY.ctv;
  if (format === 'audio') return HOUR_OF_DAY.audio;
  return HOUR_OF_DAY.default;
}

/** Day of week multiplier, index 0 = Sunday. */
export const DAY_OF_WEEK = [1.05, 0.98, 0.99, 1.0, 1.0, 1.0, 1.03] as const;

export const DV360_FEE_PCT = 0.1;
/** Verification CPM for DoubleVerify (dv_abs), INR per 1,000. */
export const DV_VERIFICATION_CPM_INR = 20.95;
/** Average order value for conversion revenue, INR. Invented. */
export const AVERAGE_ORDER_VALUE_INR = 1200;
export const FX_INR_PER_USD = 88;

/** INR to the advertiser currency (engine.md 2.7 fx block). */
export function inrTo(currency: string, fxPerUsd: Readonly<Record<string, number>>): number {
  const perUsd = fxPerUsd[currency] ?? FX_INR_PER_USD;
  return perUsd / FX_INR_PER_USD;
}

/** The exchanges that stand for a format in slices, creative reviews and the troubleshooter: top four by share, renormalised. */
export function formatExchanges(format: Format): { code: string; weight: number }[] {
  const merged = new Map<string, number>();
  for (const [cls, share] of EXCHANGE_SHARE[format]) {
    const code =
      cls === 'long_tail' ? LONG_TAIL_EXCHANGE[format] : (CLASS_TO_EXCHANGE_CODE[cls] ?? cls);
    merged.set(code, (merged.get(code) ?? 0) + share);
  }
  const top = [...merged.entries()]
    .map(([code, weight], order) => ({ code, weight, order }))
    .sort((a, b) => b.weight - a.weight || a.order - b.order)
    .slice(0, 4);
  const total = top.reduce((s, e) => s + e.weight, 0);
  return top.map((e) => ({ code: e.code, weight: e.weight / total }));
}

/** Average of exchange and device price multipliers for a format: the plan's expected clearing price factor. */
export function expectedPriceFactor(format: Format): number {
  const exchange = formatExchanges(format).reduce(
    (x, e) => x + e.weight * (EXCHANGE_PRICE_IDX[e.code] ?? DEFAULT_PRICE_IDX),
    0,
  );
  const devices = DEVICE_SHARE[format];
  const device =
    devices.length === 0
      ? 1
      : devices.reduce((x, [d, w]) => x + w * (DEVICE_MULTIPLIER[d]?.price ?? 1), 0);
  return exchange * device;
}
