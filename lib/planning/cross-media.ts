// Cross-media reach arithmetic (module 04 4.9, ENG 9.5). Pure. Fractions in, fractions out (0..1) unless named Pct.
import { segmentReach } from './forecast';
import type { TvCampaignDef } from './tv-catalogue';

/** Share of the digital audience that is also reached by TV beyond independence (ENG 9.5 `dedupShare`). */
export const DEDUP_SHARE = 0.12;

export interface DigitalInput {
  impressions: number;
  /** Reach in people, when the snapshot has one for the insertion order. */
  reach?: number | null;
}

export interface CrossMediaMath {
  digital: { reachPct: number; impressions: number; avgFrequency: number; reach: number };
  tv: { reachPct: number; grps: number; avgFrequency: number; reach: number; impressions: number };
  combined: {
    uniqueReachPct: number;
    overlapPct: number;
    incrementalTvPct: number;
    incrementalDigitalPct: number;
    uniqueReach: number;
  };
}

/** Union of independent reaches: 1 - prod(1 - r_i). */
export const unionReach = (fractions: number[]): number =>
  1 - fractions.reduce((m, r) => m * (1 - Math.min(1, Math.max(0, r))), 1);

export const overlapOf = (rD: number, rT: number, dedup: number = DEDUP_SHARE): number =>
  Math.max(0, Math.min(rD, rT, rD * rT * (1 + dedup)));

export interface CrossMediaInput {
  /** Population the reach percentages refer to (the country census, or its sub-location share). */
  population: number;
  digital: DigitalInput[];
  tv: Pick<TvCampaignDef, 'reachPct' | 'grps' | 'impressions'>[];
  /** Sub-location scaling of people counts, 1 for national. */
  scale?: number;
}

export function crossMediaMath(i: CrossMediaInput): CrossMediaMath {
  const pop = Math.max(1, i.population);
  const scale = i.scale ?? 1;
  const dFractions = i.digital.map((d) =>
    d.reach != null && d.reach > 0 ? d.reach / pop : segmentReach(d.impressions, pop) / pop,
  );
  const rD = unionReach(dFractions);
  const dImpr = i.digital.reduce((s, d) => s + d.impressions, 0);
  const rT = unionReach(i.tv.map((t) => t.reachPct / 100));
  const grps = i.tv.reduce((s, t) => s + t.grps, 0);
  const tvImpr = i.tv.reduce((s, t) => s + t.impressions, 0);
  const ov = overlapOf(rD, rT);
  const unique = rD + rT - ov;
  const people = (f: number) => Math.round(f * pop * scale);
  return {
    digital: {
      reachPct: round(rD * 100),
      impressions: Math.round(dImpr * scale),
      avgFrequency: rD > 0 ? round((dImpr / (rD * pop)) , 2) : 0,
      reach: people(rD),
    },
    tv: {
      reachPct: round(rT * 100),
      grps: Math.round(grps),
      avgFrequency: rT > 0 ? round(grps / 100 / rT, 2) : 0,
      reach: people(rT),
      impressions: Math.round(tvImpr * scale),
    },
    combined: {
      uniqueReachPct: round(unique * 100),
      overlapPct: round(ov * 100),
      incrementalTvPct: round((unique - rD) * 100),
      incrementalDigitalPct: round((unique - rT) * 100),
      uniqueReach: people(unique),
    },
  };
}

function round(n: number, d = 2): number {
  const f = 10 ** d;
  return Math.round(n * f) / f;
}
