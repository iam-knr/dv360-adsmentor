// Plain-language explanation of the engine's `CONF.*` codes for the Investigate drawer (module 11 2.8, engine 3.8).
// Each entry names the offending field and the tab and anchor where it is fixed.

export interface ConflictExplanation {
  code: string;
  text: string;
  /** Page segment below the entity path, with anchor. */
  fix: { label: string; sub: string };
}

const TABLE: Record<string, Omit<ConflictExplanation, 'code'>> = {
  'CONF.LI_BUDGETS_BELOW_IO': {
    text: 'Line item budgets add up to less than the insertion order budget for the remaining flight.',
    fix: { label: 'Open line items', sub: 'explorerlis' },
  },
  'CONF.LI_FLIGHT_OUTSIDE_IO': {
    text: 'The line item flight does not overlap any budget segment of the insertion order.',
    fix: { label: 'Open flight dates', sub: 'details#flight' },
  },
  'CONF.DAILY_CAP_TOO_LOW': {
    text: 'The daily cap is too low to spend the budget over the remaining days.',
    fix: { label: 'Open pacing', sub: 'details#pacing' },
  },
  'CONF.ASAP_VS_AUTOMATION': {
    text: 'The insertion order automates bid and budget, but this line item does not pace as soon as possible.',
    fix: { label: 'Open pacing', sub: 'details#pacing' },
  },
  'CONF.TARGET_ZERO_OVERLAP': {
    text: 'Every included region is also excluded, so no inventory can match.',
    fix: { label: 'Open targeting', sub: 'details#targeting' },
  },
  'CONF.BID_BELOW_FLOOR': {
    text: 'The fixed bid is below the lowest price at which the enabled exchanges clear.',
    fix: { label: 'Open bid', sub: 'details#bid' },
  },
  'CONF.TARGET_CPA_UNREALISTIC': {
    text: 'The target is far below what similar campaigns achieve, so the bid strategy cannot reach it.',
    fix: { label: 'Open bid', sub: 'details#bid' },
  },
  'CONF.NO_CONVERSION_ACTIVITY': {
    text: 'A conversion-based goal needs a Floodlight activity, and none is selected.',
    fix: { label: 'Open Floodlight', sub: 'details#floodlight' },
  },
};

export function explainConflicts(codes: readonly string[]): ConflictExplanation[] {
  const out: ConflictExplanation[] = [];
  for (const raw of codes) {
    const code = raw.trim();
    if (!code) continue;
    const e = TABLE[code];
    out.push({
      code,
      text: e?.text ?? 'These settings conflict and may prevent your budget from being spent.',
      fix: e?.fix ?? { label: 'Open settings', sub: 'details' },
    });
  }
  return out;
}
