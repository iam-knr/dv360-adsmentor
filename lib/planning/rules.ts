// PLN rules (module 04 4.2, 4.7, 4.9; PLN-020..031 are proposals, C-04-8). Pure: values in, Issues out.
import { MSG } from '@/lib/validation/messages';
import type { Issue, Severity } from '@/lib/validation/types';
import { PLAN_PARAMS } from './params';
import { DEAL_METHODS, type PlanBuyingMethodKey } from './types';

export const PLN_MSG = {
  LOCKED: 'Your start date has passed',
  LOCKED_HINT: 'Make a copy of this plan with new dates to work on it again.',
  STATUS_NOT_ALLOWED: "This status change isn't allowed for the plan's current status.",
  NAME_TOO_LONG: 'Use 100 characters or fewer.',
  END_BEFORE_START: 'End date must be on or after the start date.',
  START_PASSED: 'Choose a start date that has not passed.',
  TOO_LONG: 'A plan can run for up to 365 days.',
  BAD_AGE: 'Choose a valid age range.',
  ROW_DATES: 'Line item dates must fall within the plan dates.',
  ROW_CAP: 'A plan can have up to 50 line items.',
  NO_ROWS: 'Add at least one line item before creating a campaign.',
  CAMPAIGN_FOREIGN: 'Choose a campaign from this advertiser.',
  PICK_ONE: 'Select at least one insertion order or TV campaign.',
  CURRENCY_NOTE: (c: string) => `Spend is shown in ${c}. Amounts are converted at a fixed rate.`,
  MAX_ITEMS: (n: number) => `Select up to ${n} items.`,
} as const;

function issue(ruleId: string, path: string, message: string, severity: Severity = 'error'): Issue {
  return { ruleId, severity, path, message, blocking: severity === 'error' };
}

const dayMs = 86_400_000;
const days = (a: string, b: string) => Math.round((Date.parse(b) - Date.parse(a)) / dayMs) + 1;

export interface PlanHeaderValues {
  name: string;
  location: string;
  start: string;
  end: string;
  ageMin: number;
  ageMax: number;
  /** Today in sim time (YYYY-MM-DD). */
  today: string;
  /** Check the start date against today: create and copy, not an ordinary save. */
  checkStart: boolean;
  frequencyGoal?: number;
}

export function planHeaderIssues(v: PlanHeaderValues): Issue[] {
  const out: Issue[] = [];
  const name = v.name.trim();
  if (!name) out.push(issue('PLN-020', 'name', MSG.ENTER_VALUE));
  else if ([...name].length > 100) out.push(issue('GEN-004', 'name', PLN_MSG.NAME_TOO_LONG));
  if (!v.location) out.push(issue('GEN-005', 'location', MSG.SELECTION_REQUIRED));
  if (v.end < v.start) out.push(issue('GEN-008', 'dates.end', PLN_MSG.END_BEFORE_START));
  else if (days(v.start, v.end) > PLAN_PARAMS.maxDays)
    out.push(issue('PLN-022', 'dates.end', PLN_MSG.TOO_LONG));
  if (v.checkStart && v.start < v.today) out.push(issue('PLN-021', 'dates.start', PLN_MSG.START_PASSED));
  if (v.ageMin > v.ageMax) out.push(issue('PLN-023', 'demographics', PLN_MSG.BAD_AGE));
  if (v.frequencyGoal !== undefined && (v.frequencyGoal < 1 || v.frequencyGoal > 20))
    out.push(issue('PLN-023', 'additional.frequencyGoal', 'Enter a number from 1 to 20'));
  return out;
}

export interface PlanRowValues {
  name: string;
  buyingMethod: PlanBuyingMethodKey;
  dealId?: string | null;
  start: string;
  end: string;
  budgetNet: number | null;
  maxCpm?: number | null;
  planStart: string;
  planEnd: string;
}

export function planRowIssues(v: PlanRowValues, i: number): Issue[] {
  const p = `rows.${i}`;
  const out: Issue[] = [];
  if (!v.name.trim()) out.push(issue('GEN-001', `${p}.name`, MSG.ENTER_VALUE));
  if (v.budgetNet === null || !(v.budgetNet > 0))
    out.push(issue('GEN-002', `${p}.budgetNet`, MSG.ENTER_POSITIVE));
  if (v.maxCpm !== undefined && v.maxCpm !== null && !(v.maxCpm > 0))
    out.push(issue('GEN-002', `${p}.maxCpm`, MSG.ENTER_POSITIVE));
  if (v.end < v.start) out.push(issue('GEN-008', `${p}.dates.end`, PLN_MSG.END_BEFORE_START));
  else if (v.start < v.planStart || v.end > v.planEnd)
    out.push(issue('PLN-024', `${p}.dates`, PLN_MSG.ROW_DATES));
  if (DEAL_METHODS.includes(v.buyingMethod) && !v.dealId)
    out.push(issue('PLN-025', `${p}.dealId`, MSG.SELECTION_REQUIRED));
  return out;
}

export const planRowCapIssues = (count: number): Issue[] =>
  count > PLAN_PARAMS.maxRows ? [issue('PLN-026', 'rows', PLN_MSG.ROW_CAP)] : [];

export function lockedIssue(): Issue {
  return issue('PLN-002', '*', `${PLN_MSG.LOCKED}. ${PLN_MSG.LOCKED_HINT}`);
}

export const statusIssue = (): Issue => issue('PLN-004', 'status', PLN_MSG.STATUS_NOT_ALLOWED);

export function convertIssues(v: {
  status: string;
  locked: boolean;
  rowCount: number;
  target: 'CAMPAIGN' | 'IO';
  campaignFound: boolean;
}): Issue[] {
  if (v.status !== 'PLANNED') return [statusIssue()];
  if (v.locked) return [lockedIssue()];
  const out: Issue[] = [];
  if (v.rowCount === 0) out.push(issue('PLN-028', 'rows', PLN_MSG.NO_ROWS));
  if (v.target === 'IO' && !v.campaignFound)
    out.push(issue('PLN-029', 'campaignId', PLN_MSG.CAMPAIGN_FOREIGN));
  return out;
}

export interface CrossMediaValues {
  country: string | null;
  scope: 'NATIONAL' | 'SUB_LOCATION';
  subLocationCount: number;
  ioCount: number;
  tvCount: number;
}

export function crossMediaIssues(v: CrossMediaValues): Issue[] {
  const out: Issue[] = [];
  if (!v.country) out.push(issue('PLN-010', 'country', MSG.SELECTION_REQUIRED));
  if (v.scope === 'SUB_LOCATION' && v.subLocationCount === 0)
    out.push(issue('PLN-011', 'subLocations', MSG.SELECTION_REQUIRED));
  if (v.ioCount + v.tvCount === 0) out.push(issue('PLN-012', 'ioIds', PLN_MSG.PICK_ONE));
  if (v.ioCount > 50) out.push(issue('PLN-031', 'ioIds', PLN_MSG.MAX_ITEMS(50)));
  if (v.tvCount > 20) out.push(issue('PLN-031', 'tvCampaigns', PLN_MSG.MAX_ITEMS(20)));
  return out;
}
