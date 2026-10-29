// Every row of routes.md section 3 has a page file in the right frame (routes.md 3, 5.1, 9 step 5), the stub pages
// carry the row's module and view code, and no page exists that the table does not list.
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { describe, expect, it } from 'vitest';
import { PAGE_ROWS, ROUTE_TABLE, type RouteRow } from '@/lib/routes/route-table';

const APP = join(process.cwd(), 'app');
const pageFile = (r: RouteRow) => join(APP, r.folder, 'page.tsx');

function pagesUnder(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) return pagesUnder(p);
    return name === 'page.tsx' ? [relative(APP, dir).split(sep).join('/')] : [];
  });
}

/** The frame a folder lands in (routes.md 5.1 and 5.2). */
function frameOf(folder: string): RouteRow['frame'] {
  if (folder === '404') return '404';
  if (folder.startsWith('(dv)/(full)/')) return folder.includes('/reporting') ? 'R' : 'F';
  if (folder.startsWith('(dv)/(app)/(global)/')) return 'G';
  if (folder.includes('/li/[liId]/')) return 'LI';
  if (folder.includes('/io/[ioId]/')) return 'IO';
  if (folder.includes('/c/[campaignId]/(campaign)/')) return 'C';
  if (folder.includes('/a/[advertiserId]/(advertiser)/')) return 'A';
  if (folder.includes('/(partner)/')) return 'P';
  return '-';
}

describe('route table (routes.md 3)', () => {
  it('has unique paths and folders', () => {
    const paths = ROUTE_TABLE.map((r) => r.path);
    expect(new Set(paths).size).toBe(paths.length);
    const folders = ROUTE_TABLE.map((r) => r.folder);
    expect(new Set(folders).size).toBe(folders.length);
  });

  it.each(ROUTE_TABLE.filter((r) => r.folder !== '').map((r) => [r.path, r] as const))(
    '%s has a page file',
    (_path, row) => {
      expect(existsSync(pageFile(row)), row.folder).toBe(true);
    },
  );

  it.each(PAGE_ROWS.map((r) => [r.path, r] as const))('%s sits in frame of its row', (_p, row) => {
    expect(frameOf(row.folder)).toBe(row.frame);
  });

  it('every stub page names its module and view code', () => {
    for (const row of PAGE_ROWS) {
      const src = readFileSync(pageFile(row), 'utf8');
      if (!src.includes('<StubPage')) continue;
      expect(src, row.folder).toContain(`module="${row.module}"`);
      expect(src, row.folder).toContain(`view="${row.view}"`);
      if (row.frame === 'F') expect(src, row.folder).toContain('frame="form"');
      if (row.frame === 'IO' || row.frame === 'LI') expect(src, row.folder).toContain('frame="tab"');
    }
  });

  it('stub page files stay thin so owners can replace them (routes.md 9 step 5)', () => {
    for (const row of PAGE_ROWS) {
      const src = readFileSync(pageFile(row), 'utf8');
      if (src.includes('<StubPage')) expect(src.split('\n').length, row.folder).toBeLessThan(25);
    }
  });

  it('lists every page under app/(dv), app/404 and the catch-all', () => {
    const listed = new Set(ROUTE_TABLE.map((r) => r.folder));
    const onDisk = [...pagesUnder(join(APP, '(dv)')), '404'];
    expect(onDisk.filter((f) => !listed.has(f))).toEqual([]);
    expect(existsSync(join(APP, '[...unmatched]', 'page.tsx'))).toBe(true);
    expect(existsSync(join(APP, 'page.tsx'))).toBe(true);
  });
});
