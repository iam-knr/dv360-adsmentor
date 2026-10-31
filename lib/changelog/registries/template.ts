// Registry of the targeting template (module 10 2.7). The targeting rows of a template are logged as a count.
import type { EntityRegistry, FieldDef } from '../registry-types';

const ignore = (path: string, label: string): FieldDef => ({
  path,
  label,
  kind: 'scalar',
  ignore: true,
});

export const targetingTemplateRegistry: EntityRegistry = {
  entityType: 'TARGETING_TEMPLATE',
  model: 'TargetingTemplate',
  noun: 'targeting template',
  version: 1,
  load: async (tx, id) => {
    const row = await tx.targetingTemplate.findUnique({ where: { id } });
    if (!row) return null;
    const rowCount = await tx.targetingAssignment.count({
      where: { templateId: id, ownerType: 'TEMPLATE' },
    });
    return { ...row, rowCount };
  },
  fields: [
    ignore('id', 'ID'),
    ignore('sandboxId', 'Sandbox'),
    ignore('publicId', 'Targeting template ID'),
    ignore('advertiserId', 'Advertiser'),
    { path: 'createdAt', label: 'Created', kind: 'date', ignore: true },
    { path: 'updatedAt', label: 'Updated', kind: 'date', ignore: true },
    { path: 'name', label: 'Template name', kind: 'text' },
    { path: 'description', label: 'Description', kind: 'text' },
    { path: 'lineItemType', label: 'Line item type', kind: 'enum' },
    { path: 'inventoryQuality', label: 'Inventory quality', kind: 'enum' },
    { path: 'optimizedTargeting', label: 'Optimized targeting', kind: 'bool' },
    { path: 'status', label: 'Status', kind: 'enum' },
    { path: 'exchangeIds', label: 'Exchanges', kind: 'json' },
    { path: 'rowCount', label: 'Number of targeting rows', kind: 'scalar' },
  ],
};
