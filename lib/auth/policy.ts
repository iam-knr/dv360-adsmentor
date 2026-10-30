import 'server-only';
import type { AccountPolicy } from '@prisma/client';
import { prisma } from '@/lib/db';
import type { AppRole } from './types';

export type PolicyValues = Omit<AccountPolicy, 'updatedAt' | 'updatedById'>;

/** Same values as the schema defaults; used when the one row (id = 1) is missing. */
export const DEFAULT_POLICY: PolicyValues = {
  id: 1,
  idleMinutesUser: 480,
  idleMinutesAdmin: 480,
  idleMinutesSuper: 120,
  absoluteHoursUser: 12,
  absoluteHoursAdmin: 24,
  absoluteHoursSuper: 8,
  singleSessionUser: true,
  singleSessionAdmin: false,
  singleSessionSuper: false,
  lockoutThreshold: 5,
  lockoutMinutes: 15,
  minPasswordLength: 10,
  defaultMustChange: true,
  defaultCohortCapacity: 25,
};

/** The cookie lives as long as the longest absolute limit we allow (24 hours); the policy limit is checked on use. */
export const SESSION_COOKIE_MAX_AGE_SECONDS = 24 * 60 * 60;

const CACHE_MS = 30_000;
let cached: { at: number; value: PolicyValues } | undefined;

/** Call after the Super admin saves settings so this instance sees the change at once. */
export function invalidatePolicyCache(): void {
  cached = undefined;
}

export async function getAccountPolicy(
  db: Pick<typeof prisma, 'accountPolicy'> = prisma,
): Promise<PolicyValues> {
  const t = Date.now();
  if (db === prisma && cached && t - cached.at < CACHE_MS) return cached.value;
  const row = await db.accountPolicy.findUnique({ where: { id: 1 } });
  const value: PolicyValues = row ? { ...DEFAULT_POLICY, ...row } : DEFAULT_POLICY;
  if (db === prisma) cached = { at: t, value };
  return value;
}

export function idleMinutesFor(policy: PolicyValues, role: AppRole): number {
  if (role === 'super_admin') return policy.idleMinutesSuper;
  return policy.idleMinutesUser;
}

export function absoluteHoursFor(policy: PolicyValues, role: AppRole): number {
  if (role === 'super_admin') return policy.absoluteHoursSuper;
  return policy.absoluteHoursUser;
}

export function singleSessionFor(policy: PolicyValues, role: AppRole): boolean {
  if (role === 'super_admin') return policy.singleSessionSuper;
  return policy.singleSessionUser;
}
