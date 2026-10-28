// Engine behaviour (validation.md 6.4): selection, skips, suppression, dedupe, ordering, determinism.
import { describe, expect, it } from 'vitest';
import { normalizePath, validate, validateAll, validateDetailed } from '@/lib/validation';
import {
  applyPatch,
  makeCtx,
  NOW,
  validCampaign,
  validIo,
  validLineItem,
} from '@/lib/validation/testing/fixtures';

const ids = (issues: { ruleId: string }[]) => issues.map((i) => i.ruleId);

describe('selection', () => {
  it('normalizes indexed paths', () => {
    expect(normalizePath('budget.segments[12].amount')).toBe('budget.segments[].amount');
    expect(normalizePath('name')).toBe('name');
  });

  it('save runs everything, blur runs only the rules that read the changed path', () => {
    const campaign = applyPatch(validCampaign(), { name: '', creativeTypes: [] });
    const all = validate('campaign', campaign, makeCtx(), { includeInfo: false });
    expect(ids(all)).toEqual(expect.arrayContaining(['CMP-001', 'CMP-020']));
    const blur = validate('campaign', campaign, makeCtx(), {
      trigger: 'blur',
      changedPath: 'name',
    });
    expect(ids(blur)).toEqual(['CMP-001']);
  });

  it('a blur on goal also runs the cross rule that reads it (CMP-013)', () => {
    const campaign = applyPatch(validCampaign(), {
      goal: 'AWARENESS',
      kpi: { type: 'CPA', value: 5 },
    });
    expect(
      ids(validate('campaign', campaign, makeCtx(), { trigger: 'blur', changedPath: 'goal' })),
    ).toContain('CMP-013');
  });

  it('indexed paths select rules written with []', () => {
    const io = applyPatch(validIo(), {
      budget: {
        segments: [{ id: 's', amount: '', startDate: '2026-10-01', endDate: '2026-10-31' }],
      },
    });
    const got = validate('insertionOrder', io, makeCtx(), {
      trigger: 'blur',
      changedPath: 'budget.segments[0].amount',
    });
    expect(ids(got)).toContain('IO-021');
  });

  it('cross runs only cross rules', () => {
    const campaign = applyPatch(validCampaign(), {
      name: '',
      goal: 'AWARENESS',
      kpi: { type: 'CPA', value: 5 },
    });
    const got = validate('campaign', campaign, makeCtx(), { trigger: 'cross' });
    expect(ids(got)).toEqual(['CMP-013']);
  });

  it('activation rules wait for the activate trigger or an ACTIVE target', () => {
    const io = applyPatch(validIo(), {
      budget: {
        segments: [{ id: 's', amount: 5, startDate: '2026-10-01', endDate: '2026-10-05' }],
      },
    });
    expect(ids(validate('insertionOrder', io, makeCtx()))).not.toContain('IO-092');
    expect(ids(validate('insertionOrder', io, makeCtx(), { targetStatus: 'ACTIVE' }))).toContain(
      'IO-092',
    );
    expect(ids(validate('insertionOrder', io, makeCtx(), { trigger: 'activate' }))).toContain(
      'IO-092',
    );
    expect(
      ids(
        validate('insertionOrder', io, makeCtx(), {
          trigger: 'blur',
          changedPath: 'budget.segments',
        }),
      ),
    ).not.toContain('IO-092');
  });

  it('documentation rules are never emitted', () => {
    const got = validate('campaign', validCampaign(), makeCtx(), { includeInfo: true });
    expect(ids(got)).not.toContain('CMP-070');
    expect(ids(got)).not.toContain('CMP-016');
  });
});

describe('skips', () => {
  it('skips rules whose lookup is not loaded and reports them', () => {
    const li = validLineItem('DISPLAY');
    const result = validateDetailed('lineItem', li, makeCtx({ lookups: null }));
    expect(result.skipped).toEqual(
      expect.arrayContaining(['LI-013', 'LI-060', 'LI-061', 'LI-064', 'LI-070', 'LI-DSP-031']),
    );
    expect(result.issues.filter((i) => i.blocking)).toEqual([]);
  });

  it('runs them when the lookup is there', () => {
    const result = validateDetailed('lineItem', validLineItem('DISPLAY'), makeCtx());
    expect(result.skipped).toEqual([]);
  });
});

describe('suppression and dedupe', () => {
  it('drops LI-042 when LI-006 explains the same problem', () => {
    const li = validLineItem('DEMAND_GEN');
    const ctx = makeCtx({ io: { objective: 'BRAND_AWARENESS' } }, 'DEMAND_GEN');
    expect(ids(validate('lineItem', li, ctx, { includeInfo: false }))).toEqual(['LI-006']);
  });

  it('shows LI-042 on its own when the type is fine', () => {
    const ctx = makeCtx({ io: { objective: 'CLICKS' } });
    expect(
      ids(validate('lineItem', validLineItem('DISPLAY'), ctx, { includeInfo: false })),
    ).toEqual(['LI-042']);
  });

  it('drops IO-040 when the type and objective clash (IO-003)', () => {
    const io = applyPatch(validIo(), { type: 'CTV_OTT', objective: 'CLICKS' });
    expect(ids(validate('insertionOrder', io, makeCtx()))).toEqual(['IO-003']);
  });

  it('keeps one issue for the same path and message, the one with the lower ID', () => {
    const io = applyPatch(validIo(), {
      budget: {
        segments: [{ id: 's', amount: '', startDate: '2026-10-01', endDate: '2026-10-31' }],
      },
    });
    const got = validate('insertionOrder', io, makeCtx());
    expect(got.filter((i) => i.path === 'budget.segments[0].amount').map((i) => i.ruleId)).toEqual([
      'IO-021',
    ]);
  });
});

describe('ordering and shape', () => {
  it('lists errors, then warnings, then infos, each in form order', () => {
    const campaign = applyPatch(validCampaign(), {
      name: '',
      goal: 'AWARENESS',
      kpi: { type: 'CPA', value: 5 },
      creativeTypes: [],
      keywords: ['1', '2', '3', '4', '5', '6'],
    });
    const got = validate('campaign', campaign, makeCtx());
    expect(got.map((i) => i.severity)).toEqual(
      [...got.map((i) => i.severity)].sort(
        (a, b) => ['error', 'warning', 'info'].indexOf(a) - ['error', 'warning', 'info'].indexOf(b),
      ),
    );
    expect(ids(got).slice(0, 2)).toEqual(['CMP-001', 'CMP-020']);
    const warnings = got.filter((i) => i.severity === 'warning').map((i) => i.path);
    expect(warnings).toEqual(['kpi.type', 'keywords']);
  });

  it('marks only errors as blocking and formats the message', () => {
    const io = applyPatch(validIo(), { name: '' });
    const got = validate(
      'insertionOrder',
      io,
      makeCtx({
        campaign: {
          frequencyCap: { mode: 'LIMITED', maxImpressions: 3, periodCount: 1, period: 'WEEK' },
        },
      }),
    );
    for (const issue of got) expect(issue.blocking).toBe(issue.severity === 'error');
    const info = got.find((i) => i.ruleId === 'IO-061')!;
    expect(info.params).toEqual({ n: 3, period: 'week' });
    expect(info.message).toBe("The campaign's frequency cap is set to 3 exposures per week");
  });

  it('drops infos when asked', () => {
    expect(validate('campaign', validCampaign(), makeCtx(), { includeInfo: false })).toEqual([]);
    expect(ids(validate('campaign', validCampaign(), makeCtx()))).toEqual(['CMP-081', 'CMP-080']);
  });
});

describe('scenario switches', () => {
  it('lets an instructor switch a soft rule off', () => {
    const campaign = applyPatch(validCampaign(), {
      goal: 'AWARENESS',
      kpi: { type: 'CPA', value: 5 },
    });
    expect(ids(validate('campaign', campaign, makeCtx()))).toContain('CMP-013');
    expect(
      ids(validate('campaign', campaign, makeCtx({ disabledRules: ['CMP-013'] }))),
    ).not.toContain('CMP-013');
  });

  it('never switches an error off', () => {
    const campaign = applyPatch(validCampaign(), { name: '' });
    expect(ids(validate('campaign', campaign, makeCtx({ disabledRules: ['CMP-001'] })))).toContain(
      'CMP-001',
    );
  });
});

describe('determinism', () => {
  it('gives the same answer twice and depends on the context clock only', () => {
    const campaign = applyPatch(validCampaign(), { startDate: '2026-10-28' });
    const a = validate('campaign', campaign, makeCtx());
    const b = validate('campaign', campaign, makeCtx());
    expect(a).toEqual(b);
    expect(ids(a)).not.toContain('CMP-034');
    const later = makeCtx({ now: new Date(NOW.getTime() + 2 * 86_400_000) });
    expect(ids(validate('campaign', campaign, later))).toContain('CMP-034');
  });

  it('uses the advertiser time zone for "today"', () => {
    const lateEvening = new Date('2026-10-27T20:00:00Z'); // 01:30 on the 28th in Kolkata, 13:00 on the 27th in Los Angeles
    const campaign = applyPatch(validCampaign(), { startDate: '2026-10-27' });
    expect(ids(validate('campaign', campaign, makeCtx({ now: lateEvening })))).toContain('CMP-034');
    expect(
      ids(
        validate(
          'campaign',
          campaign,
          makeCtx({ now: lateEvening, advertiser: { timeZone: 'America/Los_Angeles' } }),
        ),
      ),
    ).not.toContain('CMP-034');
  });
});

describe('validateAll', () => {
  it('concatenates the issues of several entities', () => {
    const got = validateAll(
      [
        { kind: 'campaign', entity: applyPatch(validCampaign(), { name: '' }) },
        { kind: 'insertionOrder', entity: applyPatch(validIo(), { name: '' }) },
      ],
      makeCtx(),
      { includeInfo: false },
    );
    expect(ids(got)).toEqual(['CMP-001', 'IO-010']);
  });
});
