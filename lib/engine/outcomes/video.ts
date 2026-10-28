// Video and audio quartiles, views, audibility (engine.md 6.3).

import {
  audibleRateOf,
  formatOf,
  startRateOf,
  viewEventRateOf,
  type RateCtx,
} from '../params/rates';
import type { Params } from '../params/schema';
import { binomial } from '../rng/sample';
import type { Rng } from '../rng/xoshiro';
import type { CellAuction } from '../auction';

export interface VideoOutcome {
  starts: number;
  q1: number;
  mid: number;
  q3: number;
  complete: number;
  skips: number;
  views: number;
  audible: number;
  coViewed: number;
  watchSeconds: number;
}

export const ZERO_VIDEO: VideoOutcome = {
  starts: 0,
  q1: 0,
  mid: 0,
  q3: 0,
  complete: 0,
  skips: 0,
  views: 0,
  audible: 0,
  coViewed: 0,
  watchSeconds: 0,
};

const DURATION_SECONDS = 30;

export function simulateVideo(
  ca: CellAuction,
  billable: number,
  viewable: number,
  rate: RateCtx,
  params: Params,
  r: Rng,
): VideoOutcome {
  const cell = ca.elc.cell;
  const f = formatOf(params, cell.format);
  const startRate = startRateOf(params, cell);
  if (!startRate || !f.quartiles) return ZERO_VIDEO;
  const quality = ca.elc.quality;
  const scale =
    Math.pow(quality, 0.5) *
    (cell.device === 'smartphone' ? params.outcomes.quartileSmartphoneScale : 1);
  const clip = (x: number, hi: number) => Math.min(hi, Math.max(0, x));
  const p1 = clip(f.quartiles.q1 * scale, 1);
  const p2 = clip(f.quartiles.q2 * scale, p1);
  const p3 = clip(f.quartiles.q3 * scale, p2);
  const p4 = clip(f.quartiles.q4 * scale, p3);
  const starts = binomial(r.fork('start'), billable, startRate);
  const q1 = binomial(r.fork('q1'), starts, p1);
  const mid = binomial(r.fork('q2'), q1, p1 > 0 ? p2 / p1 : 0);
  const q3 = binomial(r.fork('q3'), mid, p2 > 0 ? p3 / p2 : 0);
  const complete = binomial(r.fork('q4'), q3, p3 > 0 ? p4 / p3 : 0);
  let views = complete;
  let skips = 0;
  if (f.skippableViewRate !== undefined) {
    views = binomial(r.fork('views'), billable, viewEventRateOf(params, cell, rate, quality));
    skips = Math.max(0, starts - Math.max(views, complete));
  }
  const audible = binomial(r.fork('aud'), starts, audibleRateOf(params, cell));
  const coShare =
    cell.format === 'youtube'
      ? cell.device === 'ctv'
        ? params.outcomes.coViewShare.ctv
        : params.outcomes.coViewShare.default
      : 0;
  return {
    starts,
    q1,
    mid,
    q3,
    complete,
    skips,
    views,
    audible,
    coViewed: Math.round(viewable * coShare),
    watchSeconds: Math.round((DURATION_SECONDS / 4) * (q1 + mid + q3 + complete)),
  };
}
