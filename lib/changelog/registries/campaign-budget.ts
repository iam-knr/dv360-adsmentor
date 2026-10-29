// CampaignBudget fields (module 06 3.2 "Additional budget details"). Logged as elements of the campaign's `budgets`
// list, so a budget row edit lands in the campaign's history ("Budget Q1: amount changed from ...").
import type { FieldDef, Image } from '../registry-types';

export const campaignBudgetFields: FieldDef[] = [
  { path: 'id', label: 'ID', kind: 'scalar', ignore: true },
  { path: 'sandboxId', label: 'Sandbox', kind: 'scalar', ignore: true },
  { path: 'campaignId', label: 'Campaign', kind: 'scalar', ignore: true },
  { path: 'amount', label: 'Budget', kind: 'money' },
  { path: 'name', label: 'Name', kind: 'text' },
  { path: 'startDate', label: 'Start date', kind: 'date' },
  { path: 'endDate', label: 'End date', kind: 'date' },
  { path: 'invoiceGroupingId', label: 'Invoice grouping ID', kind: 'text' },
  { path: 'externalBudgetId', label: 'External budget ID', kind: 'text' },
];

export const campaignBudgetList: FieldDef = {
  path: 'budgets',
  label: 'Budgets',
  kind: 'list',
  elementNoun: 'budget',
  elementLabel: (el: Image) => `Budget ${typeof el.name === 'string' ? el.name : ''}`.trim(),
  childFields: campaignBudgetFields.filter((f) => !f.ignore),
};
