import { describe, expect, it } from 'vitest';
import { rowsToState, stateToRows, type TargetingState } from '@/lib/targeting';

const state = (criteria: TargetingState['criteria']): TargetingState => ({
  version: 1,
  lineItemType: 'DISPLAY',
  criteria,
});
const trip = (s: TargetingState) => rowsToState(stateToRows(s), s.lineItemType);

describe('round trip through stateToRows / rowsToState (AC-10-24)', () => {
  it('geography: regions, radius points and an empty state', () => {
    const geo = state({
      geography: {
        regions: [
          { id: 'IN-MH-mumbai', mode: 'INCLUDE', label: 'Mumbai' },
          { id: 'IN-KA', mode: 'EXCLUDE', label: 'Karnataka' },
        ],
        radius: { points: [{ lat: 19.07, lng: 72.87, radiusKm: 12.5, label: '19.07, 72.87' }] },
      },
    });
    expect(trip(geo).criteria.geography).toEqual(geo.criteria.geography);
    const empty = state({ geography: { regions: [] } });
    expect(trip(empty).criteria.geography?.regions ?? []).toEqual([]);
  });
  it('apps and URLs in both modes', () => {
    const a = state({
      appsAndUrls: {
        channelIds: [],
        collections: [{ id: 'COLLECTION_GAMES', mode: 'INCLUDE' }],
        urls: [
          { id: 'a.com', mode: 'INCLUDE' },
          { id: 'b.com', mode: 'EXCLUDE' },
        ],
        apps: [{ id: 'com.example.app', mode: 'EXCLUDE' }],
      },
    });
    const back = trip(a).criteria.appsAndUrls!;
    const ids = (l: { id: string; mode: string }[]) => l.map((x) => `${x.mode}:${x.id}`).sort();
    expect(ids(back.urls)).toEqual(ids(a.criteria.appsAndUrls!.urls));
    expect(ids(back.apps)).toEqual(ids(a.criteria.appsAndUrls!.apps));
    expect(ids(back.collections)).toEqual(ids(a.criteria.appsAndUrls!.collections));
  });
  it('brand suitability with a provider and options', () => {
    const b = state({
      brandSuitability: {
        inventoryMode: 'MAXIMUM',
        thirdParty: {
          provider: 'DOUBLEVERIFY',
          options: ['authentic-brand-safety', 'display-viewability'],
        },
      },
    });
    expect(trip(b).criteria.brandSuitability).toEqual(b.criteria.brandSuitability);
  });
  it('audience lists: groups, sections and exclusions', () => {
    const a = state({
      audienceLists: {
        include: {
          firstPartyGroups: [['a1', 'a2'], ['a3']],
          google: ['7000037'],
          combined: ['c1'],
          custom: ['u1'],
        },
        exclude: { firstParty: ['x1'], google: ['7000074'] },
      },
    });
    const back = trip(a).criteria.audienceLists!;
    expect(back.include.firstPartyGroups.map((g) => [...g].sort())).toEqual([['a1', 'a2'], ['a3']]);
    expect(back.include.google).toEqual(['7000037']);
    expect(back.include.combined).toEqual(['c1']);
    expect(back.include.custom).toEqual(['u1']);
    expect(back.exclude).toEqual({ firstParty: ['x1'], google: ['7000074'] });
  });
});
