// Learning phase and significant-edit detection (engine.md 4.3).

import { rng } from '../rng/streams';
import type { Params } from '../params/schema';
import type { LearningState, LiSignature } from '../state';
import type { IoEntity, LineItemEntity } from '../world';
import type { GoalEvent } from './strategies';

const EXIT_KEY: Record<GoalEvent, string> = {
  none: 'clicks',
  clicks: 'clicks',
  conversions: 'conversions',
  viewable_impressions: 'viewable_impressions',
  reach_impressions: 'reach_impressions',
  completed_views: 'completed_views',
};

export const exitEventsFor = (event: GoalEvent, p: Params): number =>
  p.bidding.learning.exitEvents[EXIT_KEY[event]] ?? 200;
const tauFor = (event: GoalEvent, p: Params): number =>
  p.bidding.learning.tau[EXIT_KEY[event]] ?? 150;

export const qualityFromEvents = (events: number, event: GoalEvent, p: Params): number => {
  const q0 = p.bidding.learning.initialQuality;
  return 1 - (1 - q0) * Math.exp(-events / tauFor(event, p));
};

const eventsFromQuality = (q: number, event: GoalEvent, p: Params): number => {
  const q0 = p.bidding.learning.initialQuality;
  if (q <= q0) return 0;
  return -tauFor(event, p) * Math.log(Math.max(1e-9, (1 - q) / (1 - q0)));
};

export function newLearning(tick: number, p: Params): LearningState {
  return {
    phase: 'LEARNING',
    events: 0,
    q: p.bidding.learning.initialQuality,
    phaseStartTick: tick,
    relearnUntilTick: 0,
    signature: null,
  };
}

export function signatureOf(li: LineItemEntity, io: IoEntity | undefined): LiSignature {
  const t = li.targeting;
  const dims: string[] = [];
  if (t.geo) dims.push('geo');
  if (t.audiences?.includeGroups?.length || t.audiences?.exclude?.length) dims.push('audience');
  if (t.demographics) dims.push('demographics');
  if (t.devices) dims.push('devices');
  if (t.exchanges) dims.push('exchanges');
  if (t.languages) dims.push('languages');
  const budget =
    li.budget.mode === 'FIXED'
      ? (li.budget.amount ?? 0)
      : (io?.segments.reduce((a, s) => a + s.amount, 0) ?? 0);
  return {
    goal: `${li.bid.kind}|${li.bid.goal ?? ''}`,
    optimized: li.optimizedTargeting,
    creatives: [...li.creativeIds].sort().join(','),
    floodlight: li.floodlight
      .map((f) => f.activityId)
      .sort()
      .join(','),
    automation: io?.bidBudgetControl ?? '',
    dims: dims.sort().join(','),
    target: li.bid.targetValue ?? li.bid.fixedCpm ?? 0,
    budget,
  };
}

function significant(a: LiSignature, b: LiSignature, p: Params): boolean {
  if (
    a.goal !== b.goal ||
    a.optimized !== b.optimized ||
    a.creatives !== b.creatives ||
    a.floodlight !== b.floodlight ||
    a.automation !== b.automation ||
    a.dims !== b.dims
  ) {
    return true;
  }
  const rel = (x: number, y: number) =>
    x === 0 ? (y === 0 ? 0 : 100) : (Math.abs(y - x) / Math.abs(x)) * 100;
  return (
    rel(a.target, b.target) > p.bidding.learning.significantChangePct ||
    rel(a.budget, b.budget) > p.bidding.learning.significantBudgetChangePct
  );
}

/**
 * Advance learning for one tick: count events, apply a restart when the settings changed
 * significantly, and move between phases. Returns a new state.
 */
export function advanceLearning(
  prev: LearningState,
  sig: LiSignature,
  eventsDelta: number,
  event: GoalEvent,
  optimizedTargeting: boolean,
  tick: number,
  p: Params,
  sandboxSeed: string,
  liId: string,
): LearningState {
  const l = p.bidding.learning;
  const ls: LearningState = { ...prev };
  const weight = optimizedTargeting ? l.optimizedTargetingEventWeight : 1;
  ls.events = prev.events + eventsDelta * weight;
  ls.q = qualityFromEvents(ls.events, event, p);

  if (prev.signature && significant(prev.signature, sig, p)) {
    const qNew = Math.max(l.relearnQualityFloor, 0.5 * ls.q);
    ls.q = qNew;
    ls.events = eventsFromQuality(qNew, event, p);
    const u = rng(sandboxSeed, 'relearn', liId, tick).next();
    const [lo, hi] = l.relearnHours;
    ls.relearnUntilTick = tick + Math.round(lo + u * (hi - lo));
    ls.phase = 'RELEARNING';
    ls.phaseStartTick = tick;
  } else if (ls.phase === 'RELEARNING' && tick >= ls.relearnUntilTick) {
    ls.phase = ls.events >= exitEventsFor(event, p) ? 'STABLE' : 'LEARNING';
    ls.phaseStartTick = tick;
  } else if (ls.phase === 'LEARNING' && ls.events >= exitEventsFor(event, p)) {
    ls.phase = 'STABLE';
    ls.phaseStartTick = tick;
  }
  ls.signature = sig;
  return ls;
}

/** Share of the hourly allowance the line item may spend (conservative start, 4.3). */
export function learningSpendCap(ls: LearningState | undefined, tick: number, p: Params): number {
  if (!ls || ls.phase === 'STABLE') return 1;
  return tick - ls.phaseStartTick < 24 ? p.bidding.learning.firstDaySpendCap : 1;
}
