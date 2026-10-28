// AUTH_DEV_BYPASS is a local convenience. It can never be on in production: it is honoured only when
// NODE_ENV is exactly "development" or "test", so a stray variable in Vercel does nothing (module 19 4.6.3).
import type { SessionUser } from './types';

type EnvLike = Record<string, string | undefined>;

export function isDevBypassEnabled(env: EnvLike = process.env): boolean {
  const flag = env.AUTH_DEV_BYPASS?.trim().toLowerCase();
  if (flag !== '1' && flag !== 'true') return false;
  if (env.NODE_ENV !== 'development' && env.NODE_ENV !== 'test') return false;
  // Belt and braces: a Vercel production deployment never honours it, whatever NODE_ENV says.
  if (env.VERCEL_ENV === 'production') return false;
  return true;
}

/** The fixed local user. A Super admin only under test; an Admin when developing by hand. */
export function devBypassUser(env: EnvLike = process.env): SessionUser {
  const appRole = env.NODE_ENV === 'test' ? 'super_admin' : 'admin';
  const user: SessionUser = {
    id: 'dev-user',
    email: 'dev@example.test',
    name: 'Dev User',
    appRole,
    dvRole: 'ADMIN',
  };
  return { ...user, actor: { id: user.id, email: user.email, name: user.name, appRole } };
}
