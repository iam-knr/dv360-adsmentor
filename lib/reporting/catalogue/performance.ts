// Performance (22), Win Loss (14), Impression Loss (8), Invalid Traffic (6), Custom Bidding (4), Custom Impression
// Value (6), Refund (4), Programmatic Guaranteed Savings (4), Savings (4).
import {
  counter,
  currencyTriplet,
  decimalCounter,
  moneyCounter,
  moneyZero,
  ratio,
  sumOf,
  zeroMetric,
} from './generators';
import type { ReportFieldDef } from './types';

const P = 'Performance' as const;

export function performanceFields(): ReportFieldDef[] {
  const fav = { frequentlyUsed: true };
  return [
    counter(P, 'Impressions', 'impressions', fav),
    counter(P, 'Clicks', 'clicks', fav),
    ratio(P, 'Click Rate (CTR)', 'clicks', 'impressions', 100),
    counter(P, 'Billable Impressions', 'billableImpressions'),
    counter(P, 'Engagements', 'engagements'),
    ratio(P, 'Engagement Rate', 'engagements', 'impressions', 100),
    counter(P, 'Begin to Render Impressions', 'beginToRenderImpressions'),
    zeroMetric(P, 'Begin to Render Eligible Impressions'),
    counter(P, 'Blocked Impressions', 'blockedImpressions'),
    counter(P, 'Inactive Impressions', 'inactiveImpressions'),
    counter(P, 'Provisional Impressions', 'provisionalImpressions'),
    counter(P, 'Floodlight Impressions', 'floodlightImpressions', { offline: ['FLOODLIGHT'] }),
    zeroMetric(P, 'Cookie Consented Floodlight Impressions'),
    zeroMetric(P, 'Cookie Unconsented Floodlight Impressions'),
    zeroMetric(P, 'Duplicate Consented Floodlight Impressions'),
    zeroMetric(P, 'Cookie Unconsented Clicks'),
    zeroMetric(P, 'Average Bid Boost Factor', 'DECIMAL'),
    zeroMetric(P, 'Bid Boost Eligible Impressions'),
    zeroMetric(P, 'Impressions with Bid Boost'),
    zeroMetric(P, 'Percentage from Current IO Goal', 'PERCENT'),
    zeroMetric(P, 'Tracked Ads'),
    zeroMetric(P, 'Vendor Blocked Ads'),
  ];
}

const W = 'Win Loss' as const;
export function winLossFields(): ReportFieldDef[] {
  return [
    counter(W, 'Bid Requests', 'bidRequests'),
    counter(W, 'Eligible Requests', 'eligibleRequests'),
    counter(W, 'Bids Submitted', 'bidsSubmitted'),
    counter(W, 'Bid Responses', 'bidResponses'),
    ratio(W, 'Win Rate', 'impressions', 'bid_responses', 100),
    ratio(W, 'Bid Rate', 'bids_submitted', 'eligible_requests', 100),
    counter(W, 'Lost to Targeting', 'lostTargeting'),
    counter(W, 'Lost to Creative', 'lostCreative'),
    counter(W, 'Lost to Frequency', 'lostFrequency'),
    counter(W, 'Lost to Budget', 'lostBudget'),
    counter(W, 'Lost to Pacing', 'lostPacing'),
    counter(W, 'Lost to Bid Below Minimum', 'lostBelowMinBid'),
    counter(W, 'Lost to Internal Reasons', 'lostInternal'),
    counter(W, 'Lost to Not Reported', 'lostNotReported'),
  ];
}

const L = 'Impression Loss' as const;
export function impressionLossFields(): ReportFieldDef[] {
  return [
    counter(L, 'Lost Impressions: Bid Too Low', 'lostExternalBid'),
    counter(L, 'Lost Impressions: Creative Issues (External)', 'lostExternalCreative'),
    counter(L, 'Lost Impressions: Other (External)', 'lostExternalOther'),
    sumOf(L, 'Lost Impressions: Budget and Pacing', ['lost_to_budget', 'lost_to_pacing']),
    sumOf(L, 'Lost Impressions: Targeting and Frequency', [
      'lost_to_targeting',
      'lost_to_frequency',
    ]),
    sumOf(L, 'Lost Impressions: Total', [
      'lost_to_targeting',
      'lost_to_creative',
      'lost_to_frequency',
      'lost_to_budget',
      'lost_to_pacing',
      'lost_to_bid_below_minimum',
      'lost_to_internal_reasons',
      'lost_impressions_bid_too_low',
      'lost_impressions_creative_issues_external',
      'lost_impressions_other_external',
    ]),
    ratio(L, 'Lost Impressions: Share Lost to Budget', 'lost_to_budget', 'bid_requests', 100),
    ratio(
      L,
      'Lost Impressions: Share Lost to Bid',
      'lost_impressions_bid_too_low',
      'bid_requests',
      100,
    ),
  ];
}

const I = 'Invalid Traffic' as const;
export function invalidTrafficFields(): ReportFieldDef[] {
  return [
    counter(I, 'Invalid Impressions', 'invalidImpressions'),
    counter(I, 'Invalid Clicks', 'invalidClicks'),
    ratio(I, 'Invalid Impression Rate', 'invalid_impressions', 'impressions', 100),
    ratio(I, 'Invalid Click Rate', 'invalid_clicks', 'clicks', 100),
    zeroMetric(I, 'Invalid Engagements'),
    zeroMetric(I, 'Invalid Conversions', 'DECIMAL'),
  ];
}

const B = 'Custom Bidding' as const;
export function customBiddingFields(): ReportFieldDef[] {
  return [
    zeroMetric(B, 'Custom Bidding Model Impressions'),
    zeroMetric(B, 'Custom Bidding Model Score', 'DECIMAL'),
    zeroMetric(B, 'Custom Bidding Floodlight Impressions'),
    zeroMetric(B, 'Custom Bidding Model Average Bid', 'DECIMAL'),
  ];
}

const V = 'Custom Impression Value' as const;
export function customImpressionValueFields(): ReportFieldDef[] {
  return [
    decimalCounter(V, 'Custom Impression Value', 'customImpressionValue'),
    ...moneyCounter(V, 'Custom Impression Cost', 'customImpressionCost'),
    ratio(V, 'Custom Value per Impression', 'custom_impression_value', 'impressions', 1),
    ratio(V, 'Custom Value per Click', 'custom_impression_value', 'clicks', 1),
  ];
}

const R = 'Refund' as const;
export function refundFields(): ReportFieldDef[] {
  return [
    ...moneyCounter(R, 'Refund', 'refund'),
    ratio(R, 'Refund Rate', 'refund_adv', 'total_media_cost_adv', 100),
  ];
}

const S = 'Programmatic Guaranteed Savings' as const;
export function pgSavingsFields(): ReportFieldDef[] {
  return [
    ...moneyCounter(S, 'Programmatic Guaranteed Savings', 'dealSavings'),
    counter(S, 'Programmatic Guaranteed Committed Impressions', 'pgCommittedImpressions'),
  ];
}

const SV = 'Savings' as const;
export function savingsFields(): ReportFieldDef[] {
  return [...moneyZero(SV, 'Savings'), zeroMetric(SV, 'Savings Rate', 'PERCENT')];
}

// currencyTriplet is re-exported so category files that need a one-off derived money field import it from one place.
export { currencyTriplet };
