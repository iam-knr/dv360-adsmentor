// CMP rules: campaign (validation.md 2.4).
import { CAMPAIGN_PERCENT_KPIS, notRecommendedKpis } from '../constants/goals-kpis';
import { LIMITS } from '../constants/limits';
import { MSG } from '../messages';
import {
  codePointLength,
  dateRange,
  isBlank,
  isEmptyNum,
  isIsoDate,
  isUrl,
  isWhole,
  nonNegative,
  today,
  toNum,
} from '../primitives';
import type { AnyRule, CampaignBudgetRow, CampaignInput, Rule, Violation } from '../types';
import { at, capMaxEmpty, capMaxInvalid, capWindowInvalid, originalOf } from './shared';

type CampaignRule = Omit<Rule<CampaignInput>, 'kind'>;

function def(rule: CampaignRule): Rule<CampaignInput> {
  return { kind: 'campaign', ...rule };
}

/** Budget grid rows with at least one cell filled. Fully empty rows are ignored (CMP-050). */
function filledRows(c: CampaignInput): { row: CampaignBudgetRow; i: number }[] {
  return c.budgets
    .map((row, i) => ({ row, i }))
    .filter(
      ({ row }) =>
        !isBlank(row.name) || !isEmptyNum(row.amount) || !isBlank(row.startDate) || !isBlank(row.endDate),
    );
}

function amountInvalid(c: CampaignInput, row: CampaignBudgetRow): boolean {
  if (isEmptyNum(row.amount)) return false;
  const n = toNum(row.amount);
  if (n === null || n <= 0) return true;
  return c.budgetUnit === 'IMPRESSIONS' && !isWhole(row.amount);
}

export const CMP_001 = def({
  id: 'CMP-001',
  severity: 'error',
  triggers: ['blur'],
  reads: ['name'],
  message: MSG.ENTER_VALUE,
  check: (c) => (isBlank(c.name) ? { path: 'name' } : null),
});

export const CMP_002 = def({
  id: 'CMP-002',
  severity: 'error',
  triggers: ['save'],
  reads: ['name'],
  message: MSG.MAX_CHARS,
  check: (c) =>
    codePointLength(c.name) > LIMITS.NAME_MAX_240
      ? { path: 'name', params: { max: LIMITS.NAME_MAX_240 } }
      : null,
});

export const CMP_003 = def({
  id: 'CMP-003',
  severity: 'error',
  triggers: ['save'],
  reads: ['status'],
  message: MSG.CHOOSE_STATUS,
  appliesTo: (_c, ctx) => ctx.mode === 'create',
  check: (c) => (c.status === 'ACTIVE' || c.status === 'PAUSED' ? null : { path: 'status' }),
});

export const CMP_010 = def({
  id: 'CMP-010',
  severity: 'error',
  triggers: ['save'],
  reads: ['goal'],
  message: 'Choose a goal.',
  check: (c) => (c.goal ? null : { path: 'goal' }),
});

export const CMP_011 = def({
  id: 'CMP-011',
  severity: 'error',
  triggers: ['save'],
  reads: ['goal', 'kpi.type'],
  message: 'Choose a KPI.',
  appliesTo: (c) => !!c.goal,
  check: (c) => (c.kpi?.type ? null : { path: 'kpi.type' }),
});

export const CMP_012 = def({
  id: 'CMP-012',
  severity: 'error',
  triggers: ['blur'],
  reads: ['kpi.type', 'kpi.value'],
  message: MSG.ENTER_VALUE,
  appliesTo: (c) => !!c.kpi?.type && c.kpi.type !== 'OTHER',
  check: (c) => (isEmptyNum(c.kpi?.value) ? { path: 'kpi.value' } : null),
});

export const CMP_013 = def({
  id: 'CMP-013',
  severity: 'warning',
  triggers: ['cross'],
  reads: ['goal', 'kpi.type'],
  message: MSG.KPI_NOT_RECOMMENDED,
  appliesTo: (c) => !!c.goal && !!c.kpi?.type && c.kpi.type !== 'OTHER',
  check: (c) => (c.goal && c.kpi?.type && notRecommendedKpis(c.goal).includes(c.kpi.type) ? { path: 'kpi.type' } : null),
});

export const CMP_014 = def({
  id: 'CMP-014',
  severity: 'error',
  triggers: ['blur'],
  reads: ['kpi.value'],
  message: MSG.ENTER_POSITIVE,
  appliesTo: (c) => !!c.kpi?.type && c.kpi.type !== 'OTHER' && !isEmptyNum(c.kpi.value),
  check: (c) => {
    const n = toNum(c.kpi?.value);
    return n === null || n <= 0 ? { path: 'kpi.value' } : null;
  },
});

export const CMP_015 = def({
  id: 'CMP-015',
  severity: 'error',
  triggers: ['blur'],
  reads: ['kpi.type', 'kpi.value'],
  message: MSG.PCT_RANGE,
  appliesTo: (c) => !!c.kpi?.type && CAMPAIGN_PERCENT_KPIS.includes(c.kpi.type),
  check: (c) => {
    const n = toNum(c.kpi?.value);
    return n !== null && n > 100 ? { path: 'kpi.value' } : null;
  },
});

export const CMP_016 = def({
  id: 'CMP-016',
  severity: 'info',
  triggers: ['cross'],
  reads: ['kpi.otherText'],
  message: null,
  check: () => null,
});

export const CMP_020 = def({
  id: 'CMP-020',
  severity: 'error',
  triggers: ['save'],
  reads: ['creativeTypes'],
  message: MSG.SELECT_CREATIVE_TYPE,
  check: (c) => (c.creativeTypes.length === 0 ? { path: 'creativeTypes' } : null),
});

export const CMP_030 = def({
  id: 'CMP-030',
  severity: 'error',
  triggers: ['blur'],
  reads: ['plannedSpend'],
  message: MSG.NON_NEGATIVE,
  appliesTo: (c) => !isEmptyNum(c.plannedSpend),
  check: (c) => (nonNegative(c.plannedSpend) ? null : { path: 'plannedSpend' }),
});

export const CMP_031 = def({
  id: 'CMP-031',
  severity: 'error',
  triggers: ['save'],
  reads: ['startDate'],
  message: MSG.ENTER_VALUE,
  check: (c) => (isBlank(c.startDate) ? { path: 'startDate' } : null),
});

export const CMP_032 = def({
  id: 'CMP-032',
  severity: 'error',
  triggers: ['cross'],
  reads: ['startDate', 'endDate'],
  message: MSG.END_BEFORE_START,
  check: (c) => (dateRange(c.startDate, c.endDate) ? null : { path: 'endDate' }),
});

export const CMP_033 = def({
  id: 'CMP-033',
  severity: 'error',
  triggers: ['save'],
  reads: ['startDate'],
  message: "The start date can't be changed after the campaign has started.",
  appliesTo: (_c, ctx) => ctx.mode === 'edit',
  check: (c, ctx) => {
    const original = originalOf<CampaignInput>(ctx);
    const stored = original?.startDate;
    if (!stored || !isIsoDate(stored)) return null;
    const started = stored <= today(ctx);
    return started && c.startDate !== stored ? { path: 'startDate' } : null;
  },
});

export const CMP_034 = def({
  id: 'CMP-034',
  severity: 'error',
  triggers: ['blur'],
  reads: ['startDate'],
  message: MSG.START_IN_PAST,
  appliesTo: (c, ctx) => ctx.mode === 'create' && isIsoDate(c.startDate),
  check: (c, ctx) => (c.startDate && c.startDate < today(ctx) ? { path: 'startDate' } : null),
});

export const CMP_040 = def({
  id: 'CMP-040',
  severity: 'error',
  triggers: ['blur'],
  reads: ['frequencyCap.mode', 'frequencyCap.maxImpressions'],
  message: MSG.ENTER_VALUE,
  check: (c) => capMaxEmpty(c.frequencyCap, 'frequencyCap'),
});

export const CMP_041 = def({
  id: 'CMP-041',
  severity: 'error',
  triggers: ['blur'],
  reads: ['frequencyCap.maxImpressions'],
  message: MSG.ENTER_POSITIVE,
  check: (c) => capMaxInvalid(c.frequencyCap, 'frequencyCap'),
});

export const CMP_042 = def({
  id: 'CMP-042',
  severity: 'error',
  triggers: ['blur'],
  reads: ['frequencyCap.periodCount', 'frequencyCap.period'],
  message: MSG.ENTER_POSITIVE,
  check: (c) => capWindowInvalid(c.frequencyCap, 'frequencyCap', true),
});

export const CMP_050 = def({
  id: 'CMP-050',
  severity: 'error',
  triggers: ['save'],
  reads: ['budgets[].amount'],
  message: MSG.ENTER_VALUE,
  check: (c) =>
    filledRows(c)
      .filter(({ row }) => isEmptyNum(row.amount))
      .map(({ i }): Violation => ({ path: at('budgets', i, 'amount') })),
});

export const CMP_051 = def({
  id: 'CMP-051',
  severity: 'error',
  triggers: ['save'],
  reads: ['budgets[].name'],
  message: MSG.ENTER_VALUE,
  check: (c) =>
    filledRows(c)
      .filter(({ row }) => isBlank(row.name))
      .map(({ i }): Violation => ({ path: at('budgets', i, 'name') })),
});

export const CMP_052 = def({
  id: 'CMP-052',
  severity: 'error',
  triggers: ['blur'],
  reads: ['budgets[].amount', 'budgetUnit'],
  message: MSG.ENTER_POSITIVE,
  check: (c) =>
    filledRows(c)
      .filter(({ row }) => amountInvalid(c, row))
      .map(({ i }): Violation => ({ path: at('budgets', i, 'amount') })),
});

export const CMP_053 = def({
  id: 'CMP-053',
  severity: 'error',
  triggers: ['cross'],
  reads: ['budgets[].startDate', 'budgets[].endDate'],
  message: MSG.END_BEFORE_START,
  check: (c) =>
    c.budgets
      .map((row, i) => ({ row, i }))
      .filter(({ row }) => !dateRange(row.startDate, row.endDate))
      .map(({ i }): Violation => ({ path: at('budgets', i, 'endDate') })),
});

export const CMP_060 = def({
  id: 'CMP-060',
  severity: 'error',
  triggers: ['blur'],
  reads: ['landingPageUrls'],
  message: MSG.VALID_URL,
  check: (c) =>
    c.landingPageUrls
      .map((url, i) => ({ url, i }))
      .filter(({ url }) => !isBlank(url) && !isUrl(url.trim(), LIMITS.LANDING_URL_MAX))
      .map(({ i }): Violation => ({ path: `landingPageUrls[${i}]` })),
});

export const CMP_061 = def({
  id: 'CMP-061',
  severity: 'warning',
  triggers: ['blur'],
  reads: ['keywords'],
  message: 'Enter up to 5 keywords to help improve recommendations.',
  check: (c) => (c.keywords.filter((k) => !isBlank(k)).length > LIMITS.CAMPAIGN_KEYWORDS_MAX ? { path: 'keywords' } : null),
});

/** UI only: "Copy Settings" stays disabled until a source and one setting are ticked. Documentation row. */
export const CMP_070 = def({
  id: 'CMP-070',
  severity: 'error',
  triggers: ['cross'],
  reads: ['copySettings'],
  message: null,
  check: () => null,
});

export const CMP_080 = def({
  id: 'CMP-080',
  severity: 'info',
  triggers: [],
  reads: ['*'],
  message:
    'Inventory source and Targeting settings are now managed at the line item level. Use targeting templates for easy reuse.',
  appliesTo: (_c, ctx) => ctx.mode === 'create',
  check: () => ({ path: '*' }),
});

export const CMP_081 = def({
  id: 'CMP-081',
  severity: 'info',
  triggers: [],
  reads: ['goal'],
  message: "These settings don't impact serving.",
  check: () => ({ path: 'goal' }),
});

export const CMP_090 = def({
  id: 'CMP-090',
  severity: 'error',
  triggers: ['save'],
  reads: ['status'],
  message: "Archived campaigns can't be edited. Unarchive it first.",
  appliesTo: (_c, ctx) => ctx.mode === 'edit',
  check: (c, ctx) => {
    const original = originalOf<CampaignInput>(ctx);
    if (original?.status !== 'ARCHIVED') return null;
    const { status: nextStatus, ...rest } = c;
    const { status: _stored, ...storedRest } = original;
    const onlyStatusChanged = JSON.stringify(rest) === JSON.stringify(storedRest);
    return nextStatus === 'PAUSED' && onlyStatusChanged ? null : { path: 'status' };
  },
});

export const campaignRules: readonly AnyRule[] = [
  CMP_001,
  CMP_002,
  CMP_003,
  CMP_010,
  CMP_011,
  CMP_012,
  CMP_013,
  CMP_014,
  CMP_015,
  CMP_016,
  CMP_020,
  CMP_030,
  CMP_031,
  CMP_032,
  CMP_033,
  CMP_034,
  CMP_040,
  CMP_041,
  CMP_042,
  CMP_050,
  CMP_051,
  CMP_052,
  CMP_053,
  CMP_060,
  CMP_061,
  CMP_070,
  CMP_080,
  CMP_081,
  CMP_090,
];
