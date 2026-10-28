// Attribution: two-touch approximation (engine.md 6.5). Released conversions are credited to the
// generating (last-touch) line item and, for the multi-touch share, to one assist line item.

import { rng } from '../rng/streams';
import type { Params } from '../params/schema';
import type { LineItemEntity } from '../world';

export type AttributionModel = LineItemEntity['attributionModel'];

export interface AssistCandidate {
  liId: string;
  /** Impressions over the last 7 sim days. */
  weight: number;
  /** Incrementality class key of params.outcomes.attribution.dataDrivenIncrementality. */
  klass: string;
}

export interface Credit {
  liId: string;
  /** Fraction of the raw conversions credited to the line item. */
  share: number;
}

export function incrementalityClass(li: LineItemEntity): string {
  if (li.type === 'CTV') return 'ctv';
  if (li.type.startsWith('YT_') || li.type === 'DEMAND_GEN') return 'youtube_reach';
  const inc = li.targeting.audiences?.includeGroups?.length ?? 0;
  return inc > 0 ? 'remarketing' : 'prospecting';
}

/**
 * Split one block of released conversions between the last-touch line item and assists.
 * The shares always sum to 1.
 */
export function creditSplit(
  last: LineItemEntity,
  candidates: readonly AssistCandidate[],
  params: Params,
  sandboxSeed: string,
  tick: number,
  activityId: string,
): Credit[] {
  const m = params.outcomes.multiTouchShare;
  const others = candidates.filter((c) => c.liId !== last.id && c.weight > 0);
  if (others.length === 0 || last.attributionModel === 'last_click' || m <= 0) {
    return [{ liId: last.id, share: 1 }];
  }
  const total = others.reduce((a, c) => a + c.weight, 0);
  let lastCredit: number;
  const model = last.attributionModel;
  const r = rng(sandboxSeed, 'attr', tick, last.id, activityId);
  if (model === 'linear' || model === 'position_based') {
    lastCredit = 0.5;
  } else if (model === 'time_decay') {
    const gapDays = 1 + 13 * r.next();
    const wAssist = Math.pow(2, -gapDays / params.outcomes.attribution.timeDecayHalfLifeDays);
    lastCredit = 1 / (1 + wAssist);
  } else {
    // data driven: weights proportional to incrementality of each line item
    const inc = params.outcomes.attribution.dataDrivenIncrementality;
    const wl = Math.max(0.05, (inc[incrementalityClass(last)] ?? 1) + 0.05 * r.normal());
    const wa = others.reduce(
      (a, c) => a + (c.weight / total) * Math.max(0.05, inc[c.klass] ?? 1),
      0,
    );
    lastCredit = wl / (wl + wa);
  }
  const out: Credit[] = [{ liId: last.id, share: 1 - m + m * lastCredit }];
  for (const c of others)
    out.push({ liId: c.liId, share: m * (1 - lastCredit) * (c.weight / total) });
  return out;
}
