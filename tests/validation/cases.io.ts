// Insertion order cases: validation.md 6.7 (T-21..T-42) and module 07 section 6.3 (V-07-01..V-07-18).
import { inr, validClicksIo, validIo } from '@/lib/validation/testing/fixtures';
import type { LineItemSnapshot, LiType } from '@/lib/validation/types';
import type { Case } from './cases.types';

const base = () => validIo();
const clicks = validClicksIo;

const seg = (patch: object = {}) => ({
  id: 'seg-1',
  amount: inr(10_000),
  startDate: '2026-10-01',
  endDate: '2026-10-31',
  ...patch,
});

const limitCap = (patch: object) => ({
  frequencyCap: { mode: 'LIMITED', maxImpressions: 10, periodCount: 1, period: 'DAY', ...patch },
});

const li = (type: LiType, extra: Partial<LineItemSnapshot> = {}): LineItemSnapshot => ({
  id: 'li-1',
  type,
  status: 'DRAFT',
  ...extra,
});

const automated = {
  optimization: { mode: 'IO_AUTOMATED', optimizedTowards: 'MAX_VIEWABLE_IMPRESSIONS' },
};

export const ioCases: Case[] = [
  { id: 'T-21 valid fixture', kind: 'insertionOrder', base, expect: [] },
  {
    id: 'T-22 V-07-02 CTV/OTT with clicks',
    kind: 'insertionOrder',
    base,
    patch: { type: 'CTV_OTT', objective: 'CLICKS' },
    expect: ['IO-003:error'],
  },
  {
    id: 'T-23 V-07-03 DOOH with brand awareness',
    kind: 'insertionOrder',
    base,
    patch: { type: 'DOOH', objective: 'BRAND_AWARENESS' },
    expect: ['IO-004:error'],
  },
  {
    id: 'T-24 V-07-01 name empty',
    kind: 'insertionOrder',
    base,
    patch: { name: '' },
    expect: ['IO-010:error'],
  },
  {
    id: 'T-25 V-07-05 segment amount empty',
    kind: 'insertionOrder',
    base,
    patch: { budget: { segments: [seg({ amount: '' })] } },
    expect: ['IO-021:error'],
  },
  {
    id: 'T-26 V-07-05 segment amount zero',
    kind: 'insertionOrder',
    base,
    patch: { budget: { segments: [seg({ amount: 0 })] } },
    expect: ['IO-022:error'],
    message: 'Enter a number greater than 0',
  },
  {
    id: 'T-27 V-07-06 segment end before start',
    kind: 'insertionOrder',
    base,
    patch: { budget: { segments: [seg({ startDate: '2026-10-10', endDate: '2026-10-05' })] } },
    expect: ['IO-024:error'],
  },
  {
    id: 'T-28 V-07-07 overlapping segments',
    kind: 'insertionOrder',
    base,
    patch: {
      budget: {
        segments: [seg({ endDate: '2026-10-20' }), seg({ id: 'seg-2', startDate: '2026-10-15' })],
      },
    },
    expect: ['IO-027:error'],
  },
  {
    id: 'T-29 V-07-08 amount below spent',
    kind: 'insertionOrder',
    base,
    patch: { budget: { segments: [seg({ amount: inr(5_000) })] } },
    ctx: {
      mode: 'edit',
      original: {
        ...validIo(),
        budget: { type: 'CURRENCY', segments: [seg({ spent: inr(6_000) })] },
      },
    },
    expect: ['IO-026:error'],
    message: "The budget can't be lower than the amount already spent (₹6,000.00).",
  },
  {
    id: 'T-30 daily with ahead pacing',
    kind: 'insertionOrder',
    base,
    patch: { pacing: { period: 'DAILY', type: 'AHEAD', dailyAmount: inr(500) } },
    expect: ['IO-031:error'],
  },
  {
    id: 'V-07-09 flight with asap',
    kind: 'insertionOrder',
    base,
    patch: { pacing: { period: 'FLIGHT', type: 'ASAP' } },
    expect: ['IO-031:error'],
  },
  {
    id: 'T-31 V-07-10 daily with no amount',
    kind: 'insertionOrder',
    base,
    patch: { pacing: { period: 'DAILY', type: 'EVEN', dailyAmount: '' } },
    expect: ['IO-032:error'],
  },
  {
    id: 'T-32 daily above the segment budget',
    kind: 'insertionOrder',
    base,
    patch: { pacing: { period: 'DAILY', type: 'EVEN', dailyAmount: inr(20_000) } },
    expect: ['IO-034:warning'],
  },
  {
    id: 'T-33 KPI value zero',
    kind: 'insertionOrder',
    base,
    patch: { kpi: { type: 'VCPM', value: 0 } },
    expect: ['IO-041:error'],
  },
  {
    id: 'T-34 V-07-11 KPI not in the objective list',
    kind: 'insertionOrder',
    base,
    patch: { kpi: { type: 'CPC', value: inr(1) } },
    expect: ['IO-040:error'],
  },
  {
    id: 'T-35 V-07-12 VTR 120',
    kind: 'insertionOrder',
    base,
    patch: { kpi: { type: 'VTR', value: 120 } },
    expect: ['IO-042:error'],
  },
  {
    id: 'T-36 automate with an audio line item',
    kind: 'insertionOrder',
    base,
    patch: automated,
    ctx: { children: { lineItems: [li('AUDIO')] } },
    expect: ['IO-052:error'],
  },
  {
    id: 'V-07-13 automate with a YouTube line item',
    kind: 'insertionOrder',
    base,
    patch: automated,
    ctx: { children: { lineItems: [li('YT_VIDEO')] } },
    expect: ['IO-052:error'],
  },
  {
    id: 'X-IO-052 automate with display, video and CTV is fine',
    kind: 'insertionOrder',
    base,
    patch: automated,
    ctx: {
      children: {
        lineItems: [li('DISPLAY'), li('VIDEO', { id: 'li-2' }), li('CTV', { id: 'li-3' })],
      },
    },
    expect: [],
  },
  {
    id: 'T-37 cap with no exposures',
    kind: 'insertionOrder',
    base,
    patch: limitCap({ maxImpressions: null }),
    expect: ['IO-060:error'],
  },
  {
    id: 'T-38 V-07-23 IO cap looser than the campaign cap',
    kind: 'insertionOrder',
    base,
    patch: limitCap({}),
    ctx: {
      campaign: {
        frequencyCap: { mode: 'LIMITED', maxImpressions: 3, periodCount: 1, period: 'WEEK' },
      },
    },
    expect: ['IO-063:info'],
    message: "This limit is less restrictive than the campaign's, so the campaign limit applies.",
  },
  {
    id: 'X-IO-063 IO cap that bites is not flagged',
    kind: 'insertionOrder',
    base,
    patch: limitCap({ maxImpressions: 10, period: 'MONTH' }),
    ctx: {
      campaign: {
        frequencyCap: { mode: 'LIMITED', maxImpressions: 3, periodCount: 1, period: 'WEEK' },
      },
    },
    expect: [],
  },
  {
    id: 'T-39 negative CPM fee',
    kind: 'insertionOrder',
    base,
    patch: { partnerCosts: { cpmFees: [{ type: 'Default', amount: -100 }] } },
    expect: ['IO-070:error'],
  },
  {
    id: 'T-40 media fee 120 percent',
    kind: 'insertionOrder',
    base,
    patch: {
      partnerCosts: {
        mediaFees: [
          { type: 'Default', amount: 0, system: true },
          { type: 'Custom Fee 1', amount: 120 },
        ],
      },
    },
    expect: ['IO-071:error'],
  },
  {
    id: 'T-41 V-07-18 line item budgets above the IO budget',
    kind: 'insertionOrder',
    base,
    ctx: { children: { lineItems: [li('DISPLAY', { budgetAmount: inr(15_000) })] } },
    expect: ['IO-093:warning'],
    message: 'The total budget of all line items is greater than the insertion order budget.',
  },
  {
    id: 'T-42 V-07-17 activate with every segment ended',
    kind: 'insertionOrder',
    base,
    patch: { budget: { segments: [seg({ endDate: '2026-10-20' })] } },
    opts: { targetStatus: 'ACTIVE' },
    expect: ['IO-092:error'],
  },

  // Module 07 cases not in the main table
  {
    id: 'V-07-04 objective changed from clicks to conversions',
    kind: 'insertionOrder',
    base: clicks,
    patch: { objective: 'CONVERSIONS', kpi: { type: 'CPA', value: inr(100) } },
    ctx: { mode: 'edit', original: validClicksIo() },
    expect: ['IO-005:error'],
  },
  {
    id: 'X-IO-005 objective may change to none',
    kind: 'insertionOrder',
    base: clicks,
    patch: { objective: 'NONE' },
    ctx: { mode: 'edit', original: validClicksIo() },
    expect: [],
  },
  {
    id: 'V-07-05 impressions budget must be whole',
    kind: 'insertionOrder',
    base,
    patch: { budget: { type: 'IMPRESSIONS', segments: [seg({ amount: 10.5 })] } },
    expect: ['IO-023:error'],
  },
  {
    id: 'V-07-14 auto allocation while automated',
    kind: 'insertionOrder',
    base,
    patch: {
      optimization: {
        mode: 'IO_AUTOMATED',
        optimizedTowards: 'MAX_VIEWABLE_IMPRESSIONS',
        autoBudgetAllocation: true,
      },
    },
    expect: ['IO-055:error'],
  },
  {
    id: 'V-07-15 six CPM fees',
    kind: 'insertionOrder',
    base,
    patch: {
      partnerCosts: { cpmFees: Array.from({ length: 6 }, () => ({ type: 'Default', amount: 10 })) },
    },
    expect: ['IO-074:error'],
    message: 'You can add up to 5 fees of each kind.',
  },
  {
    id: 'V-07-16 fee amount without a type',
    kind: 'insertionOrder',
    base,
    patch: { partnerCosts: { cpmFees: [{ type: '', amount: 10 }] } },
    expect: ['IO-072:error'],
  },

  // Added so that every insertion order rule has a case.
  {
    id: 'X-IO-001 no type',
    kind: 'insertionOrder',
    base,
    patch: { type: null },
    expect: ['IO-001:error'],
  },
  {
    id: 'X-IO-002 no objective',
    kind: 'insertionOrder',
    base,
    patch: { objective: null },
    expect: ['IO-002:error'],
  },
  {
    id: 'X-IO-006 type changed on edit',
    kind: 'insertionOrder',
    base,
    patch: { type: 'CTV_OTT', kpi: { type: 'CPM', value: inr(10) } },
    ctx: { mode: 'edit', original: validIo() },
    expect: ['IO-006:error'],
  },
  {
    id: 'X-IO-011 name 241 characters',
    kind: 'insertionOrder',
    base,
    patch: { name: 'x'.repeat(241) },
    expect: ['IO-011:error'],
  },
  {
    id: 'X-IO-012 create paused',
    kind: 'insertionOrder',
    base,
    patch: { status: 'PAUSED' },
    expect: ['IO-012:error'],
  },
  {
    id: 'X-IO-020 budget type locked',
    kind: 'insertionOrder',
    base,
    patch: { budget: { type: 'IMPRESSIONS' } },
    ctx: { mode: 'edit', original: validIo() },
    expect: ['IO-020:error'],
  },
  {
    id: 'X-IO-020 budget type missing',
    kind: 'insertionOrder',
    base,
    patch: { budget: { type: null } },
    expect: ['IO-020:error'],
  },
  {
    id: 'X-IO-025 started segment start moved',
    kind: 'insertionOrder',
    base,
    patch: { budget: { segments: [seg({ startDate: '2026-10-02' })] } },
    ctx: { mode: 'edit', original: validIo() },
    expect: ['IO-025:error'],
  },
  {
    id: 'X-IO-028 no segment',
    kind: 'insertionOrder',
    base,
    patch: { budget: { segments: [] } },
    expect: ['IO-028:error'],
  },
  {
    id: 'X-IO-030 no pacing period',
    kind: 'insertionOrder',
    base,
    patch: { pacing: { period: null } },
    expect: ['IO-030:error'],
  },
  {
    id: 'X-IO-033 daily amount negative',
    kind: 'insertionOrder',
    base,
    patch: { pacing: { period: 'DAILY', type: 'EVEN', dailyAmount: -5 } },
    expect: ['IO-033:error'],
  },
  {
    id: 'X-IO-050 no optimization mode',
    kind: 'insertionOrder',
    base,
    patch: { optimization: { mode: null } },
    expect: ['IO-050:error'],
  },
  {
    id: 'X-IO-051 automation note',
    kind: 'insertionOrder',
    base,
    patch: automated,
    expect: ['IO-051:info'],
    message:
      'Your insertion order may only contain cross-exchange display, video and Connected TV line items',
  },
  {
    id: 'X-IO-053 switching to automation with line items',
    kind: 'insertionOrder',
    base,
    patch: automated,
    ctx: { mode: 'edit', original: validIo(), children: { lineItems: [li('DISPLAY')] } },
    expect: ['IO-053:info'],
  },
  {
    id: 'X-IO-054 strategy not in the objective list',
    kind: 'insertionOrder',
    base,
    patch: { optimization: { mode: 'IO_AUTOMATED', optimizedTowards: 'MAX_CLICKS' } },
    expect: ['IO-054:error'],
  },
  {
    id: 'X-IO-056 YouTube option without a YouTube line item',
    kind: 'insertionOrder',
    base,
    patch: { optimization: { youtubeReachFrequency: true } },
    expect: ['IO-056:warning'],
  },
  {
    id: 'X-IO-061 campaign cap shown while unlimited',
    kind: 'insertionOrder',
    base,
    ctx: {
      campaign: {
        frequencyCap: { mode: 'LIMITED', maxImpressions: 3, periodCount: 1, period: 'WEEK' },
      },
    },
    expect: ['IO-061:info'],
    message: "The campaign's frequency cap is set to 3 exposures per week",
  },
  {
    id: 'X-IO-062 exposures zero',
    kind: 'insertionOrder',
    base,
    patch: limitCap({ maxImpressions: 0 }),
    expect: ['IO-062:error'],
  },
  {
    id: 'X-IO-073 DV360 fee changed',
    kind: 'insertionOrder',
    base,
    patch: { partnerCosts: { mediaFees: [{ type: 'Default', amount: 7, system: true }] } },
    ctx: { mode: 'edit', original: validIo() },
    expect: ['IO-073:error'],
  },
  {
    id: 'X-IO-080 integration code over 500 bytes',
    kind: 'insertionOrder',
    base,
    patch: { integrationCode: 'é'.repeat(251) },
    expect: ['IO-080:error'],
    message: 'Use 500 characters or fewer.',
  },
  {
    id: 'X-IO-091 activate under an archived campaign',
    kind: 'insertionOrder',
    base,
    opts: { targetStatus: 'ACTIVE' },
    ctx: { campaign: { status: 'ARCHIVED' } },
    expect: ['IO-091:error'],
  },
  {
    id: 'X-IO-094 line item flight outside the IO flight',
    kind: 'insertionOrder',
    base,
    ctx: {
      children: {
        lineItems: [
          li('DISPLAY', {
            flight: { mode: 'CUSTOM', startDate: '2026-10-05', endDate: '2026-11-15' },
          }),
        ],
      },
    },
    expect: ['IO-094:warning'],
  },
  {
    id: 'X-IO-094 line item pacing contradicts automation',
    kind: 'insertionOrder',
    base,
    patch: automated,
    ctx: { children: { lineItems: [li('DISPLAY', { pacingType: 'EVEN' })] } },
    expect: ['IO-094:warning'],
  },
  {
    id: 'X-IO-095 flight shortened below a line item date',
    kind: 'insertionOrder',
    base,
    patch: { budget: { segments: [seg({ endDate: '2026-10-20' })] } },
    ctx: {
      mode: 'edit',
      original: validIo(),
      children: {
        lineItems: [
          li('DISPLAY', {
            flight: { mode: 'CUSTOM', startDate: '2026-10-05', endDate: '2026-10-30' },
          }),
        ],
      },
    },
    expect: ['IO-095:warning', 'IO-094:warning'],
    message: "1 line items have dates outside this insertion order's flight.",
  },
];
