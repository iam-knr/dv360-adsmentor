// Cell text of the plan line item table (module 04 2.2), shared by the grid and the CSV download so both show the
// same column order and values.
import { planCountry } from './countries';
import { PLAN_COLUMNS, normalizePlanColumns } from './columns';
import { BUYING_METHOD_LABEL, type PlanDto, type PlanRowDto, type PlanRowForecast } from './types';

const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
/** `Mar 1, 2026` */
export function fmtDate(isoDate: string): string {
  const [y, m, d] = isoDate.split('-').map(Number) as [number, number, number];
  return `${MON[m - 1]} ${d}, ${y}`;
}

export function fmtMoney(n: number | null | undefined, code: string): string {
  if (n === null || n === undefined) return '-';
  const f = Math.abs(n) >= 100_000 ? 0 : 2;
  return `${code}${n.toLocaleString('en-US', { minimumFractionDigits: f, maximumFractionDigits: f })}`;
}

export function fmtCompact(n: number): string {
  const a = Math.abs(n);
  if (a >= 1e9) return `${(n / 1e9).toFixed(2)}B`;
  if (a >= 1e6) return `${(n / 1e6).toFixed(2)}M`;
  if (a >= 1e3) return `${(n / 1e3).toFixed(1)}K`;
  return String(Math.round(n));
}

export const fmtPct = (n: number | null | undefined, d = 1): string =>
  n === null || n === undefined ? '-' : `${n.toFixed(d)}%`;

export const dateRangeLabel = (r: Pick<PlanRowDto, 'startDate' | 'endDate'>): string =>
  `${fmtDate(r.startDate)} - ${fmtDate(r.endDate)}`;

export function targetingSummary(plan: PlanDto, r: PlanRowDto): string {
  const d = plan.header.demographics;
  const sex = d.genders.length >= 2 ? 'Male, Female' : d.genders.join(', ').toLowerCase();
  const parts = [`${sex}, ${d.ageMin} - ${d.ageMax}`];
  if (r.audienceRefs.length) parts.push(r.audienceRefs.join(', '));
  return parts.join('; ');
}

export function locationsLabel(r: PlanRowDto): string {
  return r.locations.map((c) => planCountry(c)?.name ?? c).join(', ');
}

/** Plain text of a cell. `f` is the row's forecast, missing before the first save. */
export function cellText(
  columnId: string,
  plan: PlanDto,
  r: PlanRowDto,
  f: PlanRowForecast | undefined,
): string {
  const cur = plan.header.currencyCode;
  switch (columnId) {
    case 'name':
      return r.name;
    case 'locations':
      return locationsLabel(r);
    case 'dateRange':
      return dateRangeLabel(r);
    case 'targeting':
      return targetingSummary(plan, r);
    case 'buyingMethod':
      return `${BUYING_METHOD_LABEL[r.buyingMethod]} (${r.pricing})`;
    case 'budget':
      return `${fmtMoney(r.budgetNet, cur)} (Total: ${fmtMoney(r.budgetTotal, cur)})`;
    case 'budgetPct':
      return f ? fmtPct(f.budgetSharePct) : '-';
    case 'onTargetReach':
      return f ? fmtPct(f.onTargetReachPct) : '-';
    case 'onTargetFrequency':
      return f ? f.onTargetFrequency.toFixed(2) : '-';
    case 'trps':
      return f ? String(Math.round(f.trps)) : '-';
    case 'costPerReach':
      return f ? fmtMoney(f.costPerReach, cur) : '-';
    case 'cpa':
      return f && f.cpa !== null ? fmtMoney(f.cpa, cur) : '-';
    case 'onTargetImpressions':
      return f ? fmtCompact(f.onTargetImpressions) : '-';
    case 'billableUnits':
      return f ? `${fmtCompact(f.billableUnits)} ${f.billableUnitLabel}` : '-';
    case 'avgCost':
      return f
        ? `${fmtMoney(f.avgCost, cur)} ${f.avgCostLabel}${r.isCpmLocked ? ' (locked)' : f.maxCpm ? `, Max. CPM: ${fmtMoney(f.maxCpm, cur)}` : ''}`
        : '-';
    case 'viewableCpm':
      return f ? fmtMoney(f.viewableCpm, cur) : '-';
    case 'viewabilityRate':
      return f ? fmtPct(f.viewabilityRate) : '-';
    case 'trueviewViews':
    case 'conversions':
      return '-';
    default:
      return '';
  }
}

const csv = (v: string | number): string => {
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/** Spec 4.4: header lines, then the table in the user's column order. */
export function planCsv(plan: PlanDto, columns: readonly string[]): string {
  const order = normalizePlanColumns(columns);
  const h = plan.header;
  const f = plan.forecast;
  const lines: string[] = [
    ['Plan', h.name],
    ['Location', planCountry(h.location)?.name ?? h.location],
    ['Dates', `${fmtDate(h.dates.start)} - ${fmtDate(h.dates.end)}`],
    [
      'Demographics',
      `${h.demographics.genders.join('/')} ${h.demographics.ageMin}-${h.demographics.ageMax}`,
    ],
    ['Forecast as of', f ? fmtDate(f.asOf.slice(0, 10)) : '-'],
    [],
  ].map((l) => l.map(csv).join(','));
  lines.push(order.map((id) => csv(PLAN_COLUMNS.find((c) => c.id === id)?.label ?? id)).join(','));
  for (const r of plan.rows) {
    lines.push(order.map((id) => csv(cellText(id, plan, r, f?.perRow[r.id]))).join(','));
  }
  return `${lines.join('\r\n')}\r\n`;
}
