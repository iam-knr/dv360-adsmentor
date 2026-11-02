// Wording of the New campaign form (fidelity audit CAM-047, CAM-048). The rule catalogue says "Choose a goal." and
// "Choose a KPI."; real DV360 shows "A value is required" under both and counts four required errors with an empty
// form: name ("Enter a value"), goal, KPI and creative type ("Please select at least one creative type."). Pure.
import type { CampaignWire, WireIssue } from './wire';

export const REQUIRED_VALUE = 'A value is required';

export function realFormIssues(issues: WireIssue[], value: CampaignWire): WireIssue[] {
  const out = issues.map((i) =>
    i.severity === 'error' && (i.path === 'goal' || i.path === 'kpi.type')
      ? { ...i, message: REQUIRED_VALUE }
      : i,
  );
  const needsKpi =
    !value.kpi.type && !out.some((i) => i.path === 'kpi.type' && i.severity === 'error');
  // Only when the form is being rejected anyway: the server stays the judge of what is saved.
  if (needsKpi && out.some((i) => i.severity === 'error')) {
    out.push({ path: 'kpi.type', severity: 'error', code: 'CMP-011', message: REQUIRED_VALUE });
  }
  return out;
}
