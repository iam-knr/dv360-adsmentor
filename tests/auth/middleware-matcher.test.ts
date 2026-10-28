import { describe, expect, it, vi } from 'vitest';
import { config } from '../../middleware';

// middleware.ts imports Auth.js and next/server, which do not load under Vitest; only `config` is under test.
vi.mock('next-auth', () => ({ default: () => ({ auth: () => () => undefined }) }));
vi.mock('next/server', () => ({ NextResponse: {} }));

// The matcher decides which URLs reach middleware.ts at all. Next.js reads `/(...)` as a regular expression.
const [pattern] = config.matcher;
const runs = (path: string) => new RegExp(`^${pattern}$`).test(path);

describe('middleware matcher', () => {
  it('skips Next.js internals, the favicon and the public brand folder only', () => {
    for (const p of [
      '/_next/static/chunks/a.js',
      '/_next/image',
      '/_next/webpack-hmr',
      '/favicon.ico',
      '/brand/adsmentor-logo-horizontal.png',
    ]) {
      expect(runs(p), p).toBe(false);
    }
  });

  it('runs for everything else, including paths that end like a file name', () => {
    for (const p of [
      '/',
      '/sim/login',
      '/manage/accounts',
      '/p/1/home_v3',
      '/a/2/creatives/ad.js',
      '/api/x/report.txt',
      '/advertisers/abc.png',
      '/brandx/y',
      '/api/auth/session',
    ]) {
      expect(runs(p), p).toBe(true);
    }
  });
});
