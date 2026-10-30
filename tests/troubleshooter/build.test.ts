// V-08-22..26: diagnostic rows to the five stages, conservation, parents of the percentages, CSV (module 08 5.1, 5.3).
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { buildTroubleshooter, troubleshooterCsv, type DiagRow } from '@/lib/troubleshooter/build';
import { bannerFor, NO_FUNNEL } from '@/lib/troubleshooter/banner';

const rows = (o: Record<string, number>): DiagRow[] =>
  Object.entries(o).map(([reasonCode, count]) => ({ reasonCode, count }));

/** A consistent funnel: each milestone is the previous one minus its filtered reasons. */
const sample = rows({
  'M.AVAILABLE': 1000,
  'T.GEO': 300,
  'T.AUDIENCE': 100,
  'C.SIZE_MISMATCH': 100,
  'C.NONE_ASSIGNED': 50,
  'M.ELIGIBLE': 450,
  'F.LINE_ITEM': 50,
  'B.LINE_ITEM_DAILY': 100,
  'P.LINE_ITEM_PACING': 100,
  'M.BIDS_SUBMITTED': 200,
  'A.BELOW_MIN_BID': 60,
  'A.LOST_INTERNAL': 20,
  'A.LOST_INTERNAL:OWN_LINE_ITEM': 20,
  'M.BID_RESPONSES': 100,
  'E.BID_TOO_LOW': 30,
  'E.CREATIVE': 10,
  'E.OTHER': 5,
  'E.LOST_NOT_REPORTED': 15,
  'M.WON': 40,
});

describe('buildTroubleshooter', () => {
  it('always has the five stages in order with the verbatim labels and table titles (V-08-22)', () => {
    const b = buildTroubleshooter(sample);
    expect(b.stages.map((s) => s.label)).toEqual([
      'Total available requests',
      'Eligible impressions',
      'Bids submitted',
      'Bid responses',
      'Impressions won',
    ]);
    expect(b.stages.map((s) => s.filtered?.tableTitle)).toEqual([
      'Filtered impressions',
      'Filtered eligible impressions',
      'Filtered by the auction',
      'Externally filtered responses',
      undefined,
    ]);
    expect(b.kpis).toEqual({
      availableRequests: 1000,
      bidResponses: 100,
      impressionsWon: 40,
      winRate: 0.4,
    });
  });

  it('rolls reasons up and expands sub-reasons', () => {
    const b = buildTroubleshooter(sample);
    const avail = b.stages[0]!.filtered!.rows;
    expect(avail.map((r) => [r.label, r.count])).toEqual([
      ['Targeting', 400],
      ['Creative(s)', 150],
    ]);
    expect(avail[0]!.children!.map((c) => c.label)).toEqual(['Geography', 'Audience lists']);
    const auction = b.stages[2]!.filtered!.rows;
    expect(auction.map((r) => [r.label, r.count])).toEqual([
      ['Below the minimum bid', 60],
      ['Auction lost (internal)', 40],
    ]);
    expect(auction[1]!.children).toEqual([
      expect.objectContaining({ label: 'Your other line items', count: 20 }),
    ]);
  });

  it('conserves each stage: total = filtered + next total, percent uses its parent (V-08-23, V-08-26)', () => {
    const b = buildTroubleshooter(sample);
    for (let i = 0; i < 4; i++) {
      const s = b.stages[i]!;
      expect(s.total).toBe(s.filtered!.totalFiltered + b.stages[i + 1]!.total);
      for (const r of s.filtered!.rows) expect(r.pct).toBeCloseTo(r.count / s.total, 10);
    }
  });

  it('holds the invariants for random consistent funnels (V-08-23)', () => {
    fc.assert(
      fc.property(
        fc.array(fc.nat({ max: 1000 }), { minLength: 10, maxLength: 10 }),
        fc.nat({ max: 1000 }),
        (n, won) => {
          const [t, c, f, bu, p, bm, lo, eb, ec, eo] = n as [
            number,
            number,
            number,
            number,
            number,
            number,
            number,
            number,
            number,
            number,
          ];
          const ext = eb + ec + eo + lo;
          const W = won;
          const R = W + ext;
          const S = R + bm + lo;
          const E = S + f + bu + p;
          const A = E + t + c;
          const b = buildTroubleshooter(
            rows({
              'M.AVAILABLE': A,
              'T.GEO': t,
              'C.SIZE_MISMATCH': c,
              'M.ELIGIBLE': E,
              'F.LINE_ITEM': f,
              'B.LINE_ITEM_DAILY': bu,
              'P.LINE_ITEM_PACING': p,
              'M.BIDS_SUBMITTED': S,
              'A.BELOW_MIN_BID': bm,
              'A.LOST_INTERNAL': lo,
              'M.BID_RESPONSES': R,
              'E.BID_TOO_LOW': eb,
              'E.CREATIVE': ec,
              'E.OTHER': eo,
              'E.LOST_NOT_REPORTED': lo,
              'M.WON': W,
            }),
          );
          for (let i = 0; i < 4; i++)
            expect(b.stages[i]!.total).toBe(
              b.stages[i]!.filtered!.totalFiltered + b.stages[i + 1]!.total,
            );
        },
      ),
    );
  });

  it('sums per inventory to the same as all (V-08-24)', () => {
    const half = sample.map((r) => ({ ...r, count: r.count / 2 }));
    const two = [...half, ...half];
    expect(buildTroubleshooter(two)).toEqual(buildTroubleshooter(sample));
  });

  it('leaves the auction table empty for deal supply with no auction rows (V-08-25)', () => {
    const b = buildTroubleshooter(
      rows({
        'M.AVAILABLE': 10,
        'M.ELIGIBLE': 10,
        'M.BIDS_SUBMITTED': 10,
        'M.BID_RESPONSES': 10,
        'M.WON': 10,
      }),
    );
    expect(b.stages[2]!.filtered!.rows).toEqual([]);
    expect(b.kpis.winRate).toBe(1);
  });

  it('has no divide by zero for an empty funnel', () => {
    const b = buildTroubleshooter([]);
    expect(b.kpis).toEqual({
      availableRequests: 0,
      bidResponses: 0,
      impressionsWon: 0,
      winRate: 0,
    });
    expect(b.flows.every((f) => f.value === 0)).toBe(true);
  });

  it('writes the CSV of 5.3 (AC-08-24)', () => {
    const csv = troubleshooterCsv(buildTroubleshooter(sample), {
      inventory: 'All',
      from: '2026-01-01',
      to: '2026-01-07',
    });
    const lines = csv.split('\n');
    expect(lines[0]).toBe(
      'Stage,Reason,Sub-reason,Count,Percent of parent,Inventory,Date from,Date to',
    );
    expect(lines[1]).toBe(
      'Total available requests,Total available requests,,1000,,All,2026-01-01,2026-01-07',
    );
    expect(csv).toContain(
      'Total available requests,Targeting,,400,40.00,All,2026-01-01,2026-01-07',
    );
    expect(csv).toContain(
      'Total available requests,Targeting,Geography,300,30.00,All,2026-01-01,2026-01-07',
    );
    expect(csv.endsWith('\n')).toBe(true);
  });
});

describe('bannerFor', () => {
  it('maps the statuses of 5.1', () => {
    expect(bannerFor('PAUSED')).toMatchObject({
      text: 'The line item is paused.',
      severity: 'ERROR',
      action: { label: 'Go to line item settings' },
    });
    expect(bannerFor('ACTIVE_LIMITED_BY_BID')).toMatchObject({
      severity: 'WARNING',
      action: { label: 'Raise bid' },
    });
    expect(bannerFor('ARCHIVED')?.action).toBeUndefined();
    expect(bannerFor('ACTIVE_DELIVERING')).toBeUndefined();
  });
  it('shows the banner only for not-live states', () => {
    expect(NO_FUNNEL).toContain('PAUSED');
    expect(NO_FUNNEL).not.toContain('ACTIVE_LIMITED_BY_BID');
  });
});
