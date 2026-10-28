// LI-DOOH rules: Display and Video digital out of home (validation.md 2.15).
// LI-DOOH-001, -005, -007 and -008 are aliases of LI-007, LI-102, LI-060 and LI-101.
import { MSG } from '../messages';
import { positive } from '../primitives';
import type { AnyRule, LineItemInput, Rule, Violation } from '../types';
import { def as baseDef } from './line-item';

function def(rule: Omit<Rule<LineItemInput>, 'kind'>): Rule<LineItemInput> {
  return baseDef({
    ...rule,
    appliesTo: (l, ctx) =>
      (l.type === 'DOOH_DISPLAY' || l.type === 'DOOH_VIDEO') && (rule.appliesTo?.(l, ctx) ?? true),
  });
}

export const LI_DOOH_002 = def({
  id: 'LI-DOOH-002',
  severity: 'error',
  triggers: ['save'],
  reads: ['bid.mode'],
  message: 'Digital out of home line items use a fixed bid.',
  check: (l) => (l.bid.mode === 'FIXED' ? null : { path: 'bid.mode' }),
});

export const LI_DOOH_003 = def({
  id: 'LI-DOOH-003',
  severity: 'error',
  triggers: ['blur'],
  reads: ['bid.fixedCpm'],
  message: MSG.ENTER_POSITIVE,
  check: (l) => (positive(l.bid.fixedCpm) ? null : { path: 'bid.fixedCpm' }),
});

export const LI_DOOH_004 = def({
  id: 'LI-DOOH-004',
  severity: 'error',
  triggers: ['save'],
  reads: ['inventory.exchanges'],
  message: 'Only digital out of home exchanges are available for this line item.',
  needs: ['exchanges'],
  check: (l, ctx) =>
    l.inventory.exchanges
      .map((id, i) => ({ info: ctx.lookups.exchanges?.get(id), i }))
      .filter(({ info }) => !info?.isDooh)
      .map(({ i }): Violation => ({ path: `inventory.exchanges[${i}]` })),
});

/** KPI is N/A on a DOOH line item. Documentation row. */
export const LI_DOOH_006 = def({
  id: 'LI-DOOH-006',
  severity: 'info',
  triggers: ['cross'],
  reads: ['type'],
  message: null,
  check: () => null,
});

export const liDoohRules: readonly AnyRule[] = [LI_DOOH_002, LI_DOOH_003, LI_DOOH_004, LI_DOOH_006];
