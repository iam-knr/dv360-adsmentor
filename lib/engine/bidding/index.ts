// Public surface of the bidding module. It also re-exports the eligibility types that downstream
// modules (auction, outcomes) are allowed to see only through bidding outputs (engine.md 1.5).
export { planBids, medianClear, ivtEffective } from './plan';
export type { BidPlan, PlanInput } from './plan';
export { STRATEGIES, FIXED_STRATEGY, strategyFor } from './strategies';
export type { Strategy, CellRates, GoalEvent } from './strategies';
export type { ElCell, LiElig } from '../eligibility/funnel';
export type { CreativeChoice } from '../eligibility/creatives';
export { automatedWeights, autoAllocateWeights, efficiency } from './ioOptimizer';
export type { EffStat } from './ioOptimizer';
export {
  advanceLearning,
  exitEventsFor,
  learningSpendCap,
  newLearning,
  qualityFromEvents,
  signatureOf,
} from './learning';
