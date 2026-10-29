// Plan forecast parameters (module 04 DELTA-04-9). The spec puts these in `engine/params.json` under `plan`; that
// file is validated by the engine's own schema (P3-08), so they live here until the engine owner adopts them
// (gap p4-08 #1). All values are synthetic `[SIM]`.
import type { PlanBuyingMethodKey } from './types';

export const PLAN_PARAMS = {
  version: 1,
  /** Clustering exponent of the reach curve (ENG 9.5). */
  k: 1.5,
  /** Share of impressions that land on the demographic target. */
  demoOnTargetShare: 0.85,
  /** Price multiplier per buying method over the open auction clearing CPM. */
  buyingMethodPremium: {
    OPEN_AUCTION: 1,
    PROGRAMMATIC_GUARANTEED: 1.35,
    PREFERRED_DEAL: 1.1,
    PRIVATE_AUCTION: 1.05,
    YOUTUBE_RESERVE: 1.2,
  } as Record<PlanBuyingMethodKey, number>,
  /** Media and platform fee as a fraction of net. */
  fees: { default: 0.1, youtube: 0.1 },
  /** Viewable share of measurable impressions per buying method. */
  viewability: {
    OPEN_AUCTION: 0.58,
    PROGRAMMATIC_GUARANTEED: 0.74,
    PREFERRED_DEAL: 0.68,
    PRIVATE_AUCTION: 0.66,
    YOUTUBE_RESERVE: 0.8,
  } as Record<PlanBuyingMethodKey, number>,
  measurable: 0.88,
  /** Click-through and conversion rates for the CPA estimate (`plan.cpaFromCvr`). */
  ctr: 0.0012,
  clickCvr: 0.02,
  postViewCvr: 0.0001,
  /** Share of impressions delivered on YouTube when YouTube is included. */
  youtubeShare: 0.3,
  viewThroughRate: 0.32,
  /** Per-row noise amplitude (3% either way, spec 5). */
  noise: 0.03,
  /** Audience reduction of the addressable universe: share per audience reference, floor. */
  audienceShareEach: 0.78,
  audienceShareFloor: 0.25,
  /** Budget points of the Reach tab. */
  budgetPoints: [0.5, 0.75, 1, 1.25, 1.5],
  deviceShare: { Computer: 0.28, Smartphone: 0.62, Tablet: 0.05, 'Connected TV': 0.05 },
  maxRows: 50,
  maxDays: 365,
} as const;
