import { describe, expect, it } from 'vitest';
import {
  AUDIENCE_MESSAGES,
  GOOGLE_AUDIENCES,
  applyPick,
  audienceIssues,
  buildSummary,
  currentPick,
  emptyAudienceLists,
  evaluateMembers,
  evaluateShares,
  formatImpressions,
  removeAudience,
  type AudienceLists,
  type AudienceMeta,
} from '@/lib/targeting/audience';
import { audienceError } from '@/components/targeting/editors/audience/DvAudienceBuilder';
import { estimateSummary, formatsFor, otherSpec } from '@/app/api/dv/audiences/estimate/estimate';
import { defaultParams } from '@/lib/engine';
import { baseWorld, creativeFor, ioOf } from '@/lib/engine/testing/fixtures';

const lists = (
  over: Partial<AudienceLists['include']> = {},
  exclude?: AudienceLists['exclude'],
): AudienceLists => ({
  include: { ...emptyAudienceLists().include, ...over },
  exclude: exclude ?? emptyAudienceLists().exclude,
});

// Users 1..10; ENG 2.3 / RC-030 fixtures
const USERS: Record<string, number[]> = {
  A: [1, 2, 3],
  B: [3, 4],
  C: [2, 3, 4, 5],
  G: [8, 9],
  X: [3, 9],
};
const members = (id: string) => new Set((USERS[id] ?? []).map(String));

describe('audience expression over user sets (V-10-16, RC-030)', () => {
  it('OR inside a group', () => {
    expect([...evaluateMembers(lists({ firstPartyGroups: [['A', 'B']] }), members)].sort()).toEqual(
      ['1', '2', '3', '4'],
    );
  });
  it('AND between first-party groups: (A ∪ B) ∩ C', () => {
    expect(
      [...evaluateMembers(lists({ firstPartyGroups: [['A', 'B'], ['C']] }), members)].sort(),
    ).toEqual(['2', '3', '4']);
  });
  it('OR between sections: ((A ∪ B) ∩ C) ∪ Google', () => {
    expect(
      [
        ...evaluateMembers(
          lists({ firstPartyGroups: [['A', 'B'], ['C']], google: ['G'] }),
          members,
        ),
      ].sort(),
    ).toEqual(['2', '3', '4', '8', '9']);
  });
  it('then minus the exclusions', () => {
    const l = lists(
      { firstPartyGroups: [['A', 'B'], ['C']], google: ['G'] },
      { firstParty: [], google: ['X'] },
    );
    expect([...evaluateMembers(l, members)].sort()).toEqual(['2', '4', '8']);
  });
  it('with no include list, everybody except the excluded', () => {
    const all = new Set(['1', '2', '3', '9']);
    expect(
      [...evaluateMembers(lists({}, { firstParty: ['X'], google: [] }), members, all)].sort(),
    ).toEqual(['1', '2']);
  });
});

describe('audience shares', () => {
  const frac = (id: string) => ({ a: 0.1, b: 0.2, c: 0.5, g: 0.05, x: 0.3 })[id] ?? 0;
  it('groups OR, groups AND, sections OR, exclude subtracts', () => {
    const s = evaluateShares(lists({ firstPartyGroups: [['a', 'b'], ['c']], google: ['g'] }), frac);
    const group1 = 1 - 0.9 * 0.8;
    const fp = group1 * 0.5;
    expect(s.include).toBeCloseTo(1 - (1 - fp) * (1 - 0.05), 10);
    const e = evaluateShares(lists({ google: ['g'] }, { firstParty: ['x'], google: [] }), frac);
    expect(e.net).toBeCloseTo(0.05 * 0.7, 10);
    expect(e.net).toBeLessThanOrEqual(e.include);
  });
  it('no include lists means the whole supply', () => {
    expect(evaluateShares(lists(), frac)).toMatchObject({ include: 1, exclude: 0, net: 1 });
  });
  it('the same list on both sides leaves nothing (AC-10-25)', () => {
    const s = evaluateShares(lists({ google: ['c'] }, { firstParty: [], google: ['c'] }), frac);
    expect(s.net).toBeCloseTo(0, 10);
  });
});

describe('picking and removing', () => {
  it('adds a first-party group, extends it and removes it when emptied', () => {
    let l = applyPick(
      emptyAudienceLists(),
      { side: 'INCLUDE', section: 'FIRST_PARTY', group: 'new' },
      ['a'],
    ).lists;
    l = applyPick(l, { side: 'INCLUDE', section: 'FIRST_PARTY', group: 'new' }, ['b']).lists;
    expect(l.include.firstPartyGroups).toEqual([['a'], ['b']]);
    l = applyPick(l, { side: 'INCLUDE', section: 'FIRST_PARTY', group: 0 }, ['a', 'c']).lists;
    expect(currentPick(l, { side: 'INCLUDE', section: 'FIRST_PARTY', group: 0 })).toEqual([
      'a',
      'c',
    ]);
    l = applyPick(l, { side: 'INCLUDE', section: 'FIRST_PARTY', group: 1 }, []).lists;
    expect(l.include.firstPartyGroups).toEqual([['a', 'c']]);
  });
  it('TGT-100: an item cannot be both included and excluded', () => {
    const inc = applyPick(emptyAudienceLists(), { side: 'INCLUDE', section: 'GOOGLE' }, [
      '7000037',
    ]).lists;
    const r = applyPick(inc, { side: 'EXCLUDE', section: 'GOOGLE' }, ['7000037', '7000074']);
    expect(r.blocked).toEqual(['7000037']);
    expect(r.lists.exclude.google).toEqual(['7000074']);
    expect(audienceError(r.lists)).toBeNull();
  });
  it('a saved state with the list on both sides is TGT-100 and blocks Apply', () => {
    const l = lists({ google: ['7000037'] }, { firstParty: [], google: ['7000037'] });
    expect(audienceIssues(l, 'DISPLAY', () => undefined)[0]).toMatchObject({ ruleId: 'TGT-100' });
    expect(audienceError(l)).toBe(AUDIENCE_MESSAGES.TGT_100);
  });
  it('removes one list from a group and drops empty groups', () => {
    const l = lists({ firstPartyGroups: [['a'], ['b', 'c']] });
    const r = removeAudience(
      removeAudience(l, { id: 'a', side: 'INCLUDE', section: 'FIRST_PARTY', group: 0 }),
      {
        id: 'b',
        side: 'INCLUDE',
        section: 'FIRST_PARTY',
        group: 0,
      },
    );
    expect(r.include.firstPartyGroups).toEqual([['c']]);
  });
});

describe('eligibility rules (V-10-15, TGT-101 to TGT-105)', () => {
  const meta = (m: Partial<AudienceMeta> & { id: string }): AudienceMeta => ({
    name: m.id,
    kind: 'FIRST_PARTY',
    ...m,
  });
  const table = new Map([
    ['yt', meta({ id: 'yt', eligibleTypes: ['YT_VIDEO'] })],
    ['new', meta({ id: 'new', availableInHours: 2 })],
    ['combined', meta({ id: 'combined', kind: 'COMBINED', availableInHours: 2 })],
    ['small', meta({ id: 'small', sizeBucket: '< 1K' })],
    ['look', meta({ id: 'look', kind: 'LOOKALIKE' })],
  ]);
  const run = (ids: string[], type: Parameters<typeof audienceIssues>[1]) =>
    audienceIssues(lists({ firstPartyGroups: [ids] }), type, (id) => table.get(id)).map(
      (i) => i.ruleId,
    );
  it('TGT-101 not eligible for the type', () => {
    expect(run(['yt'], 'DISPLAY')).toEqual(['TGT-101']);
    expect(run(['yt'], 'YT_VIDEO')).toEqual([]);
  });
  it('TGT-103 younger than 4 hours, except combined audiences', () => {
    expect(run(['new'], 'DISPLAY')).toEqual(['TGT-103']);
    expect(run(['combined'], 'DISPLAY')).toEqual([]);
  });
  it('TGT-102 warns for lists below 1K', () => {
    expect(run(['small'], 'DISPLAY')).toEqual(['TGT-102']);
  });
  it('TGT-105 lookalike only in YouTube and Demand Gen', () => {
    expect(run(['look'], 'DISPLAY')).toEqual(['TGT-105']);
    expect(run(['look'], 'DEMAND_GEN')).toEqual([]);
  });
});

describe('Impressions summary', () => {
  it('formats K / M / B / T with two decimals (V-10-19)', () => {
    expect(formatImpressions(7.31e12)).toBe('7.31T');
    expect(formatImpressions(1_250_000_000)).toBe('1.25B');
    expect(formatImpressions(42_000)).toBe('42.00K');
    expect(formatImpressions(0)).toBe('0');
  });

  it('builds the Δ-10-4 shape with normalised mixes', () => {
    const s = buildSummary({
      asOf: 'x',
      overall: 1000,
      otherShare: 0.5,
      hasAudience: true,
      shares: { include: 0.4, exclude: 0.1, net: 0.36, overlap: 0.04 },
      mix: {
        gender: { male: 0.55, female: 0.45 },
        age: { '18-24': 1, '25-34': 1, '35-44': 1, '45-54': 1, '55-64': 1, '65+': 1 },
        device: { desktop: 1, mobile: 2, tablet: 1, ctv: 0 },
      },
    });
    expect(s.included).toBeCloseTo(400);
    expect(s.excluded).toBeCloseTo(40);
    expect(s.otherTargeting).toBeCloseTo(500);
    expect(Object.values(s.age).reduce((a, b) => a + b, 0)).toBeCloseTo(1);
    expect(s.device.mobile).toBeCloseTo(0.5);
    expect(s.gender.coveragePct).toBe(95);
  });

  const loaded = defaultParams();
  const world = baseWorld({
    insertionOrders: [ioOf()],
    creatives: [creativeFor('display')],
    audiences: [
      { id: 'big', type: 'affinity', sizeFraction: 0.1 },
      { id: 'small', type: 'in_market', sizeFraction: 0.02 },
      { id: 'fp', type: 'first_party', size: 5_000_000 },
    ],
  });
  const run = (l: AudienceLists, extra: Partial<Parameters<typeof estimateSummary>[0]> = {}) =>
    estimateSummary({ world, loaded, lists: l, lineItemType: 'DISPLAY', flightDays: 30, ...extra });

  it('returns the labelled parts; included never exceeds overall (V-10-18)', () => {
    const s = run(lists({ google: ['big'] }));
    expect(s.overall).toBeGreaterThan(0);
    expect(s.included).toBeGreaterThan(0);
    expect(s.included).toBeLessThanOrEqual(s.overall);
    expect(s.basis).toBe('FLIGHT_AND_TARGETING_NO_EXPANSION');
  });
  it('with no list chosen, included equals overall (Empty state)', () => {
    const s = run(lists());
    expect(s.included).toBeCloseTo(s.overall);
    expect(s.excluded).toBe(0);
  });
  it('a bigger list includes more; a second OR list adds; an AND group narrows', () => {
    const big = run(lists({ google: ['big'] })).included;
    const small = run(lists({ google: ['small'] })).included;
    const both = run(lists({ google: ['big', 'small'] })).included;
    expect(big).toBeGreaterThan(small);
    expect(both).toBeGreaterThan(big);
    const narrowed = run(lists({ firstPartyGroups: [['big'], ['small']] })).included;
    expect(narrowed).toBeLessThan(small);
  });
  it('excluding a list reduces the net audience and reports the excluded part', () => {
    const l = lists({ google: ['big'] }, { firstParty: [], google: ['small'] });
    const s = run(l);
    expect(s.excluded).toBeGreaterThan(0);
    expect(s.venn.overlapPct).toBeGreaterThan(0);
  });
  it('is deterministic', () => {
    const l = lists({ google: ['big'] });
    expect(run(l)).toEqual(run(l));
  });
  it('knows the Google catalogue (Basketball Fans)', () => {
    const bf = GOOGLE_AUDIENCES.find((g) => g.name === 'Basketball Fans')!;
    const s = run(lists({ google: [bf.id] }));
    expect(s.included).toBeGreaterThan(0);
    expect(s.included).toBeLessThan(s.overall);
  });
  it('other targeting narrows by environment and device', () => {
    const s = run(lists(), { criteria: { environment: { web: true, app: false } } });
    expect(s.otherTargeting).toBeLessThan(s.overall);
    expect(otherSpec({ environment: { web: true, app: true } }).environment).toEqual([
      'web',
      'app',
    ]);
    expect(formatsFor('CTV')).toEqual(['ctv']);
  });
});
