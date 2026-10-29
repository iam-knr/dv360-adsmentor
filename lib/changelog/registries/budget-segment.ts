// BudgetSegment fields (module 07 3.2). Logged as elements of the insertion order's `segments` list:
// "Budget segment 2: Budget changed from ₹500.00 to ₹800.00" (module 07 B7).
import type { FieldDef, Image } from '../registry-types';

export const budgetSegmentFields: FieldDef[] = [
  { path: 'id', label: 'ID', kind: 'scalar', ignore: true },
  { path: 'sandboxId', label: 'Sandbox', kind: 'scalar', ignore: true },
  { path: 'ioId', label: 'Insertion order', kind: 'scalar', ignore: true },
  { path: 'ordinal', label: 'Order', kind: 'scalar', ignore: true },
  { path: 'amount', label: 'Budget', kind: 'money' },
  { path: 'description', label: 'Description', kind: 'text' },
  { path: 'startDate', label: 'Start date', kind: 'date' },
  { path: 'endDate', label: 'End date', kind: 'date' },
  { path: 'externalBudgetId', label: 'External budget ID', kind: 'text' },
  { path: 'createdAt', label: 'Created', kind: 'date', ignore: true },
  { path: 'updatedAt', label: 'Updated', kind: 'date', ignore: true },
];

export const budgetSegmentList: FieldDef = {
  path: 'segments',
  label: 'Budget segments',
  kind: 'list',
  elementNoun: 'budget segment',
  elementLabel: (el: Image) => `Budget segment ${Number(el.ordinal ?? 0) + 1}`,
  childFields: budgetSegmentFields.filter((f) => !f.ignore),
};
