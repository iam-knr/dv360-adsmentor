import { describe, expect, it } from 'vitest';
import { COMMON_PASSWORDS, isCommonPassword } from '@/lib/auth/common-passwords';
import {
  ARGON2_PARAMS,
  PASSWORD_ALPHABET,
  generatePassword,
  hashPassword,
  needsRehash,
  verifyDummy,
  verifyPassword,
} from '@/lib/auth/argon';
import { checkPassword, passwordStrength } from '@/lib/auth/password-policy';
import { hash } from '@node-rs/argon2';

describe('password policy (ACC-010 to ACC-012)', () => {
  const email = 'priya.sharma@example.test';
  const rows: Array<[string, string, string | null]> = [
    ['too short', 'Ab1!xyz', 'ACC-010'],
    ['nine characters', 'Abcdef1!x', 'ACC-010'],
    ['ten characters, 3 classes', 'Abcdefg1!x', null],
    ['128 characters', `Aa1!${'x'.repeat(124)}`, null],
    ['129 characters', `Aa1!${'x'.repeat(125)}`, 'ACC-010'],
    ['only lowercase', 'abcdefghijkl', 'ACC-011'],
    ['two classes', 'abcdefgh1234', 'ACC-011'],
    ['lower, upper, digit', 'Zebra4tiger9', null],
    ['lower, digit, symbol', 'zebra4tiger!', null],
    ['equals the email', email, 'ACC-012'],
    ['contains the email local part', 'xx-Priya.Sharma-9!', 'ACC-012'],
    ['common list', 'Welcome@123', 'ACC-012'],
    ['common list, other case', 'PASSWORD123', 'ACC-012'],
  ];
  it.each(rows)('%s', (_label, password, code) => {
    const result = checkPassword(password, { email });
    if (code === null) {
      expect(result.issues).toEqual([]);
      expect(result.ok).toBe(true);
    } else {
      expect(result.ok).toBe(false);
      expect(result.issues.map((i) => i.code)).toContain(code);
    }
  });

  it('uses the exact texts of the spec', () => {
    expect(checkPassword('Ab1!').issues[0]?.message).toBe('Use at least 10 characters.');
    expect(checkPassword('abcdefghijkl').issues[0]?.message).toBe(
      'Use at least 3 of: lowercase, uppercase, number, symbol.',
    );
    expect(checkPassword('Password123').issues.at(-1)?.message).toBe(
      'Choose a password that is harder to guess.',
    );
    expect(checkPassword(`Aa1!${'x'.repeat(130)}`).issues[0]?.message).toBe(
      'Use 128 characters or fewer.',
    );
  });

  it('ignores a short email local part (under 4 characters)', () => {
    expect(checkPassword('Abc-zebra-4-tiger', { email: 'abc@example.test' }).ok).toBe(true);
  });

  it('honours a raised minimum length but never lowers it under 10', () => {
    expect(checkPassword('Zebra4tiger9', { minLength: 14 }).ok).toBe(false);
    expect(checkPassword('Zebra4tiger9', { minLength: 4 }).ok).toBe(true);
    expect(checkPassword('Zebra4t9', { minLength: 4 }).ok).toBe(false);
  });

  it('rates strength for the meter', () => {
    expect(passwordStrength('abc')).toBe('weak');
    expect(passwordStrength('Zebra4tiger9')).toBe('fair');
    expect(passwordStrength('Zebra4tiger9-orange')).toBe('strong');
  });
});

describe('common password list', () => {
  it('has at least 1,000 lower-case entries', () => {
    expect(COMMON_PASSWORDS.size).toBeGreaterThanOrEqual(1000);
    for (const p of COMMON_PASSWORDS) expect(p).toBe(p.toLowerCase());
  });
  it('compares in lower case', () => {
    expect(isCommonPassword('QwErTy123')).toBe(true);
    expect(isCommonPassword('qq9-zebra-orange')).toBe(false);
  });
});

describe('generatePassword', () => {
  it('always passes the policy, has all four classes, and no look-alikes (10,000 runs)', () => {
    const seen = new Set<string>();
    for (let i = 0; i < 10_000; i++) {
      const p = generatePassword();
      expect(p).toHaveLength(16);
      expect(checkPassword(p).ok).toBe(true);
      expect(p).toMatch(/[a-z]/);
      expect(p).toMatch(/[A-Z]/);
      expect(p).toMatch(/[0-9]/);
      expect(p).toMatch(/[-_.!@#]/);
      expect(p).not.toMatch(/[0O1Il]/);
      for (const ch of p) expect(PASSWORD_ALPHABET).toContain(ch);
      seen.add(p);
    }
    expect(seen.size).toBe(10_000);
  });
});

describe('argon2id hashing', () => {
  it('produces an argon2id PHC string and verifies it', async () => {
    const h = await hashPassword('Zebra4tiger9');
    expect(h.startsWith('$argon2id$')).toBe(true);
    expect(h).toContain(
      `m=${ARGON2_PARAMS.memoryCost},t=${ARGON2_PARAMS.timeCost},p=${ARGON2_PARAMS.parallelism}`,
    );
    expect(await verifyPassword(h, 'Zebra4tiger9')).toBe(true);
    expect(await verifyPassword(h, 'Zebra4tiger8')).toBe(false);
  });

  it('salts every hash', async () => {
    expect(await hashPassword('Zebra4tiger9')).not.toBe(await hashPassword('Zebra4tiger9'));
  });

  it('treats a malformed hash as a wrong password', async () => {
    expect(await verifyPassword('not-a-hash', 'x')).toBe(false);
  });

  it('needsRehash is false for the current parameters and true for older ones or another algorithm', async () => {
    expect(needsRehash(await hashPassword('Zebra4tiger9'))).toBe(false);
    const weaker = await hash('Zebra4tiger9', {
      algorithm: 2,
      memoryCost: 4096,
      timeCost: 1,
      parallelism: 1,
    });
    expect(needsRehash(weaker)).toBe(true);
    expect(needsRehash(`$2b$12$${'a'.repeat(53)}`)).toBe(true); // a bcrypt shaped string, built so no hash is committed
    expect(needsRehash('garbage')).toBe(true);
  });

  it('verifyDummy never says yes', async () => {
    expect(await verifyDummy('anything')).toBe(false);
  });
});
