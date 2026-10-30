// InsertionOrders.csv mapper (module 11 4.4 C). Model = the IO wire value plus the ids the file shows.
import type { FeeWire, IoWire, SegmentWire } from '@/lib/insertion-orders/wire';
import { BID_STRATEGY_LABEL } from '@/lib/insertion-orders/wire';
import { IO_OBJECTIVE_LABEL } from '@/lib/validation/constants/io-matrix';
import { KPI_LABEL } from '@/lib/campaigns/kpi';
import { FEE_TYPES } from '@/lib/validation/constants/fees';
import { decDate, decNum, decTuples, encDate, encEpoch, encNum, encTuples } from './codec';
import {
  bool, BUDGET_UNIT_LABEL, enm, enumCodec, FREQ_PERIOD_LABEL, int, money, PACING_PERIOD_LABEL,
  PACING_TYPE_LABEL, STATUS_LABEL, text, type ColMap, type ColMaps,
} from './map-common';

export interface IoModel {
  publicId: string;
  campaignPublicId: string;
  updatedAt: Date;
  wire: IoWire;
}

const IO_TYPE = { STANDARD: 'Standard', CTV_OTT: 'Connected TV and OTT streaming', DOOH: 'Digital out of home' } as const;
const CONTROL = { IO_AUTOMATED: 'Automate at insertion order', LI_CONTROLLED: 'Control at line item' } as const;
const FEE_LABEL = Object.fromEntries(FEE_TYPES.map((f) => [f, f])) as Record<string, string>;

const impressions = (m: IoModel) => m.wire.budget.type === 'IMPRESSIONS';

const cpmFee = (slot: 0 | 1): Record<string, ColMap<IoModel>> => {
  const n = slot + 1;
  const fee = (m: IoModel): FeeWire => (m.wire.partnerCosts.cpmFees[slot] ??= { type: 'Default', amount: '', invoiced: false });
  const codec = enumCodec(FEE_LABEL, `CPM Fee ${n} Type`);
  return {
    [`CPM Fee ${n} Type`]: {
      get: (m) => m.wire.partnerCosts.cpmFees[slot]?.type ?? '',
      set: (m, v) => {
        const k = codec.dec(v);
        if (k) fee(m).type = k;
        else m.wire.partnerCosts.cpmFees.splice(slot, 1);
      },
    },
    [`CPM Fee ${n} Amount`]: money((m) => m.wire.partnerCosts.cpmFees[slot]?.amount as number | string, (m, v) => (fee(m).amount = v ?? '')),
    [`CPM Fee ${n} Invoiced`]: bool((m) => m.wire.partnerCosts.cpmFees[slot]?.invoiced, (m, v) => (fee(m).invoiced = !!v)),
  };
};

const userMediaFee = (m: IoModel): FeeWire | undefined => m.wire.partnerCosts.mediaFees.find((f) => !f.system);
const ensureMediaFee = (m: IoModel): FeeWire => {
  let f = userMediaFee(m);
  if (!f) {
    f = { type: 'Default', amount: '', invoiced: false };
    m.wire.partnerCosts.mediaFees.push(f);
  }
  return f;
};

export const ioMaps: ColMaps<IoModel> = {
  'Io Id': text((m) => m.publicId),
  'Campaign Id': text((m) => m.campaignPublicId),
  Name: text((m) => m.wire.name, (m, v) => (m.wire.name = v)),
  Timestamp: { get: (m) => encEpoch(m.updatedAt) },
  Status: enm(STATUS_LABEL, 'Status', (m) => m.wire.status, (m, v) => (m.wire.status = v)),
  'Io Type': enm(IO_TYPE, 'Io Type', (m) => m.wire.type, (m, v) => (m.wire.type = v)),
  Objective: enm(IO_OBJECTIVE_LABEL, 'Objective', (m) => m.wire.objective, (m, v) => (m.wire.objective = v)),
  'Budget Type': enm(BUDGET_UNIT_LABEL, 'Budget Type', (m) => m.wire.budget.type, (m, v) => (m.wire.budget = { ...m.wire.budget, type: v })),
  'Budget Segments': {
    get: (m) =>
      encTuples(
        m.wire.budget.segments
          .filter((s) => s.amount !== '' && s.amount !== null && s.amount !== undefined)
          .map((s) => [encNum(s.amount as number | string, impressions(m) ? 0 : 2), encDate(s.startDate), encDate(s.endDate), s.description ?? '']),
      ),
    set: (m, v) => {
      const old = m.wire.budget.segments;
      const segments = decTuples(v).map((r, i): SegmentWire => ({
        ...(old[i]?.id ? { id: old[i]!.id } : {}),
        amount: decNum(r[0] ?? '') ?? '',
        startDate: decDate(r[1] ?? ''),
        endDate: decDate(r[2] ?? ''),
        description: r[3] ?? '',
      }));
      m.wire.budget = { ...m.wire.budget, segments };
    },
  },
  Pacing: enm(PACING_PERIOD_LABEL, 'Pacing', (m) => m.wire.pacing.period, (m, v) => (m.wire.pacing = { ...m.wire.pacing, period: v })),
  'Pacing Type': enm(PACING_TYPE_LABEL, 'Pacing Type', (m) => m.wire.pacing.type, (m, v) => (m.wire.pacing = { ...m.wire.pacing, type: v })),
  'Pacing Amount': money(
    (m) => (m.wire.pacing.period === 'DAILY' ? (m.wire.pacing.dailyAmount as number | string) : null),
    (m, v) => (m.wire.pacing = { ...m.wire.pacing, dailyAmount: v ?? '' }),
  ),
  'Frequency Enabled': bool(
    (m) => m.wire.frequencyCap.mode === 'LIMITED',
    (m, v) => (m.wire.frequencyCap = { ...m.wire.frequencyCap, mode: v ? 'LIMITED' : 'INHERIT' }),
  ),
  'Frequency Exposures': int((m) => m.wire.frequencyCap.maxImpressions as number | null, (m, v) => (m.wire.frequencyCap = { ...m.wire.frequencyCap, maxImpressions: v })),
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
  'Performance Goal Type': enm(KPI_LABEL, 'Performance Goal Type', (m) => m.wire.kpi?.type, (m, v) => (m.wire.kpi = { ...(m.wire.kpi ?? { type: null }), type: v })),
  'Performance Goal Value': money((m) => m.wire.kpi?.value as number | string, (m, v) => (m.wire.kpi = { ...(m.wire.kpi ?? { type: null }), value: v ?? '' })),
  'Bid And Budget Control': enm(CONTROL, 'Bid And Budget Control', (m) => m.wire.optimization.mode, (m, v) => (m.wire.optimization = { ...m.wire.optimization, mode: v })),
  'Optimized Towards': enm(BID_STRATEGY_LABEL, 'Optimized Towards', (m) => m.wire.optimization.optimizedTowards, (m, v) => (m.wire.optimization = { ...m.wire.optimization, optimizedTowards: v })),
  'Prioritize Full Budget': bool((m) => m.wire.optimization.prioritizeFullBudget, (m, v) => (m.wire.optimization = { ...m.wire.optimization, prioritizeFullBudget: !!v })),
  'Auto Budget Allocation': bool((m) => m.wire.optimization.autoBudgetAllocation, (m, v) => (m.wire.optimization = { ...m.wire.optimization, autoBudgetAllocation: !!v })),
  'Youtube Reach Frequency Optimization': bool((m) => m.wire.optimization.youtubeReachFrequency, (m, v) => (m.wire.optimization = { ...m.wire.optimization, youtubeReachFrequency: !!v })),
  ...cpmFee(0),
  ...cpmFee(1),
  'Media Fee 2 Type': {
    get: (m) => userMediaFee(m)?.type ?? '',
    set: (m, v) => {
      const k = enumCodec(FEE_LABEL, 'Media Fee 2 Type').dec(v);
      if (k) ensureMediaFee(m).type = k;
      else m.wire.partnerCosts.mediaFees = m.wire.partnerCosts.mediaFees.filter((f) => f.system);
    },
  },
  'Media Fee 2 Percent': money((m) => userMediaFee(m)?.amount as number | string, (m, v) => (ensureMediaFee(m).amount = v ?? ''), 4),
  'Media Fee 2 Invoiced': bool((m) => userMediaFee(m)?.invoiced, (m, v) => (ensureMediaFee(m).invoiced = !!v)),
  'Integration Code': text((m) => m.wire.integrationCode, (m, v) => (m.wire.integrationCode = v)),
  Details: text((m) => m.wire.integrationDetail, (m, v) => (m.wire.integrationDetail = v)),
};
