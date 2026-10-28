// Clicks and engagements (engine.md 6.2).

import { ctrOf, formatOf, type RateCtx } from '../params/rates';
import type { Params } from '../params/schema';
import { binomial } from '../rng/sample';
import type { Rng } from '../rng/xoshiro';
import type { CellAuction } from '../auction';

export interface ClickOutcome {
  clicks: number;
  invalidClicks: number;
  engagements: number;
  companionClicks: number;
}

export function simulateClicks(
  ca: CellAuction,
  billable: number,
  rate: RateCtx,
  params: Params,
  r: Rng,
): ClickOutcome {
  const cell = ca.elc.cell;
  const f = formatOf(params, cell.format);
  const quality = ca.elc.quality;
  const noise = Math.max(0.5, 1 + params.outcomes.ctrNoise * r.fork('ctrnoise').normal());
  const ctr = Math.min(0.5, ctrOf(params, cell, rate, quality) * noise);
  const raw = binomial(r.fork('click'), billable, ctr);
  const invalid = binomial(r.fork('invclick'), raw, params.outcomes.invalidClickShare);
  const clicks = raw - invalid;
  const engagements = f.engagementRate
    ? binomial(r.fork('engage'), billable, Math.min(1, f.engagementRate * quality))
    : 0;
  return {
    clicks,
    invalidClicks: invalid,
    engagements,
    companionClicks: cell.format === 'audio' ? clicks : 0,
  };
}
