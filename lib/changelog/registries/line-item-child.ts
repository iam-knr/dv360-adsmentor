// Element fields of the line item child tables (module 08 3.1). Each table's columns are registered or ignored, so a
// new column fails tests/services/line-items/registry.db.test.ts until it is added here.
import type { FieldDef } from '../registry-types';

const key = (path: string, label: string): FieldDef => ({
  path,
  label,
  kind: 'scalar',
  ignore: true,
});

export const creativeAssignmentFields: FieldDef[] = [
  key('id', 'ID'),
  key('sandboxId', 'Sandbox'),
  key('lineItemId', 'Line item'),
  key('creativeId', 'Creative'),
  key('assignedById', 'Assigned by'),
  { path: 'assignedAt', label: 'Assigned', kind: 'date', ignore: true },
];

export const partnerCostFields: FieldDef[] = [
  key('id', 'ID'),
  key('sandboxId', 'Sandbox'),
  key('ioId', 'Insertion order'),
  key('lineItemId', 'Line item'),
  key('kind', 'Fee kind'),
  key('slot', 'Slot'),
  { path: 'feeType', label: 'Fee type', kind: 'enum' },
  { path: 'amount', label: 'Amount', kind: 'money' },
  { path: 'percentage', label: 'Percentage', kind: 'scalar' },
  { path: 'invoiced', label: 'Invoiced', kind: 'bool' },
  key('isSystem', 'System fee'),
];

export const floodlightFields: FieldDef[] = [
  key('id', 'ID'),
  key('sandboxId', 'Sandbox'),
  key('lineItemId', 'Line item'),
  key('activityId', 'Floodlight activity'),
];

export const inventoryFields: FieldDef[] = [
  key('id', 'ID'),
  key('sandboxId', 'Sandbox'),
  key('lineItemId', 'Line item'),
  key('kind', 'Kind'),
  key('refId', 'Inventory source'),
  { path: 'mode', label: 'Include or exclude', kind: 'enum' },
];

/** Child model name to its element fields, for the completeness test. */
export const LINE_ITEM_CHILD_TABLES: Record<string, FieldDef[]> = {
  CreativeAssignment: creativeAssignmentFields,
  PartnerCost: partnerCostFields,
  LineItemFloodlightActivity: floodlightFields,
  LineItemInventory: inventoryFields,
};
