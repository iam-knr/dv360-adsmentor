// Field registry completeness for the resource entities (module 15 4.7, AC-05-29 pattern): every column of the model is
// registered or ignored; computed fields (entry counts, child lists) are the only extra paths.
import { describe, expect, it } from 'vitest';
import { parseModels, readSchemaText } from '@/lib/db/schema-info';
import { getRegistry } from '@/lib/changelog/registries';
import type { EntityType } from '@prisma/client';

const models = new Map(parseModels(readSchemaText()).map((m) => [m.name, m]));

function columnsOf(name: string): string[] {
  const model = models.get(name);
  if (!model) throw new Error(`no model ${name}`);
  return model.fields
    .filter((f) => !models.has(f.type) && !/@relation/.test(f.attributes))
    .map((f) => f.name);
}

const CASES: [EntityType, string, string[]][] = [
  ['CHANNEL', 'Channel', ['entryCount']],
  ['KEYWORD_LIST', 'KeywordList', ['entryCount']],
  ['LOCATION_LIST', 'LocationList', ['entryCount']],
  ['FLOODLIGHT_GROUP', 'FloodlightGroup', ['variables', 'models', 'conversionGroups']],
  ['FLOODLIGHT_ACTIVITY', 'FloodlightActivity', []],
];

describe.each(CASES)('%s registry', (type, model, computed) => {
  const registry = getRegistry(type);

  it('is on the right model', () => {
    expect(registry.model).toBe(model);
  });

  it('registers or ignores every column', () => {
    const paths = registry.fields.map((f) => f.path);
    expect(columnsOf(model).filter((c) => !paths.includes(c))).toEqual([]);
    expect(paths.filter((p) => !columnsOf(model).includes(p) && !computed.includes(p))).toEqual([]);
    expect(new Set(paths).size).toBe(paths.length);
  });

  it('ignores ids, version and timestamps', () => {
    const ignored = registry.fields.filter((f) => f.ignore).map((f) => f.path);
    for (const p of ['id', 'sandboxId', 'version']) expect(ignored).toContain(p);
  });
});
