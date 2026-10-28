// LI-CTV rules: Connected TV line items (validation.md 2.9). LI-CTV-001, -005 and -010 are aliases.
import type { AnyRule, LineItemInput, Rule } from '../types';
import { def as baseDef } from './line-item';

function def(rule: Omit<Rule<LineItemInput>, 'kind'>): Rule<LineItemInput> {
  return baseDef({
    ...rule,
    appliesTo: (l, ctx) => l.type === 'CTV' && (rule.appliesTo?.(l, ctx) ?? true),
  });
}

/** Pre-added "Position in content: In-stream, all positions selected". Documentation row. */
export const LI_CTV_002 = def({
  id: 'LI-CTV-002',
  severity: 'info',
  triggers: ['cross'],
  reads: ['targeting.position'],
  message: null,
  check: () => null,
});

/** Pre-added "Large, HD" player size. Documentation row. */
export const LI_CTV_003 = def({
  id: 'LI-CTV-003',
  severity: 'info',
  triggers: ['cross'],
  reads: ['targeting.dimensions'],
  message: null,
  check: () => null,
});

export const LI_CTV_004 = def({
  id: 'LI-CTV-004',
  severity: 'error',
  triggers: ['save'],
  reads: ['targeting.device'],
  message: 'Connected TV line items must target Connected TV devices.',
  check: (l) =>
    l.targeting.device?.include.includes('CONNECTED_TV') ? null : { path: 'targeting.device' },
});

/** The "Target DV360 curated CTV auction inventory" checkbox is available. Documentation row. */
export const LI_CTV_006 = def({
  id: 'LI-CTV-006',
  severity: 'info',
  triggers: ['cross'],
  reads: ['inventory.targetCuratedCtv'],
  message: null,
  check: () => null,
});

export const liCtvRules: readonly AnyRule[] = [LI_CTV_002, LI_CTV_003, LI_CTV_004, LI_CTV_006];
