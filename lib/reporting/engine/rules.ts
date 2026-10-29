// Validation rules of module 16 section 4.6: RPT-001..004 (validation.md 2.25) and the proposed RPT-010..020.
// Pure. The UI runs the same function on blur and on drop, the server on every save and run.
import { FIELD_BY_KEY } from '../catalogue';
import type { ReportDefinition, ReportSchedule, RuleIssue } from '../types';
import { incompatibility } from './compat';

export const MAX_NAME = 255;
export const MAX_RANGE_DAYS = 731;

const err = (ruleId: string, path: string, message: string): RuleIssue => ({
  ruleId,
  path,
  severity: 'error',
  message,
});

export function ruleName(name: string): RuleIssue[] {
  const issues: RuleIssue[] = [];
  if (!name.trim()) issues.push(err('RPT-001', 'name', 'Enter a value'));
  if (name.length > MAX_NAME) issues.push(err('RPT-019', 'name', 'Use 255 characters or fewer.'));
  return issues;
}

export function ruleSchedule(s: ReportSchedule | undefined): RuleIssue[] {
  if (!s) return [];
  const issues: RuleIssue[] = [];
  if (!Number.isInteger(s.every) || s.every < 1) {
    issues.push(err('RPT-003', 'schedule.every', 'End date must be on or after the start date.'));
  }
  if (s.expires && s.starts && s.expires < s.starts) {
    issues.push(err('RPT-003', 'schedule.expires', 'End date must be on or after the start date.'));
  }
  return issues;
}

export function ruleFileName(fileName: string | undefined): RuleIssue[] {
  return fileName && fileName.trim() ? [] : [err('RPT-004', 'delivery.fileName', 'Enter a value')];
}

/** Compatibility of the selected dimensions and metrics (RPT-011). */
export function ruleCompatibility(dimensions: string[], metrics: string[]): RuleIssue[] {
  const issues: RuleIssue[] = [];
  const selected = [...dimensions, ...metrics];
  for (const key of selected) {
    const reason = incompatibility(key, selected);
    if (reason) issues.push(err('RPT-011', `fields.${key}`, reason));
  }
  return issues;
}

export function ruleViz(
  def: Pick<ReportDefinition, 'viz' | 'dimensions' | 'metrics'>,
): RuleIssue[] {
  const dims = def.dimensions.map((k) => FIELD_BY_KEY.get(k));
  const t = def.viz.type;
  const msg = (r: string) => `This chart needs ${r}.`;
  if (t === 'TIME_SERIES' && !dims.some((d) => d?.key === 'date' || d?.key === 'date_and_hour'))
    return [err('RPT-015', 'viz', msg('a Date dimension'))];
  if (t === 'PIE' && !(def.dimensions.length === 1 && def.metrics.length === 1))
    return [err('RPT-015', 'viz', msg('exactly one dimension and one metric'))];
  if (t === 'SCATTER' && def.metrics.length < 2) return [err('RPT-015', 'viz', msg('two metrics'))];
  if (
    t === 'PIVOT_TABLE' &&
    def.viz.options?.columns &&
    !def.dimensions.includes(def.viz.options.columns)
  )
    return [err('RPT-015', 'viz', msg('its column dimension in the row dimensions'))];
  return [];
}

export interface RunRuleContext {
  /** Sim today in the advertiser time zone (YYYY-MM-DD). */
  today: string;
  /** Resolved range, or null when the param is invalid. */
  range: { from: string; to: string } | null;
  hourlyRetentionDays: number;
  /** PARTNER_CLIENT cannot use PARTNER_COST fields. */
  allowPartnerCost: boolean;
}

const daysBetween = (a: string, b: string): number =>
  Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000);

/** Everything a run or a save checks (RPT-001, 010..015, 017, 019). */
export function validateForRun(def: ReportDefinition, ctx: RunRuleContext): RuleIssue[] {
  const issues: RuleIssue[] = [...ruleName(def.name)];
  if (def.metrics.length === 0)
    issues.push(err('RPT-010', 'metrics', 'Select at least one metric.'));
  for (const key of [...def.dimensions, ...def.metrics]) {
    const f = FIELD_BY_KEY.get(key);
    if (!f) {
      issues.push(err('RPT-011', `fields.${key}`, `${key} isn't a report field.`));
      continue;
    }
    if (f.sensitivity === 'PARTNER_COST' && !ctx.allowPartnerCost)
      issues.push(err('RPT-017', `fields.${key}`, "You don't have access to this field."));
  }
  issues.push(...ruleCompatibility(def.dimensions, def.metrics));
  const r = ctx.range;
  if (!r || r.to < r.from || r.to > ctx.today || daysBetween(r.from, r.to) > MAX_RANGE_DAYS) {
    issues.push(err('RPT-012', 'dateRange', 'Choose a valid date range.'));
  } else if (
    def.dimensions.some((k) => FIELD_BY_KEY.get(k)?.compat?.includes('HOURLY')) &&
    daysBetween(r.from, ctx.today) > ctx.hourlyRetentionDays
  ) {
    issues.push(
      err(
        'RPT-013',
        'dateRange',
        `Hourly data is only available for the last ${ctx.hourlyRetentionDays} days.`,
      ),
    );
  }
  if (!def.filters.some((f) => f.field === 'partner' && f.values.length > 0))
    issues.push(err('RPT-014', 'filters', 'A partner filter is required.'));
  issues.push(...ruleViz(def));
  return issues;
}

/** Everything a save checks beyond a run: name, schedule, delivery. Metrics may be empty on a draft. */
export function validateForSave(def: ReportDefinition): RuleIssue[] {
  const issues = [...ruleName(def.name), ...ruleCompatibility(def.dimensions, def.metrics)];
  if (def.kind === 'OFFLINE') {
    issues.push(...ruleSchedule(def.schedule));
    issues.push(...ruleFileName(def.delivery?.fileName));
  } else if (def.schedule) {
    issues.push(...ruleSchedule(def.schedule));
    if (def.delivery) issues.push(...ruleFileName(def.delivery.fileName));
  }
  if (!def.filters.some((f) => f.field === 'partner' && f.values.length > 0))
    issues.push(err('RPT-014', 'filters', 'A partner filter is required.'));
  return issues;
}

export function ruleShare(canAccess: boolean): RuleIssue[] {
  return canAccess ? [] : [err('RPT-020', 'share', "That person can't access this partner.")];
}

export function ruleTruncated(rows: number, cap: number): RuleIssue[] {
  return rows > cap
    ? [
        {
          ruleId: 'RPT-018',
          path: 'rows',
          severity: 'warning',
          message: `The file was truncated at ${cap} rows.`,
        },
      ]
    : [];
}
