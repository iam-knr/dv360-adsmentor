// Rule engine (validation.md 6.4): selection by trigger and path, suppression, dedupe, ordering.
import { format } from './messages';
import { PATH_ORDER, RULES } from './registry';
import type {
  AnyRule,
  EntityKind,
  Issue,
  Trigger,
  ValidateOptions,
  ValidationContext,
  ValidationResult,
  Violation,
} from './types';

const SEVERITY_RANK = { error: 0, warning: 1, info: 2 } as const;

/** `budget.segments[2].amount` to `budget.segments[].amount`. */
export function normalizePath(path: string): string {
  return path.replace(/\[\d+\]/g, '[]');
}

function pathMatches(read: string, changed: string): boolean {
  if (read === changed) return true;
  return read.startsWith(`${changed}.`) || changed.startsWith(`${read}.`);
}

function isActivateOnly(rule: AnyRule): boolean {
  return rule.triggers.length === 1 && rule.triggers[0] === 'activate';
}

function selectRules(kind: EntityKind, opts: ValidateOptions): readonly AnyRule[] {
  const trigger: Trigger = opts.trigger ?? 'save';
  const all = RULES[kind].filter((r) => r.message !== null && !r.retired);
  if (trigger === 'save' || trigger === 'activate') {
    const withActivate = trigger === 'activate' || opts.targetStatus === 'ACTIVE';
    return all.filter((r) => withActivate || !isActivateOnly(r));
  }
  // blur or cross: the subset that reads the changed path
  const changed = opts.changedPath ? normalizePath(opts.changedPath) : null;
  return all.filter((r) => {
    if (isActivateOnly(r)) return false;
    const wanted = trigger === 'blur' ? r.triggers.includes('blur') || r.triggers.includes('cross') : r.triggers.includes('cross');
    if (!wanted) return false;
    if (changed === null) return true;
    return r.reads.some((read) => pathMatches(read, changed));
  });
}

function toViolations(result: Violation | Violation[] | null): Violation[] {
  if (result === null) return [];
  return Array.isArray(result) ? result : [result];
}

function orderIndex(kind: EntityKind, path: string): number {
  const order = PATH_ORDER[kind] ?? [];
  const normalized = normalizePath(path);
  const at = order.findIndex((p) => normalized === p || normalized.startsWith(`${p}.`) || normalized.startsWith(`${p}[`));
  return at === -1 ? order.length : at;
}

/** Runs the rules and also reports which rules were skipped for a missing lookup. */
export function validateDetailed<T>(
  kind: EntityKind,
  entity: T,
  ctx: ValidationContext,
  opts: ValidateOptions = {},
): ValidationResult {
  const selected = selectRules(kind, opts);
  const skipped: string[] = [];
  const raw: (Issue & { rule: AnyRule })[] = [];
  const disabled = new Set(ctx.disabledRules ?? []);

  for (const rule of selected) {
    // Blocking rules cannot be switched off (6.6).
    if (rule.severity !== 'error' && disabled.has(rule.id)) continue;
    if (rule.needs?.some((lookup) => ctx.lookups[lookup] === undefined)) {
      skipped.push(rule.id);
      continue;
    }
    if (rule.appliesTo && !rule.appliesTo(entity as never, ctx)) continue;
    for (const v of toViolations(rule.check(entity as never, ctx))) {
      const template = v.message ?? rule.message ?? '';
      const params = v.params;
      raw.push({
        ruleId: rule.id,
        severity: rule.severity,
        path: v.path,
        message: format(template, params),
        ...(params ? { params } : {}),
        blocking: rule.severity === 'error',
        rule,
      });
    }
  }

  // Suppression: a dependent rule is dropped when the rule that explains it fired.
  const fired = new Set(raw.map((i) => i.ruleId));
  const kept = raw.filter((i) => !i.rule.suppressedBy?.some((id) => fired.has(id)));

  // Dedupe: same (path, message) collapses into the lower rule id.
  const byKey = new Map<string, Issue & { rule: AnyRule }>();
  for (const issue of kept) {
    const key = `${issue.path}\u0000${issue.message}`;
    const seen = byKey.get(key);
    if (!seen || issue.ruleId < seen.ruleId) byKey.set(key, issue);
  }

  const includeInfo = opts.includeInfo ?? true;
  const issues = [...byKey.values()]
    .filter((i) => includeInfo || i.severity !== 'info')
    .sort(
      (a, b) =>
        SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity] ||
        orderIndex(kind, a.path) - orderIndex(kind, b.path) ||
        a.path.localeCompare(b.path) ||
        (a.ruleId < b.ruleId ? -1 : a.ruleId > b.ruleId ? 1 : 0),
    )
    .map(({ rule: _rule, ...issue }): Issue => issue);

  return { issues, skipped };
}

export function validate<T>(
  kind: EntityKind,
  entity: T,
  ctx: ValidationContext,
  opts: ValidateOptions = {},
): Issue[] {
  return validateDetailed(kind, entity, ctx, opts).issues;
}

/** Runs validate for several entity kinds (a form that holds a child, for example). */
export function validateAll(
  parts: readonly { kind: EntityKind; entity: unknown; ctx?: ValidationContext }[],
  ctx: ValidationContext,
  opts: ValidateOptions = {},
): Issue[] {
  return parts.flatMap((p) => validate(p.kind, p.entity, p.ctx ?? ctx, opts));
}
