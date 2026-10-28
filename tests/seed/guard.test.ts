import { describe, expect, it } from 'vitest';
import {
  assertSeedAllowed,
  isProductionEnvironment,
  shouldBootstrapDemoClass,
} from '@/lib/seed/guard';

describe('production guards', () => {
  it('detects production, Vercel builds and previews', () => {
    expect(isProductionEnvironment({})).toBe(false);
    expect(isProductionEnvironment({ NODE_ENV: 'development' })).toBe(false);
    expect(isProductionEnvironment({ NODE_ENV: 'production' })).toBe(true);
    expect(isProductionEnvironment({ VERCEL: '1' })).toBe(true);
    expect(isProductionEnvironment({ VERCEL_ENV: 'production' })).toBe(true);
  });

  it('seeds refuse to run in production unless allowed on purpose', () => {
    expect(() => assertSeedAllowed({ NODE_ENV: 'production' })).toThrow(/Refusing/);
    expect(() => assertSeedAllowed({ VERCEL: '1' })).toThrow(/Refusing/);
    expect(() =>
      assertSeedAllowed({ NODE_ENV: 'production', SEED_ALLOW_PRODUCTION: '1' }),
    ).not.toThrow();
    expect(() => assertSeedAllowed({ NODE_ENV: 'test' })).not.toThrow();
  });

  it('the demo class is skipped in production unless SEED_DEMO=1', () => {
    expect(shouldBootstrapDemoClass({ NODE_ENV: 'development' })).toBe(true);
    expect(shouldBootstrapDemoClass({ NODE_ENV: 'production' })).toBe(false);
    expect(shouldBootstrapDemoClass({ VERCEL: '1', NODE_ENV: 'production' })).toBe(false);
    expect(shouldBootstrapDemoClass({ NODE_ENV: 'production', SEED_DEMO: '1' })).toBe(true);
  });
});
