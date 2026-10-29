// Campaign wire types and pure mappers (routes.md 8.4, module 06 4). Client safe: no server or database imports.
// The form value, the wire value and the validation input share one shape, so issue paths point at form fields.
// Money on the wire is in major units (RC-019); `toValidationInput` converts to the minor units the rules expect.
import { toMinor, type CurrencyCode } from '@/lib/money';
import type {
  CampaignGoal,
  CampaignInput as ValidationCampaignInput,
  FreqPeriod,
  Issue,
  Kpi,
  Num,
} from '@/lib/validation';
import { MONEY_KPIS } from '@/lib/validation/constants/goals-kpis';

export type ServiceError = 'FORBIDDEN' | 'NOT_FOUND' | 'CONFLICT' | 'INVALID';

/** routes.md 8.0 `Issue`, with `info` kept for the inline notes. */
export interface WireIssue {
  path: string;
  severity: 'error' | 'warning' | 'info';
  code: string;
  message: string;
}

export function toWireIssues(issues: readonly Issue[]): WireIssue[] {
  return issues.map((i) => ({
    path: i.path,
    severity: i.severity,
    code: i.ruleId,
    message: i.message,
  }));
}

export type EntityStatusKey = 'DRAFT' | 'ACTIVE' | 'PAUSED' | 'ARCHIVED';

export interface FrequencyCapWire {
  mode: 'UNLIMITED' | 'INHERIT' | 'LIMITED';
  maxImpressions?: Num;
  periodCount?: Num;
  period?: FreqPeriod | null;
}

export interface CampaignBudgetWire {
  id?: string;
  name?: string | null;
  amount?: Num;
  startDate?: string | null;
  endDate?: string | null;
  invoiceGroupingId?: string | null;
  externalBudgetId?: string | null;
}

/** The form and wire value of a campaign (module 06 3.2). */
export interface CampaignWire {
  name: string;
  status: 'ACTIVE' | 'PAUSED' | 'ARCHIVED' | null;
  goal: CampaignGoal | null;
  kpi: { type: Kpi | null; value?: Num; otherText?: string | null };
  creativeTypes: ('DISPLAY' | 'VIDEO' | 'AUDIO')[];
  plannedSpend?: Num;
  startDate: string | null;
  endDate?: string | null;
  frequencyCap: FrequencyCapWire;
  budgetUnit: 'CURRENCY' | 'IMPRESSIONS';
  budgets: CampaignBudgetWire[];
  landingPageUrls: string[];
  keywords: string[];
}

export interface WriteMeta {
  expectedVersion?: number;
  changeNote?: string;
}

export interface CampaignDetail {
  id: string;
  publicId: string;
  advertiserId: string;
  version: number;
  archived: boolean;
  /** plannedStart <= sim today (CMP-033). */
  startLocked: boolean;
  value: CampaignWire;
  currency: CurrencyCode;
  timeZone: string;
}

export interface CampaignRow {
  id: string;
  publicId: string;
  name: string;
  status: EntityStatusKey;
  alertCount: number;
  alertSeverity: 'critical' | 'warning' | null;
  budget: number | null;
  spent: number;
  kpiGoal: string | null;
  kpiActual: string | null;
  kpiActualTrueView: string | null;
}

export interface CampaignCopySource {
  frequencyCap?: FrequencyCapWire;
  goal?: CampaignGoal | null;
  kpi?: CampaignWire['kpi'];
  creativeTypes?: CampaignWire['creativeTypes'];
}

export type CopySetting = 'frequencyCap' | 'goal' | 'creativeTypes';

/** The five starting rows of the Additional budget details grid; "Add Budgets" appends five more. */
export const BUDGET_ROWS_PER_ADD = 5;

export const emptyBudgetRow = (): CampaignBudgetWire => ({
  name: '',
  amount: '',
  startDate: '',
  endDate: '',
  invoiceGroupingId: '',
  externalBudgetId: '',
});

export function addBudgetRows(rows: CampaignBudgetWire[]): CampaignBudgetWire[] {
  return [...rows, ...Array.from({ length: BUDGET_ROWS_PER_ADD }, emptyBudgetRow)];
}

const blank = (v: unknown) => v === null || v === undefined || String(v).trim() === '';

export function isEmptyBudgetRow(row: CampaignBudgetWire): boolean {
  return (
    blank(row.name) &&
    blank(row.amount) &&
    blank(row.startDate) &&
    blank(row.endDate) &&
    blank(row.invoiceGroupingId) &&
    blank(row.externalBudgetId)
  );
}

/** Defaults of the New campaign form (module 06 2.2): Active, start today, no frequency limit. */
export function newCampaignValue(today: string): CampaignWire {
  return {
    name: '',
    status: 'ACTIVE',
    goal: null,
    kpi: { type: null, value: '', otherText: '' },
    creativeTypes: [],
    plannedSpend: '',
    startDate: today,
    endDate: '',
    frequencyCap: { mode: 'UNLIMITED', maxImpressions: '', periodCount: 1, period: 'MONTH' },
    budgetUnit: 'CURRENCY',
    budgets: addBudgetRows([]),
    landingPageUrls: [''],
    keywords: [],
  };
}

/** Major units to minor units for a form number. Text that is not a number is passed on so the rule flags it. */
export function moneyToMinor(v: Num, currency: CurrencyCode): Num {
  if (blank(v)) return null;
  const n = typeof v === 'number' ? v : Number(String(v).trim());
  if (!Number.isFinite(n)) return v;
  return toMinor(n, currency);
}

export function isMoneyKpi(kpi: Kpi | null | undefined): boolean {
  return !!kpi && (MONEY_KPIS as readonly string[]).includes(kpi);
}

const orNull = (v: string | null | undefined) => (blank(v) ? null : (v as string).trim());

/** The validation input (minor units) of a campaign wire value. Paths stay the same. */
export function toValidationInput(
  c: CampaignWire,
  currency: CurrencyCode,
): ValidationCampaignInput {
  const money = (v: Num) => moneyToMinor(v, currency);
  const budgetAmount = (v: Num) =>
    c.budgetUnit === 'IMPRESSIONS' ? (blank(v) ? null : v) : money(v);
  return {
    name: c.name,
    status: c.status,
    goal: c.goal,
    kpi: {
      type: c.kpi.type,
      value: isMoneyKpi(c.kpi.type) ? money(c.kpi.value) : blank(c.kpi.value) ? null : c.kpi.value,
      otherText: c.kpi.otherText ?? null,
    },
    creativeTypes: c.creativeTypes,
    plannedSpend: money(c.plannedSpend),
    startDate: orNull(c.startDate),
    endDate: orNull(c.endDate),
    frequencyCap: {
      mode: c.frequencyCap.mode,
      maxImpressions: blank(c.frequencyCap.maxImpressions) ? null : c.frequencyCap.maxImpressions,
      periodCount: blank(c.frequencyCap.periodCount) ? null : c.frequencyCap.periodCount,
      period: c.frequencyCap.period ?? null,
    },
    budgetUnit: c.budgetUnit,
    budgets: c.budgets.map((b) => ({
      name: b.name ?? null,
      amount: budgetAmount(b.amount),
      startDate: orNull(b.startDate),
      endDate: orNull(b.endDate),
    })),
    landingPageUrls: c.landingPageUrls,
    keywords: c.keywords,
  };
}

/** Keywords text box: comma separated (module 06 2.2). */
export function parseKeywords(text: string): string[] {
  return text
    .split(',')
    .map((k) => k.trim())
    .filter(Boolean);
}

/** DLG-10: copy only the ticked settings into the draft. "Campaign goal" carries the KPI with it. */
export function applyCopySource(
  draft: CampaignWire,
  source: CampaignCopySource,
  settings: readonly CopySetting[],
): CampaignWire {
  let next = draft;
  if (settings.includes('frequencyCap') && source.frequencyCap)
    next = { ...next, frequencyCap: { ...source.frequencyCap } };
  if (settings.includes('goal') && source.goal !== undefined)
    next = { ...next, goal: source.goal ?? null, kpi: { ...(source.kpi ?? { type: null }) } };
  if (settings.includes('creativeTypes') && source.creativeTypes)
    next = { ...next, creativeTypes: [...source.creativeTypes] };
  return next;
}
