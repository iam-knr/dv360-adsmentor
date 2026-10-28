// Media cost per cell (engine.md 8.1). Computed in the computing currency by the auction and
// converted to the advertiser currency here.

import type { CellOutcome } from '../outcomes';
import type { Params } from '../params/schema';
import { toMicros } from './fx';

export interface MediaCost {
  /** Gross media cost and the refund for invalid impressions, advertiser currency (floats). */
  gross: number;
  refund: number;
  net: number;
}

export function mediaCostOf(co: CellOutcome, fxToAdv: number, params: Params): MediaCost {
  const gross = co.ca.media * fxToAdv;
  const W = co.imp.impressions;
  const refund =
    W > 0 ? (gross * Math.min(W, co.imp.invalid) * params.outcomes.ivtRefundShare) / W : 0;
  return { gross, refund, net: gross - refund };
}

export { toMicros };
