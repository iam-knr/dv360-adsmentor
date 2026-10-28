// Live status (engine.md 3.6): the primary status of a line item at the end of a tick.

import type { CampaignEntity, IoEntity, LineItemEntity } from '../world';
import { activeSegment } from '../pacing/budgetState';
import type { FunnelRow } from './recorder';
import { totalsOf } from './recorder';

export type LiveStatus =
  | 'ACTIVE_DELIVERING'
  | 'ACTIVE_LIMITED_BY_TARGETING'
  | 'ACTIVE_LIMITED_BY_CREATIVES'
  | 'ACTIVE_LIMITED_BY_BUDGET'
  | 'ACTIVE_LIMITED_BY_PACING'
  | 'ACTIVE_LIMITED_BY_BID'
  | 'PAUSED'
  | 'DRAFT'
  | 'NOT_STARTED'
  | 'ENDED'
  | 'PARENT_PAUSED'
  | 'NO_BUDGET_SEGMENT'
  | 'NO_ACTIVE_DEAL'
  | 'ARCHIVED';

const LIVE_ACTIVE: LiveStatus = 'ACTIVE_DELIVERING';

/**
 * Lifecycle status of a line item for the advertiser date, or null when it is live and enters the
 * funnel. Entities that are not live produce a status but no funnel rows (3.1).
 */
export function lifecycleStatus(
  li: LineItemEntity,
  io: IoEntity | undefined,
  campaign: CampaignEntity | undefined,
  today: string,
): LiveStatus | null {
  if (li.status === 'ARCHIVED') return 'ARCHIVED';
  if (li.status === 'DRAFT') return 'DRAFT';
  if (li.status === 'PAUSED') return 'PAUSED';
  if (!io || io.status !== 'ACTIVE' || !campaign || campaign.status !== 'ACTIVE')
    return 'PARENT_PAUSED';
  if (li.flight) {
    if (today < li.flight.start) return 'NOT_STARTED';
    if (today > li.flight.end) return 'ENDED';
  }
  const seg = activeSegment(io.segments, today);
  if (!seg) {
    if (io.segments.length === 0) return 'NO_BUDGET_SEGMENT';
    if (io.segments.every((s) => today < s.startDay)) return 'NOT_STARTED';
    if (io.segments.every((s) => today > s.endDay)) return 'ENDED';
    return 'NO_BUDGET_SEGMENT';
  }
  return null;
}

export interface StatusSummary {
  status: LiveStatus;
  /** Reason code with the largest filtered count, the target of the suggested fix link. */
  topLoss: string | null;
}

/** Status of a live line item from the tick's funnel rows (thresholds from 3.6). */
export function liveStatusFromFunnel(rows: readonly FunnelRow[]): StatusSummary {
  const t = totalsOf(rows);
  const A = t.get('M.AVAILABLE') ?? 0;
  const E = t.get('M.ELIGIBLE') ?? 0;
  const S = t.get('M.BIDS_SUBMITTED') ?? 0;
  let tCount = 0;
  let cCount = 0;
  let bCount = 0;
  let pCount = 0;
  let top: [string, number] | null = null;
  for (const [code, n] of t) {
    if (code.startsWith('M.')) continue;
    if (code.startsWith('T.')) tCount += n;
    else if (code.startsWith('C.')) cCount += n;
    else if (code.startsWith('B.')) bCount += n;
    else if (code.startsWith('P.')) pCount += n;
    if (!top || n > top[1]) top = [code, n];
  }
  const bidLoss = (t.get('A.BELOW_MIN_BID') ?? 0) + (t.get('E.BID_TOO_LOW') ?? 0);
  const survivors = E - [...t].filter(([c]) => c.startsWith('F.')).reduce((a, [, n]) => a + n, 0);
  let status: LiveStatus = LIVE_ACTIVE;
  if (A > 0 && tCount / A > 0.95) status = 'ACTIVE_LIMITED_BY_TARGETING';
  else if (A - tCount > 0 && cCount / (A - tCount) > 0.5) status = 'ACTIVE_LIMITED_BY_CREATIVES';
  else if (survivors > 0 && bCount / survivors > 0.5) status = 'ACTIVE_LIMITED_BY_BUDGET';
  else if (S > 0 && bidLoss / S > 0.7) status = 'ACTIVE_LIMITED_BY_BID';
  else if (survivors > 0 && S === 0 && pCount > 0) status = 'ACTIVE_LIMITED_BY_PACING';
  return { status, topLoss: top ? top[0] : null };
}
