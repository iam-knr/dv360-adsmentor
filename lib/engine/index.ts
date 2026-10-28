// Public API of the simulation engine core (engine.md 1.6). Pure: no database, no clock, no
// global randomness. The io layer (P3-08b) builds a World, calls runTick and persists the output.
export { runTick } from './tick';
export { runTicks } from './catchUp';
export type { RunTickResult } from './tick';
export { newSimState, cloneState } from './state';
export type { SimStateData } from './state';
export type {
  TickOutput,
  HourlyRow,
  DailyRow,
  LiveStatusRow,
  PacingRow,
  ReachRow,
  LearningRow,
} from './output';
export type {
  World,
  LineItemEntity,
  IoEntity,
  CampaignEntity,
  CreativeEntity,
  AudienceEntity,
  FloodlightActivity,
  TargetingSpec,
} from './world';
export { loadParams, defaultParams, mergePatch } from './params/load';
export type { LoadedParams } from './params/load';
export type { Params } from './params/schema';
export { hashJson, stableStringify } from './params/hash';
export { rng } from './rng/streams';
export { dueTicks } from './clock/clock';
export { forecast, estimateAudienceSize } from './forecast';
