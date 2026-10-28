// Revenue models and profit (engine.md 8.5 and 8.6).

import type { FeeSchedule } from '../economics';
import { roundHalfEven } from '../math';
import type { CellOutcome } from '../outcomes';
import type { Params } from '../params/schema';
import { feesOf } from './fees';
import { mediaCostOf, toMicros } from './media';

export interface CellMoney {
  mediaCost: number;
  refund: number;
  cpmFee1: number;
  cpmFee2: number;
  mediaFee1: number;
  mediaFee2: number;
  dataCost: number;
  verificationCost: number;
  adServingCost: number;
  totalMediaCost: number;
  revenue: number;
  profit: number;
  clientCost: number;
}

export const ZERO_MONEY: CellMoney = {
  mediaCost: 0,
  refund: 0,
  cpmFee1: 0,
  cpmFee2: 0,
  mediaFee1: 0,
  mediaFee2: 0,
  dataCost: 0,
  verificationCost: 0,
  adServingCost: 0,
  totalMediaCost: 0,
  revenue: 0,
  profit: 0,
  clientCost: 0,
};

/** Money of one cell as integer micros of the advertiser currency. */
export function computeCellMoney(
  co: CellOutcome,
  s: FeeSchedule,
  fxToAdv: number,
  params: Params,
): CellMoney {
  const media = mediaCostOf(co, fxToAdv, params);
  const fees = feesOf(co, media, s);
  const mediaCost = toMicros(media.gross);
  const refund = toMicros(media.refund);
  const mediaNet = mediaCost - refund;
  const totalMediaCost = mediaNet + fees.all;
  let revenue: number;
  const m = s.revenue.markup;
  switch (s.revenue.type) {
    case 'TOTAL_MEDIA_COST_MARKUP':
      revenue = roundHalfEven((mediaNet + fees.invoiced) * (1 + m));
      break;
    case 'MEDIA_COST_MARKUP':
      revenue = roundHalfEven(mediaNet * (1 + m)) + fees.invoiced;
      break;
    case 'CPM_VALUE':
      revenue = toMicros((co.imp.billable / 1000) * s.revenue.cpm);
      break;
  }
  return {
    mediaCost,
    refund,
    cpmFee1: fees.cpmFee1,
    cpmFee2: fees.cpmFee2,
    mediaFee1: fees.mediaFee1,
    mediaFee2: fees.mediaFee2,
    dataCost: fees.dataCost,
    verificationCost: fees.verificationCost,
    adServingCost: fees.adServingCost,
    totalMediaCost,
    revenue,
    profit: revenue - totalMediaCost,
    clientCost: revenue,
  };
}
