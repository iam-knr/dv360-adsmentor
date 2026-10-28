// LI-DG rules: Demand Gen line items (validation.md 2.14).
// LI-DG-002 and -003 are aliases of LI-006 and LI-007; LI-DG-011 is an alias of LI-102.
import { LIMITS } from '../constants/limits';
import { MSG } from '../messages';
import { codePointLength, isBlank, isEmptyNum } from '../primitives';
import type { AnyRule, LineItemInput, Rule, Violation } from '../types';
import { def as baseDef } from './line-item';

function def(rule: Omit<Rule<LineItemInput>, 'kind'>): Rule<LineItemInput> {
  return baseDef({ ...rule, appliesTo: (l, ctx) => l.type === 'DEMAND_GEN' && (rule.appliesTo?.(l, ctx) ?? true) });
}

export const LI_DG_001 = def({
  id: 'LI-DG-001',
  severity: 'error',
  triggers: ['save'],
  reads: ['type'],
  message: MSG.DG_PREREQ,
  appliesTo: (_l, ctx) => !ctx.advertiser.demandGenFloodlightOptimization,
  check: () => ({ path: 'type' }),
});

export const LI_DG_004 = def({
  id: 'LI-DG-004',
  severity: 'error',
  triggers: ['save'],
  reads: ['type'],
  message: "YouTube & partners and Demand Gen line items aren't enabled for this advertiser.",
  appliesTo: (_l, ctx) => !ctx.advertiser.googleInventoryEnabled,
  check: () => ({ path: 'type' }),
});

export const LI_DG_005 = def({
  id: 'LI-DG-005',
  severity: 'error',
  triggers: ['save'],
  reads: ['conversions.activities', 'ioId'],
  message: 'Select at least one conversion.',
  appliesTo: (_l, ctx) => ctx.io?.objective === 'CONVERSIONS',
  check: (l) => (l.conversions.activities.length === 0 ? { path: 'conversions.activities' } : null),
});

export const LI_DG_006 = def({
  id: 'LI-DG-006',
  severity: 'error',
  triggers: ['blur'],
  reads: ['budget.amount', 'pacing.period', 'pacing.dailyAmount'],
  message: MSG.ENTER_VALUE,
  check: (l) => {
    const out: Violation[] = [];
    if (isEmptyNum(l.budget.amount)) out.push({ path: 'budget.amount' });
    if (l.pacing.period === 'DAILY' && isEmptyNum(l.pacing.dailyAmount)) out.push({ path: 'pacing.dailyAmount' });
    return out;
  },
});

export const LI_DG_007 = def({
  id: 'LI-DG-007',
  severity: 'error',
  triggers: ['save'],
  reads: ['ads[].headline'],
  message: MSG.MAX_CHARS,
  check: (l) =>
    (l.ads ?? [])
      .map((ad, i) => ({ ad, i }))
      .filter(({ ad }) => codePointLength(ad.headline ?? '') > LIMITS.DG_HEADLINE_MAX)
      .map(({ i }): Violation => ({ path: `ads[${i}].headline`, params: { max: LIMITS.DG_HEADLINE_MAX } })),
});

export const LI_DG_008 = def({
  id: 'LI-DG-008',
  severity: 'error',
  triggers: ['save'],
  reads: ['ads[].description'],
  message: MSG.MAX_CHARS,
  check: (l) =>
    (l.ads ?? [])
      .map((ad, i) => ({ ad, i }))
      .filter(({ ad }) => codePointLength(ad.description ?? '') > LIMITS.AD_DESCRIPTION_MAX)
      .map(({ i }): Violation => ({ path: `ads[${i}].description`, params: { max: LIMITS.AD_DESCRIPTION_MAX } })),
});

export const LI_DG_009 = def({
  id: 'LI-DG-009',
  severity: 'error',
  triggers: ['save'],
  reads: ['ads[].businessName'],
  message: MSG.ENTER_VALUE,
  check: (l) =>
    (l.ads ?? []).flatMap((ad, i): Violation[] => {
      if (isBlank(ad.businessName)) return [{ path: `ads[${i}].businessName` }];
      if (codePointLength(ad.businessName ?? '') > LIMITS.AD_BUSINESS_NAME_MAX) {
        return [
          {
            path: `ads[${i}].businessName`,
            message: MSG.MAX_CHARS,
            params: { max: LIMITS.AD_BUSINESS_NAME_MAX },
          },
        ];
      }
      return [];
    }),
});

export const LI_DG_010 = def({
  id: 'LI-DG-010',
  severity: 'warning',
  triggers: ['activate'],
  reads: ['ads'],
  message: "This line item has no ads and won't run.",
  check: (l) => ((l.ads ?? []).length === 0 ? { path: 'ads' } : null),
});

export const liDemandGenRules: readonly AnyRule[] = [
  LI_DG_001,
  LI_DG_004,
  LI_DG_005,
  LI_DG_006,
  LI_DG_007,
  LI_DG_008,
  LI_DG_009,
  LI_DG_010,
];
