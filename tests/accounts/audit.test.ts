import { describe, expect, it } from 'vitest';
import { ACCOUNT_AUDIT_KEYS, pickAuditPayload, purgeOldAudit } from '@/lib/accounts/audit';

describe('audit payload allow-list (module 19 4.11)', () => {
  it('drops password, hash and unknown keys', () => {
    const out = pickAuditPayload({
      password: 'x',
      passwordHash: 'y',
      token: 'z',
      email: 'a@example.test',
      toStatus: 'DISABLED',
      count: 3,
    });
    expect(out).toEqual({ toStatus: 'DISABLED', count: 3 });
  });
  it('drops objects and arrays', () => {
    expect(pickAuditPayload({ reason: { a: 1 }, count: [1] })).toEqual({});
  });
  it('has no secret-like key in the list', () => {
    for (const k of ACCOUNT_AUDIT_KEYS.filter((k) => k !== 'mustChangePassword'))
      expect(k).not.toMatch(/pass(word)?|secret|token|hash/i);
  });
  it('purges rows older than 365 days', async () => {
    let cutoff: Date | undefined;
    const n = await purgeOldAudit(new Date('2026-10-29T00:00:00Z'), {
      auditLog: {
        deleteMany: ({ where }) => {
          cutoff = where.createdAt.lt;
          return Promise.resolve({ count: 4 });
        },
      },
    });
    expect(n).toBe(4);
    expect(cutoff?.toISOString()).toBe('2025-10-29T00:00:00.000Z');
  });
});
