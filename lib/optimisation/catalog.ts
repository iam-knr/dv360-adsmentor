// Optimization suggestion catalogue (module 11 4.9, Δ-11-8): text, scope, where Investigate leads, which types have Apply.
// Pure data, shared by the engine writer, the Intelligence read model and the panel.

export type SuggestionType =
  | 'ENABLE_AUTO_BUDGET_ALLOCATION'
  | 'ENABLE_AUTOMATED_BID_BUDGET_IO'
  | 'ENABLE_AUTOMATED_BIDDING_LI'
  | 'USE_OPTIMIZED_TARGETING'
  | 'ADD_CREATIVES'
  | 'RAISE_BID'
  | 'BROADEN_TARGETING'
  | 'BID_LEARNING';

/** Where Investigate goes, relative to the entity's own path. `troubleshooter` is the LI Troubleshooter tab. */
export type InvestigateTarget =
  'io-details' | 'li-details' | 'li-creatives' | 'li-targeting' | 'troubleshooter';

export interface SuggestionInfo {
  title: string;
  scope: 'IO' | 'LI';
  investigate: InvestigateTarget;
  /** Apply sets one field through the single-entity service (4.9). */
  applicable: boolean;
  /** Learning rows are INFO only and have no Dismiss. */
  dismissable: boolean;
}

export const SUGGESTIONS: Record<SuggestionType, SuggestionInfo> = {
  ENABLE_AUTO_BUDGET_ALLOCATION: {
    title: 'Enable automatic budget allocation',
    scope: 'IO',
    investigate: 'io-details',
    applicable: true,
    dismissable: true,
  },
  ENABLE_AUTOMATED_BID_BUDGET_IO: {
    title: 'Automate bid and budget at the insertion order level',
    scope: 'IO',
    investigate: 'io-details',
    applicable: true,
    dismissable: true,
  },
  ENABLE_AUTOMATED_BIDDING_LI: {
    title: 'Use automated bidding for this line item',
    scope: 'LI',
    investigate: 'li-details',
    applicable: false,
    dismissable: true,
  },
  USE_OPTIMIZED_TARGETING: {
    title: 'Use optimized targeting',
    scope: 'LI',
    investigate: 'li-targeting',
    applicable: true,
    dismissable: true,
  },
  ADD_CREATIVES: {
    title: 'Add creative sizes',
    scope: 'LI',
    investigate: 'li-creatives',
    applicable: false,
    dismissable: true,
  },
  RAISE_BID: {
    title: 'Raise bid, bids are below the typical clearing price',
    scope: 'LI',
    investigate: 'troubleshooter',
    applicable: false,
    dismissable: true,
  },
  BROADEN_TARGETING: {
    title: 'Broaden targeting',
    scope: 'LI',
    investigate: 'li-targeting',
    applicable: false,
    dismissable: true,
  },
  BID_LEARNING: {
    title: 'Bid strategy still learning',
    scope: 'LI',
    investigate: 'li-details',
    applicable: false,
    dismissable: false,
  },
};

/** A dismissed suggestion stays hidden for 7 sim days (4.9). */
export const DISMISS_DAYS = 7;
export const SUGGESTION_ORDER: SuggestionType[] = [
  'RAISE_BID',
  'ADD_CREATIVES',
  'BROADEN_TARGETING',
  'USE_OPTIMIZED_TARGETING',
  'ENABLE_AUTOMATED_BIDDING_LI',
  'ENABLE_AUTO_BUDGET_ALLOCATION',
  'ENABLE_AUTOMATED_BID_BUDGET_IO',
  'BID_LEARNING',
];
