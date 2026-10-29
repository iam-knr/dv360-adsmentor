// InsertionOrder registry (module 07 3.2, module 05 4.1). Every Prisma column is registered or ignored;
// tests/services/insertion-orders/registry.test.ts proves it from the schema.
import type { EntityRegistry } from '../registry-types';
import { budgetSegmentList } from './budget-segment';
import { partnerCostList } from './partner-cost';

export const insertionOrderRegistry: EntityRegistry = {
  entityType: 'INSERTION_ORDER',
  model: 'InsertionOrder',
  noun: 'insertion order',
  version: 1,
  include: {
    segments: { orderBy: { ordinal: 'asc' } },
    fees: { orderBy: [{ kind: 'asc' }, { slot: 'asc' }] },
  },
  fields: [
    { path: 'id', label: 'ID', kind: 'scalar', ignore: true },
    { path: 'sandboxId', label: 'Sandbox', kind: 'scalar', ignore: true },
    { path: 'publicId', label: 'Insertion order ID', kind: 'scalar', ignore: true },
    { path: 'campaignId', label: 'Campaign', kind: 'scalar', ignore: true },
    { path: 'advertiserId', label: 'Advertiser', kind: 'scalar', ignore: true },
    { path: 'name', label: 'Name', kind: 'text' },
    { path: 'status', label: 'Status', kind: 'enum' },
    { path: 'type', label: 'Insertion order type', kind: 'enum' },
    { path: 'objective', label: 'Objective', kind: 'enum' },
    { path: 'budgetUnit', label: 'Budget type', kind: 'enum' },
    { path: 'pacingPeriod', label: 'Pacing period', kind: 'enum' },
    { path: 'pacingType', label: 'Pacing type', kind: 'enum' },
    { path: 'dailyMaxAmount', label: 'Daily maximum amount', kind: 'money' },
    { path: 'dailyMaxImpressions', label: 'Daily maximum impressions', kind: 'scalar' },
    { path: 'kpi', label: 'KPI', kind: 'enum' },
    { path: 'kpiValue', label: 'KPI value', kind: 'scalar' },
    { path: 'kpiOtherText', label: 'KPI description', kind: 'text' },
    { path: 'bidBudgetControl', label: 'Optimization', kind: 'enum' },
    { path: 'optimizeTarget', label: 'Optimized towards', kind: 'enum' },
    { path: 'prioritizeFullBudget', label: 'Prioritize spending full budget', kind: 'bool' },
    { path: 'autoBudgetAllocation', label: 'Automatic budget allocation', kind: 'bool' },
    {
      path: 'ytReachFreqOptimization',
      label: 'YouTube reach and frequency optimization',
      kind: 'bool',
    },
    { path: 'freqMode', label: 'Frequency cap', kind: 'enum' },
    { path: 'freqMaxExposures', label: 'Frequency cap exposures', kind: 'scalar' },
    { path: 'freqUnit', label: 'Frequency cap period', kind: 'enum' },
    { path: 'freqUnitCount', label: 'Frequency cap period count', kind: 'scalar' },
    { path: 'integrationCode', label: 'Integration code', kind: 'text' },
    { path: 'integrationDetail', label: 'Integration detail', kind: 'text' },
    budgetSegmentList,
    partnerCostList,
    { path: 'version', label: 'Version', kind: 'scalar', ignore: true },
    { path: 'createdAt', label: 'Created', kind: 'date', ignore: true },
    { path: 'updatedAt', label: 'Updated', kind: 'date', ignore: true },
  ],
};
