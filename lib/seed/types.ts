// Types of the sandbox plan: plain rows plus the delivery profiles the history stub reads.
import type { Prisma } from '@prisma/client';
import type { PlantedProblem, SeedKnobs, TemplateKey } from './knobs';

export type Format = 'display' | 'native' | 'video_instream' | 'ctv' | 'audio' | 'dooh';

/** Pass fractions of the engine funnel (engine.md 3.1). 1 = nothing filtered. */
export interface FunnelPasses {
  targeting: number;
  creative: number;
  frequency: number;
  pacing: number;
  belowMinBid: number;
  internal: number;
  /** Share of bid responses lost externally: bid too low, creative, other, not reported. */
  extBid: number;
  extCreative: number;
  extOther: number;
  extNotReported: number;
}

export interface ReasonWeights {
  targeting: readonly (readonly [string, number])[];
  creative: readonly (readonly [string, number])[];
  frequency: readonly (readonly [string, number])[];
  budget: readonly (readonly [string, number])[];
  pacing: readonly (readonly [string, number])[];
}

/** Why a line item stops entering the funnel after a date (engine.md 3.6 live status). */
export type StopReason = 'PAUSED' | 'PARENT_PAUSED' | 'ENDED' | 'EXHAUSTED';

export interface PlannedSegment {
  start: string;
  end: string;
  /** Impressions the line item should deliver per day while this segment runs (healthy plan). */
  dailyImpressions: number;
}

export interface LiProfile {
  liId: string;
  /** Seed-derived key for the keyed noise of the history stub; independent of the sandbox id, so twins match. */
  noiseKey: string;
  ioId: string;
  type: string;
  format: Format;
  currency: string;
  /** First day with funnel rows (ISO date). Null: never delivers (draft, future flight). */
  liveFrom: string | null;
  /** Last day with funnel rows, inclusive. Null: through yesterday. */
  liveUntil: string | null;
  stopReason: StopReason | null;
  segments: PlannedSegment[];
  /** Multiplies request supply (over-pacing). */
  supplyMul: number;
  passes: FunnelPasses;
  reasons: ReasonWeights;
  /** Exchange codes whose creatives are disapproved: creative pass is 0 there. */
  disapprovedExchangeCodes: string[];
  ctrMul: number;
  cvrMul: number;
  viewMul: number;
  /** Cumulative revenue cap in currency units for budget-exhausted line items. */
  budgetCap: number | null;
  /** Fixed or target bid CPM in currency units (informational, used by the below-min-bid story). */
  cpmFee1: number;
  mediaFee2Pct: number;
  /** All-in CPM (currency units per 1,000) the plan assumes; planned spend = planned impressions x this. */
  plannedCpm: number;
  verificationCpm: number;
  conversionMode: 'ALL' | 'POST_CLICK_ONLY' | 'PERCENTAGE';
  conversionPct: number;
  /** Planned share of the IO plan; zero for line items that are not live. */
  planShare: number;
  /** Product of the healthy pass fractions: available requests are back-solved from planned impressions with it. */
  healthyProduct: number;
}

export interface StoryTag {
  tag: PlantedProblem;
  entity: 'LINE_ITEM' | 'INSERTION_ORDER';
  entityId: string;
  entityName: string;
  note: string;
}

export interface PlanMeta {
  template: TemplateKey;
  seedValue: number;
  sandboxId: string;
  classroomId: string;
  today: string;
  knobs: SeedKnobs;
  planVersion: number;
}

export interface SimClockPlan {
  simStart: Date;
  tickIndex: number;
  marketSeed: string;
  sandboxSeed: string;
  paramsVersion: string;
}

export interface SandboxPlan {
  meta: PlanMeta;
  simClock: SimClockPlan;
  partner: Prisma.PartnerCreateManyInput;
  partnerExchanges: Prisma.PartnerExchangeCreateManyInput[];
  advertisers: Prisma.AdvertiserCreateManyInput[];
  campaigns: Prisma.CampaignCreateManyInput[];
  campaignBudgets: Prisma.CampaignBudgetCreateManyInput[];
  insertionOrders: Prisma.InsertionOrderCreateManyInput[];
  budgetSegments: Prisma.BudgetSegmentCreateManyInput[];
  partnerCosts: Prisma.PartnerCostCreateManyInput[];
  lineItems: Prisma.LineItemCreateManyInput[];
  creatives: Prisma.CreativeCreateManyInput[];
  creativeAssets: Prisma.CreativeAssetCreateManyInput[];
  creativeReviews: Prisma.CreativeReviewCreateManyInput[];
  creativeAssignments: Prisma.CreativeAssignmentCreateManyInput[];
  audiences: Prisma.AudienceCreateManyInput[];
  targetingTemplates: Prisma.TargetingTemplateCreateManyInput[];
  targetingAssignments: Prisma.TargetingAssignmentCreateManyInput[];
  alerts: Prisma.AlertCreateManyInput[];
  changeGroups: Prisma.ChangeGroupCreateManyInput[];
  changeEntries: Prisma.ChangeEntryCreateManyInput[];
  profiles: LiProfile[];
  stories: StoryTag[];
  /** Requirements of module 06/07/08 3.4 that the chosen knobs cannot satisfy. Empty for the template defaults. */
  coverageGaps: string[];
}

/** Row tables that carry a publicId from entity_public_id_seq, in assignment order. */
export const PUBLIC_ID_TABLES = [
  'partner',
  'advertisers',
  'campaigns',
  'insertionOrders',
  'lineItems',
  'creatives',
  'audiences',
  'targetingTemplates',
] as const;
export type PublicIdTable = (typeof PUBLIC_ID_TABLES)[number];
