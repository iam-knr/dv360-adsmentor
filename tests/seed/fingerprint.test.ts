// Regression for the CI flake in sandbox.db.test.ts determinism (docs/gaps/fix-db-flake.md): rows that tie on the sort
// key come back in whatever order Postgres likes, so a fingerprint must not depend on that order.
import { describe, expect, it } from 'vitest';
import { hashValue } from '@/lib/seed/hash';
import { diffParts, fingerprintOf } from './fingerprint';

// the real tie: the YouTube seed gives each advertiser a line item with the same name in a different IO
const a = { name: 'YouTube target frequency', io: 'Product Launch | IO 1.2', type: 'YT_VIDEO' };
const b = { name: 'YouTube target frequency', io: 'Festive Sale | IO 3.2', type: 'YT_VIDEO' };

describe('sandbox fingerprint', () => {
  it('the old fingerprint (stable sort by name only) depends on the order tied rows arrive in', () => {
    const byName = (rows: { name: string }[]) =>
      hashValue([...rows].sort((x, y) => x.name.localeCompare(y.name)));
    expect(byName([a, b])).not.toBe(byName([b, a])); // this is what made two identical sandboxes differ
  });

  it('the canonical fingerprint is the same for any order of the rows', () => {
    const m1 = { name: a.name, io: a.io, simHour: 1, impressions: 5 };
    const m2 = { name: b.name, io: b.io, simHour: 1, impressions: 7 };
    expect(fingerprintOf({ lis: [a, b], hourly: [m1, m2] })).toBe(
      fingerprintOf({ lis: [b, a], hourly: [m2, m1] }),
    );
  });

  it('still tells different worlds apart, and the diff names the section and the row', () => {
    const x = { lis: [a, b], hourly: [{ name: a.name, io: a.io, impressions: 5 }] };
    const y = { lis: [a, b], hourly: [{ name: a.name, io: a.io, impressions: 6 }] };
    expect(fingerprintOf(x)).not.toBe(fingerprintOf(y));
    const diff = diffParts(x, y);
    expect(diff).toContain('hourly: 1 vs 1 rows');
    expect(diff).not.toContain('lis:');
    expect(diffParts(x, x)).toBe('');
  });
});
