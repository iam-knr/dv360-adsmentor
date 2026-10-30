import { describe, expect, it } from 'vitest';
import { INSTRUCTOR_AUDIT_KEYS, pickInstructorPayload } from '@/lib/instructor/audit';

describe('instructor audit payload', () => {
  it('keeps only listed scalar keys, so a password or hash cannot be written', () => {
    const out = pickInstructorPayload({
      count: 3,
      label: 'Opened manually',
      password: 'hunter2hunter2',
      passwordHash: '$argon2id$x',
      tempPassword: 'abc',
      secret: 'x',
      nested: { password: 'p' },
      list: ['a'],
    });
    expect(out).toEqual({ count: 3, label: 'Opened manually' });
    expect(JSON.stringify(out)).not.toMatch(/hunter|argon|abc/);
  });
  it('turns dates into ISO strings and trims long text', () => {
    const out = pickInstructorPayload({ opensAt: new Date('2026-11-02T04:30:00Z'), label: 'x'.repeat(500) });
    expect(out.opensAt).toBe('2026-11-02T04:30:00.000Z');
    expect((out.label as string).length).toBe(200);
  });
  it('has no key that names a secret', () => {
    expect(INSTRUCTOR_AUDIT_KEYS.filter((k) => /pass|secret|hash|token/i.test(k))).toEqual([]);
  });
});
