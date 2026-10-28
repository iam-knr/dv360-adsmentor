import { envMult } from '../params/rates';
import { rng } from '../rng/streams';
import type { Params } from '../params/schema';
import type { Cell, Device, Format } from '../types';
import {
  appFraction,
  dowFactor,
  hodCurve,
  marketOf,
  cellSigma,
  priceMoments,
  regionsOf,
  seasonalityFactor,
  supplyLocal,
} from './curves';

export interface MarketCtx {
  country: string;
  marketSeed: string;
  simStartMs: number;
  tzOffsetMin: number;
}

// Shared-market cache (engine.md 1.4). Bounded by the number of cells it holds, not by the number of
// ticks, because a tick of all formats is about 2,500 cells and every cell is a small object graph.
const MAX_CACHED_CELLS = 120_000;
const cache = new Map<string, Cell[]>();
let cachedCells = 0;

/** Cells for one tick and one format with every exchange of the format (shared-market cache, 1.4). */
function formatCells(
  ctx: MarketCtx,
  params: Params,
  paramsHash: string,
  tick: number,
  format: Format,
): Cell[] {
  const key = `${ctx.marketSeed}|${paramsHash}|${ctx.country}|${ctx.simStartMs}|${ctx.tzOffsetMin}|${tick}|${format}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const cells = generate(ctx, params, tick, format);
  cache.set(key, cells);
  cachedCells += cells.length;
  while (cachedCells > MAX_CACHED_CELLS && cache.size > 1) {
    const oldest = cache.keys().next().value;
    if (oldest === undefined) break;
    cachedCells -= cache.get(oldest)?.length ?? 0;
    cache.delete(oldest);
  }
  return cells;
}

function generate(ctx: MarketCtx, params: Params, tick: number, format: Format): Cell[] {
  const f = params.formats[format];
  if (!f) return [];
  const market = marketOf(params, ctx.country);
  const local = supplyLocal(ctx.simStartMs, ctx.tzOffsetMin, tick);
  const hod = hodCurve(params, format);
  const hodIdx = hod[local.hour] ?? 1;
  const dow = dowFactor(params, format, local.dow);
  const season = seasonalityFactor(params, local.date);
  const base = params.supply.basePeakRequestsPerHour[format] ?? 0;
  const regions = regionsOf(params, ctx.country);
  const moments = priceMoments(params, format, ctx.country);
  const norm = moments.mean;
  const sigmaN = params.supply.noiseSigma;
  const volume = market.volumeIdx * params.supply.supplyScale;
  const hodPrice = Math.pow(hodIdx, params.supply.hodPriceExponent);
  const pressure = params.competitors.pressure;
  const out: Cell[] = [];

  const exchanges = Object.keys(params.supply.exchangeShare[format] ?? {}).sort();
  const devices = Object.keys(params.supply.deviceShare[format] ?? {}).sort();
  for (const ex of exchanges) {
    const exShare = params.supply.exchangeShare[format]?.[ex] ?? 0;
    const exp = params.exchanges[ex];
    if (!exp) continue;
    for (const region of Object.keys(regions).sort()) {
      const rShare = regions[region] ?? 0;
      const rIdx = market.regionPriceIdx?.[region] ?? 1;
      for (const device of devices) {
        const dShare = params.supply.deviceShare[format]?.[device] ?? 0;
        const dm = params.multipliers.device[device];
        if (!dm) continue;
        const app = appFraction(params, format, device);
        for (const env of ['web', 'app'] as const) {
          const eShare = env === 'app' ? app : 1 - app;
          if (eShare <= 0 || dShare <= 0) continue;
          const em = envMult(params, device, env);
          const id = `${ex}|${region}|${device}|${env}|${format}`;
          const mean = base * exShare * rShare * dShare * eShare * volume;
          const z = rng(ctx.marketSeed, 'supply', tick, id).normal();
          const noise = Math.exp(sigmaN * z - (sigmaN * sigmaN) / 2);
          const requests = Math.max(0, Math.round(mean * hodIdx * dow * season * noise));
          const idxLn =
            Math.log(exp.priceIdx) +
            Math.log(rIdx) +
            Math.log(dm.price) +
            Math.log(em.price) +
            Math.log(hodPrice) +
            Math.log(market.priceIdx) +
            Math.log(pressure) -
            norm;
          const extMu = Math.log(f.clear.median) + idxLn;
          const sigma = cellSigma(f.clear.sigma, moments);
          const viewMean = Math.min(
            0.99,
            Math.max(0.02, f.viewable * dm.view * em.view * market.viewIdx),
          );
          const idKey = device === 'ctv' ? 'ctv' : env;
          out.push({
            id,
            exchangeId: ex,
            country: ctx.country,
            region,
            device: device as Device,
            environment: env,
            format,
            hour: local.hour,
            requests,
            dayRequests: mean * dow * season * 24,
            floor: { mu: Math.log(f.floor.median) + idxLn, sigma: f.floor.sigma },
            external: { mu: extMu, sigma },
            internal: { mu: extMu + f.internalDelta, sigma: sigma * 0.9 },
            predictedViewability: { mean: viewMean, kappa: f.viewableKappa },
            uniqueUsersPerRequest: 1 / f.requestsPerUserPerDay,
            identifiedShare: params.outcomes.identifiedShare[idKey] ?? 0.55,
            ivtRate: exp.ivtRate,
            hodIndex: hodIdx,
          });
        }
      }
    }
  }
  return out;
}

/**
 * Supply for a tick (engine.md 2.1 to 2.4), sorted by cell id. When the partner enabled only some
 * exchanges, the disabled rows' share moves to the enabled ones (RC-029): the total is unchanged.
 */
export function supplyCells(
  ctx: MarketCtx,
  params: Params,
  paramsHash: string,
  tick: number,
  formats: readonly Format[],
  enabledExchanges?: readonly string[],
): Cell[] {
  const out: Cell[] = [];
  for (const format of [...new Set(formats)].sort()) {
    const cells = formatCells(ctx, params, paramsHash, tick, format);
    if (!enabledExchanges) {
      out.push(...cells);
      continue;
    }
    const enabled = new Set(enabledExchanges);
    const shares = params.supply.exchangeShare[format] ?? {};
    let all = 0;
    let on = 0;
    for (const [ex, s] of Object.entries(shares)) {
      all += s;
      if (enabled.has(ex)) on += s;
    }
    if (on <= 0) continue;
    const factor = all / on;
    for (const c of cells) {
      if (!enabled.has(c.exchangeId)) continue;
      out.push(
        factor === 1
          ? c
          : {
              ...c,
              requests: Math.round(c.requests * factor),
              dayRequests: c.dayRequests * factor,
            },
      );
    }
  }
  return out.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

export function clearSupplyCache(): void {
  cache.clear();
  cachedCells = 0;
}
