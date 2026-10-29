// Brand controls coverage per row (module 15 4.4, RC-037) with fixture line items and partner / advertiser rows.
import { describe, expect, it } from 'vitest';
import {
  computeBrandControls,
  eligibleLineItems,
  ivtSeries,
  type BrandInputs,
  type BrandLineItem,
} from '@/lib/resources/brand-controls';

const li = (id: string, over: Partial<BrandLineItem> = {}): BrandLineItem => ({
  id,
  name: `LI ${id}`,
  status: 'ACTIVE',
  type: 'DISPLAY',
  inventoryQuality: 'AUTHORIZED_DIRECT_SELLERS_AND_RESELLERS',
  targets: [],
  ...over,
});

const base = (over: Partial<BrandInputs> = {}): BrandInputs => ({
  lineItems: [],
  advertiserRows: [],
  partnerRows: [],
  ...over,
});

describe('coverage rows', () => {
  it('counts exclusions set on the line item itself', () => {
    const inputs = base({
      lineItems: [
        li('1', { targets: [{ dimension: 'DIGITAL_CONTENT_LABEL', mode: 'EXCLUDE' }] }),
        li('2', { targets: [{ dimension: 'DIGITAL_CONTENT_LABEL', mode: 'INCLUDE' }] }),
        li('3'),
        li('4', { targets: [{ dimension: 'APPS_AND_URLS', mode: 'EXCLUDE', refType: 'CHANNEL' }] }),
      ],
    });
    const r = computeBrandControls(inputs, 'display', 'active');
    const row = (k: string) => r.rows.find((x) => x.key === k)!;
    expect(row('CONTENT_LABEL')).toMatchObject({
      enabled: 1,
      total: 4,
      pct: 25,
      label: '1/4 Line items',
    });
    expect(row('APPS_URLS_CHANNELS')).toMatchObject({ enabled: 1, pct: 25 });
    expect(row('KEYWORDS').enabled).toBe(0);
  });

  it('counts a keyword list assignment and a keyword exclude, but not an include', () => {
    const inputs = base({
      lineItems: [
        li('1', {
          targets: [
            { dimension: 'NEGATIVE_KEYWORD_LIST', mode: 'EXCLUDE', refType: 'KEYWORD_LIST' },
          ],
        }),
        li('2', { targets: [{ dimension: 'KEYWORD', mode: 'EXCLUDE' }] }),
        li('3', { targets: [{ dimension: 'KEYWORD', mode: 'INCLUDE' }] }),
      ],
    });
    expect(
      computeBrandControls(inputs, 'display', 'active').rows.find((x) => x.key === 'KEYWORDS'),
    ).toMatchObject({
      enabled: 2,
      total: 3,
      pct: 67,
    });
  });

  it('advertiser and partner locked rows cover every line item and name the source', () => {
    const inputs = base({
      lineItems: [
        li('1'),
        li('2', { targets: [{ dimension: 'DIGITAL_CONTENT_LABEL', mode: 'EXCLUDE' }] }),
      ],
      advertiserRows: [{ dimension: 'DIGITAL_CONTENT_LABEL', mode: 'EXCLUDE' }],
      partnerRows: [{ dimension: 'THIRD_PARTY_VERIFIER', mode: 'INCLUDE' }],
    });
    const r = computeBrandControls(inputs, 'display', 'active');
    expect(r.rows.find((x) => x.key === 'CONTENT_LABEL')).toMatchObject({ enabled: 2, pct: 100 });
    expect(r.breakdown.CONTENT_LABEL.map((b) => b.source)).toEqual(['Advertiser', 'Line item']);
    expect(r.breakdown.VERIFICATION.map((b) => b.source)).toEqual(['Partner', 'Partner']);
    expect(r.rows.find((x) => x.key === 'CONTENT_LABEL')!.summary).toBe(
      'Partner restrictions: none · Advertiser restrictions: enabled',
    );
  });

  it('Authorized sellers is enabled for direct and direct-and-resellers, not for non-participating', () => {
    const inputs = base({
      lineItems: [
        li('1', { inventoryQuality: 'AUTHORIZED_DIRECT_SELLERS' }),
        li('2'),
        li('3', { inventoryQuality: 'AUTHORIZED_AND_NON_PARTICIPATING' }),
      ],
    });
    expect(
      computeBrandControls(inputs, 'display', 'active').rows.find(
        (x) => x.key === 'AUTHORIZED_SELLERS',
      ),
    ).toMatchObject({ enabled: 2, total: 3, pct: 67 });
  });

  it('shows four rows at partner level and five at advertiser level (RC-037)', () => {
    expect(computeBrandControls(base(), 'display', 'active', 'advertiser').rows).toHaveLength(5);
    const partner = computeBrandControls(base(), 'display', 'active', 'partner').rows;
    expect(partner).toHaveLength(4);
    expect(partner.some((r) => r.key === 'AUTHORIZED_SELLERS')).toBe(false);
  });

  it('an advertiser without line items is 0 % with "No line items yet"', () => {
    const r = computeBrandControls(base(), 'display', 'active');
    expect(
      r.rows.every((x) => x.pct === 0 && x.total === 0 && x.summary === 'No line items yet'),
    ).toBe(true);
  });
});

describe('tabs and filters', () => {
  const lis = [
    li('d1'),
    li('d2', { status: 'PAUSED' }),
    li('d3', { status: 'DRAFT' }),
    li('d4', { status: 'ARCHIVED' }),
    li('y1', { type: 'YT_VIDEO' }),
    li('y2', { type: 'DEMAND_GEN' }),
    li('y3', { type: 'YT_AUDIO', status: 'PAUSED' }),
  ];

  it('the YouTube tab counts only YouTube and Demand Gen line items', () => {
    expect(eligibleLineItems(lis, 'youtube', 'all').map((l) => l.id)).toEqual(['y1', 'y2', 'y3']);
    expect(eligibleLineItems(lis, 'display', 'all').map((l) => l.id)).toEqual(['d1', 'd2']);
  });

  it('Active line items keeps serving statuses; drafts and archived never count', () => {
    expect(eligibleLineItems(lis, 'display', 'active').map((l) => l.id)).toEqual(['d1']);
  });
});

describe('IVT card', () => {
  it('is empty when nothing was blocked', () => {
    expect(ivtSeries([{ date: '2026-10-01', blocked: 0, impressions: 100 }])).toEqual([]);
    expect(ivtSeries([])).toEqual([]);
  });

  it('is blocked / (blocked + impressions) by day, sorted', () => {
    expect(
      ivtSeries([
        { date: '2026-10-02', blocked: 10, impressions: 90 },
        { date: '2026-10-01', blocked: 0, impressions: 100 },
      ]),
    ).toEqual([
      { date: '2026-10-01', blockedPct: 0 },
      { date: '2026-10-02', blockedPct: 10 },
    ]);
  });
});
