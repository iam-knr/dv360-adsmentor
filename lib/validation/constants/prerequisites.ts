// MX-11 Floodlight, Demand Gen and other prerequisites (validation.md 3).
// The "source of truth" column says which snapshot field a rule reads.

export const PREREQUISITES = {
  DEMAND_GEN_FLOODLIGHT: {
    source: 'advertiser.demandGenFloodlightOptimization',
    rule: 'LI-DG-001',
  },
  GOOGLE_INVENTORY: { source: 'advertiser.googleInventoryEnabled', rule: 'LI-DG-004' },
  CONVERSION_BIDDING: { source: 'li.conversions.activities', rule: 'LI-046' },
  DEMAND_GEN_CONVERSIONS: { source: 'li.conversions.activities', rule: 'LI-DG-005' },
  CUSTOM_BIDDING_ACTIVE: { source: 'customBidding.status', rule: 'LI-047' },
  APP_ATTRIBUTION: { source: 'advertiser.appAttributionLinked', rule: 'LI-APP-009' },
} as const;
