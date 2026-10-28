import { describe, expect, it } from 'vitest';

// lib/auth/index.ts pulls in Auth.js; only the pure helper is under test, so load it with the heavy imports mocked.
import { vi } from 'vitest';
vi.mock('next-auth', () => ({
  default: () => ({ handlers: {}, auth: () => null, signIn: () => null, signOut: () => null }),
  CredentialsSignin: class {},
}));
vi.mock('next-auth/providers/credentials', () => ({ default: () => ({}) }));

const req = (headers: Record<string, string>) =>
  new Request('https://sim.example.test/', { headers });

describe('clientIp for the per address failure limit', async () => {
  const { clientIp } = await import('@/lib/auth');

  it('prefers the platform headers, which the client cannot write', () => {
    expect(
      clientIp(
        req({
          'x-vercel-forwarded-for': '203.0.113.7',
          'x-real-ip': '198.51.100.1',
          'x-forwarded-for': '1.1.1.1',
        }),
      ),
    ).toBe('203.0.113.7');
    expect(
      clientIp(req({ 'x-real-ip': '198.51.100.1', 'x-forwarded-for': '1.1.1.1, 2.2.2.2' })),
    ).toBe('198.51.100.1');
  });

  it('otherwise takes the LAST forwarded entry (added by the nearest proxy), not the first (written by the client)', () => {
    expect(clientIp(req({ 'x-forwarded-for': '6.6.6.6, 203.0.113.9' }))).toBe('203.0.113.9');
    expect(clientIp(req({ 'x-forwarded-for': '203.0.113.9' }))).toBe('203.0.113.9');
  });

  it('has no address when nothing says so', () => {
    expect(clientIp(req({}))).toBeNull();
    expect(clientIp(undefined)).toBeNull();
  });
});
