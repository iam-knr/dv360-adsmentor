// Partner costs, data and verification fees (engine.md 8.2 to 8.5), per cell, in integer micros.

import type { FeeSchedule } from '../economics';
import type { CellOutcome } from '../outcomes';
import { toMicros } from './fx';
import type { MediaCost } from './media';

export interface CellFees {
  cpmFee1: number;
  cpmFee2: number;
  mediaFee1: number;
  mediaFee2: number;
  dataCost: number;
  verificationCost: number;
  adServingCost: number;
  /** Sum of the invoiced parts: invoiced fees plus data and verification (8.6). */
  invoiced: number;
  /** Invoiced CPM and media fees only (for the media-cost-markup model). */
  invoicedFees: number;
  /** Sum of all components excluding media. */
  all: number;
}

export function feesOf(co: CellOutcome, media: MediaCost, s: FeeSchedule): CellFees {
  const billable = co.imp.billable;
  const k = billable / 1000;
  const cpm = [0, 1].map((i) => toMicros(k * (s.cpm[i]?.amount ?? 0)));
  const mediaFee = [0, 1].map((i) => toMicros(media.net * (s.media[i]?.pct ?? 0)));
  const dataCost = toMicros(k * s.dataCpm);
  const verificationCost = toMicros(k * s.verificationCpm);
  const adServingCost = toMicros((co.imp.impressions / 1000) * s.adServingCpm);
  let invoicedFees = 0;
  s.cpm.forEach((c, i) => {
    if (c.invoiced && i < 2) invoicedFees += cpm[i] as number;
  });
  s.media.forEach((m, i) => {
    if (m.invoiced && i < 2) invoicedFees += mediaFee[i] as number;
  });
  const all =
    (cpm[0] as number) +
    (cpm[1] as number) +
    (mediaFee[0] as number) +
    (mediaFee[1] as number) +
    dataCost +
    verificationCost +
    adServingCost;
  return {
    cpmFee1: cpm[0] as number,
    cpmFee2: cpm[1] as number,
    mediaFee1: mediaFee[0] as number,
    mediaFee2: mediaFee[1] as number,
    dataCost,
    verificationCost,
    adServingCost,
    invoiced: invoicedFees + dataCost + verificationCost,
    invoicedFees,
    all,
  };
}
