// GEN-001..GEN-010: shared primitives (validation.md 2.1).
// Module rules call the helpers in primitives.ts directly; these rules make the same checks available on a bare value,
// for forms and SDF import columns that have no entity of their own.
import { MSG } from '../messages';
import {
  byteLength,
  dateRange,
  isBlank,
  isEmptyNum,
  isUrl,
  isWhole,
  larger,
  maxLen,
  nonNegative,
  pct,
  positive,
} from '../primitives';
import type { AnyRule, Num, Rule } from '../types';

export type GenInput =
  | { check: 'required'; value: unknown }
  | { check: 'positive'; value: Num }
  | { check: 'larger'; value: Num; min: number }
  | { check: 'maxLen'; value: string; max: number; unit?: 'chars' | 'bytes' }
  | { check: 'selection'; value: unknown }
  | { check: 'url'; value: string; max?: number }
  | { check: 'whole'; value: Num }
  | { check: 'dateRange'; start: string | null; end: string | null }
  | { check: 'percent'; value: Num }
  | { check: 'nonNegative'; value: Num };

type Check = GenInput['check'];

function gen(
  id: string,
  check: Check,
  message: string,
  fails: (e: GenInput) => boolean,
  reads: string[] = ['value'],
  triggers: Rule<GenInput>['triggers'] = ['blur'],
): Rule<GenInput> {
  return {
    id,
    kind: 'generic',
    severity: 'error',
    triggers,
    reads,
    message,
    appliesTo: (e) => e.check === check,
    check: (e) => (fails(e) ? { path: e.check === 'dateRange' ? 'end' : 'value' } : null),
  };
}

export const GEN_001 = gen('GEN-001', 'required', MSG.ENTER_VALUE, (e) => e.check === 'required' && isBlank(e.value));
export const GEN_002 = gen(
  'GEN-002',
  'positive',
  MSG.ENTER_POSITIVE,
  (e) => e.check === 'positive' && !positive(e.value),
);
export const GEN_003 = gen(
  'GEN-003',
  'larger',
  MSG.ENTER_LARGER,
  (e) => e.check === 'larger' && !larger(e.value, e.min),
);
export const GEN_004 = {
  ...gen('GEN-004', 'maxLen', MSG.MAX_CHARS, () => false, ['value'], ['save']),
  check: (e: GenInput) =>
    e.check === 'maxLen' &&
    (e.unit === 'bytes' ? byteLength(e.value) > e.max : !maxLen(e.value, e.max))
      ? { path: 'value', params: { max: e.max } }
      : null,
} satisfies Rule<GenInput>;
export const GEN_005 = gen(
  'GEN-005',
  'selection',
  MSG.SELECTION_REQUIRED,
  (e) => e.check === 'selection' && (e.value === null || e.value === undefined || e.value === ''),
  ['value'],
  ['save'],
);
export const GEN_006 = gen(
  'GEN-006',
  'url',
  MSG.VALID_URL,
  (e) => e.check === 'url' && !isUrl(e.value, e.max ?? 1024),
);
export const GEN_007 = gen(
  'GEN-007',
  'whole',
  MSG.WHOLE_NUMBER,
  (e) => e.check === 'whole' && !isEmptyNum(e.value) && !isWhole(e.value),
);
export const GEN_008 = gen(
  'GEN-008',
  'dateRange',
  MSG.END_BEFORE_START,
  (e) => e.check === 'dateRange' && !dateRange(e.start, e.end),
  ['start', 'end'],
  ['cross'],
);
export const GEN_009 = gen(
  'GEN-009',
  'percent',
  MSG.PCT_RANGE,
  (e) => e.check === 'percent' && !isEmptyNum(e.value) && !pct(e.value),
);
export const GEN_010 = gen(
  'GEN-010',
  'nonNegative',
  MSG.NON_NEGATIVE,
  (e) => e.check === 'nonNegative' && !isEmptyNum(e.value) && !nonNegative(e.value),
);

export const genRules: readonly AnyRule[] = [
  GEN_001,
  GEN_002,
  GEN_003,
  GEN_004,
  GEN_005,
  GEN_006,
  GEN_007,
  GEN_008,
  GEN_009,
  GEN_010,
];
