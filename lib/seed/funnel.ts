// Funnel defaults per format and story overrides (engine.md 3.1 to 3.4). Numbers are invented but plausible:
// healthy win rate W/R is 0.30 (calibration band 0.12 to 0.45), W/A about 7 percent.
import type { Format, FunnelPasses, ReasonWeights } from './types';

const TARGETING_PASS: Record<Format, number> = {
  display: 0.35,
  native: 0.3,
  video_instream: 0.3,
  ctv: 0.22,
  audio: 0.4,
  dooh: 0.45,
};

export function healthyPasses(format: Format): FunnelPasses {
  return {
    targeting: TARGETING_PASS[format],
    creative: 0.94,
    frequency: 0.97,
    pacing: 0.95,
    belowMinBid: 0.88,
    internal: 0.92,
    extBid: 0.55,
    extCreative: 0.02,
    extOther: 0.05,
    extNotReported: 0.08,
  };
}

/** Product of the pass fractions that sit between available requests and impressions, with budget pass 1. */
export function passProduct(p: FunnelPasses): number {
  const survive = 1 - (p.extBid + p.extCreative + p.extOther + p.extNotReported);
  return p.targeting * p.creative * p.frequency * p.pacing * p.belowMinBid * p.internal * survive;
}

export function defaultReasons(): ReasonWeights {
  return {
    targeting: [
      ['T.INVENTORY_SOURCE', 0.22],
      ['T.ENVIRONMENT', 0.1],
      ['T.DEVICE_TYPE', 0.12],
      ['T.GEO', 0.3],
      ['T.LANGUAGE', 0.06],
      ['T.DAYPART', 0.08],
      ['T.BROWSER', 0.04],
      ['T.CONTENT_CATEGORY', 0.08],
    ],
    creative: [
      ['C.NOT_APPROVED_EXCHANGE:PENDING', 0.1],
      ['C.SIZE_MISMATCH', 0.55],
      ['C.FORMAT_MISMATCH', 0.15],
      ['C.ENV_REQUIREMENT', 0.2],
    ],
    frequency: [
      ['F.LINE_ITEM', 0.7],
      ['F.INSERTION_ORDER', 0.2],
      ['F.CAMPAIGN', 0.1],
    ],
    budget: [
      ['B.IO_SEGMENT', 0.6],
      ['B.LINE_ITEM_DAILY', 0.4],
    ],
    pacing: [
      ['P.LINE_ITEM_PACING', 0.5],
      ['P.IO_PACING', 0.5],
    ],
  };
}

export const NARROW_TARGETING_REASONS: ReasonWeights['targeting'] = [
  ['T.GEO', 0.62],
  ['T.AUDIENCE', 0.33],
  ['T.LANGUAGE', 0.05],
];

export const SIZE_MISMATCH_REASONS: ReasonWeights['creative'] = [['C.SIZE_MISMATCH', 1]];
export const NO_CREATIVE_REASONS: ReasonWeights['creative'] = [['C.NONE_ASSIGNED', 1]];
export const DISAPPROVED_REASONS: ReasonWeights['creative'] = [
  ['C.NOT_APPROVED_EXCHANGE:DISAPPROVED', 1],
];
export const TIGHT_FREQUENCY_REASONS: ReasonWeights['frequency'] = [['F.LINE_ITEM', 1]];
export const EXHAUSTED_BUDGET_REASONS: ReasonWeights['budget'] = [['B.LINE_ITEM_BUDGET', 1]];
