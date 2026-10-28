import type { SessionUser } from '@/lib/auth/types';

export type Action = string;
export type Scope = Record<string, string | undefined>;

/** Stub (P3-02 replaces it): allows everything. */
export function can(_user: SessionUser, _action: Action, _scope: Scope): boolean {
  return true;
}

export function assertAccess(user: SessionUser, action: Action, scope: Scope): void {
  if (!can(user, action, scope)) throw new Error('FORBIDDEN');
}
