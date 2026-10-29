// Deployment files: the engine timer workflow and the absence of sub-daily Vercel crons (ADR-048, RC-056).
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read = (p: string) => readFileSync(p, 'utf8');

describe('.github/workflows/engine-tick.yml', () => {
  const wf = read('.github/workflows/engine-tick.yml');
  it('runs every five minutes and can be started by hand', () => {
    expect(wf).toMatch(/cron:\s*'\*\/5 \* \* \* \*'/);
    expect(wf).toContain('workflow_dispatch:');
  });
  it('posts to ENGINE_CRON_URL with the bearer secret from Actions secrets', () => {
    expect(wf).toContain('secrets.ENGINE_CRON_URL');
    expect(wf).toContain('secrets.CRON_SECRET');
    expect(wf).toContain('Authorization: Bearer ${CRON_SECRET}');
    expect(wf).toMatch(/-X POST/);
  });
  it('skips quietly without a URL and fails on a non-2xx answer', () => {
    expect(wf).toMatch(/-z "\$\{ENGINE_CRON_URL\}"[\s\S]*exit 0/);
    expect(wf).toMatch(/2\?\?\)[\s\S]*exit 1/);
  });
  it('holds no secret value', () => {
    expect(wf).not.toMatch(/Bearer [A-Za-z0-9_-]{20,}/);
  });
});

describe('vercel.json', () => {
  const cfg = JSON.parse(read('vercel.json')) as { crons?: { path: string; schedule: string }[] };
  it('has no sub-daily cron (a Hobby deploy would fail)', () => {
    for (const c of cfg.crons ?? []) {
      const [minute, hour] = c.schedule.trim().split(/\s+/);
      expect(minute, c.schedule).toMatch(/^\d+$/);
      expect(hour, c.schedule).toMatch(/^\d+$/);
    }
  });
});
