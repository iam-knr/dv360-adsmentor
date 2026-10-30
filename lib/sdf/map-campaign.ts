// Campaigns.csv mapper (module 11 4.4 A). Model = the campaign wire value plus the ids the file shows.
import type { CampaignBudgetWire, CampaignWire } from '@/lib/campaigns/wire';
import { isEmptyBudgetRow } from '@/lib/campaigns/wire';
import { KPI_LABEL } from '@/lib/campaigns/kpi';
import { CAMPAIGN_GOAL_LABEL } from '@/lib/validation/constants/goals-kpis';
import { decDate, decNum, encDate, encEpoch, encNum, encTuples, decTuples, formatError } from './codec';
import { BUDGET_UNIT_LABEL, enm, FREQ_PERIOD_LABEL, int, list, money, STATUS_LABEL, text, bool, date, type ColMaps } from './map-common';

export interface CampaignModel {
  publicId: string;
  advertiserPublicId: string;
  updatedAt: Date;
  wire: CampaignWire;
}

const CREATIVE = { DISPLAY: 'Display', VIDEO: 'Video', AUDIO: 'Audio' } as const;
const goalLabels = CAMPAIGN_GOAL_LABEL;

export const campaignMaps: ColMaps<CampaignModel> = {
  'Campaign Id': text((m) => m.publicId),
  'Advertiser Id': text((m) => m.advertiserPublicId),
  Name: text((m) => m.wire.name, (m, v) => (m.wire.name = v)),
  Timestamp: { get: (m) => encEpoch(m.updatedAt) },
  Status: enm(
    STATUS_LABEL,
    'Status',
    (m) => m.wire.status,
    (m, v) => (m.wire.status = v === 'ACTIVE' || v === 'PAUSED' || v === 'ARCHIVED' ? v : m.wire.status),
  ),
  'Campaign Goal': enm(goalLabels, 'Campaign Goal', (m) => m.wire.goal, (m, v) => (m.wire.goal = v)),
  'Campaign Goal KPI': enm(
    KPI_LABEL,
    'Campaign Goal KPI',
    (m) => m.wire.kpi.type,
    (m, v) => (m.wire.kpi = { ...m.wire.kpi, type: v }),
  ),
  'Campaign Goal KPI Value': money((m) => m.wire.kpi.value as number | string, (m, v) => (m.wire.kpi = { ...m.wire.kpi, value: v ?? '' })),
  'Campaign Goal KPI Other Text': text((m) => m.wire.kpi.otherText, (m, v) => (m.wire.kpi = { ...m.wire.kpi, otherText: v })),
  'Creative Types': {
    get: (m) => m.wire.creativeTypes.map((t) => CREATIVE[t]).join(';'),
    set: (m, v) =>
      (m.wire.creativeTypes = v
        .split(';')
        .map((x) => x.trim())
        .filter(Boolean)
        .map((x) => {
          const k = (Object.keys(CREATIVE) as (keyof typeof CREATIVE)[]).find((c) => CREATIVE[c].toLowerCase() === x.toLowerCase());
          if (!k) throw formatError('Display;Video;Audio');
          return k;
        })),
  },
  'Planned Spend': money((m) => m.wire.plannedSpend, (m, v) => (m.wire.plannedSpend = v ?? '')),
  'Start Date': date((m) => m.wire.startDate, (m, v) => (m.wire.startDate = v)),
  'End Date': date((m) => m.wire.endDate, (m, v) => (m.wire.endDate = v ?? '')),
  'Frequency Enabled': bool(
    (m) => m.wire.frequencyCap.mode === 'LIMITED',
    (m, v) => (m.wire.frequencyCap = { ...m.wire.frequencyCap, mode: v ? 'LIMITED' : 'UNLIMITED' }),
  ),
  'Frequency Exposures': int(
    (m) => m.wire.frequencyCap.maxImpressions as number | null,
    (m, v) => (m.wire.frequencyCap = { ...m.wire.frequencyCap, maxImpressions: v }),
  ),
  'Frequency Period': enm(
    FREQ_PERIOD_LABEL,
    'Frequency Period',
    (m) => (m.wire.frequencyCap.mode === 'LIMITED' ? m.wire.frequencyCap.period : null),
    (m, v) => (m.wire.frequencyCap = { ...m.wire.frequencyCap, period: v }),
  ),
  'Frequency Amount': int(
    (m) => (m.wire.frequencyCap.mode === 'LIMITED' ? (m.wire.frequencyCap.periodCount as number | null) : null),
    (m, v) => (m.wire.frequencyCap = { ...m.wire.frequencyCap, periodCount: v }),
  ),
  'Budget Type': enm(BUDGET_UNIT_LABEL, 'Budget Type', (m) => m.wire.budgetUnit, (m, v) => (m.wire.budgetUnit = v ?? m.wire.budgetUnit)),
  Budgets: {
    get: (m) =>
      encTuples(
        m.wire.budgets
          .filter((b) => !isEmptyBudgetRow(b))
          .map((b) => [
            encNum(b.amount as number | string | null, m.wire.budgetUnit === 'IMPRESSIONS' ? 0 : 2),
            b.name ?? '',
            encDate(b.startDate),
            encDate(b.endDate),
            b.invoiceGroupingId ?? '',
            b.externalBudgetId ?? '',
          ]),
      ),
    set: (m, v) => {
      const rows = decTuples(v);
      const old = m.wire.budgets.filter((b) => !isEmptyBudgetRow(b));
      m.wire.budgets = rows.map((r, i): CampaignBudgetWire => ({
        ...(old[i]?.id ? { id: old[i]!.id } : {}),
        amount: decNum(r[0] ?? '') ?? '',
        name: r[1] ?? '',
        startDate: decDate(r[2] ?? ''),
        endDate: decDate(r[3] ?? ''),
        invoiceGroupingId: r[4] || null,
        externalBudgetId: r[5] || null,
      }));
    },
  },
  'Landing Page URLs': list((m) => m.wire.landingPageUrls.filter(Boolean), (m, v) => (m.wire.landingPageUrls = v.length ? v : [''])),
  Keywords: list((m) => m.wire.keywords, (m, v) => (m.wire.keywords = v)),
};
