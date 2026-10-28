// Helpers the rule files share. Pure functions over form values and the context.
import { FEES_MAX_PER_KIND } from '../constants/fees';
import { type FreqPeriod, FREQ_PERIODS, type ResolvedCap } from '../constants/frequency';
import { MSG } from '../messages';
import { isEmptyNum, isWhole, toNum } from '../primitives';
import type {
  FeeInput,
  FrequencyCapInput,
  Num,
  PartnerCostsInput,
  ValidationContext,
  Violation,
} from '../types';

/** The stored entity (edit mode). Rules that lock fields compare against it; in create mode there is none. */
export function originalOf<T>(ctx: ValidationContext): T | undefined {
  return ctx.mode === 'edit' ? (ctx.original as T | undefined) : undefined;
}

export function at(path: string, i: number, field: string): string {
  return `${path}[${i}].${field}`;
}

/** n is a whole number >= 1. */
export function isCount(value: Num): boolean {
  const n = toNum(value);
  return n !== null && Number.isInteger(n) && n >= 1;
}

export function isFreqPeriod(value: unknown): value is FreqPeriod {
  return typeof value === 'string' && (FREQ_PERIODS as readonly string[]).includes(value);
}

/** A "Limit frequency" cap with valid numbers, or null when the cap does not limit (or is not valid yet). */
export function resolveCap(cap: FrequencyCapInput | null | undefined): ResolvedCap | null {
  if (!cap || cap.mode !== 'LIMITED') return null;
  if (!isCount(cap.maxImpressions) || !isCount(cap.periodCount) || !isFreqPeriod(cap.period))
    return null;
  return {
    n: toNum(cap.maxImpressions) as number,
    periodCount: toNum(cap.periodCount) as number,
    period: cap.period,
  };
}

/** `LIMITED` and the max exposures field is empty (CMP-040, IO-060, LI-050). */
export function capMaxEmpty(
  cap: FrequencyCapInput | null | undefined,
  path: string,
): Violation | null {
  return cap?.mode === 'LIMITED' && isEmptyNum(cap.maxImpressions)
    ? { path: `${path}.maxImpressions` }
    : null;
}

/** `LIMITED` and a filled max exposures field that is not a whole number >= 1 (CMP-041). */
export function capMaxInvalid(
  cap: FrequencyCapInput | null | undefined,
  path: string,
): Violation | null {
  return cap?.mode === 'LIMITED' && !isEmptyNum(cap.maxImpressions) && !isCount(cap.maxImpressions)
    ? { path: `${path}.maxImpressions` }
    : null;
}

/** `LIMITED` and the period count is not a whole number >= 1, or (with `checkPeriod`) the unit is unknown (CMP-042). */
export function capWindowInvalid(
  cap: FrequencyCapInput | null | undefined,
  path: string,
  checkPeriod: boolean,
): Violation[] {
  if (cap?.mode !== 'LIMITED') return [];
  const out: Violation[] = [];
  if (!isCount(cap.periodCount)) out.push({ path: `${path}.periodCount` });
  if (checkPeriod && !isFreqPeriod(cap.period)) out.push({ path: `${path}.period` });
  return out;
}

// ---------------------------------------------------------------------------------------------
// Partner costs (IO-070..IO-074, LI-091)
// ---------------------------------------------------------------------------------------------

export interface FeeRef {
  kind: 'cpmFees' | 'mediaFees';
  index: number;
  fee: FeeInput;
}

function allFees(costs: PartnerCostsInput | undefined): FeeRef[] {
  if (!costs) return [];
  return [
    ...costs.cpmFees.map((fee, index): FeeRef => ({ kind: 'cpmFees', index, fee })),
    ...costs.mediaFees.map((fee, index): FeeRef => ({ kind: 'mediaFees', index, fee })),
  ];
}

export function feePath(prefix: string, ref: FeeRef, field: string): string {
  return `${prefix}.${ref.kind}[${ref.index}].${field}`;
}

/** IO-070: CPM fee amount present and below 0. */
export function cpmFeeNegative(costs: PartnerCostsInput | undefined, prefix: string): Violation[] {
  return allFees(costs)
    .filter((r) => r.kind === 'cpmFees' && !isEmptyNum(r.fee.amount))
    .filter((r) => {
      const n = toNum(r.fee.amount);
      return n === null || n < 0;
    })
    .map((r) => ({ path: feePath(prefix, r, 'amount') }));
}

/** IO-071: media fee percent present and outside 0-100. */
export function mediaFeePercentInvalid(
  costs: PartnerCostsInput | undefined,
  prefix: string,
): Violation[] {
  return allFees(costs)
    .filter((r) => r.kind === 'mediaFees' && !isEmptyNum(r.fee.amount))
    .filter((r) => {
      const n = toNum(r.fee.amount);
      return n === null || n < 0 || n > 100;
    })
    .map((r) => ({ path: feePath(prefix, r, 'amount') }));
}

/** IO-072: an amount was entered but the fee type was not chosen. */
export function feeTypeMissing(costs: PartnerCostsInput | undefined, prefix: string): Violation[] {
  return allFees(costs)
    .filter((r) => !r.fee.system && !isEmptyNum(r.fee.amount) && !(r.fee.type ?? '').trim())
    .map((r) => ({ path: feePath(prefix, r, 'type') }));
}

/** IO-073: media fee 1 is the invoiced DV360 fee. Edit mode only: it must be present and unchanged. */
export function systemFeeChanged(
  costs: PartnerCostsInput | undefined,
  original: PartnerCostsInput | undefined,
  prefix: string,
): Violation | null {
  const stored = original?.mediaFees[0];
  if (!stored?.system) return null;
  const now = costs?.mediaFees[0];
  const same =
    !!now &&
    !!now.system &&
    (now.type ?? null) === (stored.type ?? null) &&
    toNum(now.amount) === toNum(stored.amount);
  return same ? null : { path: `${prefix}.mediaFees[0]` };
}

/** IO-074: more than 5 CPM fees or more than 5 media fees. */
export function tooManyFees(costs: PartnerCostsInput | undefined, prefix: string): Violation[] {
  if (!costs) return [];
  const out: Violation[] = [];
  if (costs.cpmFees.length > FEES_MAX_PER_KIND) out.push({ path: `${prefix}.cpmFees` });
  if (costs.mediaFees.length > FEES_MAX_PER_KIND) out.push({ path: `${prefix}.mediaFees` });
  return out;
}

/** Messages used by LI-091, which repeats IO-070..IO-074 under its own ID. */
export const FEE_MESSAGES = {
  negative: MSG.NON_NEGATIVE,
  percent: MSG.PCT_RANGE,
  type: MSG.PICK_FEE_TYPE,
  locked: MSG.FEE_LOCKED,
  count: MSG.FEES_MAX,
} as const;

export { isWhole };
