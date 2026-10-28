// Every non-alias rule ID of the implemented domains has at least one case (validation.md 6.7).
import { describe, expect, it } from 'vitest';
import { allRules } from '@/lib/validation';
import { allCases } from './catalogue';
import { IMPLEMENTED } from './docs';

/**
 * Rules that exist only to document something the UI does (a note, a default, a disabled button, the
 * "activation with an error" row). They have no message, so the engine never emits them and no case can
 * expect them. The set is pinned so a rule cannot become documentation-only by accident.
 */
const DOCUMENTATION_ONLY = [
  'CMP-016',
  'CMP-070',
  'IO-043',
  'IO-090',
  'IO-100',
  'LI-045',
  'LI-110',
  'LI-VID-002',
  'LI-CTV-002',
  'LI-CTV-003',
  'LI-CTV-006',
  'LI-AUD-004',
  'LI-DOOH-006',
];

const rules = allRules().filter((r) => IMPLEMENTED.test(r.id));
const expected = new Set(allCases.flatMap((c) => c.expect.map((e) => e.split(':')[0]!)));

describe('rule coverage', () => {
  it('pins the documentation-only rules', () => {
    const silent = rules.filter((r) => r.message === null).map((r) => r.id);
    expect(silent.sort()).toEqual([...DOCUMENTATION_ONLY].sort());
  });

  it.each(rules.filter((r) => r.message !== null).map((r) => r.id))('%s has a case', (id) => {
    expect(expected.has(id), `no case expects ${id}`).toBe(true);
  });
});
