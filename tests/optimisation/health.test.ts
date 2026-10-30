// V-11-18..20 (pure part): Intelligence row text, order, drawer rows and the seven-day dismissal (module 01 4.8, 11 4.9).
import { describe, expect, it } from 'vitest';
import { SUGGESTIONS, SUGGESTION_ORDER } from '@/lib/optimisation/catalog';
import { explainConflicts } from '@/lib/optimisation/conflicts';
import {
  alertText,
  dismissalOver,
  healthRows,
  suggestionRows,
  type AlertFacts,
  type SuggestionFacts,
} from '@/lib/optimisation/health';

const ids = { partnerId: '1', advertiserId: '2' };
const alert = (o: Partial<AlertFacts>): AlertFacts => ({
  id: 'a',
  type: 'NO_SPEND',
  diagnosticCode: 'NO_SPEND_LI',
  severity: 'NEEDS_ATTENTION',
  title: 't',
  lineItemId: null,
  ioId: null,
  campaignId: null,
  ...o,
});

describe('alertText', () => {
  it('is plural aware', () => {
    expect(alertText('NO_SPEND_LI', 1, '')).toBe(
      "1 line item hasn't spent anything today or yesterday",
    );
    expect(alertText('NO_SPEND_LI', 3, '')).toBe(
      "3 line items haven't spent anything today or yesterday",
    );
    expect(alertText('UNDERPACING_IO', 2, '')).toBe('2 insertion orders are underpacing');
    expect(alertText('CONFLICT_IO', 1, '')).toBe(
      '1 insertion order has conflicting settings which may prevent your budget from being spent',
    );
    expect(alertText('CREATIVE_REJECTED', 4, '')).toBe('4 creatives rejected');
    expect(alertText('SPEND_THRESHOLD', 1, 'kept title')).toBe('kept title');
  });
});

describe('healthRows', () => {
  it('groups by engine code, errors first, then by count (V-11-20)', () => {
    const rows = healthRows(
      [
        alert({ id: '1', diagnosticCode: 'NO_SPEND_LI' }),
        alert({ id: '2', diagnosticCode: 'NO_SPEND_LI' }),
        alert({
          id: '3',
          type: 'REJECTED_CREATIVE',
          diagnosticCode: 'CREATIVE_REJECTED',
          severity: 'CRITICAL',
        }),
        alert({ id: '4', type: 'UNDERPACING', diagnosticCode: 'UNDERPACING_IO', ioId: 'io1' }),
      ],
      ids,
    );
    expect(rows.map((r) => [r.id, r.severity])).toEqual([
      ['CREATIVE_REJECTED', 'error'],
      ['NO_SPEND_LI', 'warning'],
      ['UNDERPACING_IO', 'warning'],
    ]);
    expect(rows[1]!.text).toBe("2 line items haven't spent anything today or yesterday");
  });

  it('builds the Investigate routes of the table in 4.8', () => {
    const [li, hist, pace] = healthRows(
      [
        alert({ id: '1' }),
        alert({ id: '2', type: 'UNDERPACING', diagnosticCode: 'UNDERPACING_IO' }),
        alert({
          id: '3',
          type: 'EXCEEDED_SPEND_THRESHOLD',
          diagnosticCode: 'SPEND_THRESHOLD',
          severity: 'CRITICAL',
        }),
      ],
      ids,
    ).sort((a, b) => a.id.localeCompare(b.id));
    expect(li!.investigateHref).toBe('/p/1/a/2/explorerlis?f.alert=NO_SPEND');
    expect(pace!.investigateHref).toBe('/p/1/a/2/explorerios?f.alert=UNDERPACING&cv=pacing');
    expect(hist!.investigateHref).toBe('/p/1/a/2/history');
  });

  it('opens the drawer for a single conflicting-settings entity only', () => {
    const one = healthRows(
      [alert({ type: 'CONFLICTING_SETTINGS', diagnosticCode: 'CONFLICT_LI', lineItemId: 'li1' })],
      ids,
    );
    expect(one[0]!.drawer).toEqual({ scope: 'li', id: 'li1' });
    const two = healthRows(
      [
        alert({ id: '1', type: 'CONFLICTING_SETTINGS', diagnosticCode: 'CONFLICT_IO', ioId: 'a' }),
        alert({ id: '2', type: 'CONFLICTING_SETTINGS', diagnosticCode: 'CONFLICT_IO', ioId: 'b' }),
      ],
      ids,
    );
    expect(two[0]!.drawer).toBeUndefined();
  });
});

describe('suggestionRows', () => {
  const paths = { io: (id: string) => `/io/${id}`, li: (id: string) => `/li/${id}` };
  const s = (o: Partial<SuggestionFacts>): SuggestionFacts => ({
    id: 'r',
    type: 'RAISE_BID',
    scopeType: 'LINE_ITEM',
    scopeId: 'l1',
    title: '',
    status: 'OPEN',
    updatedAt: new Date('2026-01-01T00:00:00Z'),
    ...o,
  });
  const now = new Date('2026-01-03T00:00:00Z');

  it('orders by the catalogue order and links Investigate (V-11-20)', () => {
    const rows = suggestionRows(
      [
        s({ id: '1', type: 'BID_LEARNING' }),
        s({ id: '2', type: 'ENABLE_AUTO_BUDGET_ALLOCATION', scopeType: 'IO', scopeId: 'io1' }),
        s({ id: '3', type: 'RAISE_BID' }),
      ],
      paths,
      now,
    );
    expect(rows.map((r) => r.type)).toEqual([
      'RAISE_BID',
      'ENABLE_AUTO_BUDGET_ALLOCATION',
      'BID_LEARNING',
    ]);
    expect(rows[0]!.investigateHref).toBe('/li/l1/troubleshooter');
    expect(rows[1]).toMatchObject({
      applicable: true,
      dismissable: true,
      investigateHref: '/io/io1/details',
    });
    expect(rows[2]).toMatchObject({ applicable: false, dismissable: false });
  });

  it('hides a dismissed row for seven sim days', () => {
    const d = s({ status: 'DISMISSED', updatedAt: new Date('2026-01-01T00:00:00Z') });
    expect(suggestionRows([d], paths, new Date('2026-01-07T23:00:00Z'))).toEqual([]);
    expect(suggestionRows([d], paths, new Date('2026-01-08T00:00:00Z'))).toHaveLength(1);
    expect(dismissalOver(new Date('2026-01-01T00:00:00Z'), new Date('2026-01-08T00:00:00Z'))).toBe(
      true,
    );
  });

  it('skips applied rows and rows whose entity is gone', () => {
    expect(suggestionRows([s({ status: 'APPLIED' })], paths, now)).toEqual([]);
    expect(suggestionRows([s({})], { io: () => null, li: () => null }, now)).toEqual([]);
  });
});

describe('catalogue', () => {
  it('has exactly three Apply types and one non-dismissable row (4.9)', () => {
    const types = Object.keys(SUGGESTIONS) as (keyof typeof SUGGESTIONS)[];
    expect(types.filter((t) => SUGGESTIONS[t].applicable).sort()).toEqual([
      'ENABLE_AUTOMATED_BID_BUDGET_IO',
      'ENABLE_AUTO_BUDGET_ALLOCATION',
      'USE_OPTIMIZED_TARGETING',
    ]);
    expect(types.filter((t) => !SUGGESTIONS[t].dismissable)).toEqual(['BID_LEARNING']);
    expect([...SUGGESTION_ORDER].sort()).toEqual([...types].sort());
  });
  it('explains conflict codes with a fix link', () => {
    const [a, b] = explainConflicts(['CONF.LI_BUDGETS_BELOW_IO', 'CONF.UNKNOWN']);
    expect(a!.text).toMatch(/less than the insertion order budget/);
    expect(b!.fix.sub).toBe('details');
  });
});
