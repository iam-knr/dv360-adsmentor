import { describe, expect, it } from 'vitest';
import {
  GEO_MESSAGES,
  MAP_CELLS,
  fitViewBox,
  geoRowLabel,
  mapShade,
  parsePoints,
  radiusError,
  searchRegions,
  toKm,
  fromKm,
  toRadiusPoint,
} from '@/lib/targeting/geo';
import {
  geographyError,
  insideExcluded,
} from '@/components/targeting/editors/geography/GeographyEditor';
import { summarizeTargeting } from '@/lib/targeting';

describe('region search (AC-10-04)', () => {
  it('finds Mumbai with the catalogue label "Mumbai, Maharashtra, India (City)"', () => {
    const hit = searchRegions('mumbai')[0]!;
    expect(hit.code).toBe('IN-MH-mumbai');
    expect(geoRowLabel(hit)).toBe('Mumbai, Maharashtra, India (City)');
  });
  it('matches every word of the query against the path', () => {
    expect(searchRegions('pune maharashtra').map((o) => o.label)).toContain('Pune');
    expect(searchRegions('pune kerala')).toEqual([]);
  });
  it('lists airports and universities', () => {
    expect(searchRegions('airport').some((o) => o.kind === 'Airport')).toBe(true);
    expect(searchRegions('university').some((o) => o.kind === 'University')).toBe(true);
  });
});

describe('bulk points of interest (V-10-06, V-10-22, TGT-011)', () => {
  it('accepts latitude, longitude pairs', () => {
    const r = parsePoints('19.07,72.87');
    expect(r.errors).toEqual([]);
    expect(r.points[0]).toMatchObject({ lat: 19.07, lng: 72.87, source: 'LATLNG' });
  });
  it('rejects text that is neither an address nor a pair', () => {
    const r = parsePoints('foo');
    expect(r.points).toEqual([]);
    expect(r.errors[0]).toMatchObject({
      line: 1,
      ruleId: 'TGT-011',
      message: GEO_MESSAGES.BAD_POINT,
    });
  });
  it('rejects coordinates outside the globe', () => {
    expect(parsePoints('91,10').errors).toHaveLength(1);
    expect(parsePoints('10,181').errors).toHaveLength(1);
  });
  it('geocodes a street address inside its city, deterministically', () => {
    const a = parsePoints('221 Linking Road, Bandra, Mumbai');
    const b = parsePoints('221 Linking Road, Bandra, Mumbai');
    expect(a.errors).toEqual([]);
    expect(a.points[0]!.source).toBe('ADDRESS');
    expect(a.points[0]!.lat).toBeGreaterThan(18.89);
    expect(a.points[0]!.lat).toBeLessThan(19.27);
    expect(a).toEqual(b);
  });
  it('an address with no known city is an error', () => {
    expect(parsePoints('12 Nowhere Street, Atlantis').errors).toHaveLength(1);
  });
  it('partial success: valid lines come back with the invalid ones as errors (1 valid, 1 invalid)', () => {
    const r = parsePoints('19.07,72.87\n\nnot an address\n');
    expect(r.points).toHaveLength(1);
    expect(r.errors).toHaveLength(1);
    expect(r.errors[0]!.line).toBe(3);
  });
});

describe('radius (V-10-07, TGT-012)', () => {
  it('1 and 500 pass, 0 and 501 fail', () => {
    expect(radiusError(1)).toBeNull();
    expect(radiusError(500)).toBeNull();
    expect(radiusError(0)).toBe(GEO_MESSAGES.BAD_RADIUS);
    expect(radiusError(501)).toBe(GEO_MESSAGES.BAD_RADIUS);
    expect(radiusError(Number.NaN)).toBe(GEO_MESSAGES.BAD_RADIUS);
  });
  it('converts miles to km and back', () => {
    expect(toKm(10, 'MI')).toBeCloseTo(16.09344, 5);
    expect(fromKm(toKm(7, 'MI'), 'MI')).toBeCloseTo(7, 9);
    const p = toRadiusPoint({ lat: 1, lng: 2, label: 'x', source: 'LATLNG', line: 1 }, 10, 'MI');
    expect(p.radiusKm).toBeCloseTo(16.09344, 5);
  });
  it('blocks Apply when a stored radius is out of range', () => {
    expect(
      geographyError({
        geography: { regions: [], radius: { points: [{ lat: 1, lng: 1, radiusKm: 600 }] } },
      }),
    ).toBe(GEO_MESSAGES.BAD_RADIUS);
    expect(
      geographyError({
        geography: { regions: [], radius: { points: [{ lat: 1, lng: 1, radiusKm: 5 }] } },
      }),
    ).toBeNull();
  });
});

describe('map selection shading and "All locations"', () => {
  it('shades a state when it, or a city inside it, is selected', () => {
    const regions = [{ id: 'IN-MH-mumbai', mode: 'INCLUDE' as const }];
    expect(mapShade('IN-MH', regions)).toBe('INCLUDE');
    expect(mapShade('IN-KA', regions)).toBe('NONE');
  });
  it('shades excluded states differently', () => {
    expect(mapShade('IN-KA', [{ id: 'IN-KA', mode: 'EXCLUDE' }])).toBe('EXCLUDE');
  });
  it('the map has cells for the states of the catalogue', () => {
    expect(MAP_CELLS.length).toBeGreaterThan(25);
    expect(MAP_CELLS.find((c) => c.code === 'IN-MH')).toBeDefined();
  });
  it('fit shrinks the view box to the selection', () => {
    const [, , w] = fitViewBox([{ id: 'IN-MH', mode: 'INCLUDE' }]);
    const [, , full] = fitViewBox([]);
    expect(w).toBeLessThan(full);
  });
  it('an empty geography reads "All locations" (RC-044)', () => {
    expect(summarizeTargeting('GEOGRAPHY', { geography: { regions: [] } })).toBe('All locations');
    expect(
      summarizeTargeting('GEOGRAPHY', {
        geography: { regions: [{ id: 'IN-MH-mumbai', mode: 'INCLUDE', label: 'Mumbai' }] },
      }),
    ).toBe('Region inclusions: Mumbai');
  });
  it('warns when an included city sits in an excluded state (TGT-013)', () => {
    const regions = [
      { id: 'IN-MH', mode: 'EXCLUDE' as const },
      { id: 'IN-MH-pune', mode: 'INCLUDE' as const },
    ];
    expect(insideExcluded(regions).map((r) => r.id)).toEqual(['IN-MH-pune']);
  });
});
