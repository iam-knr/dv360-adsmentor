// Location list resolution (module 15 4.1, LOC-003..005): postal codes, DMA names, lat/long, addresses, radius.
import { describe, expect, it } from 'vitest';
import { geocode, resolveLocationEntries, type GeoOptionRef } from '@/lib/resources/location';

const OPTIONS: GeoOptionRef[] = [
  { id: 'in', code: 'IN', name: 'India', kind: 'COUNTRY' },
  { id: 'us', code: 'US', name: 'United States', kind: 'COUNTRY' },
  { id: 'dma1', code: 'US-DMA-1', name: 'Metro One', kind: 'DMA' },
];

describe('regional entries', () => {
  it('resolves postal codes and DMA names', () => {
    const r = resolveLocationEntries('REGIONAL', '560001\nMetro One\nUS-DMA-1', OPTIONS);
    expect(r.unresolved).toEqual([]);
    expect(r.resolved.map((x) => x.resolvedLabel)).toEqual([
      '560001 (postal code, India)',
      'Metro One (DMA region)',
      'Metro One (DMA region)',
    ]);
  });

  it('numbers unresolved lines (LOC-004)', () => {
    const r = resolveLocationEntries('REGIONAL', '560001\n\n!!\nabc', OPTIONS);
    expect(r.unresolved.map((u) => u.line)).toEqual([3, 4]);
  });

  it('removes repeated lines', () => {
    const r = resolveLocationEntries('REGIONAL', '560001\n560001', OPTIONS);
    expect(r.resolved).toHaveLength(1);
    expect(r.duplicates).toBe(1);
  });
});

describe('proximity entries', () => {
  it('accepts lat,lng with an optional radius in km', () => {
    const r = resolveLocationEntries('PROXIMITY', '12.9716, 77.5946; 10\n19.076,72.8777', OPTIONS);
    expect(r.unresolved).toEqual([]);
    expect(r.resolved[0]).toMatchObject({ lat: 12.9716, lng: 77.5946, radiusKm: 10 });
    expect(r.resolved[1]?.radiusKm).toBe(5);
  });

  it('rejects a radius outside 1 to 500 km', () => {
    const r = resolveLocationEntries('PROXIMITY', '12.9,77.5;0\n12.9,77.5;501', OPTIONS);
    expect(r.unresolved).toHaveLength(2);
  });

  it('accepts an address with at least two comma-separated parts and rejects one word', () => {
    const r = resolveLocationEntries('PROXIMITY', '12 Orchard Lane, Bengaluru\nBengaluru', OPTIONS);
    expect(r.resolved).toHaveLength(1);
    expect(r.unresolved[0]?.line).toBe(2);
  });

  it('rejects an impossible latitude', () => {
    const r = resolveLocationEntries('PROXIMITY', '95.0, 77.5', OPTIONS);
    expect(r.unresolved).toHaveLength(1);
  });

  it('geocodes deterministically inside the country box', () => {
    const a = geocode('12 Orchard Lane, Bengaluru', 'IN');
    expect(geocode('12 Orchard Lane, Bengaluru', 'IN')).toEqual(a);
    expect(a.lat).toBeGreaterThan(8);
    expect(a.lat).toBeLessThan(35);
    expect(geocode('12 Orchard Lane, Bengaluru', 'SG').lat).toBeLessThan(1.5);
  });
});
