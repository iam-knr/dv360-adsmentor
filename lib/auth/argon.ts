// Hashing and generation without the server-only guard, so scripts (bootstrap, seed) can use them too.
// App code imports lib/auth/password.ts, which adds the guard.
import { randomBytes, randomInt } from 'node:crypto';
import { hash, parseOptions, verify, type Options } from '@node-rs/argon2';

// argon2id, OWASP minimum: 19 MiB, 2 passes, 1 lane (module 19 4.4). `2` is Algorithm.Argon2id; the d.ts
// declares a const enum, which isolatedModules cannot import.
export const ARGON2_PARAMS = { memoryCost: 19456, timeCost: 2, parallelism: 1 } as const;
const ARGON2ID = 2 as Options['algorithm'];

export async function hashPassword(password: string): Promise<string> {
  return hash(password, { algorithm: ARGON2ID, ...ARGON2_PARAMS });
}

export async function verifyPassword(passwordHash: string, password: string): Promise<boolean> {
  try {
    return await verify(passwordHash, password);
  } catch {
    // A malformed hash must behave like a wrong password.
    return false;
  }
}

/** True when the stored hash is not argon2id or uses weaker parameters than the current ones. */
export function needsRehash(passwordHash: string): boolean {
  if (!passwordHash.startsWith('$argon2id$')) return true;
  try {
    const p = parseOptions(passwordHash);
    return (
      p.memoryCost < ARGON2_PARAMS.memoryCost ||
      p.timeCost < ARGON2_PARAMS.timeCost ||
      p.parallelism !== ARGON2_PARAMS.parallelism
    );
  } catch {
    return true;
  }
}

let dummyHash: Promise<string> | undefined;

/**
 * Verify against a throw-away hash so an unknown email costs the same time as a wrong password (T3, T18).
 * The hash is made once per process from random bytes nobody knows.
 */
export async function verifyDummy(password: string): Promise<false> {
  dummyHash ??= hashPassword(randomBytes(24).toString('base64'));
  await verifyPassword(await dummyHash, password);
  return false;
}

// Generated passwords (module 19 4.4): 16 characters, no look-alikes, at least one of each class.
const UPPER = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
const LOWER = 'abcdefghijkmnopqrstuvwxyz';
const DIGITS = '23456789';
const SYMBOLS = '-_.!@#';
const ALL = UPPER + LOWER + DIGITS + SYMBOLS;
export const GENERATED_PASSWORD_LENGTH = 16;
export const PASSWORD_ALPHABET = ALL;

function pick(alphabet: string): string {
  return alphabet[randomInt(alphabet.length)] as string;
}

export function generatePassword(): string {
  const chars = [pick(UPPER), pick(LOWER), pick(DIGITS), pick(SYMBOLS)];
  while (chars.length < GENERATED_PASSWORD_LENGTH) chars.push(pick(ALL));
  // Fisher-Yates with crypto.randomInt
  for (let i = chars.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [chars[i], chars[j]] = [chars[j] as string, chars[i] as string];
  }
  return chars.join('');
}
