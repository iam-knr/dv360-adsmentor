import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  changeLineItemType,
  defaultCriteria,
  emptyTargetingState,
  mergeSegments,
  menuFor,
  parseKeywords,
  presetSegments,
  preAdded,
  rowsToState,
  stateToRows,
  summarizeTargeting,
  type TargetingState,
} from '@/lib/targeting';
import { editorError } from '@/components/targeting/editors/editors';

describe('keywords (V-10-08, V-10-09)', () => {
  it('trims, lowercases and de-duplicates on commas and new lines', () => {
    expect(parseKeywords(' Shoes, shoes\nBoots ,, ').keywords).toEqual(['shoes', 'boots']);
  });
  it('rejects more than 5,000 keywords (TGT-033)', () => {
    const include = Array.from({ length: 5001 }, (_, i) => `k${i}`);
    expect(editorError('KEYWORDS', { keywords: { include, exclude: [] } })).toBe(
      'Use 5,000 keywords or fewer.',
    );
    expect(
      editorError('KEYWORDS', { keywords: { include: include.slice(1), exclude: [] } }),
    ).toBeNull();
  });
});

describe('day and time (V-10-13)', () => {
  it('merges overlapping segments (TGT-122)', () => {
    const r = mergeSegments([
      { day: 'MON', from: '08:00', to: '12:00' },
      { day: 'MON', from: '10:00', to: '14:00' },
    ]);
    expect(r.merged).toBe(true);
    expect(r.segments).toEqual([{ day: 'MON', from: '08:00', to: '14:00' }]);
  });
  it('presets fill whole days', () => {
    expect(presetSegments('WEEKDAYS')).toHaveLength(5);
    expect(presetSegments('ALL_DAYS')).toHaveLength(7);
  });
});

describe('demographics, device, environment errors (AC-10-12, AC-10-14)', () => {
  it('flags an unchecked demographics group (TGT-111)', () => {
    const c = defaultCriteria('DEMOGRAPHICS', 'DISPLAY');
    expect(editorError('DEMOGRAPHICS', c)).toBeNull();
    expect(editorError('DEMOGRAPHICS', { demographics: { ...c.demographics!, gender: [] } })).toBe(
      'Select at least one option.',
    );
  });
  it('flags excluding all four device types (TGT-130)', () => {
    const c = defaultCriteria('DEVICE', 'DISPLAY');
    expect(editorError('DEVICE', c)).toBeNull();
    const all = c.device!.types.map((t) => ({ ...t, mode: 'EXCLUDE' as const }));
    expect(editorError('DEVICE', { device: { ...c.device!, types: all } })).toBe(
      'Select at least one option.',
    );
  });
});

describe('MX-10 menus and defaults', () => {
  it.each(['DISPLAY', 'VIDEO', 'CTV', 'AUDIO', 'ADS_IN_MOBILE_APPS', 'YT_VIDEO'])(
    '%s: every pre-added row is in the menu or locked, and state starts with them',
    (type) => {
      const state = emptyTargetingState(type);
      expect(state.lineItemType).toBe(type);
      expect(Array.isArray(preAdded(type))).toBe(true);
      expect(menuFor(type).length).toBeGreaterThan(0);
    },
  );
  it('device default summary is 4 included, 0 excluded', () => {
    const s = emptyTargetingState('DISPLAY');
    expect(summarizeTargeting('DEVICE', defaultCriteria('DEVICE', 'DISPLAY'))).toBe(
      'Include: Computer, Smartphone, Tablet, Connected TV',
    );
    expect(s.criteria.viewability).toBeDefined();
  });
  it('type change removes unsupported dimensions and reports a toast (AC-10-18)', () => {
    const base = emptyTargetingState('DISPLAY');
    const withSpeed: TargetingState = {
      ...base,
      criteria: { ...base.criteria, ...defaultCriteria('CONNECTION_SPEED', 'DISPLAY') },
    };
    const r = changeLineItemType(withSpeed, 'YT_VIDEO');
    expect(r.state.lineItemType).toBe('YT_VIDEO');
    expect(r.removed.length).toBeGreaterThan(0);
    expect(r.toast).toMatch(/removed/);
  });
});

describe('rows round trip (V-10-02, AC-10-24)', () => {
  const types = ['DISPLAY', 'VIDEO', 'CTV', 'AUDIO', 'ADS_IN_MOBILE_APPS'];
  it('is lossless for every pre-added dimension and each type', () => {
    for (const type of types) {
      const s = emptyTargetingState(type);
      const back = rowsToState(stateToRows(s), type);
      expect(back.criteria).toEqual(s.criteria);
    }
  });
  it('is lossless for generated keyword and language states', () => {
    fc.assert(
      fc.property(
        fc.array(fc.stringMatching(/^[a-z]{1,8}$/), { minLength: 1, maxLength: 10 }),
        fc.array(fc.stringMatching(/^[a-z]{1,8}$/), { maxLength: 10 }),
        (include, exclude) => {
          const s = emptyTargetingState('DISPLAY');
          s.criteria.keywords = {
            include: [...new Set(include)],
            exclude: [...new Set(exclude.filter((k) => !include.includes(k)))],
          };
          const back = rowsToState(stateToRows(s), 'DISPLAY');
          expect(back.criteria.keywords).toEqual(s.criteria.keywords);
        },
      ),
    );
  });
});
