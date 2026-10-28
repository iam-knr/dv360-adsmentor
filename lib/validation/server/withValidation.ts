import 'server-only';

// Wrapper for server actions (validation.md 6.6): validate with the full context, short-circuit on errors,
// return warnings with the success result.
import { validate } from '../engine';
import type { EntityKind, Issue, ValidateOptions, ValidationContext } from '../types';

export type ValidatedResult<R> =
  { ok: true; result: R; issues: Issue[] } | { ok: false; issues: Issue[] };

export interface WithValidationConfig<I> {
  kind: EntityKind;
  /** Builds the full, authoritative context for this input (usually `buildContext`). */
  context: (input: I) => Promise<ValidationContext>;
  /** The entity to validate; defaults to the input itself. */
  entity?: (input: I) => unknown;
  /** 'ACTIVE' adds the activation rules. */
  targetStatus?: (input: I) => ValidateOptions['targetStatus'];
}

export function withValidation<I, R>(
  config: WithValidationConfig<I>,
  handler: (input: I, ctx: ValidationContext) => Promise<R>,
): (input: I) => Promise<ValidatedResult<R>> {
  return async (input) => {
    const ctx = await config.context(input);
    const entity = config.entity ? config.entity(input) : input;
    const targetStatus = config.targetStatus?.(input);
    const issues = validate(config.kind, entity, ctx, {
      trigger: 'save',
      ...(targetStatus ? { targetStatus } : {}),
    });
    if (issues.some((i) => i.blocking)) return { ok: false, issues };
    const result = await handler(input, ctx);
    return { ok: true, result, issues: issues.filter((i) => !i.blocking) };
  };
}
