// LI-YT rules: YouTube & partners line items (validation.md 2.12). LI-YT-001, -014, -015, -016 and -019 are aliases of
// LI-001, LI-070..073, LI-080, LI-102 and LI-006 and are not registered. LI-YT-010 and -011 repeat the generic
// frequency cap checks for the exposure and view blocks; the engine dedupes the exposure one against LI-050/051.
import { YT_SUBTYPE_INFO } from '../constants/youtube';
import { MSG } from '../messages';
import { isEmptyNum, positive } from '../primitives';
import type { AnyRule, LineItemInput, Rule, Violation } from '../types';
import { def as baseDef } from './line-item';
import { capMaxEmpty, capMaxInvalid } from './shared';

function def(rule: Omit<Rule<LineItemInput>, 'kind'>): Rule<LineItemInput> {
  return baseDef({
    ...rule,
    appliesTo: (l, ctx) => (l.type === 'YT_VIDEO' || l.type === 'YT_AUDIO' || l.type === 'YT_ON_CTV') && (rule.appliesTo?.(l, ctx) ?? true),
  });
}

const OPTIMIZATIONS = ['REACH', 'TARGET_FREQUENCY', 'TRUEVIEW_VIEWS', 'AD_SEQUENCE'];

export const LI_YT_002 = def({
  id: 'LI-YT-002',
  severity: 'error',
  triggers: ['save'],
  reads: ['youtube.optimization'],
  message: MSG.SELECTION_REQUIRED,
  appliesTo: (l, ctx) => ctx.mode === 'create' && l.type !== 'YT_AUDIO',
  check: (l) =>
    l.youtube?.optimization && OPTIMIZATIONS.includes(l.youtube.optimization)
      ? null
      : { path: 'youtube.optimization' },
});

export const LI_YT_003 = def({
  id: 'LI-YT-003',
  severity: 'error',
  triggers: ['save'],
  reads: ['youtube.adFormatChoice', 'youtube.optimization'],
  message: MSG.SELECTION_REQUIRED,
  appliesTo: (l, ctx) => ctx.mode === 'create' && l.type !== 'YT_AUDIO' && !!l.youtube?.optimization,
  check: (l) => {
    const yt = l.youtube!;
    const choice = yt.adFormatChoice ?? null;
    const ok =
      yt.optimization === 'REACH'
        ? choice === 'EFFICIENT' || choice === 'NON_SKIPPABLE'
        : yt.optimization === 'TARGET_FREQUENCY'
          ? choice === 'ALL_FORMATS' || choice === 'IN_STREAM_ONLY'
          : choice === null;
    return ok ? null : { path: 'youtube.adFormatChoice' };
  },
});

export const LI_YT_004 = def({
  id: 'LI-YT-004',
  severity: 'error',
  triggers: ['save'],
  reads: ['youtube.subtype'],
  message: MSG.LOCKED_AFTER_CREATE,
  appliesTo: (_l, ctx) => ctx.mode === 'edit',
  check: (l, ctx) => {
    const stored = (ctx.original as LineItemInput | undefined)?.youtube?.subtype;
    return stored && l.youtube?.subtype !== stored ? { path: 'youtube.subtype' } : null;
  },
});

export const LI_YT_005 = def({
  id: 'LI-YT-005',
  severity: 'error',
  triggers: ['save'],
  reads: ['youtube.adFormats', 'youtube.subtype'],
  message: MSG.YT_AD_FORMAT,
  appliesTo: (l) => !!l.youtube?.subtype && YT_SUBTYPE_INFO[l.youtube.subtype].pickable,
  check: (l) => {
    const f = l.youtube!.adFormats;
    return f.inStream || f.inFeed || f.shorts ? null : { path: 'youtube.adFormats' };
  },
});

export const LI_YT_006 = def({
  id: 'LI-YT-006',
  severity: 'error',
  triggers: ['blur', 'save'],
  reads: ['budget.amount', 'budget.mode', 'pacing.period', 'pacing.dailyAmount'],
  message: MSG.ENTER_VALUE,
  check: (l) => {
    // C-09-4: Daily is stored in `dailyMaxAmount`, Flight in `budgetAmount`
    if (l.pacing.period === 'DAILY')
      return isEmptyNum(l.pacing.dailyAmount) ? { path: 'pacing.dailyAmount' } : null;
    return l.budget.mode !== 'AMOUNT' || isEmptyNum(l.budget.amount)
      ? { path: 'budget.amount' }
      : null;
  },
});

export const LI_YT_007 = def({
  id: 'LI-YT-007',
  severity: 'error',
  triggers: ['blur', 'save'],
  reads: ['budget.amount', 'pacing.dailyAmount', 'pacing.period'],
  message: MSG.ENTER_POSITIVE,
  check: (l) => {
    if (l.pacing.period === 'DAILY')
      return !isEmptyNum(l.pacing.dailyAmount) && !positive(l.pacing.dailyAmount)
        ? { path: 'pacing.dailyAmount' }
        : null;
    return l.budget.mode === 'AMOUNT' && !isEmptyNum(l.budget.amount) && !positive(l.budget.amount)
      ? { path: 'budget.amount' }
      : null;
  },
});

export const LI_YT_008 = def({
  id: 'LI-YT-008',
  severity: 'info',
  triggers: ['cross'],
  reads: ['pacing.period'],
  message: MSG.YT_PACING_NOTE,
  check: () => ({ path: 'pacing' }),
});

export const LI_YT_009 = def({
  id: 'LI-YT-009',
  severity: 'error',
  triggers: ['cross'],
  reads: ['bid.optimizedTowards', 'youtube.subtype'],
  message: MSG.YT_BID_LOCKED,
  appliesTo: (l) => !!l.youtube?.subtype && l.bid.mode === 'AUTOMATED',
  check: (l) => {
    const locked = YT_SUBTYPE_INFO[l.youtube!.subtype!].liBid;
    return l.bid.optimizedTowards === locked ? null : { path: 'bid.optimizedTowards' };
  },
});

export const LI_YT_010 = def({
  id: 'LI-YT-010',
  severity: 'error',
  triggers: ['blur', 'save'],
  reads: ['frequencyCap.mode', 'frequencyCap.maxImpressions'],
  message: MSG.ENTER_VALUE,
  check: (l) => {
    const empty = capMaxEmpty(l.frequencyCap, 'frequencyCap');
    if (empty) return empty;
    const bad = capMaxInvalid(l.frequencyCap, 'frequencyCap');
    return bad ? { ...bad, message: MSG.ENTER_POSITIVE } : null;
  },
});

export const LI_YT_011 = def({
  id: 'LI-YT-011',
  severity: 'error',
  triggers: ['blur', 'save'],
  reads: ['youtube.viewCap'],
  message: MSG.ENTER_VALUE,
  appliesTo: (l) => !!l.youtube && l.youtube.viewCap.mode === 'LIMITED',
  check: (l): Violation | Violation[] | null => {
    const cap = l.youtube!.viewCap;
    if (isEmptyNum(cap.maxImpressions)) return { path: 'youtube.viewCap.maxImpressions' };
    return positive(cap.maxImpressions)
      ? null
      : { path: 'youtube.viewCap.maxImpressions', message: MSG.ENTER_POSITIVE };
  },
});

export const LI_YT_012 = def({
  id: 'LI-YT-012',
  severity: 'error',
  triggers: ['save'],
  reads: ['youtube.targetFrequency', 'youtube.subtype'],
  message: MSG.ENTER_VALUE,
  appliesTo: (l) => !!l.youtube?.subtype && YT_SUBTYPE_INFO[l.youtube.subtype].targetFrequency,
  check: (l) => {
    const tf = l.youtube!.targetFrequency;
    if (!tf || isEmptyNum(tf.maxImpressions)) return { path: 'youtube.targetFrequency.maxImpressions' };
    return positive(tf.maxImpressions)
      ? null
      : { path: 'youtube.targetFrequency.maxImpressions', message: MSG.ENTER_POSITIVE };
  },
});

export const LI_YT_013 = def({
  id: 'LI-YT-013',
  severity: 'error',
  triggers: ['save'],
  reads: ['youtube.productFeed'],
  message: MSG.YT_MERCHANT,
  appliesTo: (l, ctx) => !!l.youtube?.productFeed && !ctx.advertiser.merchantCenterLinked,
  check: () => ({ path: 'youtube.productFeed' }),
});

export const LI_YT_017 = def({
  id: 'LI-YT-017',
  severity: 'error',
  triggers: ['save'],
  reads: ['youtube.inventorySources'],
  message: MSG.PICK_INVENTORY_SOURCE,
  appliesTo: (l) => !!l.youtube,
  check: (l) =>
    l.youtube!.inventorySources.length === 0 ? { path: 'youtube.inventorySources' } : null,
});

export const LI_YT_018 = def({
  id: 'LI-YT-018',
  severity: 'warning',
  triggers: ['activate'],
  reads: ['status'],
  message: MSG.YT_NO_AD_GROUPS,
  appliesTo: (_l, ctx) => ctx.mode === 'edit',
  check: (_l, ctx) =>
    (ctx.children?.adGroups ?? []).some((g) => g.status === 'ACTIVE') ? null : { path: 'status' },
});

/** C-09-4 follow-up: a draft line item has no ads yet, so the check runs when the line item is active. */
export const LI_YT_020 = def({
  id: 'LI-YT-020',
  severity: 'error',
  triggers: ['activate'],
  reads: ['youtube.sequenceSteps', 'youtube.subtype'],
  message: MSG.YT_SEQUENCE,
  appliesTo: (l, ctx) => ctx.mode === 'edit' && l.youtube?.subtype === 'AD_SEQUENCE',
  check: (l) => ((l.youtube!.sequenceSteps ?? 0) < 2 ? { path: 'youtube.sequenceSteps' } : null),
});

export const LI_YT_021 = def({
  id: 'LI-YT-021',
  severity: 'error',
  triggers: ['save'],
  reads: ['type'],
  message: MSG.YT_NOT_ENABLED,
  appliesTo: (_l, ctx) => !ctx.advertiser.googleInventoryEnabled,
  check: () => ({ path: 'type' }),
});

export const liYoutubeRules: readonly AnyRule[] = [
  LI_YT_002,
  LI_YT_003,
  LI_YT_004,
  LI_YT_005,
  LI_YT_006,
  LI_YT_007,
  LI_YT_008,
  LI_YT_009,
  LI_YT_010,
  LI_YT_011,
  LI_YT_012,
  LI_YT_013,
  LI_YT_017,
  LI_YT_018,
  LI_YT_020,
  LI_YT_021,
];
