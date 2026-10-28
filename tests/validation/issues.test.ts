// client/issues.ts: Issue[] to field errors, banners and focus-first-error. No React needed.
import { describe, expect, it } from 'vitest';
import { validate } from '@/lib/validation';
import {
  bannerIssues,
  firstInvalidPath,
  issuesAt,
  softIssuesOf,
  toFieldErrors,
} from '@/lib/validation/client/issues';
import { applyPatch, makeCtx, validCampaign, validIo } from '@/lib/validation/testing/fixtures';

const issues = validate(
  'campaign',
  applyPatch(validCampaign(), {
    name: '',
    creativeTypes: [],
    goal: 'AWARENESS',
    kpi: { type: 'CPA', value: 5 },
  }),
  makeCtx(),
);

describe('issues to the form', () => {
  it('maps the first blocking issue of each path', () => {
    expect(toFieldErrors(issues)).toEqual({
      name: { type: 'CMP-001', message: 'Enter a value' },
      creativeTypes: { type: 'CMP-020', message: 'Please select at least one creative type.' },
    });
  });

  it('keeps warnings and infos away from field errors', () => {
    expect(softIssuesOf(issues).map((i) => i.ruleId)).toEqual(['CMP-013', 'CMP-081', 'CMP-080']);
    expect(Object.keys(toFieldErrors(softIssuesOf(issues)))).toEqual([]);
  });

  it('puts whole-entity issues in the banner list, not under a field', () => {
    const io = validate(
      'insertionOrder',
      validIo(),
      makeCtx({
        children: {
          lineItems: [{ id: 'li-1', type: 'DISPLAY', status: 'DRAFT', budgetAmount: 99_999_999 }],
        },
      }),
    );
    expect(bannerIssues(io).map((i) => i.ruleId)).toEqual(['IO-093']);
    expect(Object.keys(toFieldErrors(io))).not.toContain('*');
  });

  it('finds the field to focus: the first error in form order', () => {
    expect(firstInvalidPath(issues)).toBe('name');
    expect(firstInvalidPath([])).toBeNull();
    expect(firstInvalidPath(softIssuesOf(issues))).toBeNull();
  });

  it('lists the issues of one field', () => {
    expect(issuesAt(issues, 'kpi.type').map((i) => i.ruleId)).toEqual(['CMP-013']);
  });
});
