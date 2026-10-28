// Per-cell metric rows and the hourly total (engine.md 9.1, 9.2).

import type { CellMoney } from '../costs';
import { lostKeyOf } from '../diagnostics';
import { METRIC_INDEX, newMetricArray, toMetrics, type Metrics } from '../metrics';
import type { CellAuction, ElCell } from '../auction';
import type { CellOutcome } from '../outcomes';

/** All additive counters of one cell for one tick, as a flat array in METRIC_KEYS order. */
export function cellMetrics(
  elc: ElCell,
  ca: CellAuction | undefined,
  co: CellOutcome | undefined,
  money: CellMoney | undefined,
): Float64Array {
  const m = newMetricArray();
  const I = METRIC_INDEX;
  m[I.bidRequests] = elc.nA;
  m[I.eligibleRequests] = elc.nE;
  const bump = (code: string, n: number) => {
    const k = lostKeyOf(code);
    if (k) m[I[k]] = (m[I[k]] as number) + n;
  };
  for (const [code, n] of elc.codes) bump(code, n);
  if (ca) {
    for (const [code, n] of ca.codes) bump(code, n);
    m[I.bidsSubmitted] = ca.S;
    m[I.bidResponses] = ca.R;
    m[I.impressions] = ca.W;
  }
  if (co) {
    m[I.billableImpressions] = co.imp.billable;
    m[I.invalidImpressions] = co.imp.invalid;
    m[I.beginToRenderImpressions] = co.imp.beginToRender;
    m[I.measurableImpressions] = co.imp.measurable;
    m[I.viewableImpressions] = co.imp.viewable;
    m[I.viewable10sImpressions] = co.imp.viewable10s;
    m[I.inactiveImpressions] = co.imp.inactive;
    m[I.clicks] = co.clicks.clicks;
    m[I.invalidClicks] = co.clicks.invalidClicks;
    m[I.engagements] = co.clicks.engagements;
    m[I.companionClicks] = co.clicks.companionClicks;
    m[I.audibleImpressions] = co.video.audible;
    m[I.videoStarts] = co.video.starts;
    m[I.videoQ1] = co.video.q1;
    m[I.videoMid] = co.video.mid;
    m[I.videoQ3] = co.video.q3;
    m[I.videoCompletions] = co.video.complete;
    m[I.skips] = co.video.skips;
    m[I.videoViews] = co.video.views;
    m[I.coViewedImpressions] = co.video.coViewed;
    m[I.watchSecondsTotal] = co.video.watchSeconds;
  }
  if (money) {
    m[I.mediaCost] = money.mediaCost;
    m[I.refund] = money.refund;
    m[I.cpmFee1] = money.cpmFee1;
    m[I.cpmFee2] = money.cpmFee2;
    m[I.mediaFee1] = money.mediaFee1;
    m[I.mediaFee2] = money.mediaFee2;
    m[I.dataCost] = money.dataCost;
    m[I.verificationCost] = money.verificationCost;
    m[I.adServingCost] = money.adServingCost;
    m[I.totalMediaCost] = money.totalMediaCost;
    m[I.revenue] = money.revenue;
    m[I.profit] = money.profit;
    m[I.clientCost] = money.clientCost;
  }
  return m;
}

/** Metrics object of one cell (for tests and tools). */
export const cellMetricsObject = (...args: Parameters<typeof cellMetrics>): Metrics =>
  toMetrics(cellMetrics(...args));
