// Field registry completeness (module 08 4.5, AC-05-29 pattern): every column of LineItem and of its child tables is
// registered or ignored, and every list field names a real relation.
import { describe, expect, it } from 'vitest';
import { parseModels, readSchemaText } from '@/lib/db/schema-info';
import { getRegistry } from '@/lib/changelog/registries';
import {
  creativeAssignmentFields,
  floodlightFields,
  inventoryFields,
  partnerCostFields,
} from '@/lib/changelog/registries/line-item-child';
import { lineItemColumnFields, lineItemRegistry } from '@/lib/changelog/registries/line-item';
import type { FieldDef } from '@/lib/changelog/registry-types';

const models = new Map(parseModels(readSchemaText()).map((m) => [m.name, m]));

function columnsOf(name: string): string[] {
  const model = models.get(name);
  if (!model) throw new Error(`no model ${name}`);
  return model.fields
    .filter((f) => !models.has(f.type) && !/@relation/.test(f.attributes))
    .map((f) => f.name);
}

function expectComplete(name: string, fields: FieldDef[]) {
  const columns = columnsOf(name);
  const paths = fields.map((f) => f.path);
  expect(
    columns.filter((c) => !paths.includes(c)),
    `${name} columns missing`,
  ).toEqual([]);
  expect(
    paths.filter((p) => !columns.includes(p)),
    `${name} unknown paths`,
  ).toEqual([]);
  expect(new Set(paths).size, `${name} duplicate paths`).toBe(paths.length);
}

describe('LineItem registry', () => {
  it('is the registry of LINE_ITEM on the LineItem model', () => {
    expect(getRegistry('LINE_ITEM')).toBe(lineItemRegistry);
    expect(lineItemRegistry.model).toBe('LineItem');
  });

  it('registers or ignores every LineItem column', () => {
    expectComplete('LineItem', lineItemColumnFields);
  });

  it.each([
    ['CreativeAssignment', creativeAssignmentFields],
    ['PartnerCost', partnerCostFields],
    ['LineItemFloodlightActivity', floodlightFields],
    ['LineItemInventory', inventoryFields],
  ] as const)('registers or ignores every %s column', (model, fields) => {
    expectComplete(model, [...fields]);
  });

  it('ignores updatedAt, version and the keys of LineItem', () => {
    const ignored = lineItemColumnFields.filter((f) => f.ignore).map((f) => f.path);
    for (const p of ['updatedAt', 'version', 'createdAt', 'id', 'sandboxId']) {
      expect(ignored).toContain(p);
    }
  });

  it('has unique labels among logged fields', () => {
    const labels = lineItemRegistry.fields.filter((f) => !f.ignore).map((f) => f.label);
    expect(new Set(labels).size).toBe(labels.length);
  });

  it('every list field is a relation of LineItem and is loaded by `include`', () => {
    const relations = new Map(models.get('LineItem')!.fields.map((f) => [f.name, f]));
    const lists = lineItemRegistry.fields.filter((f) => f.kind === 'list');
    expect(lists.length).toBeGreaterThan(0);
    for (const f of lists) {
      expect(relations.get(f.path)?.list, f.path).toBe(true);
      expect(lineItemRegistry.include, f.path).toHaveProperty(f.path);
      expect(f.elementKey, f.path).toBeTypeOf('function');
    }
  });
});
