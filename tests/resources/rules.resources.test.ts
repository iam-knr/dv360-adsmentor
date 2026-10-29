// CH, KW, LOC and FL rule tables with valid and invalid fixtures (validation.md 2.21, module 15 4).
import { describe, expect, it } from 'vitest';
import { MSG, validate } from '@/lib/validation';
import type { EntityKind } from '@/lib/validation';
import { RESOURCE_LIMITS } from '@/lib/resources/limits';
import {
  resourceCtx,
  validChannel,
  validConversion,
  validGroup,
  validKeywordList,
  validLocationList,
} from './fixtures';

const ids = (kind: EntityKind, entity: unknown, ctx = resourceCtx()) =>
  validate(kind, entity, ctx, { includeInfo: true });
const has = (issues: ReturnType<typeof ids>, id: string) => issues.filter((i) => i.ruleId === id);

describe('valid fixtures', () => {
  it.each([
    ['channel', validChannel()],
    ['keywordList', validKeywordList()],
    ['locationList', validLocationList()],
    ['floodlightGroup', validGroup()],
    ['floodlightConversion', validConversion()],
  ] as const)('%s has no blocking issue', (kind, entity) => {
    expect(ids(kind, entity).filter((i) => i.blocking)).toEqual([]);
  });
});

describe('channel (CH)', () => {
  it('CH-001 empty name and CH-002 longer than 255', () => {
    expect(has(ids('channel', { ...validChannel(), name: ' ' }), 'CH-001')[0]?.message).toBe(
      MSG.ENTER_VALUE,
    );
    expect(
      has(ids('channel', { ...validChannel(), name: 'x'.repeat(256) }), 'CH-002'),
    ).toHaveLength(1);
  });

  it('CH-003 names the invalid line', () => {
    const issues = has(
      ids('channel', { ...validChannel(), sites: ['ok.example.com', '', 'not a url'] }),
      'CH-003',
    );
    expect(issues).toHaveLength(1);
    expect(issues[0]?.path).toBe('sites[2]');
    expect(issues[0]?.message).toBe('Enter a valid URL or app ID.');
  });

  it('CH-004 fails at 10,001 entries and passes at 10,000', () => {
    const make = (n: number) => Array.from({ length: n }, (_, i) => `site${i}.example.com`);
    expect(has(ids('channel', { ...validChannel(), sites: make(10_000) }), 'CH-004')).toHaveLength(
      0,
    );
    expect(has(ids('channel', { ...validChannel(), sites: make(10_001) }), 'CH-004')).toHaveLength(
      1,
    );
  });

  it('CH-008 warns with the line item count', () => {
    const w = has(ids('channel', { ...validChannel(), usedByLineItems: 3 }), 'CH-008')[0];
    expect(w?.severity).toBe('warning');
    expect(w?.message).toBe('3 line items use this channel.');
  });
});

describe('negative keyword list (KW)', () => {
  it('KW-001 empty name', () => {
    expect(has(ids('keywordList', { ...validKeywordList(), name: '' }), 'KW-001')).toHaveLength(1);
  });

  it('KW-002 5,001 keywords fail with the NEG_KW_LIMIT text; separators both count', () => {
    const many = (n: number, sep: string) => [
      Array.from({ length: n }, (_, i) => `kw${i}`).join(sep),
    ];
    expect(
      has(ids('keywordList', { ...validKeywordList(), keywords: many(5001, ',') }), 'KW-002')[0]
        ?.message,
    ).toBe(MSG.NEG_KW_LIMIT);
    expect(
      has(ids('keywordList', { ...validKeywordList(), keywords: many(5001, '\n') }), 'KW-002'),
    ).toHaveLength(1);
    expect(
      has(ids('keywordList', { ...validKeywordList(), keywords: many(5000, ',') }), 'KW-002'),
    ).toHaveLength(0);
  });

  it('KW-002 counts after de-duplication', () => {
    const dup = ['a\nA\na'.repeat(3000)];
    expect(
      has(ids('keywordList', { ...validKeywordList(), keywords: dup }), 'KW-002'),
    ).toHaveLength(0);
  });

  it('KW-004 flags a keyword over 80 characters', () => {
    const issues = has(
      ids('keywordList', { ...validKeywordList(), keywords: ['ok\n' + 'y'.repeat(81)] }),
      'KW-004',
    );
    expect(issues[0]?.path).toBe('keywords[1]');
  });

  it('KW-005 warns when the list is in use', () => {
    expect(
      has(ids('keywordList', { ...validKeywordList(), usedByLineItems: 2 }), 'KW-005')[0]?.message,
    ).toBe('2 line items use this list.');
  });
});

describe('location list (LOC)', () => {
  it('LOC-001 name, LOC-003 zero entries', () => {
    expect(has(ids('locationList', { ...validLocationList(), name: '' }), 'LOC-001')).toHaveLength(
      1,
    );
    expect(
      has(ids('locationList', { ...validLocationList(), entries: [] }), 'LOC-003'),
    ).toHaveLength(1);
  });

  it('LOC-002 type is required and locked on edit', () => {
    expect(
      has(ids('locationList', { ...validLocationList(), type: null }), 'LOC-002'),
    ).toHaveLength(1);
    const edit = resourceCtx({ mode: 'edit' });
    expect(
      has(
        ids(
          'locationList',
          { ...validLocationList(), type: 'PROXIMITY', storedType: 'REGIONAL' },
          edit,
        ),
        'LOC-002',
      ),
    ).toHaveLength(1);
    expect(
      has(ids('locationList', { ...validLocationList(), storedType: 'REGIONAL' }, edit), 'LOC-002'),
    ).toHaveLength(0);
  });

  it('LOC-004 reports the line number and the kind', () => {
    const issues = has(
      ids('locationList', { ...validLocationList(), entries: ['560001', '??'] }),
      'LOC-004',
    );
    expect(issues[0]?.message).toBe("Line 2 isn't a valid postal code or DMA region.");
    const prox = has(
      ids('locationList', { ...validLocationList(), type: 'PROXIMITY', entries: ['nowhere'] }),
      'LOC-004',
    );
    expect(prox[0]?.message).toBe("Line 1 isn't a valid street address or lat,long pair.");
  });

  it('LOC-005 caps a list at 5,000 entries', () => {
    const entries = (n: number) => Array.from({ length: n }, (_, i) => String(100000 + i));
    expect(
      has(ids('locationList', { ...validLocationList(), entries: entries(5001) }), 'LOC-005')[0]
        ?.message,
    ).toBe('Use 5,000 locations or fewer.');
    expect(RESOURCE_LIMITS.LOCATION_ENTRIES_MAX).toBe(5000);
  });
});

describe('Floodlight group (FL-001, FL-02x)', () => {
  it('FL-001 empty name', () => {
    expect(has(ids('floodlightGroup', { ...validGroup(), name: '' }), 'FL-001')).toHaveLength(1);
  });

  it.each([0, 91, 1.5, 'abc'])('FL-020 rejects a click window of %s', (v) => {
    expect(has(ids('floodlightGroup', { ...validGroup(), clickDays: v }), 'FL-020')).toHaveLength(
      1,
    );
  });

  it.each([1, 30, 90])('FL-020 accepts %s days', (v) => {
    expect(
      has(ids('floodlightGroup', { ...validGroup(), impressionDays: v }), 'FL-020'),
    ).toHaveLength(0);
  });

  it.each([-1, 101])('FL-021 rejects %s %', (v) => {
    expect(
      has(ids('floodlightGroup', { ...validGroup(), viewableImpressionPct: v }), 'FL-021')[0]
        ?.message,
    ).toBe(MSG.PCT_RANGE);
  });

  it.each([['u0'], ['u101'], ['x1'], ['u01']])('FL-022 rejects variable %s', (key) => {
    expect(
      has(ids('floodlightGroup', { ...validGroup(), variableKeys: [key] }), 'FL-022'),
    ).toHaveLength(1);
  });
});

describe('Floodlight conversion (FL-01x, FL-03x)', () => {
  it('FL-010..013 and FL-017 need a selection or a value', () => {
    const issues = ids('floodlightConversion', {
      ...validConversion(),
      platform: null,
      format: null,
      type: null,
      status: null,
      name: '',
    });
    for (const id of ['FL-010', 'FL-011', 'FL-012', 'FL-013', 'FL-017'])
      expect(has(issues, id)).toHaveLength(1);
  });

  it('FL-014 Counter + Transactions and Sale + Standard fail, Counter + Standard passes', () => {
    expect(
      has(
        ids(
          'floodlightConversion',
          validConversion({ type: 'COUNTER', countingMethod: 'TRANSACTIONS' }),
        ),
        'FL-014',
      ),
    ).toHaveLength(1);
    expect(
      has(
        ids('floodlightConversion', validConversion({ type: 'SALE', countingMethod: 'STANDARD' })),
        'FL-014',
      ),
    ).toHaveLength(1);
    expect(has(ids('floodlightConversion', validConversion()), 'FL-014')).toHaveLength(0);
  });

  it('FL-015 value-based bidding needs Floodlight optimization on the advertiser', () => {
    const off = resourceCtx({
      advertiser: { ...resourceCtx().advertiser, demandGenFloodlightOptimization: false },
    });
    expect(
      has(ids('floodlightConversion', validConversion({ valueBasedBidding: true }), off), 'FL-015'),
    ).toHaveLength(1);
    expect(
      has(ids('floodlightConversion', validConversion({ valueBasedBidding: true })), 'FL-015'),
    ).toHaveLength(0);
  });

  it('FL-016 remarketing note is info', () => {
    const i = has(ids('floodlightConversion', validConversion({ remarketing: true })), 'FL-016')[0];
    expect(i?.severity).toBe('info');
    expect(i?.message).toBe('The first-party list can take up to an hour to fill.');
  });

  it('FL-030 and FL-031 need an app and an event name for Mobile app and Connected TV', () => {
    const app = ids(
      'floodlightConversion',
      validConversion({ platform: 'MOBILE_APP', appId: null }),
    );
    expect(has(app, 'FL-030')[0]?.message).toBe('Select an app');
    expect(has(app, 'FL-031')).toHaveLength(1);
    const ctv = ids(
      'floodlightConversion',
      validConversion({ platform: 'CONNECTED_TV', ctvAppId: null }),
    );
    expect(has(ctv, 'FL-030')[0]?.path).toBe('ctvAppId');
    const ok = ids(
      'floodlightConversion',
      validConversion({
        platform: 'MOBILE_APP',
        appId: 'com.example.app.one',
        conversionEventName: 'first_open',
      }),
    );
    expect(has(ok, 'FL-030')).toHaveLength(0);
    expect(has(ok, 'FL-031')).toHaveLength(0);
    expect(has(ids('floodlightConversion', validConversion()), 'FL-030')).toHaveLength(0);
  });

  it('FL-033 warns when archiving a conversion that line items count', () => {
    const w = has(
      ids('floodlightConversion', validConversion({ status: 'ARCHIVED', usedByLineItems: 4 })),
      'FL-033',
    )[0];
    expect(w?.message).toBe('4 line items count this conversion.');
    expect(w?.severity).toBe('warning');
  });
});
