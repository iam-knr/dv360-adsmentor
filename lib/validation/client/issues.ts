// Issue[] to field errors, banner list and focus-first-error (validation.md 5.1, 6.6). No React here, so it is testable.
import type { Issue } from '../types';

export interface FieldError {
  type: string; // the rule id
  message: string;
}

/** The first blocking issue per path. Warnings and infos never become field errors. */
export function toFieldErrors(issues: readonly Issue[]): Record<string, FieldError> {
  const out: Record<string, FieldError> = {};
  for (const issue of issues) {
    if (!issue.blocking || issue.path === '*') continue;
    if (!(issue.path in out)) out[issue.path] = { type: issue.ruleId, message: issue.message };
  }
  return out;
}

/** Warnings and infos for inline display. They never set `formState.errors`. */
export function softIssuesOf(issues: readonly Issue[]): Issue[] {
  return issues.filter((i) => !i.blocking);
}

/** Issues about the whole entity (path `*`): shown as a banner, not under a field. */
export function bannerIssues(issues: readonly Issue[]): Issue[] {
  return issues.filter((i) => i.path === '*');
}

/** Issues for one field, most severe first (the engine already sorts). */
export function issuesAt(issues: readonly Issue[], path: string): Issue[] {
  return issues.filter((i) => i.path === path);
}

/** The path `focusFirstInvalid` goes to: the first error in engine order. */
export function firstInvalidPath(issues: readonly Issue[]): string | null {
  return issues.find((i) => i.blocking && i.path !== '*')?.path ?? null;
}

/** Moves focus to the first invalid field and scrolls it into view. Fields carry `name` or `data-field-path`. */
export function focusFirstInvalid(
  issues: readonly Issue[],
  root: ParentNode | undefined = undefined,
): boolean {
  const path = firstInvalidPath(issues);
  if (path === null || typeof document === 'undefined') return false;
  const scope: ParentNode = root ?? document;
  const escaped = path.replace(/["\\]/g, '\\$&');
  const el = scope.querySelector<HTMLElement>(
    `[name="${escaped}"], [data-field-path="${escaped}"]`,
  );
  if (!el) return false;
  el.scrollIntoView?.({ block: 'center' });
  el.focus();
  return true;
}
