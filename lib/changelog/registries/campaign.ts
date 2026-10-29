// Campaign registry (module 06 3.2, module 05 4.1). Every Prisma column is registered or ignored;
// tests/services/campaigns/registry.test.ts proves it from the schema.
import type { EntityRegistry } from '../registry-types';
import { campaignBudgetList } from './campaign-budget';

export const campaignRegistry: EntityRegistry = {
  entityType: 'CAMPAIGN',
  model: 'Campaign',
  noun: 'campaign',
  version: 1,
  include: { budgets: { orderBy: { id: 'asc' } } },
  fields: [
    { path: 'id', label: 'ID', kind: 'scalar', ignore: true },
    { path: 'sandboxId', label: 'Sandbox', kind: 'scalar', ignore: true },
    { path: 'publicId', label: 'Campaign ID', kind: 'scalar', ignore: true },
    { path: 'advertiserId', label: 'Advertiser', kind: 'scalar', ignore: true },
    { path: 'name', label: 'Name', kind: 'text' },
    { path: 'status', label: 'Status', kind: 'enum' },
    { path: 'goal', label: 'Goal', kind: 'enum' },
    { path: 'kpi', label: 'KPI', kind: 'enum' },
    { path: 'kpiValue', label: 'KPI value', kind: 'scalar' },
    { path: 'kpiOtherText', label: 'KPI description', kind: 'text' },
    { path: 'creativeTypes', label: 'Creative types', kind: 'json' },
    { path: 'plannedSpend', label: 'Planned spend', kind: 'money' },
    { path: 'plannedStart', label: 'Start date', kind: 'date' },
    { path: 'plannedEnd', label: 'End date', kind: 'date' },
    { path: 'freqMode', label: 'Frequency cap', kind: 'enum' },
    { path: 'freqMaxExposures', label: 'Frequency cap exposures', kind: 'scalar' },
    { path: 'freqUnit', label: 'Frequency cap period', kind: 'enum' },
    { path: 'freqUnitCount', label: 'Frequency cap period count', kind: 'scalar' },
    { path: 'landingPageUrls', label: 'Landing page URLs', kind: 'json' },
    { path: 'keywords', label: 'Keywords', kind: 'json' },
    { path: 'copiedFromId', label: 'Copied from', kind: 'scalar', ignore: true },
    { path: 'budgetUnit', label: 'Budget type', kind: 'enum' },
    campaignBudgetList,
    { path: 'version', label: 'Version', kind: 'scalar', ignore: true },
    { path: 'createdAt', label: 'Created', kind: 'date', ignore: true },
    { path: 'updatedAt', label: 'Updated', kind: 'date', ignore: true },
  ],
};
