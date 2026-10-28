// LI-VID rules: Video line items (validation.md 2.8). LI-VID-003 and -010 are aliases of LI-102 and LI-060.
import { MSG } from '../messages';
import type { AnyRule, LineItemInput, Rule } from '../types';
import { def as baseDef } from './line-item';

function def(rule: Omit<Rule<LineItemInput>, 'kind'>): Rule<LineItemInput> {
  return baseDef({ ...rule, appliesTo: (l, ctx) => l.type === 'VIDEO' && (rule.appliesTo?.(l, ctx) ?? true) });
}

export const LI_VID_001 = def({
  id: 'LI-VID-001',
  severity: 'info',
  triggers: ['cross'],
  reads: ['inventory.exchanges'],
  message: MSG.EXCHANGES_SELECTED,
  check: (l) => ({ path: 'inventory.exchanges', params: { n: l.inventory.exchanges.length } }),
});

/** No default Open Measurement row for video. Documentation row. */
export const LI_VID_002 = def({
  id: 'LI-VID-002',
  severity: 'info',
  triggers: ['cross'],
  reads: ['targeting.dimensions'],
  message: null,
  check: () => null,
});

export const liVideoRules: readonly AnyRule[] = [LI_VID_001, LI_VID_002];
