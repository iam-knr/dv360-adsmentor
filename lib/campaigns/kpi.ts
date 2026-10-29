// KPI labels, goal text and KPI Actual (module 06 2.1 and 5, engine.md 4.6 and 9.4). Pure and client safe.
import { format as formatMoney, type CurrencyCode } from '@/lib/money';
import type { Kpi } from '@/lib/validation';
import { MONEY_KPIS } from '@/lib/validation/constants/goals-kpis';

/** Short KPI names used in the KPI dropdowns and the Goal columns. */
export const KPI_LABEL: Record<Kpi, string> = {
  CPM: 'CPM',
  CPC: 'CPC',
  CPA: 'CPA',
  CTR: 'CTR',
  CPV: 'CPV',
  CPIAVC: 'CPIAVC',
  VIEWABLE_PCT: 'Viewable %',
  VCPM: 'VCPM',
  CPCL: 'CPCL',
  CPCV: 'CPCV',
  TOS10: 'TOS10',
  VTR: 'VTR',
  COMPL_AUDIO: 'Audio completion rate',
  COMPL_VIDEO: 'Video completion rate',
  VALUE_COST: 'Value / Cost',
  CLICK_CVR: 'Click CVR',
  IMPR_CVR: 'Impression CVR',
  OTHER: 'Other',
};

const isMoney = (kpi: Kpi) => (MONEY_KPIS as readonly string[]).includes(kpi);

/** "₹50.00 CPM", "0.15% CTR", "2.5 Value / Cost". Null when there is no goal (OTHER, Q-06-06). */
export function kpiGoalText(
  kpi: Kpi | null,
  value: number | null,
  currency: CurrencyCode,
): string | null {
  if (!kpi || kpi === 'OTHER' || value === null) return null;
  if (isMoney(kpi)) return `${formatMoney(value, currency)} ${KPI_LABEL[kpi]}`;
  if (kpi === 'VALUE_COST') return `${value} ${KPI_LABEL[kpi]}`;
  return `${value}% ${KPI_LABEL[kpi]}`;
}

/** Inputs the KPI formulas read (engine.md 4.6). Absent fields mean the engine does not report them yet. */
export interface KpiMetrics {
  impressions: number;
  clicks: number;
  conversions: number;
  /** Media and fees cost: `revenue` (RC-038). */
  revenue: number;
  views?: number;
  viewableImpressions?: number;
  measurableImpressions?: number;
  customImpressionValue?: number;
}

/** Minimum sample before KPI Actual is shown (engine.md 4.6). */
export const KPI_MIN_SAMPLE = { impressions: 1000, clicks: 30, conversions: 10, views: 100 };

/** KPI Actual as a number in the KPI unit (major money units or percent), or null ("-"). */
export function kpiActualValue(kpi: Kpi | null, m: KpiMetrics): number | null {
  if (!kpi) return null;
  const enoughImpr = m.impressions >= KPI_MIN_SAMPLE.impressions;
  switch (kpi) {
    case 'CPM':
      return enoughImpr ? (m.revenue / m.impressions) * 1000 : null;
    case 'CTR':
      return enoughImpr ? (m.clicks / m.impressions) * 100 : null;
    case 'CPC':
      return m.clicks >= KPI_MIN_SAMPLE.clicks ? m.revenue / m.clicks : null;
    case 'CPA':
      return m.conversions >= KPI_MIN_SAMPLE.conversions ? m.revenue / m.conversions : null;
    case 'CLICK_CVR':
      return m.clicks >= KPI_MIN_SAMPLE.clicks ? (m.conversions / m.clicks) * 100 : null;
    case 'IMPR_CVR':
      return enoughImpr ? (m.conversions / m.impressions) * 100 : null;
    case 'CPV':
      return m.views !== undefined && m.views >= KPI_MIN_SAMPLE.views ? m.revenue / m.views : null;
    case 'VTR':
      return m.views !== undefined && enoughImpr ? (m.views / m.impressions) * 100 : null;
    case 'VIEWABLE_PCT':
      return m.viewableImpressions !== undefined && m.measurableImpressions
        ? (m.viewableImpressions / m.measurableImpressions) * 100
        : null;
    case 'VCPM':
      return m.viewableImpressions !== undefined &&
        m.viewableImpressions >= KPI_MIN_SAMPLE.impressions
        ? (m.revenue / m.viewableImpressions) * 1000
        : null;
    case 'VALUE_COST':
      return m.customImpressionValue !== undefined && m.revenue > 0
        ? m.customImpressionValue / m.revenue
        : null;
    default:
      return null;
  }
}

function formatActual(kpi: Kpi, v: number, currency: CurrencyCode): string {
  if (isMoney(kpi)) return formatMoney(v, currency);
  if (kpi === 'VALUE_COST') return v.toFixed(2);
  return `${v.toFixed(2)}%`;
}

export function kpiActualText(
  kpi: Kpi | null,
  m: KpiMetrics,
  currency: CurrencyCode,
): string | null {
  const v = kpiActualValue(kpi, m);
  return kpi && v !== null && Number.isFinite(v) ? formatActual(kpi, v, currency) : null;
}

/** "KPI Actual TrueView" (Δ-06-7): CPV when the KPI is CPV, VTR when VTR, else "-". */
export function kpiActualTrueViewText(
  kpi: Kpi | null,
  m: KpiMetrics,
  currency: CurrencyCode,
): string | null {
  return kpi === 'CPV' || kpi === 'VTR' ? kpiActualText(kpi, m, currency) : null;
}
