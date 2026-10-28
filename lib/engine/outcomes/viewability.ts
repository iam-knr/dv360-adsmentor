// Impressions, invalid traffic and Active View (engine.md 6.1, 5.6).

import { formatOf, viewMeanOf, type RateCtx } from '../params/rates';
import type { Params } from '../params/schema';
import { betaMean, binomial } from '../rng/sample';
import type { Rng } from '../rng/xoshiro';
import type { CellAuction } from '../auction';

export interface ImpressionOutcome {
  impressions: number;
  invalid: number;
  billable: number;
  measurable: number;
  viewable: number;
  viewable10s: number;
  inactive: number;
  beginToRender: number;
}

export function simulateImpressions(
  ca: CellAuction,
  rate: RateCtx,
  params: Params,
  r: Rng,
): ImpressionOutcome {
  const cell = ca.elc.cell;
  const f = formatOf(params, cell.format);
  const W = ca.W;
  const ivt = cell.ivtRate * (1 - params.outcomes.ivtFraudVerifyCut * rate.fraudVerifiedShare);
  const invalid = binomial(r.fork('ivt'), W, ivt);
  const billable = W - Math.round(invalid * params.outcomes.ivtRefundShare);
  const measurable = binomial(r.fork('meas'), W - invalid, f.measurable);
  const pv = viewMeanOf(cell, rate);
  const p = betaMean(r.fork('beta'), pv, cell.predictedViewability.kappa);
  const viewable = binomial(r.fork('view'), measurable, p);
  const tos =
    cell.format === 'display' || cell.format === 'native'
      ? params.bidding.tos10Share.display
      : params.bidding.tos10Share.video;
  return {
    impressions: W,
    invalid,
    billable,
    measurable,
    viewable,
    viewable10s: binomial(r.fork('tos'), viewable, tos),
    inactive: measurable - viewable,
    beginToRender: Math.round(W * params.outcomes.beginToRenderRate),
  };
}
