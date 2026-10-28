import { describe, expect, it } from 'vitest';
import { encodeFailure, messageForCode } from '@/lib/auth/failure-code';

describe('sign in failure codes (they travel in the redirect URL)', () => {
  it('round-trips each failure to its exact message', () => {
    expect(messageForCode(encodeFailure({ ok: false, code: 'invalid' }))).toBe(
      'Incorrect email or password.',
    );
    expect(messageForCode(encodeFailure({ ok: false, code: 'locked', minutes: 15 }))).toBe(
      'Too many attempts. Try again in 15 minutes.',
    );
    expect(messageForCode(encodeFailure({ ok: false, code: 'locked', minutes: 1 }))).toBe(
      'Too many attempts. Try again in 1 minute.',
    );
    expect(messageForCode(encodeFailure({ ok: false, code: 'disabled' }))).toBe(
      'Your account is disabled. Contact your admin.',
    );
    expect(
      messageForCode(
        encodeFailure({
          ok: false,
          code: 'not_started',
          at: new Date('2026-11-12T20:00:00Z'),
          timeZone: 'Pacific/Auckland',
        }),
      ),
    ).toBe('Your access starts on 13 Nov 2026.');
    expect(
      messageForCode(
        encodeFailure({ ok: false, code: 'ended', at: new Date('2026-10-30T10:00:00Z') }),
      ),
    ).toBe('Your access ended on 30 Oct 2026. Contact your admin.');
  });

  it('shows the plain message for anything it does not know (nothing leaks from the URL)', () => {
    for (const code of [
      null,
      undefined,
      '',
      'credentials',
      'CredentialsSignin',
      'locked.abc.def.ghi',
      'x'.repeat(500),
    ]) {
      const m = messageForCode(code);
      expect([
        'Incorrect email or password.',
        'Too many attempts. Try again in 1 minute.',
      ]).toContain(m);
    }
  });
});
