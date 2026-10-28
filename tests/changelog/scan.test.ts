// AC-05-7: the scan fails when a service writes a tenant table outside withChangeLog and passes for UI_STATE_TABLES.
import { describe, expect, it } from 'vitest';
import { parseModels, readSchemaText, tenantModels } from '@/lib/db/schema-info';
import { UI_STATE_TABLES } from '@/lib/changelog';
import { blankNonCode, scanRepository, scanSource } from '@/lib/changelog/scan';

const tenant = tenantModels(parseModels(readSchemaText())).map((m) => m.name);
const opts = { tenantModels: [...tenant, ...UI_STATE_TABLES] };

const failing = `
import { prisma } from '@/lib/db';
export async function renameCampaign(id: string, name: string) {
  return prisma.campaign.update({ where: { id }, data: { name } });
}
`;

const passing = `
import { withChangeLog } from '@/lib/changelog';
export async function renameCampaign(ctx, id: string, name: string) {
  return withChangeLog(ctx, { type: 'CAMPAIGN', id, chain: {} }, (tx) =>
    tx.campaign.update({ where: { id }, data: { name } }),
  );
}
`;

describe('changelog scan', () => {
  it('fails a service that writes a tenant model outside withChangeLog', () => {
    const v = scanSource('lib/services/campaigns.ts', failing, opts);
    expect(v).toEqual([
      { file: 'lib/services/campaigns.ts', line: 4, model: 'Campaign', op: 'update' },
    ]);
  });

  it('passes the same write inside withChangeLog', () => {
    expect(scanSource('lib/services/campaigns.ts', passing, opts)).toEqual([]);
  });

  it('catches every write operation, including createMany and upsert', () => {
    const ops = ['create', 'createMany', 'update', 'updateMany', 'upsert', 'delete', 'deleteMany'];
    for (const op of ops) {
      const src = `export const f = (tx) => tx.lineItem.${op}({ data: {} });`;
      expect(
        scanSource('lib/actions/x.ts', src, opts).map((x) => x.op),
        op,
      ).toEqual([op]);
    }
  });

  it('does not flag reads', () => {
    const src = `export const f = (tx) => tx.campaign.findMany({ where: {} }) && tx.campaign.count();`;
    expect(scanSource('lib/services/x.ts', src, opts)).toEqual([]);
  });

  it('passes every table in UI_STATE_TABLES', () => {
    for (const table of UI_STATE_TABLES) {
      const delegate = table.charAt(0).toLowerCase() + table.slice(1);
      const src = `export const f = (prisma) => prisma.${delegate}.upsert({ where: {}, create: {}, update: {} });`;
      expect(scanSource('lib/services/x.ts', src, opts), table).toEqual([]);
    }
  });

  it('also passes engine-owned tables and ignores global tables', () => {
    const src = `export const f = (tx) => tx.simDailyMetric.upsert({}) && tx.user.update({}) && tx.exchange.create({});`;
    expect(scanSource('lib/services/x.ts', src, opts)).toEqual([]);
  });

  it('flags raw SQL writes to a tenant table outside withChangeLog', () => {
    const bad = 'export const f = (tx) => tx.$executeRaw`UPDATE "Campaign" SET "name" = ${n}`;';
    expect(scanSource('lib/services/x.ts', bad, opts).map((v) => v.model)).toEqual(['Campaign']);
    const ok = `export const f = (ctx) => withChangeLog(ctx, ref, (tx) => tx.$executeRaw\`UPDATE "Campaign" SET "name" = 'x'\`);`;
    expect(scanSource('lib/services/x.ts', ok, opts)).toEqual([]);
  });

  it('ignores writes that only appear in comments and strings', () => {
    const src = `// tx.campaign.update(...) is forbidden\nconst s = "tx.campaign.update({})";\n/* tx.creative.delete() */`;
    expect(scanSource('lib/services/x.ts', src, opts)).toEqual([]);
  });

  it('only treats the callback span as inside withChangeLog', () => {
    const src = `
export async function f(ctx, tx) {
  await withChangeLog(ctx, ref, (t) => t.campaign.update({}));
  return tx.campaign.delete({});
}`;
    expect(scanSource('lib/services/x.ts', src, opts).map((v) => [v.line, v.op])).toEqual([
      [4, 'delete'],
    ]);
  });

  it('blankNonCode keeps offsets and newlines', () => {
    const src = 'a // x\nb "y(" c';
    const out = blankNonCode(src);
    expect(out.length).toBe(src.length);
    expect(out.split('\n')).toHaveLength(2);
    expect(out).not.toContain('(');
  });

  it('the repository has no unlogged tenant write in lib/services, lib/actions or app', () => {
    expect(scanRepository(process.cwd(), opts)).toEqual([]);
  });
});
