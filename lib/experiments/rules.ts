// AB and LS rules (module 17 4.5, validation.md 2.22 and 2.23; AB-026..029 and LS-018, LS-019 are proposals adopted by
// RC-053, LS-017 is dropped). Pure: values in, Issues out. Kept beside the module like the PLN rules of module 04.
import type { ExperimentChannelScope, LiftStrength, LiftType } from '@prisma/client';
import { MSG } from '@/lib/validation/messages';
import type { Issue, Severity } from '@/lib/validation/types';
import {
  AB_ARM_NAME_MAX,
  AB_GOALS_BY_SCOPE,
  AB_HYPOTHESIS_MAX,
  AB_MAX_ARMS,
  AB_NAME_MAX,
  LS_BRAND_MAX,
  LS_MAX_COMPETITORS,
  LS_MAX_GROUPS,
  LS_MAX_METRICS,
  LS_MAX_TERMS,
  LS_NAME_MAX,
} from './constants';
import type { AbTestInput, BrandLiftInput, LiftStudyInput } from './types';

export const EXP_MSG = {
  ENTER_VALUE: 'Enter a value',
  LARGER: 'Enter a larger number',
  NAME_100: `Use ${AB_NAME_MAX} characters or fewer.`,
  HYPOTHESIS_400: `Use ${AB_HYPOTHESIS_MAX} characters or fewer.`,
  ARM_200: `Use ${AB_ARM_NAME_MAX} characters or fewer.`,
  END_BEFORE_START: 'End date must be on or after the start date.',
  DATES_LOCKED: "Dates can't be changed after the test has started.",
  ARMS_LOCKED: "Arms can't be changed after the test has started.",
  SELECTION: 'A selection is required',
  TWO_ARMS: 'Add at least 2 arms.',
  MAX_ARMS: `You can add up to ${AB_MAX_ARMS} arms.`,
  SPLIT_100: 'Audience splits must add up to 100%.',
  ONE_CONTROL: 'Choose one control arm.',
  EMPTY_ARM: (kind: string) => `Select at least one ${kind} for each arm.`,
  ONE_ARM_ONLY: 'An item can only be in one arm.',
  IN_OTHER_TEST: (name: string) => `${name} is already part of another test.`,
  GOAL: 'Choose a measurement goal that applies to these arms.',
  CONFIDENCE: 'Choose a confidence level.',
  EXCLUDE_WARN: 'Excluding traffic without third-party IDs can make results less representative.',
  MIXED: 'All arms must compare the same kind of item.',
  BRAND_NEEDS: 'Brand lift needs insertion orders with YouTube & partners or Demand Gen line items.',
  PAST_START: "The start date can't be in the past.",
  INACTIVE: (name: string) => `${name} isn't active and won't deliver.`,
  LS_NAME_128: `Use ${LS_NAME_MAX} characters or fewer.`,
  LS_GROUP: 'Choose insertion orders from one group.',
  LS_TYPE: 'Select at least one lift type.',
  LS_UNMEASURABLE: 'No line items in the selected insertion orders can be measured.',
  LS_METRICS: 'Select between 1 and 3 metrics.',
  LS_BRAND_30: `Use ${LS_BRAND_MAX} characters or fewer.`,
  LS_OBJECT: 'Select an object type.',
  LS_ACTION: 'Select an intended action.',
  LS_ENHANCED: 'Enhanced lift is only available for YouTube and needs 3 times the standard budget.',
  LS_GROUPS: `Add 1 to ${LS_MAX_TERMS} search terms per group, up to ${LS_MAX_GROUPS} groups.`,
  LS_LOCKED: "This setting can't be changed after it is created.",
  LS_FINISH_FLIGHT: 'Finish or end the current flight first.',
  LS_COMPETITOR: 'Competitors must be different from your brand.',
  NOT_ELIGIBLE: 'Not eligible',
} as const;

function issue(ruleId: string, path: string, message: string, severity: Severity = 'error'): Issue {
  return { ruleId, severity, path, message, blocking: severity === 'error' };
}

const chars = (s: string) => [...s].length;
const blank = (s: string | null | undefined) => !s || s.trim() === '';

export interface AbEntityInfo {
  kind: 'IO' | 'LI';
  name: string;
  scope: ExperimentChannelScope;
  /** Budget of the LIs of an IO exceeds the IO budget (AB-023). */
  budgetWarning: boolean;
  /** Draft or archived: will not deliver (AB-029). */
  inactive: boolean;
  /** IO with YouTube or Demand Gen line items (not PG YouTube): brand lift is possible (AB-022). */
  liftable: boolean;
}

export interface AbRuleCtx {
  mode: 'create' | 'edit';
  today: string;
  /** Edit: the test has started. */
  started: boolean;
  /** Edit: values before the change. */
  original?: {
    startDate: string;
    endDate: string | null;
    arms: { id: string; splitPct: number; isControl: boolean; entityIds: string[] }[];
  } | undefined;
  entities: Map<string, AbEntityInfo>;
  /** Entity id to the name of another active test it is in (AB-026). */
  usedElsewhere: Map<string, string>;
}

const numOf = (v: unknown): number | null => {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

/** Channel scope of a set of entities. */
export function scopeOf(scopes: ExperimentChannelScope[]): ExperimentChannelScope {
  const set = new Set(scopes);
  if (set.size === 0) return 'CROSS_EXCHANGE';
  if (set.size === 1) return [...set][0] as ExperimentChannelScope;
  return 'MIXED';
}

export function abIssues(input: AbTestInput, ctx: AbRuleCtx): Issue[] {
  const out: Issue[] = [];
  const name = input.name ?? '';
  if (blank(name)) out.push(issue('AB-001', 'name', EXP_MSG.ENTER_VALUE));
  else if (chars(name.trim()) > AB_NAME_MAX) out.push(issue('AB-002', 'name', EXP_MSG.NAME_100));
  if (input.hypothesis && chars(input.hypothesis) > AB_HYPOTHESIS_MAX)
    out.push(issue('AB-003', 'hypothesis', EXP_MSG.HYPOTHESIS_400));
  if (blank(input.startDate)) out.push(issue('AB-004', 'startDate', EXP_MSG.ENTER_VALUE));
  if (input.endDate && input.startDate && input.endDate < input.startDate)
    out.push(issue('AB-005', 'endDate', EXP_MSG.END_BEFORE_START));
  if (ctx.mode === 'create' && input.startDate && input.startDate < ctx.today)
    out.push(issue('AB-028', 'startDate', EXP_MSG.PAST_START));
  if (ctx.mode === 'edit' && ctx.started && ctx.original) {
    if (input.startDate !== ctx.original.startDate)
      out.push(issue('AB-006', 'startDate', EXP_MSG.DATES_LOCKED));
    // the end date stays editable once started (AB-024)
  }
  if (input.target !== 'INSERTION_ORDER' && input.target !== 'LINE_ITEM')
    out.push(issue('AB-007', 'target', EXP_MSG.SELECTION));

  const arms = input.arms ?? [];
  if (arms.length < 2) out.push(issue('AB-008', 'arms', EXP_MSG.TWO_ARMS));
  if (arms.length > AB_MAX_ARMS) out.push(issue('AB-027', 'arms', EXP_MSG.MAX_ARMS));

  let total = 0;
  let allSplits = true;
  arms.forEach((a, i) => {
    const p = `arms.${i}`;
    if (blank(a.name)) out.push(issue('AB-009', `${p}.name`, EXP_MSG.ENTER_VALUE));
    else if (chars(a.name.trim()) > AB_ARM_NAME_MAX) out.push(issue('AB-009', `${p}.name`, EXP_MSG.ARM_200));
    const s = numOf(a.splitPct);
    if (s === null) {
      allSplits = false;
      out.push(issue('AB-010', `${p}.splitPct`, EXP_MSG.ENTER_VALUE));
    } else if (s <= 0) {
      allSplits = false;
      out.push(issue('AB-011', `${p}.splitPct`, EXP_MSG.LARGER));
    } else total += s;
    if (a.entityIds.length === 0)
      out.push(
        issue('AB-014', `${p}.entityIds`, EXP_MSG.EMPTY_ARM(input.target === 'LINE_ITEM' ? 'line item' : 'insertion order')),
      );
  });
  if (allSplits && arms.length > 0 && Math.round(total * 1000) !== 100_000)
    out.push(issue('AB-012', 'arms', EXP_MSG.SPLIT_100));
  if (arms.filter((a) => a.isControl).length !== 1) out.push(issue('AB-013', 'arms', EXP_MSG.ONE_CONTROL));

  // same entity in two arms (AB-015), already in another test (AB-026), mixed kinds (AB-021), inactive (AB-029)
  const seen = new Map<string, number>();
  const flagged = new Set<string>();
  arms.forEach((a, i) =>
    a.entityIds.forEach((id) => {
      const prev = seen.get(id);
      if (prev !== undefined && prev !== i && !flagged.has(id)) {
        flagged.add(id);
        out.push(issue('AB-015', `arms.${i}.entityIds`, EXP_MSG.ONE_ARM_ONLY));
      }
      seen.set(id, i);
    }),
  );
  const wantKind = input.target === 'LINE_ITEM' ? 'LI' : 'IO';
  let mixed = false;
  const scopes: ExperimentChannelScope[] = [];
  arms.forEach((a, i) =>
    a.entityIds.forEach((id) => {
      const e = ctx.entities.get(id);
      if (!e) return;
      if (e.kind !== wantKind) mixed = true;
      scopes.push(e.scope);
      const other = ctx.usedElsewhere.get(id);
      if (other) out.push(issue('AB-026', `arms.${i}.entityIds`, EXP_MSG.IN_OTHER_TEST(e.name)));
      if (e.inactive) out.push(issue('AB-029', `arms.${i}.entityIds`, EXP_MSG.INACTIVE(e.name), 'warning'));
      if (e.budgetWarning) out.push(issue('AB-023', `arms.${i}.entityIds`, MSG.LI_BUDGET_GT_IO, 'warning'));
    }),
  );
  if (mixed) out.push(issue('AB-021', 'arms', EXP_MSG.MIXED));

  const scope = scopeOf(scopes);
  if (!AB_GOALS_BY_SCOPE[scope].includes(input.goal))
    out.push(issue('AB-016', 'goal', EXP_MSG.GOAL));
  if (input.confidence !== 'P90' && input.confidence !== 'P95')
    out.push(issue('AB-017', 'confidence', EXP_MSG.CONFIDENCE));

  const crossExchange = scopes.includes('CROSS_EXCHANGE');
  if (input.target === 'LINE_ITEM' || crossExchange)
    out.push(issue('AB-018', 'lift', MSG.LIFT_NA_FOR_LI, 'info'));
  // the toggle only applies to cross-exchange insertion orders; elsewhere the service stores it as off
  if (input.excludeUnidentifiedUsers && crossExchange && input.target === 'INSERTION_ORDER')
    out.push(issue('AB-019', 'excludeUnidentifiedUsers', EXP_MSG.EXCLUDE_WARN, 'warning'));
  if (input.liftEnabled) {
    const all = arms.flatMap((a) => a.entityIds).map((id) => ctx.entities.get(id));
    const ok = input.target === 'INSERTION_ORDER' && all.length > 0 && all.every((e) => !e || e.liftable);
    if (!ok) out.push(issue('AB-022', 'lift', EXP_MSG.BRAND_NEEDS));
    else if (input.brandLift) out.push(...brandLiftIssues(input.brandLift, 'brandLift', ['BRAND_LIFT']));
  }

  if (ctx.mode === 'edit' && ctx.started && ctx.original) {
    const o = ctx.original;
    const changed =
      arms.length !== o.arms.length ||
      arms.some((a) => {
        const was = o.arms.find((x) => x.id === a.id);
        if (!was) return true;
        const ids = [...a.entityIds].sort().join(',');
        return (
          numOf(a.splitPct) !== was.splitPct ||
          a.isControl !== was.isControl ||
          ids !== [...was.entityIds].sort().join(',')
        );
      });
    if (changed) out.push(issue('AB-024', 'arms', EXP_MSG.ARMS_LOCKED));
  }
  return out;
}

/** Survey fields shared by the A/B Brand lift block and the lift study form (LS-006 to LS-013, LS-019). */
export function brandLiftIssues(b: BrandLiftInput, base: string, types: LiftType[]): Issue[] {
  const out: Issue[] = [];
  if (types.includes('BRAND_LIFT') && (b.metrics.length < 1 || b.metrics.length > LS_MAX_METRICS))
    out.push(issue('LS-006', `${base}.metrics`, EXP_MSG.LS_METRICS));
  if (blank(b.brandName)) out.push(issue('LS-007', `${base}.brandName`, EXP_MSG.ENTER_VALUE));
  else if (chars(b.brandName.trim()) > LS_BRAND_MAX)
    out.push(issue('LS-007', `${base}.brandName`, EXP_MSG.LS_BRAND_30));
  const comps = b.competitors.map((c) => c.trim()).filter(Boolean);
  if (comps.length > LS_MAX_COMPETITORS || comps.some((c) => chars(c) > LS_BRAND_MAX))
    out.push(issue('LS-008', `${base}.competitors`, EXP_MSG.LS_BRAND_30));
  const lower = comps.map((c) => c.toLowerCase());
  if (
    new Set(lower).size !== lower.length ||
    (!blank(b.brandName) && lower.includes(b.brandName.trim().toLowerCase()))
  )
    out.push(issue('LS-019', `${base}.competitors`, EXP_MSG.LS_COMPETITOR));
  if (blank(b.objectType)) out.push(issue('LS-010', `${base}.objectType`, EXP_MSG.LS_OBJECT));
  if (b.metrics.includes('PURCHASE_INTENT') && !b.intendedAction)
    out.push(issue('LS-011', `${base}.intendedAction`, EXP_MSG.LS_ACTION));
  return out;
}

export interface LsEligibilityInput {
  type: LiftType;
  measurableLis: number;
  eligible: boolean;
}

export interface LsRuleCtx {
  mode: 'create' | 'edit';
  /** Selected IOs by group: both groups at once are an error (LS-002). */
  groups: { yt: number; other: number };
  eligibleIoCount: number;
  perType: LsEligibilityInput[];
  /** Enhanced is valid only when every measurable line item is YouTube. */
  allMeasurableYoutube: boolean;
  /** Edit: lift types stored on the study. */
  originalTypes?: LiftType[] | undefined;
}

export function lsIssues(input: LiftStudyInput, ctx: LsRuleCtx): Issue[] {
  const out: Issue[] = [];
  const name = input.name ?? '';
  if (blank(name)) out.push(issue('LS-001', 'name', EXP_MSG.ENTER_VALUE));
  else if (chars(name.trim()) > LS_NAME_MAX) out.push(issue('LS-001', 'name', EXP_MSG.LS_NAME_128));
  if (ctx.groups.yt > 0 && ctx.groups.other > 0) out.push(issue('LS-002', 'ioIds', EXP_MSG.LS_GROUP));
  if (ctx.eligibleIoCount === 0) out.push(issue('LS-003', 'ioIds', MSG.LS_SELECT_IO));
  else {
    if (input.liftTypes.length === 0) out.push(issue('LS-004', 'liftTypes', EXP_MSG.LS_TYPE));
    for (const t of input.liftTypes) {
      const e = ctx.perType.find((p) => p.type === t);
      if (!e || e.measurableLis === 0) out.push(issue('LS-005', 'liftTypes', EXP_MSG.LS_UNMEASURABLE));
    }
  }
  if (input.liftTypes.length > 0) out.push(...brandLiftIssues(input.brandLift, 'brandLift', input.liftTypes));
  if (input.strength === 'ENHANCED' && !ctx.allMeasurableYoutube)
    out.push(issue('LS-012', 'strength', EXP_MSG.LS_ENHANCED));
  if (input.liftTypes.includes('SEARCH_LIFT')) {
    const g = input.searchGroups;
    if (
      g.length > LS_MAX_GROUPS ||
      g.some((terms) => terms.filter((t) => t.trim()).length < 1 || terms.filter((t) => t.trim()).length > LS_MAX_TERMS)
    )
      out.push(issue('LS-013', 'searchGroups', EXP_MSG.LS_GROUPS));
  }
  if (ctx.mode === 'edit' && ctx.originalTypes) {
    const a = [...ctx.originalTypes].sort().join(',');
    const b = [...input.liftTypes].sort().join(',');
    if (a !== b) out.push(issue('LS-015', 'liftTypes', EXP_MSG.LS_LOCKED));
  }
  return out;
}

export const lockedAbEnd = (): Issue => issue('AB-025', '*', 'This test has already ended.');
export const lsFlightOpenIssue = (): Issue => issue('LS-018', '*', EXP_MSG.LS_FINISH_FLIGHT);
export const lsNotEligibleIssue = (): Issue => issue('LS-014', 'eligibility', EXP_MSG.NOT_ELIGIBLE, 'warning');

export type { LiftStrength };
