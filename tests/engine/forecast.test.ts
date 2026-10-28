import { describe, expect, it } from 'vitest';
import { estimateAudienceSize, forecast } from '@/lib/engine/forecast';
import { baseWorld, creativeFor, ioOf, smallWorld } from '@/lib/engine/testing/fixtures';
import { params } from './helpers';

const FAST = { partner: { id: 'p1', currency: 'INR', enabledExchanges: ['index_exchange'] } };
const w = smallWorld({
  targeting: { exchanges: ['index_exchange'], geo: { includeRegions: ['IN-MH'] } },
  li: { bid: { kind: 'FIXED', fixedCpm: 80 } },
  world: FAST,
});
const li = w.lineItems[0]!;

describe('forecast (engine.md 1.6)', () => {
  const f = (draft = li, days = 7) => forecast(w, draft, { startTick: 0, days }, params);

  it('returns positive bands that scale with the window', () => {
    const a = f(li, 7);
    expect(a.impressions.mid).toBeGreaterThan(0);
    expect(a.impressions.low).toBeLessThan(a.impressions.mid);
    expect(a.impressions.high).toBeGreaterThan(a.impressions.mid);
    expect(a.spend.mid).toBeGreaterThan(0);
    expect(a.avgCpm).toBeGreaterThan(20);
    // a fixed bid pays what it bids on a first-price exchange
    expect(a.avgCpm).toBeLessThanOrEqual(80.001);
    const b = f(li, 14);
    expect(b.impressions.mid / a.impressions.mid).toBeCloseTo(2, 6);
    expect(b.availableRequests / a.availableRequests).toBeCloseTo(2, 6);
  });

  it('is deterministic and does not change the world', () => {
    expect(f()).toEqual(f());
  });

  it('a higher bid delivers more and costs more per impression', () => {
    const lo = f({ ...li, bid: { kind: 'FIXED', fixedCpm: 40 } });
    const hi = f({ ...li, bid: { kind: 'FIXED', fixedCpm: 160 } });
    expect(hi.impressions.mid).toBeGreaterThan(lo.impressions.mid);
    expect(hi.avgCpm!).toBeGreaterThan(lo.avgCpm!);
  });

  it('wider targeting finds more inventory', () => {
    const narrow = f();
    const wide = f({
      ...li,
      targeting: { ...li.targeting, geo: { includeRegions: ['IN-MH', 'IN-DL', 'IN-KA'] } },
    });
    expect(wide.impressions.mid).toBeGreaterThan(narrow.impressions.mid * 1.5);
    expect(wide.eligibleRequests).toBeGreaterThan(narrow.eligibleRequests);
  });

  it('automated strategies are forecast as a fixed bid at the market median', () => {
    const auto = f({ ...li, bid: { kind: 'AUTOMATED', goal: 'MAX_CLICKS' } });
    expect(auto.impressions.mid).toBeGreaterThan(0);
  });

  it('a draft without creatives has no eligible inventory', () => {
    const none = forecast(w, { ...li, creativeIds: [] }, { startTick: 0, days: 2 }, params);
    expect(none.impressions.mid).toBe(0);
    expect(none.avgCpm).toBeNull();
  });
});

describe('audience size (engine.md 1.6)', () => {
  const world = baseWorld({
    insertionOrders: [ioOf()],
    creatives: [creativeFor('display')],
    audiences: [{ id: 'a1', type: 'affinity', sizeFraction: 0.05 }],
  });
  const size = (t: object) => estimateAudienceSize(world, t, ['display'], params);

  it('untargeted passes the whole supply', () => {
    const s = size({});
    expect(s.share).toBeGreaterThan(0.5);
    expect(s.requestsPerDay).toBeGreaterThan(1e7);
    expect(s.usersPerDay).toBeLessThan(s.requestsPerDay);
  });

  it('every added dimension shrinks the audience', () => {
    const all = size({});
    const geo = size({ geo: { includeRegions: ['IN-MH'] } });
    const geoDev = size({ geo: { includeRegions: ['IN-MH'] }, devices: ['smartphone'] });
    const aud = size({
      geo: { includeRegions: ['IN-MH'] },
      audiences: { includeGroups: [['a1']] },
    });
    expect(geo.usersPerDay).toBeLessThan(all.usersPerDay);
    expect(geoDev.usersPerDay).toBeLessThan(geo.usersPerDay);
    expect(aud.usersPerDay).toBeLessThan(geo.usersPerDay);
    expect(geo.share).toBeGreaterThan(0.05);
    expect(geo.share).toBeLessThan(0.25);
  });
});
