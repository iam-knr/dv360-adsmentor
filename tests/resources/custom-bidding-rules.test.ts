// CB rule table: valid and invalid fixtures (validation.md 2.21 CB block, module 15 4.3, T-122..T-124).
import { describe, expect, it } from 'vitest';
import { MSG, validate } from '@/lib/validation';
import { resourceCtx, validCustomBidding } from './fixtures';

const run = (entity: unknown, trigger: 'save' | 'cross' = 'save') =>
  validate('customBidding', entity, resourceCtx(), { trigger, includeInfo: true });
const has = (issues: ReturnType<typeof run>, id: string) => issues.filter((i) => i.ruleId === id);

describe('custom bidding rules (CB)', () => {
  it('a valid algorithm has no blocking issue', () => {
    expect(run(validCustomBidding()).filter((i) => i.blocking)).toEqual([]);
  });

  it('CB-001 empty name', () => {
    expect(has(run({ ...validCustomBidding(), name: ' ' }), 'CB-001')[0]?.message).toBe(
      MSG.ENTER_VALUE,
    );
  });

  it('CB-002 objective not chosen or unknown', () => {
    for (const objective of [null, 'NOPE']) {
      expect(has(run({ ...validCustomBidding(), objective }), 'CB-002')[0]?.message).toBe(
        MSG.SELECTION_REQUIRED,
      );
    }
  });

  it('CB-003 script only for the Custom objective (dormant in v1)', () => {
    expect(has(run({ ...validCustomBidding(), source: 'SCRIPT' }), 'CB-003')).toHaveLength(1);
    expect(
      has(run({ ...validCustomBidding(), source: 'SCRIPT', objective: 'CUSTOM' }), 'CB-003'),
    ).toHaveLength(0);
  });

  it('CB-004 needs at least one rule (T-122)', () => {
    expect(has(run({ ...validCustomBidding(), rules: [] }), 'CB-004')[0]?.message).toBe(
      'At least 1 rule is required',
    );
  });

  it('CB-005 score missing or not a number', () => {
    const rules = [
      { groupKey: 'Click rules', signalKey: 'CLICKED' },
      { groupKey: 'Click rules', signalKey: 'CLICKED', score: 'abc' },
      { groupKey: 'Click rules', signalKey: 'CLICKED', score: 3 },
    ];
    expect(has(run({ ...validCustomBidding(), rules }), 'CB-005').map((i) => i.path)).toEqual([
      'rules[0].score',
      'rules[1].score',
    ]);
  });

  it('CB-006 more than four multipliers (T-123)', () => {
    const kinds = ['AD_POSITION', 'CREATIVE_DIMENSION', 'DAY_AND_TIME', 'DEVICE_TYPE', 'GENRE'];
    const multipliers = kinds.map((kind) => ({ kind, values: [] }));
    expect(has(run({ ...validCustomBidding(), multipliers }), 'CB-006')).toHaveLength(1);
    expect(
      has(run({ ...validCustomBidding(), multipliers: multipliers.slice(0, 4) }), 'CB-006'),
    ).toHaveLength(0);
  });

  it('CB-007 duplicate or unknown multiplier type (T-124)', () => {
    const multipliers = [
      { kind: 'DEVICE_TYPE', values: [] },
      { kind: 'DEVICE_TYPE', values: [] },
      { kind: 'COLOUR', values: [] },
    ];
    expect(has(run({ ...validCustomBidding(), multipliers }), 'CB-007').map((i) => i.path)).toEqual(
      ['multipliers[1].kind', 'multipliers[2].kind'],
    );
  });

  it('CB-012 factor between 0.1 and 10', () => {
    const bad = (multiplier: unknown) => [
      { kind: 'DEVICE_TYPE', values: [{ valueKey: 'TABLET', multiplier }] },
    ];
    for (const m of [0.05, 11, '', 'x']) {
      expect(has(run({ ...validCustomBidding(), multipliers: bad(m) }), 'CB-012')).toHaveLength(1);
    }
    for (const m of [0.1, 1, 10, '2.5']) {
      expect(has(run({ ...validCustomBidding(), multipliers: bad(m) }), 'CB-012')).toHaveLength(0);
    }
  });

  it('CB-010 warns for a training algorithm in use; CB-011 blocks a suspended one', () => {
    const base = { ...validCustomBidding(), usedByActiveLineItems: 2 };
    const training = run({ ...base, status: 'TRAINING' });
    expect(has(training, 'CB-010')[0]).toMatchObject({ severity: 'warning', blocking: false });
    const suspended = run({ ...base, status: 'SUSPENDED' });
    expect(has(suspended, 'CB-011')[0]?.blocking).toBe(true);
    expect(has(run({ ...base, status: 'ACTIVE' }), 'CB-010')).toHaveLength(0);
    expect(
      has(run({ ...base, status: 'TRAINING', usedByActiveLineItems: 0 }), 'CB-010'),
    ).toHaveLength(0);
  });
});
