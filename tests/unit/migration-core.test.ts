// The migration is deployed to the live shared database by `prisma migrate deploy`: it must be additive and in sync
// with prisma/sql. These checks need no database.
import { readFileSync, readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseModels, readSchemaText, renderRlsApplySql, tenantModels } from '@/lib/db/schema-info';

const migration = readFileSync('prisma/migrations/0001_core/migration.sql', 'utf8');
const sqlFiles = readdirSync('prisma/sql')
  .filter((f) => f.endsWith('.sql'))
  .sort();
const models = parseModels(readSchemaText());

describe('migration 0001_core', () => {
  it('contains every prisma/sql file verbatim', () => {
    expect(sqlFiles).toEqual([
      '00-extensions-sequences.sql',
      '10-roles.sql',
      '20-rls-function.sql',
      '30-constraints.sql',
      '40-rls-apply.sql',
      '50-grants-and-defaults.sql',
    ]);
    for (const f of sqlFiles) {
      expect(migration, f).toContain(readFileSync(`prisma/sql/${f}`, 'utf8'));
    }
  });

  it('puts every tenant table under RLS (40-rls-apply.sql is current)', () => {
    expect(readFileSync('prisma/sql/40-rls-apply.sql', 'utf8')).toBe(renderRlsApplySql(models));
    expect(tenantModels(models).length).toBeGreaterThanOrEqual(26);
  });

  it('creates exactly the models the schema defines, except the base table', () => {
    const created = [...migration.matchAll(/CREATE TABLE "(\w+)"/g)].map((m) => m[1]).sort();
    const expected = models
      .map((m) => m.name)
      .filter((n) => n !== 'AppMeta')
      .sort();
    expect(created).toEqual(expected);
  });

  it('is additive: no table or column is dropped, emptied or rewritten', () => {
    const forbidden = [
      /DROP\s+TABLE/i,
      /DROP\s+COLUMN/i,
      /DROP\s+TYPE/i,
      /\bTRUNCATE\b/i,
      /DELETE\s+FROM/i,
      /ALTER\s+TABLE\s+"AppMeta"/i,
    ];
    for (const re of forbidden) expect(migration).not.toMatch(re);
    // the only DROP INDEX statements swap Prisma's unique indexes for NULLS NOT DISTINCT ones of the same name
    const dropped = [...migration.matchAll(/DROP INDEX "(\w+)"/g)].map((m) => m[1]);
    expect(dropped.length).toBe(3);
    for (const name of dropped) {
      expect(migration).toMatch(new RegExp(`CREATE UNIQUE INDEX "${name}"[^;]*NULLS NOT DISTINCT`));
    }
  });

  it('cannot fail a deploy on a managed host because of role privileges', () => {
    const roles = readFileSync('prisma/sql/10-roles.sql', 'utf8');
    expect(roles).toContain('EXCEPTION WHEN insufficient_privilege');
    expect(roles).toMatch(/EXCEPTION WHEN OTHERS THEN\s+RAISE NOTICE/);
  });

  it('seeds nothing but the one AccountPolicy row, and idempotently', () => {
    const inserts = [...migration.matchAll(/INSERT INTO "(\w+)"/g)].map((m) => m[1]);
    expect(inserts).toEqual(['AccountPolicy']);
    expect(migration).toContain('ON CONFLICT ("id") DO NOTHING');
  });

  it('contains no secrets or real addresses', () => {
    expect(migration).not.toMatch(/password\s*=|secret|@gmail\.|@adsmentor\./i);
  });
});
