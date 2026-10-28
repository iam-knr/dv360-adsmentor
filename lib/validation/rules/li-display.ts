// LI-DSP rules: Display line items (validation.md 2.7). LI-DSP-001, -002 and -030 are aliases of LI-100 and LI-060.
import { isStandardDisplaySize } from '../constants/creatives';
import { MSG } from '../messages';
import type { AnyRule, LineItemInput, Rule, Violation } from '../types';
import { def as baseDef } from './line-item';

const ON_SCREEN = ['ABOVE_THE_FOLD', 'BELOW_THE_FOLD', 'UNKNOWN'] as const;
const IN_CONTENT = [
  'IN_ARTICLE',
  'IN_FEED',
  'INTERSTITIAL',
  'IN_BANNER',
  'UNKNOWN',
  'PERIPHERAL',
  'RECOMMENDATION',
] as const;
const VIEWABILITY_STEPS = [90, 80, 70, 60, 50, 40, 30, 20, 10] as const;

function def(rule: Omit<Rule<LineItemInput>, 'kind'>): Rule<LineItemInput> {
  return baseDef({
    ...rule,
    appliesTo: (l, ctx) => l.type === 'DISPLAY' && (rule.appliesTo?.(l, ctx) ?? true),
  });
}

export const LI_DSP_010 = def({
  id: 'LI-DSP-010',
  severity: 'info',
  triggers: ['cross'],
  reads: ['inventory.exchanges'],
  message: MSG.EXCHANGES_SELECTED,
  check: (l) => ({ path: 'inventory.exchanges', params: { n: l.inventory.exchanges.length } }),
});

export const LI_DSP_020 = def({
  id: 'LI-DSP-020',
  severity: 'error',
  triggers: ['save'],
  reads: ['targeting.position'],
  message: 'Choose a valid position.',
  appliesTo: (l) => !!l.targeting.position,
  check: (l) => {
    const position = l.targeting.position;
    const bad =
      (position?.onScreen ?? []).some((v) => !(ON_SCREEN as readonly string[]).includes(v)) ||
      (position?.inContent ?? []).some((v) => !(IN_CONTENT as readonly string[]).includes(v));
    return bad ? { path: 'targeting.position' } : null;
  },
});

export const LI_DSP_021 = def({
  id: 'LI-DSP-021',
  severity: 'error',
  triggers: ['save'],
  reads: ['targeting.predictedViewability'],
  message: 'Choose a viewability option.',
  appliesTo: (l) =>
    l.targeting.predictedViewability !== undefined && l.targeting.predictedViewability !== null,
  check: (l) => {
    const value = l.targeting.predictedViewability;
    const ok =
      value === 'ALL' ||
      (typeof value === 'number' && (VIEWABILITY_STEPS as readonly number[]).includes(value));
    return ok ? null : { path: 'targeting.predictedViewability' };
  },
});

export const LI_DSP_031 = def({
  id: 'LI-DSP-031',
  severity: 'warning',
  triggers: ['save'],
  reads: ['creatives'],
  message: "This creative size can't serve on most exchanges.",
  needs: ['creatives'],
  check: (l, ctx) =>
    l.creatives
      .map((id, i) => ({ info: ctx.lookups.creatives?.get(id), i }))
      .filter(
        ({ info }) =>
          !!info &&
          (info.format === 'IMAGE' || info.format === 'HTML5' || info.format === 'TP_DISPLAY') &&
          info.width !== undefined &&
          info.height !== undefined &&
          !isStandardDisplaySize(info.width, info.height),
      )
      .map(({ i }): Violation => ({ path: `creatives[${i}]` })),
});

export const liDisplayRules: readonly AnyRule[] = [LI_DSP_010, LI_DSP_020, LI_DSP_021, LI_DSP_031];
