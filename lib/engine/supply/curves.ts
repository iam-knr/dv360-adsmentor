import { tickToLocal, type LocalTime } from '../calendar';
import { envMult } from '../params/rates';
import type { Params } from '../params/schema';
import type { Format } from '../types';

/** Hour-of-day curve for a format, normalised to mean 1 (engine.md 2.2). */
const hodCache = new WeakMap<Params, Map<string, number[]>>();

export function hodCurve(params: Params, format: Format): number[] {
  let perParams = hodCache.get(params);
  if (!perParams) {
    perParams = new Map();
    hodCache.set(params, perParams);
  }
  const key = format === 'ctv' ? 'ctv' : format === 'audio' ? 'audio' : 'default';
  const hit = perParams.get(key);
  if (hit) return hit;
  const raw = params.supply.hourOfDay[key];
  let sum = 0;
  for (const v of raw) sum += v;
  const mean = sum / raw.length;
  const norm = raw.map((v) => v / mean);
  perParams.set(key, norm);
  return norm;
}

export function dowFactor(params: Params, format: Format, dow: number): number {
  const arr = format === 'ctv' ? params.supply.dayOfWeek.ctv : params.supply.dayOfWeek.default;
  return arr[dow] ?? 1;
}

export function seasonalityFactor(params: Params, date: string): number {
  let f = 1;
  for (const w of params.supply.seasonality) if (date >= w.from && date <= w.to) f *= w.factor;
  return f;
}

/** Fraction of a device's supply that is app inventory for a format. */
export function appFraction(params: Params, format: Format, device: string): number {
  const base = params.supply.appShareBySmartphone[format] ?? 0.6;
  const k = params.supply.appShareByDevice[device] ?? 0;
  return Math.min(1, base * k);
}

export function marketOf(params: Params, country: string): Params['markets'][string] {
  const m = params.markets[country];
  if (!m) throw new Error(`Unknown market ${country}`);
  return m;
}

export function regionsOf(params: Params, country: string): Record<string, number> {
  const m = marketOf(params, country);
  return m.regionShare ?? { [`${country}-ALL`]: 1 };
}

export function supplyLocal(simStartMs: number, tzOffsetMin: number, tick: number): LocalTime {
  return tickToLocal(simStartMs, tzOffsetMin, tick);
}

/**
 * Moments of ln(price index) across a format's supply, volume weighted. The cell price medians are
 * shifted by the mean so the mixed buy has the table median as its median (engine.md 2.5 "the
 * median is the default parameter"). The variance is removed from the competitor sigma, so the
 * table sigma is the total dispersion of clearing prices across the mixed buy rather than the
 * dispersion inside one cell (otherwise exchange, region and device spread would be counted twice
 * and the p10 to p90 of 2.5 would be too wide).
 */
export interface PriceMoments {
  mean: number;
  variance: number;
}

const normCache = new WeakMap<Params, Map<string, PriceMoments>>();

export function priceMoments(params: Params, format: Format, country: string): PriceMoments {
  let perParams = normCache.get(params);
  if (!perParams) {
    perParams = new Map();
    normCache.set(params, perParams);
  }
  const key = `${format}|${country}`;
  const hit = perParams.get(key);
  if (hit) return hit;
  const hod = hodCurve(params, format);
  const regions = regionsOf(params, country);
  const m = marketOf(params, country);
  let wSum = 0;
  let acc = 0;
  let acc2 = 0;
  for (const [ex, exShare] of Object.entries(params.supply.exchangeShare[format] ?? {})) {
    const exIdx = params.exchanges[ex]?.priceIdx ?? 1;
    for (const [region, rShare] of Object.entries(regions)) {
      const rIdx = m.regionPriceIdx?.[region] ?? 1;
      for (const [device, dShare] of Object.entries(params.supply.deviceShare[format] ?? {})) {
        const dIdx = params.multipliers.device[device]?.price ?? 1;
        const app = appFraction(params, format, device);
        for (const [env, eShare] of [
          ['web', 1 - app],
          ['app', app],
        ] as const) {
          if (eShare <= 0) continue;
          const eIdx = envMult(params, device, env).price;
          for (let h = 0; h < 24; h++) {
            const w = exShare * rShare * dShare * eShare * (hod[h] ?? 1);
            const ln =
              Math.log(exIdx) +
              Math.log(rIdx) +
              Math.log(dIdx) +
              Math.log(eIdx) +
              params.supply.hodPriceExponent * Math.log(hod[h] ?? 1);
            wSum += w;
            acc += w * ln;
            acc2 += w * ln * ln;
          }
        }
      }
    }
  }
  const mean = wSum > 0 ? acc / wSum : 0;
  const variance = wSum > 0 ? Math.max(0, acc2 / wSum - mean * mean) : 0;
  const v = { mean, variance };
  perParams.set(key, v);
  return v;
}

export const priceNormaliser = (params: Params, format: Format, country: string): number =>
  priceMoments(params, format, country).mean;

/** Competitor log-sigma inside one cell: the table sigma minus the spread between cells. */
export function cellSigma(tableSigma: number, moments: PriceMoments): number {
  return Math.sqrt(Math.max(tableSigma * tableSigma - moments.variance, (0.5 * tableSigma) ** 2));
}
