// Public API of lib/validation (validation.md 6.2). Pure: client/ and server/ are imported by path.
export { validate, validateAll, validateDetailed, normalizePath } from './engine';
export { RULES, allRules, findRule, PATH_ORDER } from './registry';
export { MSG, format } from './messages';
export type { MsgKey, MsgParams } from './messages';
export * from './types';
export * as primitives from './primitives';
export {
  DIALOGS,
  renderDialog,
  archiveCascadeNote,
  isDirty,
  normalizeForDirty,
  commitSlideOver,
} from './dialogs';
export {
  canTransition,
  offeredTransitions,
  TRANSITIONS,
  type TransitionResult,
  type StatefulKind,
} from './state/transitions';
export { effectiveStatus, isServing, type EffectiveStatus } from './state/effective-status';
export { isApplicable, applicability, type BulkAction } from './state/bulk';
export { campaignSnapshotFrom, ioSnapshotFrom, lineItemSnapshotFrom } from './snapshots';
