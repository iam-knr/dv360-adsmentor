// The f.* filters the Search links carry, as the list pages read them (routes.md 6.1).
import { describe, expect, it } from 'vitest';
import {
  extraFilterChips,
  filterIoRows,
  filterLineItemRows,
  parseListFilters,
  statusFromParams,
} from '@/lib/search/list-filters';

const li = (over: Partial<Parameters<typeof filterLineItemRows>[0][number]> = {}) => ({
  name: 'LI',
  publicId: '10',
  type: 'DISPLAY',
  status: 'ACTIVE',
  budget: 1000,
  revenue: 100,
  clicks: 10,
  cpa: 5,
  ...over,
});

describe('parseListFilters', () => {
  it('reads known keys and drops unknown values', () => {
    const f = parseListFilters({
      'f.status': 'PAUSED',
      'f.type': ['YT_VIDEO', 'NOPE'],
      'f.pacingType': 'WRONG',
      'f.cpcOver': '-3',
      q: ' fest ',
    });
    expect(f.status).toBe('PAUSED');
    expect(f.types).toEqual(['YT_VIDEO']);
    expect(f.pacingType).toBeNull();
    expect(f.cpcOver).toBeNull();
    expect(f.q).toBe('fest');
    expect(statusFromParams({ 'f.status': 'bogus' })).toBeNull();
  });
});

describe('filterLineItemRows', () => {
  const today = '2026-10-31';
  it('filters by type and name/ID', () => {
    const rows = [li({ type: 'YT_VIDEO', name: 'Alpha' }), li({ name: 'Beta', publicId: '77' })];
    expect(
      filterLineItemRows(rows, parseListFilters({ 'f.type': 'YT_VIDEO' }), today),
    ).toHaveLength(1);
    expect(filterLineItemRows(rows, parseListFilters({ q: 'beta' }), today)[0]?.name).toBe('Beta');
    expect(filterLineItemRows(rows, parseListFilters({ q: '77' }), today)[0]?.name).toBe('Beta');
  });
  it('expiring soon: active, flight ends within 7 days', () => {
    const f = parseListFilters({ 'f.endsWithin': '7' });
    const rows = [
      li({ name: 'soon', flightEnd: '2026-11-03' }),
      li({ name: 'later', flightEnd: '2026-12-31' }),
      li({ name: 'ended', flightEnd: '2026-10-01' }),
      li({ name: 'paused', status: 'PAUSED', flightEnd: '2026-11-03' }),
    ];
    expect(filterLineItemRows(rows, f, today).map((r) => r.name)).toEqual(['soon']);
  });
  it('unused pacing: spent share well behind the elapsed share of the flight', () => {
    const f = parseListFilters({ 'f.pacing': 'UNDER' });
    const base = { flightStart: '2026-10-01', flightEnd: '2026-10-31', budget: 1000 };
    const rows = [
      li({ ...base, name: 'behind', revenue: 100 }),
      li({ ...base, name: 'on track', revenue: 980 }),
      li({ name: 'no flight', revenue: 0 }),
    ];
    expect(filterLineItemRows(rows, f, today).map((r) => r.name)).toEqual(['behind']);
  });
  it('CPC and CPA over X', () => {
    const rows = [
      li({ name: 'dear', revenue: 100, clicks: 10, cpa: 50 }),
      li({ name: 'cheap', revenue: 5, clicks: 10, cpa: 2 }),
      li({ name: 'no clicks', revenue: 5, clicks: 0, cpa: null }),
    ];
    expect(
      filterLineItemRows(rows, parseListFilters({ 'f.cpcOver': '2' }), today).map((r) => r.name),
    ).toEqual(['dear']);
    expect(
      filterLineItemRows(rows, parseListFilters({ 'f.cpaOver': '10' }), today).map((r) => r.name),
    ).toEqual(['dear']);
  });
});

describe('filterIoRows and chips', () => {
  it('pacing type', () => {
    const rows = [
      { name: 'a', publicId: '1', pacingType: 'AHEAD' },
      { name: 'b', publicId: '2', pacingType: 'EVEN' },
    ];
    expect(filterIoRows(rows, parseListFilters({ 'f.pacingType': 'AHEAD' }))).toHaveLength(1);
  });
  it('one chip per extra filter, never for Status', () => {
    const f = parseListFilters({
      'f.status': 'PAUSED',
      'f.type': ['YT_VIDEO', 'YT_AUDIO', 'YT_ON_CTV'],
      'f.pacingType': 'AHEAD',
      'f.cpcOver': '2.5',
    });
    expect(extraFilterChips(f).map((c) => c.label)).toEqual([
      'Type: YouTube',
      'Pacing type: Ahead',
      'CPC: over 2.5',
    ]);
  });
});
