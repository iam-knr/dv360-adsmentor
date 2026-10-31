// plan-fix2: pure rules behind the planner defects found by the production browser test (each fails on main).
import { describe, expect, it } from 'vitest';
import { DEFAULT_DEMOGRAPHICS, demographicsLabel } from '@/lib/planning/countries';
import { forecastPlan, type ForecastInput } from '@/lib/planning/forecast';
import { inheritRows } from '@/lib/planning/inherit';
import { planLockReason } from '@/lib/planning/rules';
import { cellText, planCsv, targetingSummary } from '@/lib/planning/table';
import type { PlanDto, PlanRowDto } from '@/lib/planning/types';
import { formatMediumDate } from '@/lib/date-format';

const input = (maxCpm: number | null): ForecastInput => ({
  seed: 's',
  planId: 'p',
  country: 'IN',
  currency: 'INR',
  demographics: DEFAULT_DEMOGRAPHICS,
  reachBasis: 'CENSUS',
  includeYoutube: false,
  startDate: '2026-11-01',
  endDate: '2026-11-30',
  asOf: '2026-10-30T00:00:00.000Z',
  rows: [{ key: 'a', name: 'A', buyingMethod: 'OPEN_AUCTION', budgetNet: 400_000, maxCpm }],
});

describe('#3 Total Budget % of the only row', () => {
  it('is 100% with and without a Max CPM below the expected CPM', () => {
    expect(forecastPlan(input(null)).perRow.a?.budgetSharePct).toBe(100);
    const capped = forecastPlan(input(1)); // far below the clearing CPM
    expect(capped.perRow.a?.expectedSpendPct).toBeLessThan(100);
    expect(capped.perRow.a?.budgetSharePct).toBe(100);
  });
  it('splits two rows by the budgets they ask for', () => {
    const f = forecastPlan({
      ...input(1),
      rows: [
        { key: 'a', name: 'A', buyingMethod: 'OPEN_AUCTION', budgetNet: 300, maxCpm: 1 },
        { key: 'b', name: 'B', buyingMethod: 'OPEN_AUCTION', budgetNet: 100 },
      ],
    });
    expect(f.perRow.a?.budgetSharePct).toBe(75);
    expect(f.perRow.b?.budgetSharePct).toBe(25);
  });
});

describe('#6 forecast and budget are consistent', () => {
  it('plannedBudget is the row budget with fee; budget is the expected spend below it when Max CPM bites', () => {
    const open = forecastPlan(input(null));
    expect(open.plannedBudget).toBeCloseTo(440_000, 0);
    expect(open.budget).toBeCloseTo(open.plannedBudget as number, 0);
    const capped = forecastPlan(input(1));
    expect(capped.plannedBudget).toBeCloseTo(440_000, 0);
    expect(capped.budget).toBeLessThan(capped.plannedBudget as number);
  });
});

describe('#2 rows follow plan-level edits unless overridden', () => {
  const from = { start: '2026-11-01', end: '2026-11-30', location: 'IN' };
  const to = { start: '2026-11-01', end: '2026-12-15', location: 'SG' };
  const row = (over: object) => ({
    startDate: '2026-11-01',
    endDate: '2026-11-30',
    locations: ['IN'],
    ...over,
  });
  it('moves a row that matched the plan', () => {
    const [r] = inheritRows([row({})], from, to);
    expect(r).toMatchObject({ startDate: '2026-11-01', endDate: '2026-12-15', locations: ['SG'] });
  });
  it('keeps a row with its own dates or locations', () => {
    const [r] = inheritRows(
      [row({ startDate: '2026-11-05', endDate: '2026-11-20', locations: ['IN', 'AE'] })],
      from,
      to,
    );
    expect(r).toMatchObject({
      startDate: '2026-11-05',
      endDate: '2026-11-20',
      locations: ['IN', 'AE'],
    });
  });
  it('returns the same rows when nothing changed', () => {
    const rows = [row({})];
    expect(inheritRows(rows, from, from)).toBe(rows);
  });
});

describe('#4 demographics read the same everywhere', () => {
  it('the default is All people, 18 - 65+ in the editor label and in the CSV', () => {
    expect(demographicsLabel(DEFAULT_DEMOGRAPHICS)).toBe('All people, 18 - 65+');
    expect(demographicsLabel({ genders: ['MALE', 'FEMALE'], ageMin: 25, ageMax: 64 })).toBe(
      'Male and Female, 25 - 64',
    );
    expect(demographicsLabel({ genders: ['FEMALE'], ageMin: 18, ageMax: 34 })).toBe('Female, 18 - 34');
  });
});

const plan = (row: Partial<PlanRowDto>): { plan: PlanDto; row: PlanRowDto } => {
  const r: PlanRowDto = {
    id: 'r1',
    ordinal: 0,
    name: 'Row',
    buyingMethod: 'OPEN_AUCTION',
    dealId: null,
    locations: ['IN'],
    startDate: '2026-11-01',
    endDate: '2026-11-30',
    targeting: {},
    audienceRefs: [],
    budgetNet: 1,
    budgetTotal: 1,
    feePct: 0.1,
    maxCpm: null,
    isCpmLocked: false,
    pricing: 'Auction',
    ...row,
  };
  const p = {
    header: {
      name: 'P',
      location: 'IN',
      currencyCode: 'INR',
      dates: { start: '2026-11-01', end: '2026-11-30' },
      demographics: DEFAULT_DEMOGRAPHICS,
      additional: {},
      channels: ['DIGITAL'],
    },
    forecast: null,
    rows: [r],
  } as unknown as PlanDto;
  return { plan: p, row: r };
};

describe('#5 the Targeting column shows every targeting added', () => {
  it('lists Position and the other added rows after the demographics', () => {
    const { plan: p, row } = plan({
      targeting: {
        version: 1,
        lineItemType: 'DISPLAY',
        criteria: {
          position: { onScreen: ['ABOVE_THE_FOLD'], inContent: [], native: [] },
          environment: { web: true, app: false },
        },
      },
    });
    const text = targetingSummary(p, row);
    expect(text).toContain('All people, 18 - 65+');
    expect(text).toContain('Position: On screen:');
    expect(text).toContain('Environment: Include: Web');
    expect(cellText('targeting', p, row, undefined)).toBe(text);
    expect(planCsv(p, ['name', 'targeting'])).toContain('Position');
  });
  it('is only the demographics for a row with no targeting', () => {
    const { plan: p, row } = plan({});
    expect(targetingSummary(p, row)).toBe('All people, 18 - 65+');
  });
});

describe('#7 why a plan is read-only', () => {
  it('only says the start date passed when it did', () => {
    expect(planLockReason({ locked: false, status: 'PLANNED' })).toBeNull();
    expect(planLockReason({ locked: false, status: 'TRAFFICKED' })).toBe('TRAFFICKED');
    expect(planLockReason({ locked: false, status: 'ARCHIVED' })).toBe('ARCHIVED');
    expect(planLockReason({ locked: true, status: 'PLANNED' })).toBe('DATE_PASSED');
  });
});

describe('#10 app date format', () => {
  it('formats a stored timestamp as Oct 31, 2026', () => {
    expect(formatMediumDate('2026-10-31T23:30:00.000Z')).toBe('Oct 31, 2026');
    expect(formatMediumDate(new Date('2026-01-05T00:00:00Z'))).toBe('Jan 5, 2026');
    expect(formatMediumDate('nope')).toBe('-');
  });
});
