// Mutable engine memory between ticks (engine.md 1.1, "State"). The core never mutates the state it
// is given: runTick clones it, advances it and returns the new copy. The io layer persists it.

import type { FreqState } from './eligibility/frequency';
import type { AlertCode } from './world';

export type LearningPhase = 'LEARNING' | 'STABLE' | 'RELEARNING';

export interface LearningState {
  phase: LearningPhase;
  /** Goal events counted since the last reset. */
  events: number;
  /** Quality in [initialQuality, 1]. */
  q: number;
  phaseStartTick: number;
  /** Tick at which a relearn period ends. */
  relearnUntilTick: number;
  /** Fingerprint of the settings whose change restarts learning (4.3). */
  signature: LiSignature | null;
}

export interface LiSignature {
  goal: string;
  optimized: boolean;
  creatives: string;
  floodlight: string;
  automation: string;
  dims: string;
  target: number;
  budget: number;
}

export interface DayRecord {
  date: string;
  spend: number;
  impressions: number;
  clicks: number;
  conversions: number;
  viewable: number;
  measurable: number;
  views: number;
  /** Media cost in advertiser currency, for KPI cost metrics. */
  cost: number;
}

export interface LiState {
  /** Advertiser-tz date the "today" counters belong to. */
  today: string;
  spendToday: number;
  spendYesterday: number;
  /** Hours of today during which the line item was live (for the no-spend alert). */
  liveTicksToday: number;
  liveTicksYesterday: number;
  /** Consumption since the line item's own flight started (fixed budgets). */
  spentFlight: number;
  liveTicks: number;
  learning: LearningState;
  lambda: number;
  /** Expected consumption at r = 1 in the previous tick, used as capacity for allocation. */
  lastCapacity: number;
  lastR: number;
  lastStatus: string;
  days: DayRecord[];
  /** Impressions decayed over about 7 days, the weight of an assist (6.5). */
  winsLast: number;
}

export interface IoState {
  today: string;
  spentToday: number;
  spentYesterday: number;
  /** Consumption by budget segment id. */
  segSpent: Record<string, number>;
  /** Consumption per day, most recent last (up to 30). */
  daily: { date: string; spend: number }[];
  activatedTick: number;
  /** Allocation weights by line item id (4.5). */
  weights: Record<string, number>;
  /** Credibility-weighted efficiency, events per currency unit, by line item id. */
  eff: Record<string, { events: number; spend: number }>;
  autoWeightsDate: string;
}

export interface PendingConversion {
  liId: string;
  activityId: string;
  kind: 'click' | 'view';
  dueTick: number;
  adEventTick: number;
  /** Raw (uncounted) conversions. */
  count: number;
}

export interface AlertTracker {
  raisedAtTick: number;
  clearTicks: number;
  active: boolean;
  /** Last seen facts, so a resolution can be reported after the condition is gone. */
  severity: 'CRITICAL' | 'NEEDS_ATTENTION';
  params: Record<string, string | number>;
}

export interface SimStateData {
  /** The next tick to process; ticks below it are already applied (idempotency). */
  nextTick: number;
  li: Record<string, LiState>;
  io: Record<string, IoState>;
  freq: Record<string, FreqState>;
  /** Lifetime exposure state per line item. */
  reach: Record<string, FreqState>;
  pending: PendingConversion[];
  alerts: Record<string, AlertTracker>;
  recommendations: Record<string, boolean>;
}

export function newSimState(): SimStateData {
  return {
    nextTick: 0,
    li: {},
    io: {},
    freq: {},
    reach: {},
    pending: [],
    alerts: {},
    recommendations: {},
  };
}

export function cloneState(s: SimStateData): SimStateData {
  return structuredClone(s);
}

export type { AlertCode };
