import { describe, expect, it } from 'vitest';
import {
  checkDealAction,
  dealActionsFor,
  DEAL_TRANSITIONS,
  effectiveDealStatus,
  type DealAction,
  type DealStatusKey,
} from '@/lib/inventory/transitions';

const ok = { allowPausing: true, canWriteAll: true };

describe('validation 4.7 deal transitions', () => {
  const allowed: [DealStatusKey, DealAction, DealStatusKey][] = [
    ['DRAFT', 'ACTIVATE', 'ACTIVE'],
    ['ACTIVE', 'PAUSE', 'PAUSED'],
    ['PAUSED', 'ACTIVATE', 'ACTIVE'],
    ['ACTIVE', 'ARCHIVE', 'ARCHIVED'],
    ['PAUSED', 'ARCHIVE', 'ARCHIVED'],
    ['ARCHIVED', 'UNARCHIVE', 'PAUSED'],
  ];
  it.each(allowed)('%s + %s -> %s', (from, action, to) => {
    expect(checkDealAction(from, action, ok)).toEqual({ ok: true, to });
  });

  const forbidden: [DealStatusKey, DealAction][] = [
    ['DRAFT', 'PAUSE'],
    ['DRAFT', 'ARCHIVE'],
    ['ARCHIVED', 'ACTIVATE'],
    ['COMPLETED', 'ACTIVATE'],
    ['COMPLETED', 'ARCHIVE'],
    ['NOT_SERVABLE', 'PAUSE'],
    ['NOT_SERVABLE', 'ACTIVATE'],
    ['ACTIVE', 'ACTIVATE'],
    ['ACTIVE', 'UNARCHIVE'],
  ];
  it.each(forbidden)('%s + %s is INV-013', (from, action) => {
    const r = checkDealAction(from, action, ok);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.ruleId).toBe('INV-013');
  });

  it('pausing needs Allow pausing (INV-014)', () => {
    const r = checkDealAction('ACTIVE', 'PAUSE', { allowPausing: false, canWriteAll: true });
    expect(r).toMatchObject({ ok: false, ruleId: 'INV-014' });
  });

  it('a user without write access to all advertisers is refused first (INV-010)', () => {
    const r = checkDealAction('DRAFT', 'ACTIVATE', { allowPausing: true, canWriteAll: false });
    expect(r).toMatchObject({ ok: false, ruleId: 'INV-010' });
  });

  it('system-only rows never come from a user action', () => {
    for (const t of DEAL_TRANSITIONS.filter((t) => t.actor === 'SYSTEM'))
      expect(t.action).toBeNull();
    expect(dealActionsFor('ACTIVE')).toEqual(['PAUSE', 'ARCHIVE']);
    expect(dealActionsFor('COMPLETED')).toEqual([]);
  });

  it('derives COMPLETED and NOT_SERVABLE from a stored ACTIVE deal', () => {
    const now = new Date('2026-06-15T00:00:00Z');
    const base = {
      status: 'ACTIVE',
      endAt: new Date('2026-07-01T00:00:00Z'),
      exchangeEnabled: true,
    };
    expect(effectiveDealStatus(base, now)).toBe('ACTIVE');
    expect(effectiveDealStatus({ ...base, endAt: new Date('2026-06-01T00:00:00Z') }, now)).toBe(
      'COMPLETED',
    );
    expect(effectiveDealStatus({ ...base, exchangeEnabled: false }, now)).toBe('NOT_SERVABLE');
    expect(
      effectiveDealStatus(
        { ...base, commitment: 'GUARANTEED', quantityImpressions: 100, deliveredImpressions: 100 },
        now,
      ),
    ).toBe('COMPLETED');
    expect(effectiveDealStatus({ ...base, status: 'PAUSED', exchangeEnabled: false }, now)).toBe(
      'PAUSED',
    );
  });
});
