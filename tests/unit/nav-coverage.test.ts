// Every partner, advertiser and campaign page of routes.md section 3 belongs to a left menu entry (activeKey finds it).
import { describe, expect, it } from 'vitest';
import { activeKey } from '@/lib/nav/trees';
import { ROUTE_TABLE } from '@/lib/routes/route-table';

describe('left menu covers the route table', () => {
  it('every framed page has an active menu entry', () => {
    const missing: string[] = [];
    for (const r of ROUTE_TABLE) {
      if (r.frame !== 'P' && r.frame !== 'A' && r.frame !== 'C') continue;
      const level = r.frame === 'P' ? 'partner' : r.frame === 'A' ? 'advertiser' : 'campaign';
      const base = { partner: '/p/1', advertiser: '/p/1/a/2', campaign: '/p/1/a/2/c/3' }[level];
      const path = r.path
        .replace('{pid}', '1')
        .replace('{aid}', '2')
        .replace('{cid}', '3')
        .replace('{x}', '9');
      if (!activeKey(level, path, base)) missing.push(`${r.frame} ${r.path}`);
    }
    expect(missing).toEqual([]);
  });
});
