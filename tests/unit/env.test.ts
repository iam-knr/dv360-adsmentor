import { describe, expect, it } from 'vitest';
import { parseEnv } from '@/lib/env';

describe('env', () => {
  it('fails with a clear message when DATABASE_URL is missing', () => {
    expect(() => parseEnv({})).toThrow(/Invalid environment variables:[\s\S]*DATABASE_URL/);
  });

  it('treats empty strings as unset', () => {
    expect(() => parseEnv({ DATABASE_URL: '' })).toThrow(/DATABASE_URL/);
  });

  it('accepts a minimal valid environment and applies defaults', () => {
    const env = parseEnv({ DATABASE_URL: 'postgresql://x', NODE_ENV: 'test' });
    expect(env.CRON_MODE).toBe('github');
    expect(env.DIRECT_URL).toBeUndefined();
  });

  it('parses booleans', () => {
    const env = parseEnv({
      DATABASE_URL: 'postgresql://x',
      AUTH_DEV_BYPASS: '1',
      AUTH_TRUST_HOST: 'true',
    });
    expect(env.AUTH_DEV_BYPASS).toBe(true);
    expect(env.AUTH_TRUST_HOST).toBe(true);
  });

  it('requires AUTH_SECRET in production', () => {
    expect(() => parseEnv({ DATABASE_URL: 'postgresql://x', NODE_ENV: 'production' })).toThrow(
      /AUTH_SECRET/,
    );
  });
});
