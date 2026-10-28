// Stage 2 of the funnel: which assigned creatives can serve in a cell (engine.md 3.4) and how a
// win is split between them (6.2).

import { clamp } from '../math';
import { rng } from '../rng/streams';
import type { Params } from '../params/schema';
import type { Cell } from '../types';
import type { ApprovalState, CreativeEntity, LineItemEntity } from '../world';
import { C_CODES } from './reasons';

export interface CreativeChoice {
  creative: CreativeEntity;
  share: number;
  quality: number;
}

export interface CreativeStep {
  code: string;
  /** Share of the remaining requests that fails this test. */
  failShare: number;
}

export interface CreativeMask {
  steps: CreativeStep[];
  choices: CreativeChoice[];
  /** Share-weighted quality multiplier of the creatives that can serve. */
  quality: number;
}

const qualityCache = new Map<string, number>();

/** Quality multiplier 0.7 to 1.3 from a seeded hash of the creative, plus record adjustments (6.2). */
export function creativeQuality(c: CreativeEntity, params: Params): number {
  if (c.qualityOverride !== undefined) return clamp(c.qualityOverride, 0.7, 1.3);
  const key = `${c.id}|${params.outcomes.creativeQualitySigma}|${c.rich ?? ''}|${c.scaled ?? ''}|${c.trackingIssue ?? ''}`;
  const hit = qualityCache.get(key);
  if (hit !== undefined) return hit;
  let q = Math.exp(params.outcomes.creativeQualitySigma * rng('creativeQuality', c.id).normal());
  if (c.rich || c.type === 'video') q += params.creatives.qualityBonusRich;
  if (c.scaled) q -= params.creatives.qualityPenaltyScaled;
  if (c.trackingIssue) q -= params.creatives.qualityPenaltyTracking;
  q = clamp(q, 0.7, 1.3);
  qualityCache.set(key, q);
  return q;
}

export function approvalOn(c: CreativeEntity, exchangeId: string): ApprovalState {
  return c.approval[exchangeId] ?? c.approval['*'] ?? 'APPROVED';
}

function typeMatches(c: CreativeEntity, cell: Cell): boolean {
  switch (c.type) {
    case 'display':
      return cell.format === 'display';
    case 'native':
      return cell.format === 'native';
    case 'video':
      return cell.format === 'video_instream' || cell.format === 'ctv' || cell.format === 'youtube';
    case 'audio':
      return cell.format === 'audio';
  }
}

function slotCoverage(cs: CreativeEntity[], params: Params): number {
  const table = params.creatives.slotSizes;
  const seen = new Set<string>();
  let cover = 0;
  for (const c of cs) {
    const size = c.size ?? 'other';
    if (seen.has(size)) continue;
    seen.add(size);
    cover += size in table ? (table[size] ?? 0) : (table.other ?? 0) * 0.25;
  }
  return clamp(cover, 0, 1);
}

export interface CreativeCtx {
  params: Params;
  creatives: Map<string, CreativeEntity>;
  /** Ticks the line item has been live, for the exploration period (6.2). */
  liveTicks: number;
  /** Advertiser-tz date for creative flight dates (not modelled), kept for the signature. */
  date: string;
}

/** Mask for one cell family; it only depends on exchange, region, environment and format. */
export function creativeMask(li: LineItemEntity, cell: Cell, ctx: CreativeCtx): CreativeMask {
  const none = (code: string): CreativeMask => ({
    steps: [{ code, failShare: 1 }],
    choices: [],
    quality: 1,
  });
  const assigned: CreativeEntity[] = [];
  // sorted by id so the result never depends on the order the ids were stored in
  for (const id of [...li.creativeIds].sort()) {
    const c = ctx.creatives.get(id);
    if (c && c.status === 'ACTIVE') assigned.push(c);
  }
  if (assigned.length === 0) return none(C_CODES.NONE_ASSIGNED);

  const steps: CreativeStep[] = [];
  // 2. approval on the cell's exchange
  const servable = assigned.filter((c) => c.dv360Servable);
  const approved = servable.filter((c) => approvalOn(c, cell.exchangeId) === 'APPROVED');
  if (approved.length === 0) {
    let code: string = C_CODES.NOT_APPROVED_NOT_SERVABLE;
    if (servable.length > 0) {
      code = servable.some((c) => approvalOn(c, cell.exchangeId) === 'PENDING')
        ? C_CODES.NOT_APPROVED_PENDING
        : C_CODES.NOT_APPROVED_DISAPPROVED;
    }
    return none(code);
  }
  // 3. slot size (display and native) among creatives of the right type
  const typed = approved.filter((c) => typeMatches(c, cell));
  const sizeRelevant = cell.format === 'display' || cell.format === 'native';
  const cover = typed.length === 0 || !sizeRelevant ? 1 : slotCoverage(typed, ctx.params);
  steps.push({ code: C_CODES.SIZE_MISMATCH, failShare: 1 - cover });
  // 4. geo policy
  const geoOk = approved.filter((c) => !(c.restrictedRegions ?? []).includes(cell.region));
  if (geoOk.length === 0)
    return {
      steps: [...steps, { code: C_CODES.GEO_POLICY, failShare: 1 }],
      choices: [],
      quality: 1,
    };
  // 5. format
  const fmtOk = geoOk.filter((c) => typeMatches(c, cell));
  if (fmtOk.length === 0) {
    return {
      steps: [...steps, { code: C_CODES.FORMAT_MISMATCH, failShare: 1 }],
      choices: [],
      quality: 1,
    };
  }
  // 6. environment requirement
  const envOk = fmtOk.filter((c) => !(c.mraid && cell.environment === 'web'));
  if (envOk.length === 0) {
    return {
      steps: [...steps, { code: C_CODES.ENV_REQUIREMENT, failShare: 1 }],
      choices: [],
      quality: 1,
    };
  }
  const usable = envOk.length;
  const qs = envOk.map((c) => creativeQuality(c, ctx.params));
  const mean = qs.reduce((a, b) => a + b, 0) / usable;
  const explore = ctx.liveTicks < ctx.params.creatives.explorationTicks || !li.creativeOptimization;
  const raw = qs.map((q) =>
    explore ? 1 : Math.exp((ctx.params.creatives.optimizationSharpness * q) / mean),
  );
  const total = raw.reduce((a, b) => a + b, 0);
  const choices: CreativeChoice[] = envOk.map((c, i) => ({
    creative: c,
    share: (raw[i] ?? 0) / total,
    quality: qs[i] ?? 1,
  }));
  const quality = choices.reduce((a, c) => a + c.share * c.quality, 0);
  return { steps, choices, quality };
}
