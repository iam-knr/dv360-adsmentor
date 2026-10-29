// AUD rules: one valid and one invalid fixture each (validation.md 2.19, module 14 6.3 `rules.audience`, `lock`).
import { describe, expect, it } from 'vitest';
import { MSG, validate } from '@/lib/validation';
import type { AudienceRuleInput } from '@/lib/validation/rules/audience';
import { resourceCtx } from '../resources/fixtures';

const run = (a: AudienceRuleInput, mode: 'create' | 'edit' = 'create') =>
  validate('audience', a, resourceCtx({ mode }), { includeInfo: true });
const ids = (a: AudienceRuleInput, mode: 'create' | 'edit' = 'create') => run(a, mode).map((i) => i.ruleId);

const tag = (o: Partial<AudienceRuleInput> = {}): AudienceRuleInput => ({
  type: 'TAG_BASED',
  name: 'Visitors',
  floodlightActivityId: '123',
  activityRemarketing: true,
  tagRules: [{ variableKey: 'u1', operator: 'EQUALS', value: 'x' }],
  membershipDays: 30,
  ...o,
});
const lookalike = (o: Partial<AudienceRuleInput> = {}): AudienceRuleInput => ({
  type: 'LOOKALIKE',
  name: 'Lookalike',
  seeds: [{ id: 'a', users: 5000 }],
  reachPct: 5,
  countries: ['IN'],
  ...o,
});

describe('valid fixtures', () => {
  it.each([
    tag(),
    lookalike(),
    { type: 'COMBINED', name: 'C', includeGroups: [['a']], excludeIds: ['b'] },
    { type: 'CUSTOM_AFFINITY', name: 'A', interests: ['x'], urls: [] },
    { type: 'CUSTOM_INTENT_YOUTUBE', name: 'I', keywords: ['k'] },
    { type: 'YOUTUBE_USERS', name: 'Y', linkedChannels: 1, membershipDays: 30 },
    { type: 'CUSTOMER_MATCH', name: 'M', dataSource: 'UPLOAD', file: { present: true }, consentAck: true, membershipDays: 30 },
  ] as AudienceRuleInput[])('%# has no blocking issue', (a) => {
    expect(run(a).filter((i) => i.blocking)).toEqual([]);
  });
});

describe('names (AUD-001, AUD-002)', () => {
  it('AUD-001 empty name says Enter a value', () => {
    expect(run(tag({ name: ' ' })).find((i) => i.ruleId === 'AUD-001')?.message).toBe(MSG.ENTER_VALUE);
  });
  it('AUD-002 more than 255 characters', () => {
    expect(ids(tag({ name: 'x'.repeat(256) }))).toContain('AUD-002');
  });
});

describe('tag-based (AUD-010 to AUD-012)', () => {
  it('AUD-010 needs an activity', () => expect(ids(tag({ floodlightActivityId: null }))).toContain('AUD-010'));
  it('AUD-011 a rule row with an empty value', () => {
    const issues = run(tag({ tagRules: [{ variableKey: 'u1', operator: 'EQUALS', value: '' }] }));
    expect(issues.find((i) => i.ruleId === 'AUD-011')?.path).toBe('tagRules[0].value');
  });
  it('AUD-012 activity without remarketing', () => expect(ids(tag({ activityRemarketing: false }))).toContain('AUD-012'));
});

describe('customer match (AUD-020 to AUD-025)', () => {
  const cm = (o: Partial<AudienceRuleInput> = {}): AudienceRuleInput => ({
    type: 'CUSTOMER_MATCH',
    name: 'M',
    dataSource: 'UPLOAD',
    file: { present: true },
    consentAck: true,
    membershipDays: 30,
    ...o,
  });
  it('AUD-020 needs a data source', () => expect(ids(cm({ dataSource: null }))).toContain('AUD-020'));
  it('AUD-021 no file or no identifier column', () => {
    expect(ids(cm({ file: { present: false } }))).toContain('AUD-021');
    expect(ids(cm({ file: { present: true, error: 'NO_IDENTIFIER' } }))).toContain('AUD-021');
    expect(ids(cm({ file: { present: true, error: 'NOT_CSV' } }))).toContain('AUD-021');
  });
  it('AUD-022 warns for fewer than 1,000 matched users, never blocks', () => {
    const w = run(cm({ matchedUsersInUse: 800 })).find((i) => i.ruleId === 'AUD-022');
    expect(w?.severity).toBe('warning');
    expect(w?.blocking).toBe(false);
    expect(ids(cm({ matchedUsersInUse: 1000 }))).not.toContain('AUD-022');
  });
  it('AUD-023 consent box', () => expect(ids(cm({ consentAck: false }))).toContain('AUD-023'));
  it.each([0, 541, 1.5, 'x'])('AUD-024 rejects %s days', (d) =>
    expect(ids(cm({ membershipDays: d }))).toContain('AUD-024'),
  );
  it.each([1, 540])('AUD-024 accepts %s days', (d) => expect(ids(cm({ membershipDays: d }))).not.toContain('AUD-024'));
  it('AUD-025 more than 100,000 rows', () =>
    expect(ids(cm({ file: { present: true, error: 'TOO_MANY_ROWS' } }))).toContain('AUD-025'));
  it('is not asked for a file when the source is a connected product or later', () => {
    expect(ids(cm({ dataSource: 'CONNECT', file: null, consentAck: false }))).not.toContain('AUD-021');
    expect(ids(cm({ dataSource: 'LATER', file: null, consentAck: false }))).not.toContain('AUD-023');
  });
});

describe('combined (AUD-030, 031, 111, 112)', () => {
  const c = (o: Partial<AudienceRuleInput> = {}): AudienceRuleInput => ({ type: 'COMBINED', name: 'C', includeGroups: [['a']], excludeIds: [], ...o });
  it('AUD-030 needs an include member', () => expect(ids(c({ includeGroups: [[]] }))).toContain('AUD-030'));
  it('AUD-031 the same list on both sides', () => expect(ids(c({ excludeIds: ['a'] }))).toContain('AUD-031'));
  it('AUD-111 cycle', () => expect(ids(c({ cyclic: true }))).toContain('AUD-111'));
  it('AUD-112 warns when every included list is archived', () => {
    const w = run(c({ allIncludedArchived: true })).find((i) => i.ruleId === 'AUD-112');
    expect(w?.blocking).toBe(false);
  });
});

describe('lookalike (AUD-040 to AUD-044)', () => {
  it('AUD-040 zero and eleven seeds', () => {
    expect(ids(lookalike({ seeds: [] }))).toContain('AUD-040');
    const eleven = Array.from({ length: 11 }, (_, i) => ({ id: `s${i}`, users: 5000 }));
    expect(ids(lookalike({ seeds: eleven }))).toContain('AUD-040');
    expect(ids(lookalike({ seeds: eleven.slice(0, 10) }))).not.toContain('AUD-040');
  });
  it('AUD-041 a seed under 1,000 users uses LOOKALIKE_MIN', () => {
    const issue = run(lookalike({ seeds: [{ id: 'a', users: 999 }] })).find((i) => i.ruleId === 'AUD-041');
    expect(issue?.message).toBe(MSG.LOOKALIKE_MIN);
    expect(ids(lookalike({ seeds: [{ id: 'a', users: 1000 }] }))).not.toContain('AUD-041');
  });
  it.each([2.5, 5, 7.5, 10])('AUD-042 accepts %s', (r) => expect(ids(lookalike({ reachPct: r }))).not.toContain('AUD-042'));
  it.each([0, 6.25, 12])('AUD-042 rejects %s', (r) => expect(ids(lookalike({ reachPct: r }))).toContain('AUD-042'));
  it('AUD-043 needs a country', () => expect(ids(lookalike({ countries: [] }))).toContain('AUD-043'));
  it('AUD-044 documents the disabled Save and never fires', () => expect(ids(lookalike())).not.toContain('AUD-044'));
});

describe('custom lists (AUD-050 to AUD-052, AUD-080)', () => {
  it('AUD-050 affinity with no entry', () =>
    expect(ids({ type: 'CUSTOM_AFFINITY', name: 'A', interests: [], urls: [], apps: [] })).toContain('AUD-050'));
  it('AUD-051 is the estimator message and never blocks', () =>
    expect(run({ type: 'CUSTOM_AFFINITY', name: 'A', interests: ['x'] }).some((i) => i.ruleId === 'AUD-051')).toBe(false));
  it('AUD-052 invalid URL', () =>
    expect(ids({ type: 'CUSTOM_AFFINITY', name: 'A', urls: ['not a url'] })).toContain('AUD-052'));
  it.each(['CUSTOM_INTENT_DISPLAY_VIDEO', 'CUSTOM_INTENT_YOUTUBE'] as const)('AUD-080 %s needs a keyword or URL', (type) => {
    expect(ids({ type, name: 'I', keywords: [], urls: [] })).toContain('AUD-080');
    expect(ids({ type, name: 'I', keywords: [], urls: ['example.com'] })).not.toContain('AUD-080');
  });
});

describe('YouTube users, archive, lock and analysis', () => {
  it('AUD-090 without a linked channel', () =>
    expect(ids({ type: 'YOUTUBE_USERS', name: 'Y', linkedChannels: 0, membershipDays: 30 })).toContain('AUD-090'));
  it('AUD-100 warns with the line item count', () => {
    const w = run({ type: 'TAG_BASED', name: 'T', targetingLineItems: 3 }).find((i) => i.ruleId === 'AUD-100');
    expect(w?.message).toBe('3 active line items target this audience.');
    expect(w?.blocking).toBe(false);
  });
  it.each(['type', 'floodlightActivityId', 'rules', 'seeds', 'reachPct', 'countries', 'contactType'])(
    'AUD-110 blocks a change to %s after creation',
    (field) => {
      const issue = run({ type: 'TAG_BASED', name: 'T', lockedChanges: [field] }, 'edit').find((i) => i.ruleId === 'AUD-110');
      expect(issue?.message).toBe(MSG.LOCKED_AFTER_CREATE);
      expect(issue?.path).toBe(field);
    },
  );
  it('AUD-110 does not run on create', () =>
    expect(ids({ type: 'TAG_BASED', name: 'T', lockedChanges: ['type'] }, 'create')).not.toContain('AUD-110'));
  it('AUD-113 seed under 1,000 users', () => {
    expect(ids({ type: 'TAG_BASED', name: 'T', analysisSeedUsers: 999 })).toContain('AUD-113');
    expect(ids({ type: 'TAG_BASED', name: 'T', analysisSeedUsers: 1000 })).not.toContain('AUD-113');
  });
  it('AUD-114 line item without optimized targeting', () => {
    expect(ids({ type: 'TAG_BASED', name: 'T', insightsOptimized: false })).toContain('AUD-114');
    expect(ids({ type: 'TAG_BASED', name: 'T', insightsOptimized: true })).not.toContain('AUD-114');
  });
  it('documentation rules AUD-060, 070, 091 carry no blocking issue', () => {
    const issues = run({ type: 'TAG_BASED', name: 'T' }).filter((i) => ['AUD-060', 'AUD-070', 'AUD-091'].includes(i.ruleId));
    expect(issues.every((i) => !i.blocking)).toBe(true);
  });
});
