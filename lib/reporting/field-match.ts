// Matching of typed field names in the report builder's Bulk edit (Q10). Pure; shared by the dialog and the tests.
import type { ReportFieldDef } from './catalogue/types';

type Named = Pick<ReportFieldDef, 'key' | 'label' | 'kind'>;

const norm = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

function distance(a: string, b: string): number {
  const prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    let diag = prev[0]!;
    prev[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = prev[j]!;
      prev[j] = Math.min(prev[j]! + 1, prev[j - 1]! + 1, diag + (a[i - 1] === b[j - 1] ? 0 : 1));
      diag = tmp;
    }
  }
  return prev[b.length]!;
}

/** Up to `limit` valid labels closest to `text`: contains or is contained, shared words, then edit distance. */
export function nearestFields<T extends Named>(text: string, fields: readonly T[], limit = 5): T[] {
  const q = norm(text);
  if (!q) return [];
  const words = new Set(q.split(' '));
  const scored = fields.map((f) => {
    const l = norm(f.label);
    const lw = l.split(' ');
    const shared = lw.filter((w) => words.has(w)).length;
    let score = 0;
    const bare = norm(f.label.replace(/\([^)]*\)/g, ''));
    if (l === q) score = 1000;
    else if (bare === q) score = 700;
    else if (l.startsWith(q) || q.startsWith(l)) score = 500 - Math.abs(l.length - q.length);
    else if (l.includes(q) || q.includes(l)) score = 300 - Math.abs(l.length - q.length);
    else if (shared > 0) score = 100 * (shared / Math.max(words.size, lw.length)) - 1;
    else score = 20 - distance(l, q) / 2;
    return { f, score };
  });
  return scored
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score || a.f.label.localeCompare(b.f.label))
    .slice(0, limit)
    .map((s) => s.f);
}

/** The field a typed line names: exact key or label, ignoring case, spacing and punctuation. */
export function resolveField<T extends Named>(
  text: string,
  fields: readonly T[],
  kind: Named['kind'],
): T | undefined {
  const q = norm(text);
  return fields.find((f) => f.kind === kind && (f.key === text.trim() || norm(f.label) === q));
}

/** One sentence for an unknown name: what was not found and the nearest valid names. */
export function unknownFieldMessage<T extends Named>(
  bad: string[],
  fields: readonly T[],
  kind: Named['kind'],
): string {
  const pool = fields.filter((f) => f.kind === kind);
  const parts = bad.map((name) => {
    const near = nearestFields(name, pool);
    return near.length
      ? `"${name}" (did you mean ${near.map((f) => `"${f.label}"`).join(', ')}?)`
      : `"${name}"`;
  });
  return `Unknown fields: ${parts.join('; ')}. Use the exact names from the field list on the page.`;
}
