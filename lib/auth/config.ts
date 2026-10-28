// Auth.js configuration that is safe on the edge (no database, no native modules). middleware.ts uses it as is;
// lib/auth/index.ts adds the credentials provider for the Node runtime.
import type { NextAuthConfig } from 'next-auth';
import { isAppRole } from './roles';

export const SESSION_COOKIE_MAX_AGE = 24 * 60 * 60;

export const authConfig = {
  providers: [],
  session: { strategy: 'jwt', maxAge: SESSION_COOKIE_MAX_AGE },
  pages: { signIn: '/sim/login', error: '/sim/login' },
  callbacks: {
    jwt({ token, user }) {
      // `user` is only present at sign in. The claims are never taken from the browser (no `update` trigger).
      if (user) {
        token.sub = user.id;
        token.appRole = user.appRole;
        token.sv = user.sessionVersion;
        token.sid = user.sid;
        token.mcp = user.mustChangePassword ?? false;
        token.loginAt = Math.floor(Date.now() / 1000);
      }
      return token;
    },
    session({ session, token }) {
      const appRole = isAppRole(token.appRole) ? token.appRole : 'user';
      session.user = {
        ...session.user,
        id: token.sub ?? '',
        appRole,
        mcp: token.mcp === true,
        sv: typeof token.sv === 'number' ? token.sv : -1,
        sid: typeof token.sid === 'string' ? token.sid : '',
        loginAt: typeof token.loginAt === 'number' ? token.loginAt : 0,
      };
      return session;
    },
  },
  // A wrong password is not a server error; keep it out of the logs. Everything else is logged without secrets.
  logger: {
    error(error) {
      const type = (error as { type?: string }).type;
      if (type === 'CredentialsSignin' || error.name === 'CredentialsSignin') return;
      console.error(`[auth] ${error.name}: ${error.message}`);
    },
    warn() {},
    debug() {},
  },
} satisfies NextAuthConfig;
