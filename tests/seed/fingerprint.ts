// Canonical form of a sandbox "world" for comparing two sandboxes (sandbox.db.test.ts determinism).
// Line item names are NOT unique inside a sandbox (lib/youtube/seed.ts seeds "YouTube target frequency" on both
// advertisers), so a query that sorts by name alone returns tied rows in an unspecified order, and two identical
// sandboxes could hash differently (docs/gaps/fix-db-flake.md). Rows therefore carry their IO name and every section
// is sorted by the full content of the row, which makes the result independent of the order the database returns.
import { hashValue } from '@/lib/seed/hash';

const show = (v: unknown) =>
  JSON.stringify(v, (_, w: unknown) => (typeof w === 'bigint' ? w.toString() : w));

export type FingerprintParts = Record<string, unknown[]>;

/** Sorts every section by the serialised row, so equal sets of rows give equal parts whatever order they arrived in. */
export function canonicalParts(parts: FingerprintParts): FingerprintParts {
  const out: FingerprintParts = {};
  for (const k of Object.keys(parts).sort())
    out[k] = parts[k]!.map((r) => [show(r), r] as const)
      .sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0))
      .map((x) => x[1]);
  return out;
}

export const fingerprintOf = (parts: FingerprintParts): string => hashValue(canonicalParts(parts));

/** Names every section where two sets of parts differ, with the first differing row; '' when equal. */
export function diffParts(x: FingerprintParts, y: FingerprintParts): string {
  const [cx, cy] = [canonicalParts(x), canonicalParts(y)];
  const out: string[] = [];
  for (const k of Object.keys(cx)) {
    const [ax, ay] = [cx[k]!, cy[k] ?? []];
    if (hashValue(ax) === hashValue(ay)) continue;
    const i = ax.findIndex((r, n) => hashValue(r) !== hashValue(ay[n]));
    out.push(
      `${k}: ${ax.length} vs ${ay.length} rows, first difference at #${i}: ${show(ax[i])} vs ${show(ay[i])}`,
    );
  }
  return out.join('\n');
}
