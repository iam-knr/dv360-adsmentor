// Everything one tick produces for the io layer to persist (engine.md 9.1 write path).

import type { AlertDecision, FunnelRow, LiveStatus, RecommendationDecision } from './diagnostics';
import type { Metrics } from './metrics';

export interface HourlyRow {
  lineItemId: string;
  /** Epoch ms of the start of the sim hour (sandbox tz hour grid). */
  hourStartMs: number;
  /** Advertiser-tz date and hour the tick belongs to. */
  date: string;
  hour: number;
  metrics: Metrics;
}

export interface DailyRow {
  lineItemId: string;
  date: string;
  sliceKind: string;
  sliceKey: string;
  /** Additive delta to add to the stored row (ON CONFLICT DO UPDATE SET x = x + delta). */
  metrics: Metrics;
}

export interface LiveStatusRow {
  lineItemId: string;
  status: LiveStatus;
  /** Reason code with the largest filtered count, for the suggested fix link. */
  topLoss: string | null;
}

export interface PacingRow {
  scopeKind: 'LINE_ITEM' | 'INSERTION_ORDER';
  scopeId: string;
  date: string;
  segmentId: string | null;
  segmentBudget: number;
  spentToDate: number;
  dailyTarget: number;
  /** Spent over the planned amount on an even timeline. */
  pacingPct: number;
  budgetRemaining: number;
  projected: number | null;
  budgetAtRisk: number | null;
  underpacing: boolean;
}

export interface ReachRow {
  lineItemId: string;
  date: string;
  /** Users reached at least once (lifetime). */
  impressionReach: number;
  avgFrequency: number;
  pool: number;
}

export interface LearningRow {
  lineItemId: string;
  phase: string;
  quality: number;
  events: number;
}

export interface TickOutput {
  tick: number;
  /** False when the tick had already been applied; the output is then empty. */
  applied: boolean;
  hourStartMs: number;
  date: string;
  hour: number;
  funnel: FunnelRow[];
  hourly: HourlyRow[];
  daily: DailyRow[];
  liveStatus: LiveStatusRow[];
  alerts: AlertDecision[];
  recommendations: RecommendationDecision[];
  pacing: PacingRow[];
  reach: ReachRow[];
  learning: LearningRow[];
}

export function emptyOutput(
  tick: number,
  applied: boolean,
  hourStartMs: number,
  date: string,
  hour: number,
): TickOutput {
  return {
    tick,
    applied,
    hourStartMs,
    date,
    hour,
    funnel: [],
    hourly: [],
    daily: [],
    liveStatus: [],
    alerts: [],
    recommendations: [],
    pacing: [],
    reach: [],
    learning: [],
  };
}
