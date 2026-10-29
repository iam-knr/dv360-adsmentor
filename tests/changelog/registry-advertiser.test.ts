// Pattern for AC-05-29: every Prisma column of an entity is registered or marked ignore.
import { EntityType } from '@prisma/client';
import { describe, expect, it } from 'vitest';
import { parseModels, readSchemaText } from '@/lib/db/schema-info';
import { REGISTRIES, getRegistry, MissingRegistryError } from '@/lib/changelog/registries';
import { advertiserRegistry } from '@/lib/changelog/registries/advertiser';

const models = new Map(parseModels(readSchemaText()).map((m) => [m.name, m]));

describe('Advertiser registry (AC-05-29 pattern)', () => {
  const model = models.get('Advertiser')!;
  const columns = model.fields
    .filter((f) => !f.list && !/@relation/.test(f.attributes) && models.has(f.type) === false)
    .map((f) => f.name);

  it('registers or ignores every Advertiser column', () => {
    const paths = advertiserRegistry.fields.map((f) => f.path);
    expect(columns.filter((c) => !paths.includes(c))).toEqual([]);
  });

  it('has no path that is not a column', () => {
    expect(
      advertiserRegistry.fields.map((f) => f.path).filter((p) => !columns.includes(p)),
    ).toEqual([]);
  });

  it('ignores updatedAt, version and the keys', () => {
    const ignored = advertiserRegistry.fields.filter((f) => f.ignore).map((f) => f.path);
    for (const p of ['updatedAt', 'version', 'createdAt', 'id', 'sandboxId'])
      expect(ignored).toContain(p);
  });

  it('has unique paths and unique labels among logged fields', () => {
    const paths = advertiserRegistry.fields.map((f) => f.path);
    expect(new Set(paths).size).toBe(paths.length);
    const labels = advertiserRegistry.fields.filter((f) => !f.ignore).map((f) => f.label);
    expect(new Set(labels).size).toBe(labels.length);
  });

  it('points at the right model', () => {
    expect(advertiserRegistry.model).toBe('Advertiser');
    expect(advertiserRegistry.entityType).toBe('ADVERTISER');
    expect(getRegistry('ADVERTISER')).toBe(advertiserRegistry);
  });
});

describe('registry directory', () => {
  it('every registered registry names an existing model', () => {
    for (const reg of Object.values(REGISTRIES))
      expect(models.has(reg.model), reg.model).toBe(true);
  });

  it('a missing registry is an error, never a silent skip', () => {
    // Whichever EntityType has no registry yet (the entity sessions add theirs one by one).
    const missing = Object.values(EntityType).find((t) => !REGISTRIES[t]);
    expect(missing).toBeDefined();
    expect(() => getRegistry(missing!)).toThrow(MissingRegistryError);
  });

  // AC-05-29 asks for a registry per EntityType. The entity sessions add them (campaign, IO, LI: P3-06b/c; the rest: Phase 4).
  // Remove each todo when its registry lands.
  it.todo('LINE_ITEM registry (P3-06c)');
  it.todo('the other 17 EntityTypes (Phase 4)');
});
