// Runs every case table (validation.md 6.7).
import { describe, expect, it } from 'vitest';
import { allCases, run } from './catalogue';

describe('case ids are unique', () => {
  it('has no repeated id', () => {
    const ids = allCases.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe.each(allCases)('$id', (c) => {
  it('raises exactly the expected issues', () => {
    const got = run(c);
    expect(got.map((i) => `${i.ruleId}:${i.severity}`).sort()).toEqual([...c.expect].sort());
    expect(got.every((i) => i.blocking === (i.severity === 'error'))).toBe(true);
  });

  if (c.message) {
    it('uses the verbatim message', () => {
      const first = c.expect[0]!.split(':')[0];
      const issue = run(c).find((i) => i.ruleId === first);
      expect(issue?.message).toBe(c.message);
    });
  }
});
