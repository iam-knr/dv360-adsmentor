import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { apportion, splitVector, DIAGNOSTIC_DAYS } from '@/lib/seed/history-stub';
import { TEMPLATE_KEYS } from '@/lib/seed/knobs';
import { hashValue } from '@/lib/seed/hash';
import { buildHistory } from '@/lib/seed/history-stub';
import { TODAY, historyFor, num, planFor } from './fixtures';

const LEAVES = [
  'lostTargeting',
  'lostCreative',
  'lostFrequency',
  'lostBudget',
  'lostPacing',
  'lostBelowMinBid',
  'lostInternal',
  'lostExternalBid',
  'lostExternalCreative',
  'lostExternalOther',
  'lostNotReported',
] as const;
type Row = Record<string, unknown>;
const key = (r: Row) => `${(r.simDate as Date).toISOString().slice(0, 10)}|${String(r.lineItemId)}`;

function sumBy(rows: Row[], column: string) {
  return rows.reduce((s, r) => s + num(r[column]), 0);
}

describe('apportion', () => {
  it('always sums to the total (property)', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 1_000_000 }),
        fc.array(fc.double({ min: 0, max: 100, noNaN: true }), { minLength: 1, maxLength: 24 }),
        (total, weights) => {
          const parts = apportion(total, weights);
          const sum = weights.reduce((s, w) => s + w, 0);
          expect(parts.reduce((s, x) => s + x, 0)).toBe(sum > 0 ? total : 0);
          for (const p of parts) expect(Number.isInteger(p) && p >= 0).toBe(true);
        },
      ),
    );
  });

  it('follows the weights and is deterministic', () => {
    expect(apportion(10, [1, 1, 1, 1])).toEqual(apportion(10, [1, 1, 1, 1]));
    expect(apportion(100, [1, 3])).toEqual([25, 75]);
    expect(apportion(5, [0, 0])).toEqual([0, 0]);
  });

  it('splitVector keeps funnel conservation in every part', () => {
    const total = {
      lostTargeting: 1001,
      lostCreative: 57,
      lostFrequency: 13,
      lostBudget: 0,
      lostPacing: 22,
      lostBelowMinBid: 31,
      lostInternal: 18,
      lostExternalBid: 77,
      lostExternalCreative: 3,
      lostExternalOther: 9,
      lostNotReported: 14,
      impressions: 123,
      clicks: 4,
      revenue: 98_765_432,
    };
    const parts = splitVector(
      total,
      Array.from({ length: 24 }, (_, i) => 1 + (i % 5)),
    );
    const sumImpr = parts.reduce((s, p) => s + (p.impressions ?? 0), 0);
    expect(sumImpr).toBe(123);
    expect(parts.reduce((s, p) => s + (p.revenue ?? 0), 0)).toBe(98_765_432);
    for (const p of parts) {
      expect(p.bidRequests).toBe(
        LEAVES.reduce((s, k) => s + (p[k] ?? 0), 0) + (p.impressions ?? 0),
      );
      expect(p.clicks ?? 0).toBeLessThanOrEqual(p.impressions ?? 0);
    }
  });
});

describe.each(TEMPLATE_KEYS)('history stub of %s', (template) => {
  const plan = planFor(template, 7);
  const h = historyFor(template, 7);
  const totals = h.daily.filter((r) => r.sliceKind === 'total') as Row[];

  it('is deterministic', () => {
    expect(hashValue(buildHistory(plan))).toBe(hashValue(buildHistory(planFor(template, 7))));
    expect(hashValue(buildHistory(plan))).not.toBe(hashValue(buildHistory(planFor(template, 8))));
  });

  it('holds the funnel conservation law on every row: available = filtered + won', () => {
    for (const r of [...h.daily, ...h.hourly] as Row[]) {
      const lost = LEAVES.reduce((s, k) => s + num(r[k]), 0);
      expect(num(r.bidRequests), String(r.lineItemId)).toBe(lost + num(r.impressions));
      expect(num(r.bidResponses)).toBeGreaterThanOrEqual(num(r.impressions));
      expect(num(r.bidsSubmitted)).toBeGreaterThanOrEqual(num(r.bidResponses));
      expect(num(r.eligibleRequests)).toBeGreaterThanOrEqual(num(r.bidsSubmitted));
      expect(num(r.bidRequests)).toBeGreaterThanOrEqual(num(r.eligibleRequests));
    }
  });

  it('keeps counters ordered: clicks, viewable and quartiles never exceed impressions or their predecessor', () => {
    for (const r of totals) {
      const w = num(r.impressions);
      expect(num(r.clicks)).toBeLessThanOrEqual(w);
      expect(num(r.viewableImpressions)).toBeLessThanOrEqual(num(r.measurableImpressions));
      expect(num(r.measurableImpressions)).toBeLessThanOrEqual(w);
      expect(num(r.invalidImpressions) + num(r.billableImpressions)).toBe(w);
      expect(num(r.videoStarts)).toBeLessThanOrEqual(w);
      expect(num(r.videoQ1)).toBeLessThanOrEqual(num(r.videoStarts));
      expect(num(r.videoMid)).toBeLessThanOrEqual(num(r.videoQ1));
      expect(num(r.videoQ3)).toBeLessThanOrEqual(num(r.videoMid));
      expect(num(r.videoCompletions)).toBeLessThanOrEqual(num(r.videoQ3));
    }
  });

  it('daily total equals the sum of the exchange slices and the sum of the device slices', () => {
    const slices = h.daily.filter((r) => r.sliceKind !== 'total') as Row[];
    expect(slices.length).toBeGreaterThan(0);
    const byKey = (kind: string) => {
      const m = new Map<string, Row[]>();
      for (const r of slices.filter((x) => x.sliceKind === kind))
        (m.get(key(r)) ?? m.set(key(r), []).get(key(r))!).push(r);
      return m;
    };
    const exchange = byKey('exchange');
    const device = byKey('device');
    const columns = [
      'bidRequests',
      'impressions',
      'clicks',
      'viewableImpressions',
      'lostTargeting',
      'lostCreative',
      'lostBelowMinBid',
      'convTotal',
    ];
    for (const t of totals) {
      const k = key(t);
      if (exchange.has(k))
        for (const c of columns)
          expect(sumBy(exchange.get(k)!, c), `${k} exchange ${c}`).toBe(num(t[c]));
      if (device.has(k))
        for (const c of columns)
          expect(sumBy(device.get(k)!, c), `${k} device ${c}`).toBe(num(t[c]));
      if (exchange.has(k))
        for (const c of ['mediaCost', 'revenue', 'totalMediaCost'])
          expect(sumBy(exchange.get(k)!, c)).toBeCloseTo(num(t[c]), 5);
    }
  });

  it('only slices the most recent sliceDays and only the total beyond', () => {
    const cutoff =
      new Date(`${TODAY}T00:00:00Z`).getTime() - plan.meta.knobs.sliceDays * 86_400_000;
    for (const r of h.daily.filter((x) => x.sliceKind !== 'total'))
      expect((r.simDate as Date).getTime()).toBeGreaterThanOrEqual(cutoff);
    expect(totals.some((r) => (r.simDate as Date).getTime() < cutoff)).toBe(true);
  });

  it('hourly rows sum to the daily total for every day of the hourly window', () => {
    const hourlyByDay = new Map<string, Row[]>();
    for (const r of h.hourly as Row[]) {
      const hour = r.simHour as Date;
      const day = `${hour.toISOString().slice(0, 10)}|${String(r.lineItemId)}`;
      (hourlyByDay.get(day) ?? hourlyByDay.set(day, []).get(day)!).push(r);
    }
    expect(hourlyByDay.size).toBeGreaterThan(0);
    const dailyByKey = new Map(totals.map((t) => [key(t), t]));
    const columns = [
      'bidRequests',
      'eligibleRequests',
      'bidsSubmitted',
      'bidResponses',
      'impressions',
      'billableImpressions',
      'clicks',
      'viewableImpressions',
      'videoCompletions',
      'lostBudget',
      'lostExternalBid',
      'convTotal',
    ];
    for (const [day, rows] of hourlyByDay) {
      const t = dailyByKey.get(day)!;
      expect(t, day).toBeDefined();
      for (const c of columns) expect(sumBy(rows, c), `${day} ${c}`).toBe(num(t[c]));
      for (const c of ['mediaCost', 'revenue', 'refund'])
        expect(sumBy(rows, c)).toBeCloseTo(num(t[c]), 5);
      expect(rows.length).toBeLessThanOrEqual(24);
    }
    // nothing outside the window, and every day inside it that has a total has hours
    const from = new Date(`${TODAY}T00:00:00Z`).getTime() - plan.meta.knobs.hourlyDays * 86_400_000;
    for (const r of h.hourly) expect((r.simHour as Date).getTime()).toBeGreaterThanOrEqual(from);
    const withHours = new Set(hourlyByDay.keys());
    for (const t of totals)
      if ((t.simDate as Date).getTime() >= from && num(t.bidRequests) > 0)
        expect(withHours.has(key(t)), key(t)).toBe(true);
  });

  it('money adds up: total media cost is the sum of its parts and revenue equals it', () => {
    for (const r of totals) {
      const parts =
        num(r.mediaCost) +
        num(r.cpmFee1) +
        num(r.cpmFee2) +
        num(r.mediaFee1) +
        num(r.mediaFee2) +
        num(r.dataCost) +
        num(r.verificationCost) +
        num(r.adServingCost);
      expect(num(r.totalMediaCost)).toBeCloseTo(parts, 5);
      expect(num(r.revenue)).toBeCloseTo(num(r.totalMediaCost), 5);
    }
  });

  it('gives plausible CPM, CTR and viewability by format (engine calibration bands, loosened for a stub)', () => {
    const fmt = new Map(plan.profiles.map((p) => [p.liId, p.format]));
    const agg = new Map<
      string,
      { impr: number; media: number; clicks: number; measurable: number; viewable: number }
    >();
    for (const r of totals) {
      const f = fmt.get(r.lineItemId as string)!;
      const a = agg.get(f) ?? { impr: 0, media: 0, clicks: 0, measurable: 0, viewable: 0 };
      a.impr += num(r.impressions);
      a.media += num(r.mediaCost);
      a.clicks += num(r.clicks);
      a.measurable += num(r.measurableImpressions);
      a.viewable += num(r.viewableImpressions);
      agg.set(f, a);
    }
    const display = agg.get('display')!;
    const cpmInr = (display.media / display.impr) * 1000;
    // INR and SGD advertisers are mixed, so only a broad band is asserted (engine band is 35 to 120 INR for the INR advertiser)
    expect(cpmInr).toBeGreaterThan(0.5);
    expect(cpmInr).toBeLessThan(120);
    expect(display.clicks / display.impr).toBeGreaterThan(0.0005);
    expect(display.clicks / display.impr).toBeLessThan(0.0035);
    expect(display.viewable / display.measurable).toBeGreaterThan(0.4);
    expect(display.viewable / display.measurable).toBeLessThan(0.65);
    const ctv = agg.get('ctv')!;
    expect(ctv.viewable / ctv.measurable).toBeGreaterThan(0.85);
  });

  it('writes diagnostics only for the Troubleshooter window with milestone rows that match the daily totals', () => {
    const from = new Date(`${TODAY}T00:00:00Z`).getTime() - DIAGNOSTIC_DAYS * 86_400_000;
    for (const d of h.diagnostics) expect((d.date as Date).getTime()).toBeGreaterThanOrEqual(from);
    const won = new Map<string, number>();
    const available = new Map<string, number>();
    for (const d of h.diagnostics) {
      const k = `${(d.date as Date).toISOString().slice(0, 10)}|${d.lineItemId}`;
      if (d.reasonCode === 'M.WON') won.set(k, (won.get(k) ?? 0) + Number(d.count));
      if (d.reasonCode === 'M.AVAILABLE')
        available.set(k, (available.get(k) ?? 0) + Number(d.count));
    }
    for (const t of totals) {
      const k = key(t);
      if (won.has(k)) expect(won.get(k)).toBe(num(t.impressions));
      if (available.has(k)) expect(available.get(k)).toBe(num(t.bidRequests));
    }
    // unique key of the table
    const unique = new Set(
      h.diagnostics.map(
        (d) => `${d.lineItemId}|${(d.date as Date).toISOString()}|${d.exchangeId}|${d.reasonCode}`,
      ),
    );
    expect(unique.size).toBe(h.diagnostics.length);
  });

  it('has unique keys on the metric tables', () => {
    expect(
      new Set(
        h.daily.map(
          (r) =>
            `${r.lineItemId}|${(r.simDate as Date).toISOString()}|${r.sliceKind}|${r.sliceKey}`,
        ),
      ).size,
    ).toBe(h.daily.length);
    expect(
      new Set(h.hourly.map((r) => `${r.lineItemId}|${(r.simHour as Date).toISOString()}`)).size,
    ).toBe(h.hourly.length);
  });

  it('only has rows for live line items inside their flight', () => {
    const profiles = new Map(plan.profiles.map((p) => [p.liId, p]));
    for (const r of totals) {
      const p = profiles.get(r.lineItemId as string)!;
      const day = (r.simDate as Date).toISOString().slice(0, 10);
      expect(p.liveFrom, 'row for a line item that never goes live').not.toBeNull();
      expect(day >= (p.liveFrom as string)).toBe(true);
      expect(day <= (p.liveUntil ?? '9999')).toBe(true);
      expect(day < TODAY).toBe(true);
    }
  });
});

describe('history does not depend on the sandbox id', () => {
  it('twins with the same seed produce the same metrics under different ids', () => {
    const strip = (rows: Row[]) =>
      rows.map(({ sandboxId: _s, lineItemId: _l, exchangeId: _e, ...rest }) => rest);
    const a = buildHistory(planFor('starter-agency', 3, undefined, 'sbx-one'));
    const b = buildHistory(planFor('starter-agency', 3, undefined, 'sbx-two'));
    expect(hashValue(strip(a.daily as Row[]))).toBe(hashValue(strip(b.daily as Row[])));
    expect(hashValue(strip(a.hourly as Row[]))).toBe(hashValue(strip(b.hourly as Row[])));
    expect(a.daily[0]?.lineItemId).not.toBe(b.daily[0]?.lineItemId);
  });
});

describe('planted delivery stories show up in the numbers', () => {
  const plan = planFor('troubleshooting-lab', 7);
  const h = historyFor('troubleshooting-lab', 7);
  const totals = h.daily.filter((r) => r.sliceKind === 'total') as Row[];
  const lineItem = (tag: string, n = 0) => plan.stories.filter((s) => s.tag === tag)[n]!.entityId;
  const rowsOf = (liId: string) => totals.filter((r) => r.lineItemId === liId);
  const share = (rows: Row[], column: string) =>
    sumBy(rows, column) / Math.max(1, sumBy(rows, 'bidRequests'));
  const recent = (rows: Row[], days: number) =>
    rows.filter(
      (r) =>
        (r.simDate as Date).getTime() >=
        new Date(`${TODAY}T00:00:00Z`).getTime() - days * 86_400_000,
    );

  it('healthy delivers with a normal win rate and filters mostly by targeting', () => {
    const rows = rowsOf(lineItem('healthy'));
    expect(rows.length).toBeGreaterThan(20);
    const winRate = sumBy(rows, 'impressions') / sumBy(rows, 'bidResponses');
    expect(winRate).toBeGreaterThan(0.12);
    expect(winRate).toBeLessThan(0.45);
    expect(share(rows, 'lostBelowMinBid')).toBeLessThan(0.1);
  });

  it('bid too low: A.BELOW_MIN_BID filters most bids', () => {
    const rows = rowsOf(lineItem('bid-too-low'));
    expect(sumBy(rows, 'lostBelowMinBid') / sumBy(rows, 'bidsSubmitted')).toBeGreaterThan(0.9);
    const diag = h.diagnostics.filter(
      (d) => d.lineItemId === lineItem('bid-too-low') && d.reasonCode === 'A.BELOW_MIN_BID',
    );
    expect(diag.length).toBeGreaterThan(0);
  });

  it('targeting too narrow: targeting filters more than 99 percent', () => {
    const rows = rowsOf(lineItem('targeting-too-narrow'));
    expect(sumBy(rows, 'lostTargeting') / sumBy(rows, 'bidRequests')).toBeGreaterThan(0.99);
    const codes = new Set(
      h.diagnostics
        .filter((d) => d.lineItemId === lineItem('targeting-too-narrow'))
        .map((d) => d.reasonCode),
    );
    expect(codes.has('T.GEO') && codes.has('T.AUDIENCE')).toBe(true);
  });

  it('creative disapproved on an exchange: that exchange is filtered at the creative stage, the others deliver', () => {
    const li = lineItem('creative-disapproved-exchange', 0);
    const diag = h.diagnostics.filter((d) => d.lineItemId === li);
    const blocked = diag.filter((d) => d.reasonCode === 'C.NOT_APPROVED_EXCHANGE:DISAPPROVED');
    expect(blocked.length).toBeGreaterThan(0);
    expect(new Set(blocked.map((d) => d.exchangeId)).size).toBe(1);
    const blockedExchange = blocked[0]!.exchangeId;
    expect(diag.some((d) => d.exchangeId === blockedExchange && d.reasonCode === 'M.WON')).toBe(
      false,
    );
    expect(diag.some((d) => d.exchangeId !== blockedExchange && d.reasonCode === 'M.WON')).toBe(
      true,
    );
  });

  it('creative size mismatch: C.SIZE_MISMATCH dominates', () => {
    const li = lineItem('creative-size-mismatch');
    const codes = h.diagnostics.filter(
      (d) => d.lineItemId === li && d.stage === 'CREATIVE' && d.reasonCode.startsWith('C.'),
    );
    expect(codes.length).toBeGreaterThan(0);
    expect(codes.every((d) => d.reasonCode === 'C.SIZE_MISMATCH')).toBe(true);
  });

  it('budget exhausted: spend stops and the budget stage takes over', () => {
    const rows = rowsOf(lineItem('budget-exhausted'));
    const last7 = recent(rows, 7);
    expect(last7.length).toBeGreaterThan(0);
    expect(sumBy(last7, 'impressions')).toBe(0);
    expect(sumBy(last7, 'lostBudget')).toBeGreaterThan(0);
    expect(sumBy(rows, 'impressions')).toBeGreaterThan(0);
    const li = plan.lineItems.find((l) => l.id === lineItem('budget-exhausted'))!;
    expect(sumBy(rows, 'revenue')).toBeLessThanOrEqual(Number(li.budgetAmount));
    expect(sumBy(rows, 'revenue')).toBeGreaterThan(Number(li.budgetAmount) * 0.99);
    const codes = new Set(
      h.diagnostics
        .filter((d) => d.lineItemId === li.id && d.stage === 'BUDGET')
        .map((d) => d.reasonCode),
    );
    expect([...codes]).toEqual(['B.LINE_ITEM_BUDGET']);
  });

  it('frequency cap too tight: F.LINE_ITEM filters most eligible requests', () => {
    const rows = rowsOf(lineItem('frequency-cap-too-tight'));
    const filtered = sumBy(rows, 'lostFrequency');
    expect(
      filtered /
        (filtered +
          sumBy(rows, 'bidsSubmitted') +
          sumBy(rows, 'lostBudget') +
          sumBy(rows, 'lostPacing')),
    ).toBeGreaterThan(0.6);
  });

  it('paused line item: no rows in the last 10 days', () => {
    const rows = rowsOf(lineItem('paused-li'));
    expect(rows.length).toBeGreaterThan(0);
    expect(recent(rows, 10)).toHaveLength(0);
  });

  it('line item under a paused IO: rows stop when the IO was paused', () => {
    const rows = rowsOf(lineItem('li-under-paused-io'));
    expect(recent(rows, 4)).toHaveLength(0);
  });

  it('line item with no creatives: requests arrive and none become impressions', () => {
    const rows = rowsOf(lineItem('li-no-creatives'));
    expect(rows.length).toBeGreaterThan(10);
    expect(sumBy(rows, 'impressions')).toBe(0);
    expect(sumBy(rows, 'bidsSubmitted')).toBe(0);
    const codes = new Set(
      h.diagnostics
        .filter((d) => d.lineItemId === lineItem('li-no-creatives') && d.stage === 'CREATIVE')
        .map((d) => d.reasonCode),
    );
    expect(codes.has('C.NONE_ASSIGNED')).toBe(true);
  });

  it('line item with a future custom flight: nothing yet', () => {
    expect(rowsOf(lineItem('li-future-flight'))).toHaveLength(0);
  });

  it('IO story pace: underpacing IOs are below 90, the overpacing IO above 105', () => {
    const lastPacing = (ioId: string) => {
      const ids = new Set(plan.lineItems.filter((l) => l.ioId === ioId).map((l) => l.id));
      const rows = totals
        .filter((r) => ids.has(r.lineItemId as string) && r.ioPacingPct)
        .sort((a, b) => (a.simDate as Date).getTime() - (b.simDate as Date).getTime());
      return num(rows[rows.length - 1]?.ioPacingPct);
    };
    for (const s of plan.stories.filter((x) => x.tag === 'io-underpacing'))
      expect(lastPacing(s.entityId), s.entityName).toBeLessThan(90);
    for (const s of plan.stories.filter((x) => x.tag === 'io-overpacing'))
      expect(lastPacing(s.entityId)).toBeGreaterThan(105);
    const healthyIo = plan.lineItems.find((l) => l.id === lineItem('healthy'))!.ioId;
    expect(lastPacing(healthyIo)).toBeGreaterThan(90);
  });

  it('IO underperforming: conversions per click are well below the other IOs', () => {
    const under = plan.stories.find((s) => s.tag === 'io-underperforming')!.entityId;
    const ids = new Set(plan.lineItems.filter((l) => l.ioId === under).map((l) => l.id));
    const mine = totals.filter((r) => ids.has(r.lineItemId as string));
    const others = totals.filter((r) => !ids.has(r.lineItemId as string));
    const cvr = (rows: Row[]) => sumBy(rows, 'convTotal') / Math.max(1, sumBy(rows, 'impressions'));
    expect(cvr(mine)).toBeLessThan(cvr(others));
  });
});
