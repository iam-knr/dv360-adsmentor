import 'server-only';
import type { SessionUser } from './types';

const DEV_USER: SessionUser = {
  id: 'dev-user',
  email: 'dev@example.test',
  name: 'Dev User',
  appRole: 'admin',
  dvRole: 'ADMIN',
};

/** Stub (P3-02 replaces it). Returns a fixed user only when AUTH_DEV_BYPASS=1 outside production. */
export async function getSessionUser(): Promise<SessionUser | null> {
  if (process.env.AUTH_DEV_BYPASS === '1' && process.env.NODE_ENV !== 'production') {
    return await Promise.resolve(DEV_USER);
  }
  return null;
}

export async function requireUser(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) throw new Error('UNAUTHENTICATED');
  return user;
}
