// V-09-06 to V-09-09 and V-09-14, V-09-15: rule cases of LI-YT, AG and AD (module 09 6.3).
import { describe, expect, it } from 'vitest';
import { validate } from '@/lib/validation';
import { mergeUrl } from '@/lib/validation/constants/youtube';
import { applyPatch, inr } from '@/lib/validation/testing/fixtures';
import { validAd, validAdGroup, ytCtx, ytLineItem } from './helpers';

const ids = (issues: { ruleId: string; severity: string }[]) => issues.map((i) => i.ruleId);
const errors = (issues: { ruleId: string; blocking: boolean }[]) =>
  issues.filter((i) => i.blocking).map((i) => i.ruleId);

describe('LI-YT (V-09-06)', () => {
  it('a valid Efficient reach line item has no errors', () => {
    expect(errors(validate('lineItem', ytLineItem(), ytCtx()))).toEqual([]);
  });
  it.each([
    'NON_SKIPPABLE_REACH',
    'TARGET_FREQUENCY',
    'TARGET_FREQUENCY_IN_STREAM',
    'TRUEVIEW_VIEWS',
    'AD_SEQUENCE',
    'AUDIO_REACH',
  ] as const)('a valid %s line item has no errors', (s) => {
    expect(errors(validate('lineItem', ytLineItem(s), ytCtx()))).toEqual([]);
  });

  it('LI-YT-005: all ad formats unticked', () => {
    const li = applyPatch(ytLineItem(), {
      youtube: { adFormats: { inStream: false, inFeed: false, shorts: false } },
    });
    expect(errors(validate('lineItem', li, ytCtx()))).toContain('LI-YT-005');
  });
  it('LI-YT-005 does not apply to non-skippable reach', () => {
    const li = applyPatch(ytLineItem('NON_SKIPPABLE_REACH'), {
      youtube: { adFormats: { inStream: false, inFeed: false, shorts: false } },
    });
    expect(ids(validate('lineItem', li, ytCtx()))).not.toContain('LI-YT-005');
  });
  it('LI-YT-006 and 007: daily amount empty, zero', () => {
    const empty = applyPatch(ytLineItem(), { pacing: { dailyAmount: null } });
    expect(errors(validate('lineItem', empty, ytCtx()))).toContain('LI-YT-006');
    const zero = applyPatch(ytLineItem(), { pacing: { dailyAmount: 0 } });
    // LI-036 says the same on the same path, so the engine keeps the lower id
    const issue = validate('lineItem', zero, ytCtx()).find((i) => i.path === 'pacing.dailyAmount');
    expect(issue?.message).toBe('Enter a number greater than 0');
  });
  it('LI-YT-006: flight budget needs an amount', () => {
    const li = applyPatch(ytLineItem(), { pacing: { period: 'FLIGHT', dailyAmount: undefined } });
    expect(errors(validate('lineItem', li, ytCtx()))).toContain('LI-YT-006');
    const ok = applyPatch(li, { budget: { mode: 'AMOUNT', amount: inr(5000) } });
    expect(errors(validate('lineItem', ok, ytCtx()))).toEqual([]);
  });
  it('LI-YT-009 locks the bid strategy; LI-042 is suppressed', () => {
    const li = applyPatch(ytLineItem(), { bid: { optimizedTowards: 'TARGET_CPM' } });
    const out = errors(validate('lineItem', li, ytCtx()));
    expect(out).toContain('LI-YT-009');
    expect(out).not.toContain('LI-042');
  });
  it('LI-YT-011: view cap limited without a value', () => {
    const li = applyPatch(ytLineItem(), {
      youtube: { viewCap: { mode: 'LIMITED', maxImpressions: null } },
    });
    expect(errors(validate('lineItem', li, ytCtx()))).toContain('LI-YT-011');
  });
  it('LI-YT-012: target frequency needs an exposure target', () => {
    const li = applyPatch(ytLineItem('TARGET_FREQUENCY'), { youtube: { targetFrequency: null } });
    expect(errors(validate('lineItem', li, ytCtx()))).toContain('LI-YT-012');
  });
  it('LI-YT-013: product feed without a Merchant Center account', () => {
    const li = applyPatch(ytLineItem(), { youtube: { productFeed: true } });
    expect(errors(validate('lineItem', li, ytCtx()))).toContain('LI-YT-013');
    expect(
      errors(validate('lineItem', li, ytCtx({ advertiser: { merchantCenterLinked: true } }))),
    ).toEqual([]);
  });
  it('LI-YT-017: no inventory source left', () => {
    const li = applyPatch(ytLineItem(), { youtube: { inventorySources: [] } });
    expect(errors(validate('lineItem', li, ytCtx()))).toContain('LI-YT-017');
  });
  it('LI-YT-020: ad sequence with fewer than two ads blocks activation only', () => {
    const li = applyPatch(ytLineItem('AD_SEQUENCE'), {
      status: 'ACTIVE',
      youtube: { sequenceSteps: 1 },
    });
    const ctx = ytCtx({ mode: 'edit', original: ytLineItem('AD_SEQUENCE') });
    expect(errors(validate('lineItem', li, ctx, { targetStatus: 'ACTIVE' }))).toContain(
      'LI-YT-020',
    );
    expect(errors(validate('lineItem', li, ctx))).not.toContain('LI-YT-020');
  });
  it('LI-YT-021: Google inventory not enabled', () => {
    expect(
      errors(
        validate(
          'lineItem',
          ytLineItem(),
          ytCtx({ advertiser: { googleInventoryEnabled: false } }),
        ),
      ),
    ).toContain('LI-YT-021');
  });
  it('LI-YT-018: activation without an active ad group warns', () => {
    const ctx = ytCtx({
      mode: 'edit',
      original: ytLineItem(),
      children: { adGroups: [{ id: 'g1', status: 'PAUSED', adCount: 1 }] },
    });
    const out = validate('lineItem', applyPatch(ytLineItem(), { status: 'ACTIVE' }), ctx, {
      targetStatus: 'ACTIVE',
    });
    expect(out.find((i) => i.ruleId === 'LI-YT-018')?.blocking).toBe(false);
  });
  it('LI-YT-004: the subtype cannot change after create', () => {
    const ctx = ytCtx({ mode: 'edit', original: ytLineItem('EFFICIENT_REACH') });
    const li = applyPatch(ytLineItem(), { youtube: { subtype: 'TRUEVIEW_VIEWS' } });
    expect(errors(validate('lineItem', li, ctx))).toContain('LI-YT-004');
  });
  it('LI-YT-002 and 003: step 1 choices', () => {
    const li = applyPatch(ytLineItem(), {
      youtube: { optimization: 'REACH', adFormatChoice: 'ALL_FORMATS' },
    });
    expect(errors(validate('lineItem', li, ytCtx()))).toContain('LI-YT-003');
    const none = applyPatch(ytLineItem(), { youtube: { optimization: null } });
    expect(errors(validate('lineItem', none, ytCtx()))).toContain('LI-YT-002');
  });
});

describe('AG (V-09-07)', () => {
  const run = (patch: unknown) => validate('adGroup', applyPatch(validAdGroup(), patch), ytCtx());
  it('a valid ad group has no errors', () => expect(errors(run({}))).toEqual([]));
  it('AG-001 and AG-002', () => {
    expect(errors(run({ name: '' }))).toContain('AG-001');
    expect(errors(run({ name: 'x'.repeat(256) }))).toContain('AG-002');
    expect(errors(run({ name: 'x'.repeat(255) }))).toEqual([]);
  });
  it('AG-003 and AG-004', () => {
    expect(errors(run({ bid: null }))).toContain('AG-003');
    expect(errors(run({ bid: 0 }))).toContain('AG-004');
  });
  it('AG-005: an active ad group without ads warns with the catalogue text', () => {
    const w = run({ adCount: 0 }).find((i) => i.ruleId === 'AG-005');
    expect(w?.blocking).toBe(false);
    expect(w?.message).toBe(
      "This active ad group doesn't have any ads. It won't run until you create ads.",
    );
    expect(ids(run({ adCount: 0, status: 'PAUSED' }))).not.toContain('AG-005');
  });
  it('AG-006: only placements, demographics and audience lists belong to ad groups', () => {
    expect(errors(run({ dimensions: ['GENDER', 'AUDIENCE_LIST', 'CATEGORY'] }))).toEqual([]);
    expect(errors(run({ dimensions: ['GEOGRAPHY'] }))).toContain('AG-006');
  });
});

describe('AD (V-09-08, V-09-09, V-09-15)', () => {
  const run = (patch: unknown, ctx = ytCtx({ advertiser: { businessName: null } })) =>
    validate('ad', applyPatch(validAd(), patch), ctx);
  it('a valid ad has no errors', () => expect(errors(run({}))).toEqual([]));
  it.each([
    ['AD-001', { name: '' }],
    ['AD-002', { name: 'x'.repeat(256) }],
    ['AD-003', { videoRef: '', videoId: null }],
    ['AD-004', { videoRef: 'AAAAAAAAAAA', videoId: 'AAAAAAAAAAA' }],
    ['AD-004', { videoRef: 'AAAAAAAAPRV', videoId: 'AAAAAAAAPRV' }],
    ['AD-005', { headline: 'x'.repeat(31) }],
    ['AD-006', { longHeadline: '' }],
    ['AD-007', { longHeadline: 'x'.repeat(91) }],
    ['AD-008', { description: '' }],
    ['AD-009', { description: 'x'.repeat(91) }],
    ['AD-010', { callToAction: 'x'.repeat(11) }],
    ['AD-011', { businessName: '' }],
    ['AD-012', { businessName: 'x'.repeat(26) }],
    ['AD-014', { logoAssetId: null }],
    ['AD-015', { path1: 'x'.repeat(16) }],
    ['AD-015', { path2: 'x'.repeat(16) }],
    ['AD-016', { landingPageUrl: '' }],
    ['AD-017', { landingPageUrl: 'ftp://x.example' }],
    ['AD-017', { clickTrackerUrl: 'nope' }],
    ['AD-018', { companionMode: 'OWN', companionAssetId: null }],
    ['AD-019', { status: null }],
  ])('%s', (id, patch) => {
    expect(errors(run(patch))).toContain(id);
  });
  it.each([
    ['headline', 30, 31, 'AD-005'],
    ['longHeadline', 90, 91, 'AD-007'],
    ['description', 90, 91, 'AD-009'],
    ['callToAction', 10, 11, 'AD-010'],
    ['businessName', 25, 26, 'AD-012'],
    ['path1', 15, 16, 'AD-015'],
  ])('%s limit %i / %i', (field, ok, over, id) => {
    expect(errors(run({ [field]: 'x'.repeat(ok) }))).not.toContain(id);
    expect(errors(run({ [field]: 'x'.repeat(over) }))).toContain(id);
  });
  it('AD-013: the advertiser default business name cannot be cleared', () => {
    const out = errors(run({ businessName: '' }, ytCtx({ advertiser: { businessName: 'Acme' } })));
    expect(out).toContain('AD-013');
    expect(out).not.toContain('AD-011');
  });
  it('AD-011 and AD-014 apply from 12 Oct 2026', () => {
    const before = ytCtx({
      now: new Date('2026-10-11T06:00:00Z'),
      advertiser: { businessName: null },
    });
    expect(errors(run({ businessName: '', logoAssetId: null }, before))).toEqual([]);
  });
  it('AD-020 is info', () => {
    const i = run({}).find((x) => x.ruleId === 'AD-020');
    expect(i?.severity).toBe('info');
  });
  it('V-09-15: protocol merge then AD-017', () => {
    expect(mergeUrl('https://', 'example.com/a')).toBe('https://example.com/a');
    expect(mergeUrl('http://', 'https://x.example')).toBe('https://x.example');
    expect(mergeUrl('https://', '')).toBe('');
    expect(errors(run({ landingPageUrl: mergeUrl('https://', 'bad host') }))).toContain('AD-017');
    expect(errors(run({ landingPageUrl: mergeUrl('https://', 'good.example') }))).toEqual([]);
  });
});
