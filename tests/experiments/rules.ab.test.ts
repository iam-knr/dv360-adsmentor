// AB rules (module 17 4.5, acceptance 2, 4, 5, 9). Fixtures per rule id.
import { describe, expect, it } from 'vitest';
import { abIssues, scopeOf, type AbEntityInfo, type AbRuleCtx } from '@/lib/experiments/rules';
import type { AbTestInput } from '@/lib/experiments/types';

const io = (name: string, over: Partial<AbEntityInfo> = {}): AbEntityInfo => ({
  kind: 'IO',
  name,
  scope: 'CROSS_EXCHANGE',
  budgetWarning: false,
  inactive: false,
  liftable: false,
  ...over,
});

const entities = new Map<string, AbEntityInfo>([
  ['io1', io('IO One')],
  ['io2', io('IO Two')],
  ['io3', io('IO Three', { budgetWarning: true })],
  ['io4', io('IO Four', { scope: 'YOUTUBE', liftable: true })],
  ['io5', io('IO Five', { scope: 'YOUTUBE', liftable: true })],
  ['io6', io('IO Six', { inactive: true })],
  ['li1', { ...io('LI One'), kind: 'LI' }],
  ['li2', { ...io('LI Two'), kind: 'LI' }],
]);
const ctx = (over: Partial<AbRuleCtx> = {}): AbRuleCtx => ({
  mode: 'create',
  today: '2026-01-10',
  started: false,
  entities,
  usedElsewhere: new Map(),
  ...over,
});
const base = (over: Partial<AbTestInput> = {}): AbTestInput => ({
  name: 'Test',
  startDate: '2026-01-10',
  target: 'INSERTION_ORDER',
  goal: 'CONVERSIONS',
  confidence: 'P90',
  excludeUnidentifiedUsers: false,
  arms: [
    { name: 'Arm 1', splitPct: 50, isControl: true, entityIds: ['io1'] },
    { name: 'Arm 2', splitPct: 50, isControl: false, entityIds: ['io2'] },
  ],
  ...over,
});
const ids = (i: ReturnType<typeof abIssues>) => i.map((x) => x.ruleId);

describe('AB rules', () => {
  it('accepts the defaults of a filled form', () => {
    expect(abIssues(base(), ctx()).filter((i) => i.blocking)).toEqual([]);
  });
  it('AB-001 empty name, AB-002 long name, AB-003 long hypothesis', () => {
    const a = abIssues(base({ name: ' ' }), ctx()).find((i) => i.ruleId === 'AB-001');
    expect(a?.message).toBe('Enter a value');
    expect(ids(abIssues(base({ name: 'x'.repeat(101) }), ctx()))).toContain('AB-002');
    expect(ids(abIssues(base({ hypothesis: 'x'.repeat(401) }), ctx()))).toContain('AB-003');
  });
  it('AB-004 and AB-005 dates, AB-028 past start on create only', () => {
    expect(ids(abIssues(base({ startDate: '' }), ctx()))).toContain('AB-004');
    expect(ids(abIssues(base({ endDate: '2026-01-09' }), ctx()))).toContain('AB-005');
    expect(ids(abIssues(base({ startDate: '2026-01-09' }), ctx()))).toContain('AB-028');
    expect(ids(abIssues(base({ startDate: '2026-01-09' }), ctx({ mode: 'edit' })))).not.toContain('AB-028');
  });
  it('AB-008 one arm, AB-027 more than five arms', () => {
    const one = base({ arms: [{ name: 'A', splitPct: 100, isControl: true, entityIds: ['io1'] }] });
    expect(abIssues(one, ctx()).find((i) => i.ruleId === 'AB-008')?.message).toBe('Add at least 2 arms.');
    const six = base({
      arms: Array.from({ length: 6 }, (_, i) => ({ name: `A${i}`, splitPct: 10, isControl: i === 0, entityIds: [] })),
    });
    expect(ids(abIssues(six, ctx()))).toContain('AB-027');
  });
  it('AB-011 a new arm with 0% says "Enter a larger number"; AB-010 empty split', () => {
    const t = base({
      arms: [
        { name: 'Arm 1', splitPct: 100, isControl: true, entityIds: ['io1'] },
        { name: 'Arm 2', splitPct: 0, isControl: false, entityIds: ['io2'] },
      ],
    });
    expect(abIssues(t, ctx()).find((i) => i.ruleId === 'AB-011')?.message).toBe('Enter a larger number');
    const e = base({ arms: [{ name: 'A', splitPct: '', isControl: true, entityIds: ['io1'] }, { name: 'B', splitPct: 50, isControl: false, entityIds: ['io2'] }] });
    expect(ids(abIssues(e, ctx()))).toContain('AB-010');
  });
  it('AB-012 splits that do not total 100 (60 / 30)', () => {
    const t = base({
      arms: [
        { name: 'A', splitPct: 60, isControl: true, entityIds: ['io1'] },
        { name: 'B', splitPct: 30, isControl: false, entityIds: ['io2'] },
      ],
    });
    expect(abIssues(t, ctx()).find((i) => i.ruleId === 'AB-012')?.message).toBe('Audience splits must add up to 100%.');
  });
  it('AB-013 needs exactly one control', () => {
    const none = base({ arms: base().arms.map((a) => ({ ...a, isControl: false })) });
    const two = base({ arms: base().arms.map((a) => ({ ...a, isControl: true })) });
    expect(ids(abIssues(none, ctx()))).toContain('AB-013');
    expect(ids(abIssues(two, ctx()))).toContain('AB-013');
  });
  it('AB-014 an arm without entities, AB-015 the same entity in two arms', () => {
    const empty = base({ arms: [{ name: 'A', splitPct: 50, isControl: true, entityIds: [] }, { name: 'B', splitPct: 50, isControl: false, entityIds: ['io2'] }] });
    expect(abIssues(empty, ctx()).find((i) => i.ruleId === 'AB-014')?.message).toBe('Select at least one insertion order for each arm.');
    const dup = base({ arms: [{ name: 'A', splitPct: 50, isControl: true, entityIds: ['io1'] }, { name: 'B', splitPct: 50, isControl: false, entityIds: ['io1'] }] });
    expect(ids(abIssues(dup, ctx()))).toContain('AB-015');
  });
  it('AB-026 an entity already in another active test', () => {
    const used = new Map([['io2', 'Other test']]);
    expect(abIssues(base(), ctx({ usedElsewhere: used })).find((i) => i.ruleId === 'AB-026')?.message).toBe('IO Two is already part of another test.');
  });
  it('AB-021 mixing insertion orders and line items', () => {
    const t = base({ arms: [{ name: 'A', splitPct: 50, isControl: true, entityIds: ['io1'] }, { name: 'B', splitPct: 50, isControl: false, entityIds: ['li1'] }] });
    expect(ids(abIssues(t, ctx()))).toContain('AB-021');
  });
  it('AB-016 a goal that does not apply to the channel (MX-14)', () => {
    const yt = base({ goal: 'VIDEO_COMPLETIONS', arms: [{ name: 'A', splitPct: 50, isControl: true, entityIds: ['io4'] }, { name: 'B', splitPct: 50, isControl: false, entityIds: ['io5'] }] });
    expect(ids(abIssues(yt, ctx()))).toContain('AB-016');
    expect(ids(abIssues({ ...yt, goal: 'VIEWS_YOUTUBE' }, ctx()))).not.toContain('AB-016');
  });
  it('AB-017 confidence', () => {
    expect(ids(abIssues(base({ confidence: 'P80' as never }), ctx()))).toContain('AB-017');
  });
  it('AB-018 lift info for line items and cross exchange insertion orders; AB-019 warning only for cross exchange IOs', () => {
    const li = base({ target: 'LINE_ITEM', arms: [{ name: 'A', splitPct: 50, isControl: true, entityIds: ['li1'] }, { name: 'B', splitPct: 50, isControl: false, entityIds: ['li2'] }] });
    const a = abIssues(li, ctx()).find((i) => i.ruleId === 'AB-018');
    expect(a?.severity).toBe('info');
    expect(a?.message).toContain('Lift studies are not applicable');
    const w = abIssues(base({ excludeUnidentifiedUsers: true }), ctx()).find((i) => i.ruleId === 'AB-019');
    expect(w?.severity).toBe('warning');
    const yt = base({ excludeUnidentifiedUsers: true, goal: 'CLICKS', arms: [{ name: 'A', splitPct: 50, isControl: true, entityIds: ['io4'] }, { name: 'B', splitPct: 50, isControl: false, entityIds: ['io5'] }] });
    expect(ids(abIssues(yt, ctx()))).not.toContain('AB-019');
  });
  it('AB-022 brand lift needs YouTube or Demand Gen insertion orders', () => {
    const lift = { liftEnabled: true, brandLift: { metrics: ['AWARENESS' as const], brandName: 'B', competitors: [], language: 'en-US', objectType: 'Brand', intendedAction: null } };
    expect(ids(abIssues(base(lift), ctx()))).toContain('AB-022');
    const yt = base({ ...lift, goal: 'CLICKS', arms: [{ name: 'A', splitPct: 50, isControl: true, entityIds: ['io4'] }, { name: 'B', splitPct: 50, isControl: false, entityIds: ['io5'] }] });
    expect(abIssues(yt, ctx()).filter((i) => i.blocking)).toEqual([]);
  });
  it('AB-023 warns about budgets but allows the choice; AB-029 warns about inactive entities', () => {
    const t = base({ arms: [{ name: 'A', splitPct: 50, isControl: true, entityIds: ['io3'] }, { name: 'B', splitPct: 50, isControl: false, entityIds: ['io6'] }] });
    const i = abIssues(t, ctx());
    expect(i.find((x) => x.ruleId === 'AB-023')?.message).toBe('The total budget of all line items is greater than the insertion order budget.');
    expect(i.find((x) => x.ruleId === 'AB-023')?.blocking).toBe(false);
    expect(i.find((x) => x.ruleId === 'AB-029')?.message).toBe("IO Six isn't active and won't deliver.");
  });
});

describe('locks after the start (AC 9)', () => {
  const original = {
    startDate: '2026-01-05',
    endDate: null,
    arms: [
      { id: 'a1', splitPct: 50, isControl: true, entityIds: ['io1'] },
      { id: 'a2', splitPct: 50, isControl: false, entityIds: ['io2'] },
    ],
  };
  const edit = (over: Partial<AbTestInput> = {}) =>
    base({
      startDate: '2026-01-05',
      arms: [
        { id: 'a1', name: 'Arm 1', splitPct: 50, isControl: true, entityIds: ['io1'] },
        { id: 'a2', name: 'Arm 2', splitPct: 50, isControl: false, entityIds: ['io2'] },
      ],
      ...over,
    });
  const c = ctx({ mode: 'edit', started: true, original });
  it('name, hypothesis and end date change freely', () => {
    expect(abIssues(edit({ name: 'New name', hypothesis: 'h', endDate: '2026-02-01' }), c).filter((i) => i.blocking)).toEqual([]);
  });
  it('AB-006 dates, AB-024 splits, arms and control', () => {
    expect(abIssues(edit({ startDate: '2026-01-06' }), c).find((i) => i.ruleId === 'AB-006')?.message).toBe("Dates can't be changed after the test has started.");
    const splits = edit({ arms: [{ id: 'a1', name: 'Arm 1', splitPct: 60, isControl: true, entityIds: ['io1'] }, { id: 'a2', name: 'Arm 2', splitPct: 40, isControl: false, entityIds: ['io2'] }] });
    expect(abIssues(splits, c).find((i) => i.ruleId === 'AB-024')?.message).toBe("Arms can't be changed after the test has started.");
    const swap = edit({ arms: [{ id: 'a1', name: 'Arm 1', splitPct: 50, isControl: true, entityIds: ['io1', 'io3'] }, { id: 'a2', name: 'Arm 2', splitPct: 50, isControl: false, entityIds: ['io2'] }] });
    expect(ids(abIssues(swap, c))).toContain('AB-024');
  });
  it('an unstarted test keeps everything editable', () => {
    expect(ids(abIssues(edit({ startDate: '2026-01-12' }), ctx({ mode: 'edit', started: false, original })))).not.toContain('AB-006');
  });
});

describe('channel scope', () => {
  it('derives one scope or MIXED', () => {
    expect(scopeOf([])).toBe('CROSS_EXCHANGE');
    expect(scopeOf(['YOUTUBE', 'YOUTUBE'])).toBe('YOUTUBE');
    expect(scopeOf(['YOUTUBE', 'DEMAND_GEN'])).toBe('MIXED');
  });
});
