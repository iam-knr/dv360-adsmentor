// Every case ID named by the specs is either covered by a test here or listed as belonging to a later session.
import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { readDoc, ROOT } from './docs';

const here = resolve(ROOT, 'tests/validation');
const ownSources = readdirSync(here)
  .filter((f) => f.endsWith('.ts') && f !== 'traceability.test.ts')
  .map((f) => readFileSync(resolve(here, f), 'utf8'))
  .join('\n');

/** Cases that belong to services, YouTube, targeting and other domains (build-plan 4.4 "OUT OF SCOPE"). */
const LATER: Record<string, string> = {
  'V-06-13': 'campaign duplicate service (P3-06b)',
  'V-06-14': 'archive cascade service (P3-06b)',
  'V-06-15': 'copy settings service (P3-06b)',
  'V-06-16': 'KPI actual formula, needs the engine metrics (P3-09)',
  'V-06-17': 'alert groups builder (P3-06b)',
  'V-07-20': 'IO duplicate service (P3-06b)',
  'V-07-21': 'automation propagation service (P3-06b)',
  'V-08-22': 'troubleshooter builder (P3-06c)',
  'V-08-23': 'troubleshooter invariants (P3-06c)',
  'V-08-24': 'troubleshooter inventory filter (P3-06c)',
  'V-08-25': 'troubleshooter PG deals (P3-06c)',
  'V-08-26': 'troubleshooter percent parents (P3-06c)',
  'V-08-27': 'troubleshooter banners (P3-06c)',
  'V-08-28': 'troubleshooter CSV (P3-06c)',
  'V-08-29': 'line item duplicate service (P3-06c)',
  'V-08-30': 'bulk apply template service (P3-06c)',
  // validation.md 6.7: YouTube, ad group, ad, targeting, creative, audience, A/B, lift, resources, inventory
  ...Object.fromEntries(
    Array.from({ length: 131 - 71 }, (_, i) => [
      `T-${String(i + 72).padStart(2, '0')}`,
      'domain of a later session',
    ]),
  ),
  'S-05': 'deal transition (INV domain)',
  'S-06': 'deal transition (INV domain)',
  'S-07': 'A/B test transition (AB domain)',
};

function idsIn(markdown: string, pattern: RegExp): string[] {
  return [...new Set([...markdown.matchAll(pattern)].map((m) => m[0]))];
}

describe('case traceability', () => {
  const modules = ['06-campaigns', '07-insertion-orders', '08-line-items'].flatMap((f) =>
    idsIn(readDoc(`docs/specs/modules/${f}.md`), /\bV-0[678]-\d{2}\b/g),
  );
  const doc = readDoc('docs/specs/validation.md');
  const tables = idsIn(doc, /^\| (T-\d{2,3}|S-\d{2}|D-\d{2}) \|/gm).map((s) =>
    s.replace(/[| ]/g, ''),
  );

  it('finds the specified case IDs', () => {
    expect(modules.length).toBeGreaterThanOrEqual(60);
    expect(tables.length).toBeGreaterThanOrEqual(150);
  });

  it.each([...modules, ...tables])('%s is covered or assigned to a later session', (id) => {
    if (id in LATER) return;
    expect(ownSources.includes(id), `no test mentions ${id}`).toBe(true);
  });

  it('lists only IDs that exist', () => {
    const all = new Set([...modules, ...tables]);
    for (const id of Object.keys(LATER)) expect(all.has(id), id).toBe(true);
  });
});
