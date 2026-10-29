// PartnerCost fields (module 07 3.2 "Partner costs"). Logged as elements of the insertion order's `fees` list,
// keyed by kind and slot so a fee keeps its identity across saves ("CPM fee 2: Amount changed from ...").
import type { FieldDef, Image } from '../registry-types';

export const partnerCostFields: FieldDef[] = [
  { path: 'id', label: 'ID', kind: 'scalar', ignore: true },
  { path: 'sandboxId', label: 'Sandbox', kind: 'scalar', ignore: true },
  { path: 'ioId', label: 'Insertion order', kind: 'scalar', ignore: true },
  { path: 'lineItemId', label: 'Line item', kind: 'scalar', ignore: true },
  { path: 'kind', label: 'Fee kind', kind: 'enum', ignore: true },
  { path: 'slot', label: 'Slot', kind: 'scalar', ignore: true },
  { path: 'feeType', label: 'Type', kind: 'enum' },
  { path: 'amount', label: 'Amount', kind: 'money' },
  { path: 'percentage', label: 'Percentage', kind: 'scalar' },
  { path: 'invoiced', label: 'Invoiced', kind: 'bool' },
  { path: 'isSystem', label: 'System fee', kind: 'bool', ignore: true },
];

const feeName = (el: Image) =>
  `${el.kind === 'MEDIA_FEE' ? 'Media fee' : 'CPM fee'} ${String(el.slot ?? '')}`.trim();

export const partnerCostList: FieldDef = {
  path: 'fees',
  label: 'Partner costs',
  kind: 'list',
  elementNoun: 'partner cost',
  elementKey: (el: Image) => `${String(el.kind)}:${String(el.slot)}`,
  elementLabel: feeName,
  childFields: partnerCostFields.filter((f) => !f.ignore),
};
