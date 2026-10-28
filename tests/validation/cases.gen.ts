// GEN-001..GEN-010 on bare values.
import type { GenInput } from '@/lib/validation/rules/gen';
import type { Case } from './cases.types';

const gen = (input: GenInput) => () => input;

export const genCases: Case[] = [
  { id: 'GEN-001 blank text', kind: 'generic', base: gen({ check: 'required', value: '  ' }), expect: ['GEN-001:error'], message: 'Enter a value' },
  { id: 'GEN-001 filled text', kind: 'generic', base: gen({ check: 'required', value: 'x' }), expect: [] },
  { id: 'GEN-002 zero', kind: 'generic', base: gen({ check: 'positive', value: 0 }), expect: ['GEN-002:error'], message: 'Enter a number greater than 0' },
  { id: 'GEN-002 not numeric', kind: 'generic', base: gen({ check: 'positive', value: 'abc' }), expect: ['GEN-002:error'] },
  { id: 'GEN-002 positive', kind: 'generic', base: gen({ check: 'positive', value: '0.5' }), expect: [] },
  { id: 'GEN-003 split of zero', kind: 'generic', base: gen({ check: 'larger', value: 0, min: 0 }), expect: ['GEN-003:error'], message: 'Enter a larger number' },
  { id: 'GEN-004 too long', kind: 'generic', base: gen({ check: 'maxLen', value: 'abcd', max: 3 }), expect: ['GEN-004:error'], message: 'Use 3 characters or fewer.' },
  { id: 'GEN-004 emoji counts once', kind: 'generic', base: gen({ check: 'maxLen', value: '😀😀', max: 2 }), expect: [] },
  { id: 'GEN-004 bytes', kind: 'generic', base: gen({ check: 'maxLen', value: 'ééé', max: 5, unit: 'bytes' }), expect: ['GEN-004:error'] },
  { id: 'GEN-005 nothing chosen', kind: 'generic', base: gen({ check: 'selection', value: null }), expect: ['GEN-005:error'], message: 'A selection is required' },
  { id: 'GEN-006 ftp url', kind: 'generic', base: gen({ check: 'url', value: 'ftp://x.example' }), expect: ['GEN-006:error'], message: 'Enter a valid URL.' },
  { id: 'GEN-006 url too long', kind: 'generic', base: gen({ check: 'url', value: `https://x.example/${'a'.repeat(1024)}` }), expect: ['GEN-006:error'] },
  { id: 'GEN-006 https url', kind: 'generic', base: gen({ check: 'url', value: 'https://x.example/a?b=1' }), expect: [] },
  { id: 'GEN-007 fraction', kind: 'generic', base: gen({ check: 'whole', value: 1.5 }), expect: ['GEN-007:error'], message: 'Enter a whole number.' },
  { id: 'GEN-008 end before start', kind: 'generic', base: gen({ check: 'dateRange', start: '2026-10-10', end: '2026-10-09' }), expect: ['GEN-008:error'], message: 'End date must be on or after the start date.' },
  { id: 'GEN-008 same day', kind: 'generic', base: gen({ check: 'dateRange', start: '2026-10-10', end: '2026-10-10' }), expect: [] },
  { id: 'GEN-009 above 100', kind: 'generic', base: gen({ check: 'percent', value: 100.01 }), expect: ['GEN-009:error'], message: 'Enter a number between 0 and 100.' },
  { id: 'GEN-009 at the edges', kind: 'generic', base: gen({ check: 'percent', value: 0 }), expect: [] },
  { id: 'GEN-010 negative', kind: 'generic', base: gen({ check: 'nonNegative', value: -0.01 }), expect: ['GEN-010:error'], message: 'Enter a number that is 0 or greater.' },
  { id: 'GEN-010 zero', kind: 'generic', base: gen({ check: 'nonNegative', value: 0 }), expect: [] },
];
