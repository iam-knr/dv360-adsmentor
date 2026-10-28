// Public entry of the seed generator (build-plan 2.3: lib/seed). Server and script code only.
export { buildSandboxPlan, checkCoverage, PLAN_VERSION, type PlanInput } from './plan';
export {
  buildHistory,
  apportion,
  splitVector,
  DIAGNOSTIC_DAYS,
  type HistoryRows,
} from './history-stub';
export { insertPlan, clearSandboxData } from './write';
export {
  provisionSandbox,
  partnerIdOf,
  seedValueFor,
  simToday,
  SEED_VERSION,
  type ProvisionInput,
  type ProvisionResult,
} from './sandbox';
export { seedReferenceData, seedExchanges, seedTargetingOptions } from './reference-db';
export {
  EXCHANGES,
  EXCHANGE_BY_CODE,
  TARGETING_OPTIONS,
  GOOGLE_AUDIENCES,
  APPS,
  FX_PER_USD,
  exchangeSimClass,
  exchangeId,
  SIM_CLASSES,
  type ExchangeSeed,
  type SimClass,
} from './reference';
export {
  TEMPLATE_KEYS,
  TEMPLATE_DEFAULTS,
  PLANTED_PROBLEMS,
  DELIVERY_STORIES,
  KNOB_LIMITS,
  KnobError,
  resolveKnobs,
  isTemplateKey,
  type SeedKnobs,
  type TemplateKey,
  type PlantedProblem,
} from './knobs';
export { mulberry32, hashString, stableId, Rng } from './prng';
export { hashValue, stableStringify } from './hash';
export { assertVendorsAllowed, VENDOR_ALLOW_LIST, VendorNotAllowedError } from './vendors';
export { containsRealBrand, assertSyntheticName, brandNames } from './names';
export type { SandboxPlan, LiProfile, StoryTag } from './types';
