// Funnel recorder (engine.md 3.5): turns per-cell counts into DeliveryDiagnostic rows in the
// ENG 3.5 shape (stage, reasonCode, count) plus the M.* milestone rows.

import type { AuctionResult, ElCell, LiElig } from '../auction';
import { MILESTONES, stageOfCode, type DiagStage } from '../eligibility/reasons';
import type { MetricKey } from '../metrics';

export interface FunnelRow {
  lineItemId: string;
  /** Advertiser-tz date. */
  date: string;
  exchangeId: string;
  stage: DiagStage;
  reasonCode: string;
  count: number;
}

/** Metric column that rolls up a reason code (engine.md 9.2 win/loss group). */
export function lostKeyOf(code: string): MetricKey | null {
  if (code.startsWith('T.')) return 'lostTargeting';
  if (code.startsWith('C.')) return 'lostCreative';
  if (code.startsWith('F.')) return 'lostFrequency';
  if (code.startsWith('B.')) return 'lostBudget';
  if (code.startsWith('P.')) return 'lostPacing';
  if (code === 'A.BELOW_MIN_BID') return 'lostBelowMinBid';
  if (code.startsWith('A.LOST_INTERNAL')) return 'lostInternal';
  if (code === 'E.BID_TOO_LOW') return 'lostExternalBid';
  if (code === 'E.CREATIVE') return 'lostExternalCreative';
  if (code === 'E.OTHER') return 'lostExternalOther';
  if (code === 'E.LOST_NOT_REPORTED') return 'lostNotReported';
  return null;
}

export function recordFunnel(
  liId: string,
  date: string,
  elig: LiElig,
  auction: AuctionResult | undefined,
): FunnelRow[] {
  const byEx = new Map<string, Map<string, number>>();
  const add = (ex: string, code: string, n: number) => {
    if (n <= 0) return;
    let m = byEx.get(ex);
    if (!m) {
      m = new Map();
      byEx.set(ex, m);
    }
    m.set(code, (m.get(code) ?? 0) + n);
  };
  for (const ec of elig.cells) {
    const ex = ec.cell.exchangeId;
    add(ex, MILESTONES.AVAILABLE, ec.nA);
    add(ex, MILESTONES.ELIGIBLE, ec.nE);
    for (const [code, n] of ec.codes) add(ex, code, n);
  }
  const byCell = new Map<ElCell, number>();
  auction?.cells.forEach((ca, i) => byCell.set(ca.elc, i));
  for (const ca of auction?.cells ?? []) {
    const ex = ca.elc.cell.exchangeId;
    for (const [code, n] of ca.codes) add(ex, code, n);
    add(ex, MILESTONES.BIDS_SUBMITTED, ca.S);
    add(ex, MILESTONES.BID_RESPONSES, ca.R);
    add(ex, MILESTONES.WON, ca.W);
  }
  const rows: FunnelRow[] = [];
  for (const ex of [...byEx.keys()].sort()) {
    const m = byEx.get(ex) as Map<string, number>;
    for (const code of [...m.keys()].sort()) {
      rows.push({
        lineItemId: liId,
        date,
        exchangeId: ex,
        stage: stageOfCode(code),
        reasonCode: code,
        count: m.get(code) as number,
      });
    }
  }
  return rows;
}

/** Sum of milestone and reason counts over rows, for tests and live status. */
export function totalsOf(rows: readonly FunnelRow[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const r of rows) m.set(r.reasonCode, (m.get(r.reasonCode) ?? 0) + r.count);
  return m;
}
