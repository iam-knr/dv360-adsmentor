import 'server-only';
// Campaign rows to the wire shape and back (module 06 3.2). Money: Decimal major units in the DB and on the wire.
import { Prisma, type Campaign, type CampaignBudget } from '@prisma/client';
import type { CampaignSnapshot } from '@/lib/validation';
import { decimalToNumber, fromDbDate, toDbDate } from './service-kit';
import { isEmptyBudgetRow, type CampaignWire, type FrequencyCapWire } from './wire';

type CampaignWithBudgets = Campaign & { budgets: CampaignBudget[] };

const blank = (v: unknown) =>
  v === null || v === undefined || (typeof v === 'string' ? v.trim() === '' : false);
const dec = (v: unknown): Prisma.Decimal | null =>
  blank(v) ? null : new Prisma.Decimal(String(v).trim());
const int = (v: unknown): number | null => (blank(v) ? null : Number(v));
const text = (v: string | null | undefined): string | null => (blank(v) ? null : String(v).trim());

export function frequencyFromRow(r: {
  freqMode: 'UNLIMITED' | 'INHERIT' | 'LIMITED';
  freqMaxExposures: number | null;
  freqUnit: FrequencyCapWire['period'] | null;
  freqUnitCount: number | null;
}): FrequencyCapWire {
  return r.freqMode === 'LIMITED'
    ? {
        mode: 'LIMITED',
        maxImpressions: r.freqMaxExposures,
        periodCount: r.freqUnitCount ?? 1,
        period: r.freqUnit ?? 'MONTH',
      }
    : { mode: r.freqMode, maxImpressions: '', periodCount: 1, period: 'MONTH' };
}

export function frequencyToRow(cap: FrequencyCapWire) {
  const limited = cap.mode === 'LIMITED';
  return {
    freqMode: cap.mode,
    freqMaxExposures: limited ? int(cap.maxImpressions) : null,
    freqUnit: limited ? (cap.period ?? 'MONTH') : null,
    freqUnitCount: limited ? (int(cap.periodCount) ?? 1) : null,
  };
}

export function campaignToWire(c: CampaignWithBudgets): CampaignWire {
  return {
    name: c.name,
    status: c.status === 'DRAFT' || c.status === 'SCHEDULED_FOR_DELETION' ? 'PAUSED' : c.status,
    goal: c.goal,
    kpi: {
      type: c.kpi,
      value: decimalToNumber(c.kpiValue) ?? '',
      otherText: c.kpiOtherText ?? '',
    },
    creativeTypes: c.creativeTypes,
    plannedSpend: decimalToNumber(c.plannedSpend) ?? '',
    startDate: fromDbDate(c.plannedStart),
    endDate: fromDbDate(c.plannedEnd) ?? '',
    frequencyCap: frequencyFromRow(c),
    budgetUnit: c.budgetUnit,
    budgets: c.budgets.map((b) => ({
      id: b.id,
      name: b.name,
      amount: decimalToNumber(b.amount) ?? '',
      startDate: fromDbDate(b.startDate) ?? '',
      endDate: fromDbDate(b.endDate) ?? '',
      invoiceGroupingId: b.invoiceGroupingId ?? '',
      externalBudgetId: b.externalBudgetId ?? '',
    })),
    landingPageUrls: c.landingPageUrls.length ? c.landingPageUrls : [''],
    keywords: c.keywords,
  };
}

/** Scalar columns of a campaign from a validated wire value. Budgets are written separately. */
export function campaignData(w: CampaignWire) {
  const kpiType = w.kpi.type;
  return {
    name: w.name.trim(),
    goal: w.goal,
    kpi: kpiType,
    kpiValue: kpiType && kpiType !== 'OTHER' ? dec(w.kpi.value) : null,
    kpiOtherText: kpiType === 'OTHER' ? text(w.kpi.otherText) : null,
    creativeTypes: [...new Set(w.creativeTypes)],
    plannedSpend: dec(w.plannedSpend),
    plannedStart: toDbDate(String(w.startDate)),
    plannedEnd: blank(w.endDate) ? null : toDbDate(String(w.endDate)),
    ...frequencyToRow(w.frequencyCap),
    budgetUnit: w.budgetUnit,
    landingPageUrls: w.landingPageUrls.map((u) => u.trim()).filter(Boolean),
    keywords: w.keywords.map((k) => k.trim()).filter(Boolean),
  };
}

/** Budget rows to keep: fully empty rows are ignored (CMP-050). */
export function budgetRows(w: CampaignWire) {
  return w.budgets
    .filter((b) => !isEmptyBudgetRow(b))
    .map((b) => ({
      id: b.id,
      amount: dec(b.amount) ?? new Prisma.Decimal(0),
      name: String(b.name ?? '').trim(),
      startDate: blank(b.startDate) ? null : toDbDate(String(b.startDate)),
      endDate: blank(b.endDate) ? null : toDbDate(String(b.endDate)),
      invoiceGroupingId: text(b.invoiceGroupingId),
      externalBudgetId: text(b.externalBudgetId),
    }));
}

export function campaignSnapshotOf(c: Campaign): CampaignSnapshot {
  return {
    id: c.id,
    goal: c.goal,
    status: c.status === 'ARCHIVED' ? 'ARCHIVED' : c.status === 'PAUSED' ? 'PAUSED' : 'ACTIVE',
    frequencyCap: frequencyFromRow(c),
  };
}
