// Outcomes for one line item and tick (engine.md 6): impressions, clicks, video, and raw
// conversion events. Conversions are scheduled with lag by the orchestrator (6.4).

import type { AuctionResult, CellAuction } from '../auction';
import { cvrClickOf, cvrViewOf, type RateCtx } from '../params/rates';
import type { Params } from '../params/schema';
import { rng } from '../rng/streams';
import type { FloodlightActivity } from '../world';
import { simulateClicks, type ClickOutcome } from './clicks';
import { generateForActivity } from './conversions';
import { simulateImpressions, type ImpressionOutcome } from './viewability';
import { simulateVideo, type VideoOutcome } from './video';

export interface CellOutcome {
  ca: CellAuction;
  imp: ImpressionOutcome;
  clicks: ClickOutcome;
  video: VideoOutcome;
}

export interface LiOutcomes {
  liId: string;
  cells: CellOutcome[];
  /** Raw conversions generated this tick by activity and kind (before lag and counting). */
  rawConversions: { activityId: string; kind: 'click' | 'view'; count: number }[];
}

export interface OutcomeInput {
  liId: string;
  auction: AuctionResult;
  rate: RateCtx;
  activities: FloodlightActivity[];
  params: Params;
  tick: number;
  sandboxSeed: string;
}

export function simulateOutcomes(inp: OutcomeInput): LiOutcomes {
  const cells: CellOutcome[] = [];
  const raw = new Map<string, number>();
  for (const ca of inp.auction.cells) {
    if (ca.W <= 0) continue;
    const r = rng(inp.sandboxSeed, 'outcome', inp.tick, inp.liId, ca.elc.cell.id);
    const imp = simulateImpressions(ca, inp.rate, inp.params, r);
    const clicks = simulateClicks(ca, imp.billable, inp.rate, inp.params, r);
    const video = simulateVideo(ca, imp.billable, imp.viewable, inp.rate, inp.params, r);
    cells.push({ ca, imp, clicks, video });
    const cell = ca.elc.cell;
    const cvrC = cvrClickOf(inp.params, cell, inp.rate);
    const cvrV = cvrViewOf(inp.params, cell, inp.rate);
    for (const act of inp.activities) {
      const g = generateForActivity(
        r.fork(`conv/${act.id}`),
        clicks.clicks,
        imp.viewable - clicks.clicks,
        cvrC,
        cvrV,
        act,
        inp.params,
      );
      if (g.click) raw.set(`${act.id}|click`, (raw.get(`${act.id}|click`) ?? 0) + g.click);
      if (g.view) raw.set(`${act.id}|view`, (raw.get(`${act.id}|view`) ?? 0) + g.view);
    }
  }
  const rawConversions = [...raw.entries()]
    .sort((a, b) => (a[0] < b[0] ? -1 : 1))
    .map(([k, count]) => {
      const [activityId, kind] = k.split('|') as [string, 'click' | 'view'];
      return { activityId, kind, count };
    });
  return { liId: inp.liId, cells, rawConversions };
}

export { creditSplit, incrementalityClass } from './attribution';
export type { AssistCandidate, Credit } from './attribution';
export {
  countConversion,
  lagBuckets,
  postViewWeight,
  scheduleLags,
  windowHours,
} from './conversions';
export type { CountedConversion } from './conversions';
