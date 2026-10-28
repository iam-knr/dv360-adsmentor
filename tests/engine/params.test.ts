import { describe, expect, it } from 'vitest';
import { defaultParams, loadParams, mergePatch } from '@/lib/engine';
import { hashJson, stableStringify } from '@/lib/engine/params/hash';
import { paramsSchema } from '@/lib/engine/params/schema';
import baseJson from '../../engine/params.json';

describe('engine/params.json', () => {
  const { params, hash } = defaultParams();

  it('validates against the schema and hashes to 32 hex characters', () => {
    expect(paramsSchema.safeParse(baseJson).success).toBe(true);
    expect(hash).toMatch(/^[0-9a-f]{32}$/);
    expect(loadParams().hash).toBe(hash);
  });

  it('carries the benchmark table of engine.md 2.5', () => {
    const f = params.formats;
    expect(f.display?.floor.median).toBe(15);
    expect(f.display?.clear.median).toBe(65);
    expect(f.native?.clear.median).toBe(110);
    expect(f.video_instream?.clear.median).toBe(260);
    expect(f.ctv?.clear.median).toBe(700);
    expect(f.audio?.clear.median).toBe(320);
    expect(f.youtube?.clear.median).toBe(130);
    expect(f.display?.clear.sigma).toBe(0.45);
    expect(f.ctv?.clear.sigma).toBe(0.4);
    expect(f.display?.ctr).toBe(0.0014);
    expect(f.native?.ctr).toBe(0.004);
  });

  it('carries the market multipliers of engine.md 2.6', () => {
    expect(params.markets.IN?.priceIdx).toBe(1);
    expect(params.markets.US?.priceIdx).toBe(8.5);
    expect(params.markets.UK?.priceIdx).toBe(6.5);
    expect(params.markets.AE?.volumeIdx).toBe(0.04);
    expect(params.markets.BR?.cvrIdx).toBe(0.85);
    expect(params.fx.perUSD.INR).toBe(88);
    expect(params.multipliers.device.smartphone?.ctr).toBe(1.1);
    expect(params.exchanges.google_ad_manager?.priceIdx).toBe(1.08);
    expect(params.exchanges.long_tail?.priceIdx).toBe(0.7);
  });

  it('has shares that add up', () => {
    for (const [format, shares] of Object.entries(params.supply.exchangeShare)) {
      expect(
        Object.values(shares).reduce((a, b) => a + b, 0),
        `exchange share ${format}`,
      ).toBeCloseTo(1, 9);
      for (const ex of Object.keys(shares))
        expect(params.exchanges[ex], `exchange ${ex}`).toBeDefined();
    }
    for (const [format, shares] of Object.entries(params.supply.deviceShare)) {
      expect(
        Object.values(shares).reduce((a, b) => a + b, 0),
        `device share ${format}`,
      ).toBeCloseTo(1, 9);
    }
    expect(
      Object.values(params.markets.IN?.regionShare ?? {}).reduce((a, b) => a + b, 0),
    ).toBeCloseTo(1, 9);
    expect(Object.values(params.creatives.slotSizes).reduce((a, b) => a + b, 0)).toBeCloseTo(1, 9);
    for (const t of Object.values(params.targeting.languageShare)) {
      expect(Object.values(t).reduce((a, b) => a + b, 0)).toBeCloseTo(1, 9);
    }
  });

  it('has a calibration block that the calibration tests read', () => {
    expect(params.calibration.ctrBand).toEqual([0.0008, 0.0035]);
    expect(params.calibration.winRateAtClear).toEqual([0.4, 0.55]);
    expect(params.calibration.winRateAt06).toEqual([0.08, 0.22]);
    expect(params.calibration.winRateAt15Min).toBe(0.75);
    expect(params.calibration.flightEvenPct).toEqual([0.97, 1.03]);
  });

  it('fails on unknown keys, at any depth', () => {
    expect(() => loadParams({ surprise: 1 })).toThrow();
    expect(() => loadParams({ pacing: { surprise: 1 } })).toThrow();
    expect(() => loadParams({ formats: { display: { surprise: 1 } } })).toThrow();
  });

  it('fails on out-of-range values', () => {
    expect(() => loadParams({ pacing: { overshootMax: -1 } })).toThrow();
    expect(() => loadParams({ supply: { hourOfDay: { default: [1, 2, 3] } } })).toThrow();
  });

  it('changing one value changes the hash (so every golden changes, engine.md 11.1 item 10)', () => {
    const patched = loadParams({ supply: { supplyScale: 1.01 } });
    expect(patched.hash).not.toBe(hash);
    expect(patched.params.supply.supplyScale).toBe(1.01);
    expect(params.supply.supplyScale).toBe(1);
  });

  it('merge patch follows RFC 7396', () => {
    expect(mergePatch({ a: 1, b: { c: 2, d: 3 } }, { b: { c: 9, d: null }, e: 4 })).toEqual({
      a: 1,
      b: { c: 9 },
      e: 4,
    });
    expect(mergePatch({ a: [1, 2] }, { a: [3] })).toEqual({ a: [3] });
    expect(mergePatch({ a: 1 }, 5)).toBe(5);
    expect(mergePatch(undefined, { a: 1 })).toEqual({ a: 1 });
  });

  it('hashes do not depend on key order', () => {
    expect(hashJson({ a: 1, b: { c: 2, d: 3 } })).toBe(hashJson({ b: { d: 3, c: 2 }, a: 1 }));
    expect(stableStringify({ b: 1, a: undefined, c: [2, { y: 1, x: 2 }] })).toBe(
      '{"b":1,"c":[2,{"x":2,"y":1}]}',
    );
  });
});
