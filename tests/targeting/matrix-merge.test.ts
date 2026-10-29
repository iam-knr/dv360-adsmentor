// V-10-01 (MX-10 for every cell), V-10-03, V-10-04, V-10-17, V-10-21 and AC-10-16 (LI-100).
import { describe, expect, it } from 'vitest';
import {
  applyTemplateToTargeting,
  availability,
  changeLineItemType,
  defaultCriteria,
  emptyTargetingState,
  keywordDim,
  lockedRowsChanged,
  menuFor,
  mergeTargeting,
  preAdded,
  removeDimension,
  summarizeTargeting,
  toLiTargetingInput,
  typeLocked,
  type TargetingCriteria,
  type TargetingState,
} from '@/lib/targeting';
import { LI_TYPES } from '@/lib/validation/constants/li-compat';
import {
  MATRIX_DIMENSIONS,
  TARGETING_AVAILABILITY,
  targetingColumn,
  type MatrixDimension,
} from '@/lib/validation/constants/targeting-availability';
import { validate } from '@/lib/validation';
import { applyPatch, makeCtx, validLineItem } from '@/lib/validation/testing/fixtures';

describe('V-10-01 MX-10 for every (dimension, type) cell', () => {
  const MAI_EXTRA = ['VIEWABILITY', 'DEVICE'];
  for (const type of LI_TYPES) {
    it(`${type}: menu, pre-added rows and locks follow the matrix`, () => {
      for (const dim of MATRIX_DIMENSIONS) {
        const cell = TARGETING_AVAILABILITY[dim][targetingColumn(type)];
        // the raw `V` cell resolves to N without an ad type
        expect(availability(type, dim), `${dim} x ${type}`).toBe(cell === 'V' ? 'N' : cell);
        const resolved = cell === 'V' ? 'N' : cell;
        const wantPre =
          resolved === 'P' ||
          resolved === 'L' ||
          (type === 'MOBILE_APP_INSTALL' && MAI_EXTRA.includes(dim));
        expect(preAdded(type).includes(dim), `${dim} pre-added on ${type}`).toBe(wantPre);
        const wantLocked =
          resolved === 'L' || (type === 'MOBILE_APP_INSTALL' && dim === 'VIEWABILITY');
        expect(typeLocked(type).includes(dim), `${dim} locked on ${type}`).toBe(wantLocked);
      }
    });
  }
  it('the menu never offers a dimension the type cannot hold (N cells are hidden)', () => {
    for (const type of LI_TYPES.filter((t) => !t.startsWith('YT_'))) {
      for (const dim of menuFor(type).flatMap((g) => g.items)) {
        if (dim === 'KEYWORDS') continue;
        expect(availability(type, dim), `${dim} x ${type}`).not.toBe('N');
      }
    }
  });
  it('keywords show as exclusions where includes are not allowed', () => {
    expect(keywordDim('DISPLAY')).toBe('KEYWORDS');
    expect(keywordDim('AUDIO')).toBe('KEYWORD_EXCLUSIONS');
  });
});

const kw = (include: string[], exclude: string[] = []): TargetingCriteria => ({
  keywords: { include, exclude },
});

describe('V-10-03 mergeTargeting order: partner < template < LI < locked', () => {
  const advertiser = {
    criteria: { ...defaultCriteria('VIEWABILITY', 'DISPLAY'), ...kw(['locked']) },
    locked: ['KEYWORDS'],
  };
  it('later layers win per dimension', () => {
    const m = mergeTargeting(kw(['partner']), kw(['template']), kw(['li']), null, 'DISPLAY');
    expect(m.criteria.keywords?.include).toEqual(['li']);
    expect(
      mergeTargeting(kw(['partner']), kw(['template']), null, null, 'DISPLAY').criteria.keywords
        ?.include,
    ).toEqual(['template']);
    expect(
      mergeTargeting(kw(['partner']), null, null, null, 'DISPLAY').criteria.keywords?.include,
    ).toEqual(['partner']);
  });
  it('advertiser rules beat the LI and come back locked', () => {
    const m = mergeTargeting(kw(['partner']), kw(['template']), kw(['li']), advertiser, 'DISPLAY');
    expect(m.criteria.keywords?.include).toEqual(['locked']);
    expect(m.locked).toEqual(['KEYWORDS']);
  });
  it('only the locked dimensions are taken from the advertiser', () => {
    const m = mergeTargeting(null, null, kw(['li']), advertiser, 'DISPLAY');
    expect(m.criteria.viewability).toBeUndefined();
  });
});

describe('V-10-04 applyTemplateToTargeting keeps locked rows', () => {
  const current: TargetingState = {
    ...emptyTargetingState('DISPLAY'),
    criteria: { ...emptyTargetingState('DISPLAY').criteria, ...kw(['locked']), language: [] },
    locked: ['KEYWORDS'],
  };
  const template = {
    id: 'tpl-1',
    criteria: { ...kw(['from-template']), ...defaultCriteria('ENVIRONMENT', 'DISPLAY') },
  };
  it('replaces every unlocked dimension and keeps the locked one', () => {
    const { state, templateId } = applyTemplateToTargeting(current, template);
    expect(templateId).toBe('tpl-1');
    expect(state.criteria.keywords?.include).toEqual(['locked']);
    expect(state.criteria.environment).toEqual(template.criteria.environment);
    expect(state.criteria.language).toBeUndefined();
    expect(state.criteria.viewability).toBeUndefined();
  });
  it('extra locked dimensions (advertiser rules) are kept too', () => {
    const { state } = applyTemplateToTargeting(current, template, ['ENVIRONMENT']);
    expect(state.criteria.environment).toEqual(current.criteria.environment);
  });
});

describe('V-10-17 summarizeTargeting goldens', () => {
  const D = (dim: MatrixDimension, type = 'DISPLAY') =>
    summarizeTargeting(dim, defaultCriteria(dim, type));
  it('default summaries per dimension', () => {
    expect(D('ENVIRONMENT')).toBe('None selected');
    expect(D('VIEWABILITY')).toBe('Open Measurement');
    expect(D('DEVICE')).toBe('Include: Computer, Smartphone, Tablet, Connected TV');
    expect(D('CONNECTION_SPEED')).toBe('All connection speeds');
    expect(D('DEMOGRAPHICS')).toBe(
      'Gender: All, Age: 18-65+, Unknown, Parental status: All, Household income: All',
    );
    expect(D('POSITION', 'CTV')).toBe('In-stream, all positions');
    expect(D('POSITION')).toBe('None selected');
    expect(D('LANGUAGE')).toBe('None selected');
  });
  it('selection summaries', () => {
    expect(
      summarizeTargeting('CATEGORIES', {
        categories: [
          { id: 'SPORTS', mode: 'INCLUDE' },
          { id: 'NEWS', mode: 'EXCLUDE' },
        ],
      }),
    ).toBe('Include: Sports; Exclude: News');
    expect(summarizeTargeting('KEYWORDS', kw(['a', 'b'], ['c']))).toBe(
      'Include: 2 keywords. Exclude: 1 keyword',
    );
    expect(summarizeTargeting('KEYWORD_EXCLUSIONS', kw([], ['c']))).toBe('Exclude: 1 keyword');
    expect(
      summarizeTargeting('DAY_TIME', {
        dayAndTime: { tz: 'LOCAL', segments: [{ day: 'MON', from: '09:00', to: '17:00' }] },
      }),
    ).toContain('9:00 AM');
    expect(summarizeTargeting('LIVESTREAM', { livestream: 'EXCLUDE' })).toBe('Exclude livestream');
    expect(summarizeTargeting('REWARDED', { rewarded: 'INCLUDE' })).toBe('Include rewarded');
  });
  it('is null for a dimension that is not in the state', () => {
    for (const dim of ['ENVIRONMENT', 'DEVICE', 'LANGUAGE', 'CATEGORIES', 'DAY_TIME'] as const)
      expect(summarizeTargeting(dim, {})).toBeNull();
  });
  it('sub-categories read with their own label', () => {
    expect(
      summarizeTargeting('CATEGORIES', {
        categories: [{ id: 'SPORTS__TEAM_SPORTS', mode: 'INCLUDE' }],
      }),
    ).toBe('Include: Team Sports');
  });
  it('device extras are counted', () => {
    const d = defaultCriteria('DEVICE', 'DISPLAY').device!;
    expect(
      summarizeTargeting('DEVICE', {
        device: { ...d, os: [{ id: 'ANDROID', mode: 'INCLUDE' }], makeModel: [] },
      }),
    ).toContain('1 operating system or model');
  });
});

describe('V-10-21 dimensions dropped on type change', () => {
  it('lists the dropped rows and keeps what the new type allows', () => {
    const base = emptyTargetingState('DISPLAY');
    const s: TargetingState = {
      ...base,
      criteria: {
        ...base.criteria,
        ...defaultCriteria('BROWSER', 'DISPLAY'),
        ...defaultCriteria('CONNECTION_SPEED', 'DISPLAY'),
      },
    };
    const r = changeLineItemType(s, 'CTV');
    expect(r.removed).toEqual(expect.arrayContaining(['Browser', 'Connection speed']));
    expect(r.state.criteria.browser).toBeUndefined();
    expect(r.toast).toContain('was removed');
  });
});

describe('AC-10-16 locked rows and forged removal (LI-100)', () => {
  const original: TargetingState = {
    ...emptyTargetingState('DISPLAY'),
    criteria: { ...emptyTargetingState('DISPLAY').criteria, ...kw(['brand']) },
    locked: ['KEYWORDS'],
  };
  const forged = removeDimension(original, 'KEYWORDS');
  it('detects a locked row that was removed or edited', () => {
    expect(lockedRowsChanged(original, original)).toEqual([]);
    expect(lockedRowsChanged(original, forged)).toEqual(['KEYWORDS']);
    expect(
      lockedRowsChanged(original, {
        ...original,
        criteria: { ...original.criteria, ...kw(['x']) },
      }),
    ).toEqual(['KEYWORDS']);
  });
  it('the LI validator rejects the forged save with LI-100 and accepts the untouched one', () => {
    const run = (next: TargetingState) => {
      const li = applyPatch(validLineItem('DISPLAY'), {
        targeting: toLiTargetingInput(next, original),
      });
      return validate('lineItem', li, makeCtx()).map((i) => i.ruleId);
    };
    expect(run(forged)).toContain('LI-100');
    expect(run(original)).not.toContain('LI-100');
  });
});
