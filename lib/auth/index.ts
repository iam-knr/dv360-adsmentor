import 'server-only';
import NextAuth, { CredentialsSignin } from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import { z } from 'zod';
import { authConfig } from './config';
import { encodeFailure } from './failure-code';
import { authenticate } from './signin';

/** Thrown from `authorize`; `code` travels in the redirect URL and tells the login action what happened. */
export class SignInRejected extends CredentialsSignin {
  constructor(code: string) {
    super();
    this.code = code;
  }
}

const credentialsSchema = z.object({ email: z.string(), password: z.string() });

/**
 * The address for the per IP failure limit. Platform headers first (Vercel sets x-vercel-forwarded-for and x-real-ip
 * itself and drops what the client sent); otherwise the last x-forwarded-for entry, which is the one the nearest
 * proxy added, never the first, which the client can write.
 */
export function clientIp(request: Request | undefined): string | null {
  const h = request?.headers;
  if (!h) return null;
  const platform = h.get('x-vercel-forwarded-for') ?? h.get('x-real-ip');
  if (platform?.trim()) return platform.split(',')[0]?.trim() ?? null;
  const forwarded = h.get('x-forwarded-for')?.split(',');
  return forwarded?.at(-1)?.trim() || null;
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      credentials: { email: {}, password: {} },
      async authorize(raw, request) {
        const parsed = credentialsSchema.safeParse(raw);
        if (!parsed.success) throw new SignInRejected('invalid');
        const result = await authenticate({ ...parsed.data, ip: clientIp(request) });
        if (!result.ok) throw new SignInRejected(encodeFailure(result));
        const u = result.user;
        return {
          id: u.id,
          email: u.email,
          name: u.name,
          appRole: u.appRole,
          sessionVersion: u.sessionVersion,
          sid: u.sid,
          mustChangePassword: u.mustChangePassword,
        };
      },
    }),
  ],
});
