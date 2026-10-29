// Cost (54), Profit (10), Fees (148), Conversions (84). Money is written once and emitted as a currency triplet.
import {
  counter,
  currencyTriplet,
  decimalCounter,
  moneyCounter,
  moneyRatio,
  moneyZero,
  ratio,
  zeroMetric,
} from './generators';
import type { ReportFieldDef } from './types';

const C = 'Cost' as const;

/** eCPM, viewable eCPM, eCPA, eCPC and the post-click / post-view variants of one money base (18 or 27 fields). */
function costFamily(
  cat: 'Cost' | 'Conversions' | 'Profit',
  prefix: string,
  base: string,
  o: { sensitivity?: 'PARTNER_COST'; withViewable?: boolean } = {},
): ReportFieldDef[] {
  const so = o.sensitivity ? { sensitivity: o.sensitivity } : {};
  const out: ReportFieldDef[] = [
    ...moneyRatio(cat, `${prefix} eCPM`, base, 'impressions', 1000, so),
  ];
  if (o.withViewable !== false) {
    out.push(...moneyRatio(cat, `${prefix} Viewable eCPM`, base, 'viewable_impressions', 1000, so));
  }
  out.push(
    ...moneyRatio(cat, `${prefix} eCPA`, base, 'total_conversions', 1, so),
    ...moneyRatio(cat, `${prefix} eCPC`, base, 'clicks', 1, so),
    ...moneyRatio(cat, `${prefix} eCPA (PC)`, base, 'post_click_conversions', 1, so),
    ...moneyRatio(cat, `${prefix} eCPA (PV)`, base, 'post_view_conversions', 1, so),
    ...moneyRatio(cat, `${prefix} eCPC (PC)`, base, 'clicks', 1, so),
    ...moneyRatio(cat, `${prefix} eCPC (PV)`, base, 'clicks', 1, so),
  );
  return out;
}

export function costFields(): ReportFieldDef[] {
  return [
    ...moneyCounter(C, 'Media Cost', 'mediaCost'),
    ...costFamily(C, 'Media Cost', 'media_cost'),
    ...moneyCounter(C, 'Total Media Cost', 'totalMediaCost'),
    ...costFamily(C, 'Total Media Cost', 'total_media_cost'),
  ];
}

const P = 'Profit' as const;
export function profitFields(): ReportFieldDef[] {
  const s = { sensitivity: 'PARTNER_COST' as const };
  return [
    ...moneyCounter(P, 'Profit', 'profit', s),
    ratio(P, 'Profit Margin', 'profit_adv', 'revenue_adv', 100, s),
    ...moneyRatio(P, 'Profit Viewable eCPM', 'profit', 'viewable_impressions', 1000, s),
    ...moneyRatio(P, 'Profit eCPM', 'profit', 'impressions', 1000, s),
  ];
}

const F = 'Fees' as const;
/** [label, columns that feed it (empty = not modelled), or `sum:` plus the field keys it adds] */
const FEE_FAMILIES: [string, string[]][] = [
  ['CPM Fee 1', ['cpmFee1']],
  ['CPM Fee 2', ['cpmFee2']],
  ['CPM Fee 3', []],
  ['CPM Fee 4', []],
  ['CPM Fee 5', []],
  ['Media Fee 1', ['mediaFee1']],
  ['Media Fee 2', ['mediaFee2']],
  ['Media Fee 3', []],
  ['Media Fee 4', []],
  ['Media Fee 5', []],
  ['Data Fees', ['dataCost']],
  ['First-Party Data Fees', []],
  ['Verification Fees', ['verificationCost']],
  ['DoubleVerify Fee', []],
  ['Integral Ad Science Fee', []],
  ['Scope3 Fee', []],
  ['Custom Fee 1', []],
  ['Custom Fee 2', []],
  ['Custom Fee 3', []],
  ['Custom Fee 4', []],
  ['Custom Fee 5', []],
  ['Ad Serving Cost', ['adServingCost']],
  ['DV360 Fee', []],
  [
    'Total Fees',
    [
      'sum:cpm_fee_1',
      'sum:cpm_fee_2',
      'sum:media_fee_1',
      'sum:media_fee_2',
      'sum:data_fees',
      'sum:verification_fees',
      'sum:ad_serving_cost',
    ],
  ],
];

export function feeFields(): ReportFieldDef[] {
  const s = { sensitivity: 'PARTNER_COST' as const };
  const out: ReportFieldDef[] = [];
  for (const [label, cols] of FEE_FAMILIES) {
    const base = `${label
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_|_$/g, '')}`;
    if (cols.length === 0) {
      out.push(...moneyZero(F, label, s));
    } else if (cols[0]?.startsWith('sum:')) {
      // Sum of other fee fields of the same currency.
      out.push(
        ...currencyTriplet(
          F,
          label,
          (_c, suffix) => ({ t: 'SUM_OF', of: cols.map((c) => `${c.slice(4)}_${suffix}`) }),
          { ...s, key: base },
        ),
      );
    } else {
      out.push(...moneyCounter(F, label, cols[0] as string, s));
    }
    out.push(...moneyRatio(F, `${label} eCPM`, base, 'impressions', 1000, s));
  }
  out.push(
    ratio(F, 'Total Fees as % of Revenue', 'total_fees_adv', 'revenue_adv', 100, s),
    ratio(F, 'DV360 Fee as % of Revenue', 'dv360_fee_adv', 'revenue_adv', 100, s),
    ratio(F, 'Media Fees as % of Revenue', 'media_fee_1_adv', 'revenue_adv', 100, s),
    ratio(F, 'CPM Fees as % of Revenue', 'cpm_fee_1_adv', 'revenue_adv', 100, s),
  );
  return out;
}

const V = 'Conversions' as const;
export function conversionFields(): ReportFieldDef[] {
  return [
    decimalCounter(V, 'Total Conversions', 'convTotal', { frequentlyUsed: false }),
    decimalCounter(V, 'Post-Click Conversions', 'convPostClick'),
    decimalCounter(V, 'Post-View Conversions', 'convPostView'),
    ratio(V, '% Clicks Leading to Conversions', 'post_click_conversions', 'clicks', 100),
    ratio(V, '% Impressions Leading to Conversions', 'post_view_conversions', 'impressions', 100),
    decimalCounter(V, 'Total Transactions', 'convTransactions'),
    zeroMetric(V, 'Post-Click Transactions', 'DECIMAL'),
    zeroMetric(V, 'Post-View Transactions', 'DECIMAL'),
    decimalCounter(V, 'Total Items Sold', 'convItems'),
    zeroMetric(V, 'Post-Click Items Sold', 'DECIMAL'),
    zeroMetric(V, 'Post-View Items Sold', 'DECIMAL'),
    zeroMetric(V, 'Cross-Device Conversions', 'DECIMAL'),
    ...moneyCounter(V, 'Revenue', 'revenue', { frequentlyUsed: true }),
    ...costFamily(V, 'Revenue', 'revenue'),
    ...moneyCounter(V, 'Client Cost', 'clientCost'),
    ...costFamily(V, 'Client Cost', 'client_cost'),
    ...moneyCounter(V, 'Conversion Revenue', 'convRevenue'),
    ...moneyCounter(V, 'Cart Revenue', 'cartRevenue'),
    ...moneyZero(V, 'Post-Click Revenue'),
    ...moneyZero(V, 'Post-View Revenue'),
    ...moneyZero(V, 'CM360 Post-Click Revenue'),
    ...moneyZero(V, 'CM360 Post-View Revenue'),
  ];
}

// counter is re-used by other money files
export { counter };
