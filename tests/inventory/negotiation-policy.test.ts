import { describe, expect, it } from 'vitest';
import {
  advanceNegotiation,
  decideSellerReply,
  parsePolicy,
  type NegotiationState,
} from '@/lib/inventory/negotiation-policy';

const policy = { minRate: 140, maxVolume: 2_000_000, maxRounds: 3, replyDelayHours: 12 };

describe('seller policy', () => {
  it('accepts at or above the minimum rate', () => {
    expect(decideSellerReply(policy, { rate: 140, volume: 1_000_000 }, 160, 1).kind).toBe('ACCEPT');
    expect(decideSellerReply(policy, { rate: 150, volume: null }, 160, 1).kind).toBe('ACCEPT');
  });

  it('counters at the midpoint below the minimum, never under it', () => {
    const d = decideSellerReply(policy, { rate: 100, volume: 1_000_000 }, 180, 1);
    expect(d).toMatchObject({ kind: 'COUNTER', rate: 140, final: false });
    const wide = decideSellerReply({ ...policy, minRate: 100 }, { rate: 60, volume: null }, 200, 1);
    expect(wide).toMatchObject({ kind: 'COUNTER', rate: 130 });
  });

  it('makes a final offer at the last allowed round and declines beyond it', () => {
    expect(decideSellerReply(policy, { rate: 100, volume: null }, 180, 3)).toMatchObject({
      kind: 'COUNTER',
      final: true,
      rate: 140,
    });
    expect(decideSellerReply(policy, { rate: 100, volume: null }, 180, 4).kind).toBe('DECLINE');
  });

  it('caps the volume at maxVolume and counters instead of accepting', () => {
    const d = decideSellerReply(policy, { rate: 150, volume: 5_000_000 }, 160, 1);
    expect(d).toMatchObject({ kind: 'COUNTER', volume: 2_000_000 });
  });

  it('is deterministic', () => {
    const a = decideSellerReply(policy, { rate: 90, volume: 10 }, 170, 2);
    const b = decideSellerReply(policy, { rate: 90, volume: 10 }, 170, 2);
    expect(a).toEqual(b);
  });

  it('parses a stored policy with safe defaults and a 6 to 24 hour delay', () => {
    expect(parsePolicy(null).maxRounds).toBe(3);
    expect(parsePolicy({ replyDelayHours: 99 }).replyDelayHours).toBe(24);
    expect(parsePolicy({ replyDelayHours: 1 }).replyDelayHours).toBe(6);
  });
});

describe('advanceNegotiation', () => {
  const base: NegotiationState = {
    status: 'COUNTERED',
    awaiting: 'SELLER',
    round: 1,
    replyAt: new Date('2026-06-02T12:00:00Z'),
    expiresAt: new Date('2026-07-01T00:00:00Z'),
    sellerRate: 180,
    proposal: { rate: 100, volume: 1_000_000 },
    policy,
  };
  it('replies only once the delay has passed', () => {
    expect(advanceNegotiation(base, new Date('2026-06-02T11:59:00Z')).kind).toBe('NONE');
    expect(advanceNegotiation(base, new Date('2026-06-02T12:00:00Z')).kind).toBe('REPLY');
  });
  it('expires an open negotiation', () => {
    const waiting: NegotiationState = { ...base, awaiting: 'BUYER', replyAt: null };
    expect(advanceNegotiation(waiting, new Date('2026-07-02T00:00:00Z')).kind).toBe('EXPIRE');
  });
  it('leaves closed negotiations alone', () => {
    expect(advanceNegotiation({ ...base, status: 'ACCEPTED' }, new Date('2030-01-01')).kind).toBe('NONE');
  });
});
