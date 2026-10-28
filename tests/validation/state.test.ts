// State machines, effective status and bulk applicability (validation.md 4, 6.7 S-01..S-15, V-06-12, V-07-22).
import { describe, expect, it } from 'vitest';
import {
  applicability,
  canTransition,
  effectiveStatus,
  isApplicable,
  isServing,
  offeredTransitions,
} from '@/lib/validation';
import { TRANSITIONS } from '@/lib/validation/state/transitions';
import type { BulkAction, BulkRow } from '@/lib/validation/state/bulk';
import { readDoc, splitRow } from './docs';

const row = (status: BulkRow['status'], type?: BulkRow['type']): BulkRow =>
  type ? { status, type } : { status };

describe('transitions', () => {
  it('S-01 a draft insertion order cannot be paused', () => {
    expect(canTransition('insertionOrder', 'DRAFT', 'PAUSED', { role: 'STANDARD' })).toEqual({
      ok: false,
      reason: 'NOT_OFFERED',
    });
  });

  it('S-02 a draft insertion order can be activated by a standard user', () => {
    expect(canTransition('insertionOrder', 'DRAFT', 'ACTIVE', { role: 'STANDARD' })).toEqual({
      ok: true,
    });
  });

  it('S-03 a read-only user cannot pause', () => {
    expect(canTransition('insertionOrder', 'ACTIVE', 'PAUSED', { role: 'READ_ONLY' })).toEqual({
      ok: false,
      reason: 'ROLE',
    });
    expect(canTransition('campaign', 'ACTIVE', 'PAUSED', { role: 'REPORTING_ONLY' })).toEqual({
      ok: false,
      reason: 'ROLE',
    });
  });

  it('S-04 an archived campaign cannot go straight to active, but can be unarchived to paused', () => {
    expect(canTransition('campaign', 'ARCHIVED', 'ACTIVE', { role: 'STANDARD' })).toEqual({
      ok: false,
      reason: 'NOT_OFFERED',
    });
    expect(canTransition('campaign', 'ARCHIVED', 'PAUSED', { role: 'STANDARD' })).toEqual({
      ok: true,
    });
  });

  it('S-08 only an admin schedules an advertiser for deletion', () => {
    expect(
      canTransition('advertiser', 'PAUSED', 'SCHEDULED_FOR_DELETION', { role: 'STANDARD' }),
    ).toEqual({ ok: false, reason: 'ROLE' });
    expect(
      canTransition('advertiser', 'PAUSED', 'SCHEDULED_FOR_DELETION', { role: 'ADMIN' }),
    ).toEqual({ ok: true });
    expect(canTransition('advertiser', 'ACTIVE', 'PAUSED', { role: 'STANDARD' })).toEqual({
      ok: true,
    });
  });

  it('create accepts draft or active for IOs and line items, active or paused for campaigns (RC-040)', () => {
    expect(canTransition('insertionOrder', 'CREATE', 'PAUSED', { role: 'STANDARD' }).ok).toBe(
      false,
    );
    expect(canTransition('lineItem', 'CREATE', 'PAUSED', { role: 'STANDARD' }).ok).toBe(false);
    expect(canTransition('insertionOrder', 'CREATE', 'DRAFT', { role: 'STANDARD' }).ok).toBe(true);
    expect(canTransition('campaign', 'CREATE', 'PAUSED', { role: 'STANDARD' }).ok).toBe(true);
    expect(canTransition('campaign', 'CREATE', 'DRAFT', { role: 'STANDARD' }).ok).toBe(false);
  });

  it('IO-091 and LI-111: activating under an archived parent is refused', () => {
    expect(
      canTransition(
        'insertionOrder',
        'PAUSED',
        'ACTIVE',
        { role: 'STANDARD' },
        { campaignArchived: true },
      ),
    ).toEqual({
      ok: false,
      reason: 'PARENT_ARCHIVED',
      ruleId: 'IO-091',
    });
    expect(
      canTransition('lineItem', 'DRAFT', 'ACTIVE', { role: 'STANDARD' }, { ioArchived: true }),
    ).toEqual({
      ok: false,
      reason: 'PARENT_ARCHIVED',
      ruleId: 'LI-111',
    });
    expect(
      canTransition('lineItem', 'ACTIVE', 'PAUSED', { role: 'STANDARD' }, { ioArchived: true }).ok,
    ).toBe(true);
  });

  it('Limited Access greys every status change', () => {
    expect(
      canTransition('campaign', 'ACTIVE', 'PAUSED', { role: 'STANDARD', limitedAccess: true }),
    ).toEqual({
      ok: false,
      reason: 'LIMITED_ACCESS',
    });
  });

  it('offers only legal moves to the status chip', () => {
    expect(offeredTransitions('insertionOrder', 'DRAFT', { role: 'STANDARD' })).toEqual([
      'ACTIVE',
      'ARCHIVED',
    ]);
    expect(offeredTransitions('insertionOrder', 'ACTIVE', { role: 'READ_ONLY' })).toEqual([]);
    expect(offeredTransitions('campaign', 'ARCHIVED', { role: 'ADMIN' })).toEqual(['PAUSED']);
  });

  it('has the same rows for insertion orders and line items except where the document says otherwise', () => {
    expect(TRANSITIONS.lineItem).toEqual(TRANSITIONS.insertionOrder);
  });

  it('never lets a campaign be a draft (4.2)', () => {
    expect(TRANSITIONS.campaign.some((t) => t.to === 'DRAFT' || t.from === 'DRAFT')).toBe(false);
  });

  it('every row of the document state tables is in the data', () => {
    const lines = readDoc('docs/specs/validation.md').split('\n');
    const start = lines.findIndex((l) => l.startsWith('### 4.3 Insertion order'));
    const rows = lines
      .slice(start, start + 14)
      .filter((l) => l.startsWith('| `'))
      .map(splitRow);
    expect(rows.length).toBeGreaterThanOrEqual(7);
    for (const r of rows) {
      const from = r[0]!
        .replace(/`/g, '')
        .split(',')
        .map((s) => s.trim());
      const to = r[1]!
        .replace(/`/g, '')
        .replace(/ \(derived\)/, '')
        .trim();
      if (to === 'COMPLETED') continue; // derived, never stored
      for (const f of from) {
        const known = TRANSITIONS.insertionOrder.some((t) => t.from === f && t.to === to);
        const notOffered = r[2]!.includes('not offered');
        expect(known, `${f} -> ${to}`).toBe(!notOffered);
      }
    }
  });
});

describe('effective status and serving', () => {
  it('S-15 an active IO whose last segment ended yesterday is completed', () => {
    expect(effectiveStatus({ status: 'ACTIVE', flightEnd: '2026-10-27' }, '2026-10-28')).toBe(
      'COMPLETED',
    );
    expect(effectiveStatus({ status: 'ACTIVE', flightEnd: '2026-10-28' }, '2026-10-28')).toBe(
      'ACTIVE',
    );
    expect(effectiveStatus({ status: 'PAUSED', flightEnd: '2026-10-01' }, '2026-10-28')).toBe(
      'PAUSED',
    );
    expect(effectiveStatus({ status: 'ACTIVE', flightEnd: null }, '2026-10-28')).toBe('ACTIVE');
  });

  const chain = {
    advertiserActive: true,
    campaignStatus: 'ACTIVE',
    ioStatus: 'ACTIVE',
    liStatus: 'ACTIVE',
    flight: { start: '2026-10-01', end: '2026-10-31' },
    budgetRemaining: true,
    servableCreativeOrAd: true,
  } as const;

  it('S-14 a line item under a paused IO does not serve, and keeps its own status', () => {
    expect(isServing(chain, '2026-10-28')).toBe(true);
    const paused = { ...chain, ioStatus: 'PAUSED' } as const;
    expect(isServing(paused, '2026-10-28')).toBe(false);
    expect(paused.liStatus).toBe('ACTIVE');
  });

  it.each([
    ['advertiser paused', { advertiserActive: false }],
    ['campaign paused', { campaignStatus: 'PAUSED' }],
    ['line item paused', { liStatus: 'PAUSED' }],
    ['before the flight', { flight: { start: '2026-11-01', end: null } }],
    ['after the flight', { flight: { start: null, end: '2026-10-27' } }],
    ['budget spent', { budgetRemaining: false }],
    ['no servable creative', { servableCreativeOrAd: false }],
  ])('does not serve when %s', (_name, patch) => {
    expect(isServing({ ...chain, ...patch } as never, '2026-10-28')).toBe(false);
  });
});

describe('bulk applicability (4.10)', () => {
  it('S-09 V-06-12 activate on rows that are all active is not applicable', () => {
    expect(isApplicable('ACTIVATE', [row('ACTIVE'), row('ACTIVE')])).toBe(false);
    expect(isApplicable('ACTIVATE', [row('ACTIVE'), row('PAUSED')])).toBe(true);
  });

  it('S-10 mixed selections are applicable, with the skipped rows counted', () => {
    expect(applicability('ACTIVATE', [row('ACTIVE'), row('PAUSED'), row('DRAFT')])).toEqual({
      applicable: true,
      eligible: 2,
      skipped: 1,
    });
  });

  it('S-11 pause on a draft is not applicable', () => {
    expect(isApplicable('PAUSE', [row('DRAFT')])).toBe(false);
  });

  it('S-12 archive on archived rows is not applicable', () => {
    expect(isApplicable('ARCHIVE', [row('ARCHIVED')])).toBe(false);
  });

  it('S-13 limited access disables bulk edit settings but not the SDF download', () => {
    const actor = { role: 'STANDARD', limitedAccess: true } as const;
    expect(isApplicable('EDIT_SETTINGS', [row('ACTIVE')], actor)).toBe(false);
    expect(isApplicable('SDF_DOWNLOAD', [row('ACTIVE')], actor)).toBe(true);
    expect(isApplicable('EDIT_SETTINGS', [row('ACTIVE')], { role: 'READ_ONLY' })).toBe(false);
    expect(isApplicable('SDF_DOWNLOAD', [row('ARCHIVED')], { role: 'READ_ONLY' })).toBe(true);
  });

  // V-07-22: the table for the IO grid
  const statuses = ['DRAFT', 'ACTIVE', 'PAUSED', 'ARCHIVED'] as const;
  const expected: Record<BulkAction, Record<(typeof statuses)[number], boolean>> = {
    ACTIVATE: { DRAFT: true, ACTIVE: false, PAUSED: true, ARCHIVED: false },
    PAUSE: { DRAFT: false, ACTIVE: true, PAUSED: false, ARCHIVED: false },
    ARCHIVE: { DRAFT: true, ACTIVE: true, PAUSED: true, ARCHIVED: false },
    DUPLICATE: { DRAFT: true, ACTIVE: true, PAUSED: true, ARCHIVED: true },
    EDIT_SETTINGS: { DRAFT: true, ACTIVE: true, PAUSED: true, ARCHIVED: false },
    SDF_DOWNLOAD: { DRAFT: true, ACTIVE: true, PAUSED: true, ARCHIVED: true },
    SDF_UPLOAD: { DRAFT: true, ACTIVE: true, PAUSED: true, ARCHIVED: true },
    EDIT_CREATIVE_ASSIGNMENT: { DRAFT: true, ACTIVE: true, PAUSED: true, ARCHIVED: false },
    APPLY_TEMPLATE: { DRAFT: false, ACTIVE: false, PAUSED: false, ARCHIVED: false },
    EDIT_TARGETING: { DRAFT: false, ACTIVE: false, PAUSED: false, ARCHIVED: false },
  };
  const ioGridActions: BulkAction[] = [
    'ACTIVATE',
    'PAUSE',
    'ARCHIVE',
    'DUPLICATE',
    'EDIT_SETTINGS',
    'SDF_DOWNLOAD',
    'SDF_UPLOAD',
    'EDIT_CREATIVE_ASSIGNMENT',
  ];

  it.each(ioGridActions.flatMap((a) => statuses.map((s) => [a, s] as const)))(
    'V-07-22 IO grid %s on a %s row',
    (action, status) => {
      expect(
        isApplicable(action, [row(status)], { role: 'STANDARD' }, { entity: 'insertionOrder' }),
      ).toBe(expected[action][status]);
    },
  );

  it('the campaign grid offers no template, settings or targeting edits', () => {
    for (const action of [
      'APPLY_TEMPLATE',
      'EDIT_SETTINGS',
      'EDIT_TARGETING',
      'EDIT_CREATIVE_ASSIGNMENT',
    ] as const) {
      expect(
        isApplicable(
          action,
          [row('ACTIVE', 'DISPLAY')],
          { role: 'STANDARD' },
          { entity: 'campaign' },
        ),
        action,
      ).toBe(false);
    }
  });

  it('apply template needs line items of the template type', () => {
    const rows = [row('ACTIVE', 'DISPLAY'), row('ACTIVE', 'VIDEO'), row('ARCHIVED', 'DISPLAY')];
    expect(
      applicability('APPLY_TEMPLATE', rows, { role: 'STANDARD' }, { templateType: 'DISPLAY' }),
    ).toEqual({ applicable: true, eligible: 1, skipped: 2 });
    expect(
      isApplicable(
        'APPLY_TEMPLATE',
        [row('ACTIVE', 'AUDIO')],
        { role: 'STANDARD' },
        { templateType: 'DISPLAY' },
      ),
    ).toBe(false);
  });

  it('targeting edits need a line item type that has the dimension (MX-10)', () => {
    const rows = [row('ACTIVE', 'AUDIO'), row('ACTIVE', 'DISPLAY')];
    expect(
      applicability('EDIT_TARGETING', rows, { role: 'STANDARD' }, { dimension: 'VIEWABILITY' }),
    ).toEqual({ applicable: true, eligible: 1, skipped: 1 });
    expect(
      isApplicable(
        'EDIT_TARGETING',
        [row('ACTIVE', 'AUDIO')],
        { role: 'STANDARD' },
        { dimension: 'VIEWABILITY' },
      ),
    ).toBe(false);
  });

  it('creative assignment skips YouTube and Demand Gen line items', () => {
    expect(
      isApplicable('EDIT_CREATIVE_ASSIGNMENT', [
        row('ACTIVE', 'YT_VIDEO'),
        row('ACTIVE', 'DEMAND_GEN'),
      ]),
    ).toBe(false);
    expect(
      isApplicable('EDIT_CREATIVE_ASSIGNMENT', [row('ACTIVE', 'YT_VIDEO'), row('ACTIVE', 'CTV')]),
    ).toBe(true);
  });

  it('an empty selection is never applicable', () => {
    expect(isApplicable('ACTIVATE', [])).toBe(false);
  });
});
