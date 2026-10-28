import { describe, expect, it } from 'vitest';
import type { CellAuction } from '@/lib/engine/auction';
import { simulateOutcomes } from '@/lib/engine/outcomes';
import { simulateClicks } from '@/lib/engine/outcomes/clicks';
import { simulateVideo, ZERO_VIDEO } from '@/lib/engine/outcomes/video';
import { simulateImpressions } from '@/lib/engine/outcomes/viewability';
import {
  audibleRateOf,
  ctrOf,
  formatOf,
  neutralRateCtx,
  viewMeanOf,
} from '@/lib/engine/params/rates';
import { Rng } from '@/lib/engine/rng/xoshiro';
import { benchmarkWorld, purchase } from '@/lib/engine/testing/fixtures';
import { funnelFor, params } from './helpers';

const P = params.params;

function synthetic(
  liId: string,
  pick: (c: { device: string; environment: string; exchangeId: string; region: string }) => boolean,
  W = 1_000_000,
) {
  const world = benchmarkWorld({ formats: ['display', 'video_instream', 'ctv', 'audio'] });
  const { elig } = funnelFor(world, liId);
  const elc = elig.cells.find((c) => pick(c.cell) && c.nSurv > 0)!;
  const ca: CellAuction = {
    elc,
    bid: 100,
    S: W * 2,
    R: W * 1.5,
    W,
    codes: [],
    price: 50,
    media: (W * 50) / 1000,
  };
  return { ca, elc, rate: { ...elig.rate, creativeQuality: 1 } };
}

describe('impressions, invalid traffic and Active View (engine.md 6.1)', () => {
  const { ca, rate, elc } = synthetic(
    'li-display',
    (c) =>
      c.exchangeId === 'google_ad_manager' && c.device === 'smartphone' && c.environment === 'app',
  );
  const imp = simulateImpressions(ca, rate, P, new Rng('imp'));

  it('keeps the chain impressions >= valid >= measurable >= viewable >= 10 s viewable', () => {
    expect(imp.impressions).toBe(ca.W);
    expect(imp.billable).toBeLessThanOrEqual(imp.impressions);
    expect(imp.measurable).toBeLessThanOrEqual(imp.impressions - imp.invalid);
    expect(imp.viewable).toBeLessThanOrEqual(imp.measurable);
    expect(imp.viewable10s).toBeLessThanOrEqual(imp.viewable);
    expect(imp.inactive).toBe(imp.measurable - imp.viewable);
    expect(imp.beginToRender).toBe(Math.round(ca.W * 0.985));
  });

  it('follows the exchange IVT rate and the measurable rate', () => {
    expect(imp.invalid / ca.W).toBeGreaterThan(0.018);
    expect(imp.invalid / ca.W).toBeLessThan(0.022);
    expect(imp.measurable / (ca.W - imp.invalid)).toBeCloseTo(0.88, 2);
  });

  it('viewable share of measurable follows the cell viewability (beta draw)', () => {
    // each cell draws its own beta rate, so look at the average over many cells
    const expected = viewMeanOf(elc.cell, rate);
    let v = 0;
    let m = 0;
    for (let i = 0; i < 60; i++) {
      const x = simulateImpressions(ca, rate, P, new Rng(`beta-${i}`));
      v += x.viewable;
      m += x.measurable;
    }
    expect(v / m).toBeGreaterThan(expected - 0.04);
    expect(v / m).toBeLessThan(expected + 0.04);
  });

  it('3P fraud verification cuts invalid traffic by 70%', () => {
    const v = simulateImpressions(ca, { ...rate, fraudVerifiedShare: 1 }, P, new Rng('imp'));
    expect(v.invalid / imp.invalid).toBeGreaterThan(0.25);
    expect(v.invalid / imp.invalid).toBeLessThan(0.35);
  });

  it('a viewability target keeps the better supply', () => {
    const base = viewMeanOf(elc.cell, rate);
    const t = viewMeanOf(elc.cell, { ...rate, viewabilityMin: 0.8 });
    expect(t).toBeGreaterThan(base);
    expect(t).toBeLessThanOrEqual(0.99);
  });

  it('above the fold is more viewable than below it', () => {
    const above = viewMeanOf(elc.cell, {
      ...rate,
      positionMult: P.multipliers.position.above_fold!,
    });
    const below = viewMeanOf(elc.cell, {
      ...rate,
      positionMult: P.multipliers.position.below_fold!,
    });
    expect(above).toBeGreaterThan(below);
  });
});

describe('clicks (engine.md 6.2)', () => {
  const { ca, rate } = synthetic(
    'li-display',
    (c) =>
      c.exchangeId === 'google_ad_manager' && c.device === 'smartphone' && c.environment === 'app',
  );
  const billable = 1_000_000;

  it('clicks follow the cell CTR, with 2% removed as invalid', () => {
    const ctr = ctrOf(P, ca.elc.cell, rate, ca.elc.quality);
    const c = simulateClicks(ca, billable, rate, P, new Rng('clicks'));
    const raw = c.clicks + c.invalidClicks;
    expect(raw / billable).toBeGreaterThan(ctr * 0.85);
    expect(raw / billable).toBeLessThan(ctr * 1.15);
    expect(c.invalidClicks / raw).toBeGreaterThan(0.015);
    expect(c.invalidClicks / raw).toBeLessThan(0.025);
  });

  it('smartphone app beats computer web, first-party remarketing beats no audience, quality scales CTR', () => {
    const phone = ctrOf(P, ca.elc.cell, rate, 1);
    const desktop = ctrOf(P, { ...ca.elc.cell, device: 'computer', environment: 'web' }, rate, 1);
    expect(phone / desktop).toBeCloseTo((1.1 * 1.15) / (0.85 * 1.0), 6);
    expect(ctrOf(P, ca.elc.cell, { ...rate, audienceKind: 'first_party' }, 1) / phone).toBeCloseTo(
      1.8,
      6,
    );
    expect(ctrOf(P, ca.elc.cell, rate, 1.3) / phone).toBeCloseTo(1.3, 6);
  });

  it('frequency decays CTR by 8% per extra prior exposure', () => {
    const one = ctrOf(P, ca.elc.cell, { ...rate, avgPriorExposures: 1 }, 1);
    const three = ctrOf(P, ca.elc.cell, { ...rate, avgPriorExposures: 3 }, 1);
    expect(three / one).toBeCloseTo(0.92 ** 2, 9);
  });

  it('display has engagements, audio has companion clicks', () => {
    const c = simulateClicks(ca, billable, rate, P, new Rng('eng'));
    expect(c.engagements / billable).toBeGreaterThan(0.003);
    expect(c.engagements / billable).toBeLessThan(0.005);
    const audio = synthetic('li-audio', () => true);
    const a = simulateClicks(audio.ca, 100_000, audio.rate, P, new Rng('aud'));
    expect(a.companionClicks).toBe(a.clicks);
  });
});

describe('video and audio (engine.md 6.3)', () => {
  it('follows the quartile chain and the start rate', () => {
    const { ca, rate } = synthetic(
      'li-video_instream',
      (c) => c.device === 'computer' && c.environment === 'web',
    );
    const v = simulateVideo(ca, 1_000_000, 500_000, rate, P, new Rng('video'));
    expect(v.starts).toBeGreaterThan(0);
    expect(v.q1).toBeLessThanOrEqual(v.starts);
    expect(v.mid).toBeLessThanOrEqual(v.q1);
    expect(v.q3).toBeLessThanOrEqual(v.mid);
    expect(v.complete).toBeLessThanOrEqual(v.q3);
    expect(v.starts / 1_000_000).toBeCloseTo(0.94, 2);
    expect(v.complete / v.starts).toBeGreaterThan(0.55);
    expect(v.complete / v.starts).toBeLessThan(0.75);
    expect(v.views).toBeGreaterThan(0);
    expect(v.audible).toBeLessThanOrEqual(v.starts);
    expect(v.watchSeconds).toBeGreaterThan(0);
  });

  it('smartphones retain fewer viewers than computers', () => {
    const phone = synthetic('li-video_instream', (c) => c.device === 'smartphone');
    const desk = synthetic('li-video_instream', (c) => c.device === 'computer');
    const p = simulateVideo(phone.ca, 1_000_000, 0, phone.rate, P, new Rng('v'));
    const d = simulateVideo(desk.ca, 1_000_000, 0, desk.rate, P, new Rng('v'));
    expect(p.complete / p.starts).toBeLessThan(d.complete / d.starts);
  });

  it('CTV starts almost every impression and completes about 95%', () => {
    const { ca, rate } = synthetic('li-ctv', () => true);
    const v = simulateVideo(ca, 1_000_000, 900_000, rate, P, new Rng('ctv'));
    expect(v.starts / 1_000_000).toBeCloseTo(0.99, 2);
    expect(v.complete / v.starts).toBeGreaterThan(0.9);
    expect(v.audible / v.starts).toBeCloseTo(audibleRateOf(P, ca.elc.cell), 1);
  });

  it('display has no video metrics', () => {
    const { ca, rate } = synthetic('li-display', () => true);
    expect(simulateVideo(ca, 1000, 500, rate, P, new Rng('d'))).toEqual(ZERO_VIDEO);
    expect(formatOf(P, 'display').startRate).toBeUndefined();
  });

  it('YouTube co-viewing is higher on CTV devices', () => {
    const w = benchmarkWorld({ formats: ['youtube'] });
    const { elig } = funnelFor(w, 'li-youtube');
    const ctv = elig.cells.find((c) => c.cell.device === 'ctv' && c.nSurv > 0)!;
    const phone = elig.cells.find((c) => c.cell.device === 'smartphone' && c.nSurv > 0)!;
    const mk = (elc: typeof ctv): CellAuction => ({
      elc,
      bid: 100,
      S: 2e6,
      R: 1.5e6,
      W: 1e6,
      codes: [],
      price: 50,
      media: 5e4,
    });
    const a = simulateVideo(mk(ctv), 1e6, 800_000, elig.rate, P, new Rng('yt'));
    const b = simulateVideo(mk(phone), 1e6, 800_000, elig.rate, P, new Rng('yt'));
    expect(a.coViewed).toBeCloseTo(800_000 * 0.25, -2);
    expect(b.coViewed).toBeCloseTo(800_000 * 0.02, -2);
  });
});

describe('simulateOutcomes (engine.md 6.4)', () => {
  const run = (activities = [purchase]) => {
    const { ca, rate } = synthetic('li-display', (c) => c.exchangeId === 'google_ad_manager');
    return simulateOutcomes({
      liId: 'li-display',
      auction: { liId: 'li-display', cells: [ca], clipped: 0 },
      rate,
      activities,
      params: P,
      tick: 4,
      sandboxSeed: 'sb',
    });
  };

  it('generates raw conversions by activity and kind from clicks and post-view', () => {
    const o = run();
    const kinds = o.rawConversions.map((r) => r.kind).sort();
    expect(kinds).toEqual(['click', 'view']);
    const click = o.rawConversions.find((r) => r.kind === 'click')!.count;
    const clicks = o.cells[0]!.clicks.clicks;
    expect(click / clicks).toBeGreaterThan(0.01);
    expect(click / clicks).toBeLessThan(0.04);
  });

  it('a broken tag produces no conversions but the ad events are unchanged', () => {
    const broken = run([{ ...purchase, tagStatus: 'broken' }]);
    expect(broken.rawConversions).toEqual([]);
    expect(broken.cells[0]!.clicks.clicks).toBe(run().cells[0]!.clicks.clicks);
  });

  it('is seeded: the same tick gives the same outcome, another tick differs', () => {
    expect(run().cells[0]!.clicks.clicks).toBe(run().cells[0]!.clicks.clicks);
    const { ca, rate } = synthetic('li-display', (c) => c.exchangeId === 'google_ad_manager');
    const other = simulateOutcomes({
      liId: 'li-display',
      auction: { liId: 'li-display', cells: [ca], clipped: 0 },
      rate,
      activities: [purchase],
      params: P,
      tick: 5,
      sandboxSeed: 'sb',
    });
    expect(other.cells[0]!.clicks.clicks).not.toBe(run().cells[0]!.clicks.clicks);
  });

  it('skips cells without wins', () => {
    const { ca, rate } = synthetic('li-display', () => true);
    const o = simulateOutcomes({
      liId: 'x',
      auction: { liId: 'x', cells: [{ ...ca, W: 0 }], clipped: 0 },
      rate,
      activities: [purchase],
      params: P,
      tick: 1,
      sandboxSeed: 's',
    });
    expect(o.cells).toEqual([]);
    expect(neutralRateCtx().vertical).toBe(1);
  });
});
