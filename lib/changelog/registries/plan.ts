// Plan registry (module 04 4.2, 4.10): header fields and the plan line items as a list. Rows log per element:
// "1 plan line item added", "Plan line item 2: Budget changed from ... to ...".
import type { Tx } from '@/lib/db';
import type { EntityRegistry, FieldDef, Image } from '../registry-types';

const scalar = (path: string, label: string, kind: FieldDef['kind'] = 'scalar'): FieldDef => ({
  path,
  label,
  kind,
});
const ignored = (path: string, label: string): FieldDef => ({
  path,
  label,
  kind: 'scalar',
  ignore: true,
});

export const planFields: FieldDef[] = [
  ignored('id', 'ID'),
  ignored('sandboxId', 'Sandbox'),
  ignored('publicId', 'Plan ID'),
  ignored('advertiserId', 'Advertiser'),
  scalar('name', 'Name', 'text'),
  scalar('status', 'Status', 'enum'),
  scalar('locationCountry', 'Location'),
  scalar('currencyCode', 'Currency'),
  scalar('startDate', 'Start date', 'date'),
  scalar('endDate', 'End date', 'date'),
  scalar('totalBudget', 'Total budget', 'money'),
  { path: 'channels', label: 'Channels', kind: 'json' },
  { path: 'demographics', label: 'On-target demographics', kind: 'json' },
  { path: 'additionalSettings', label: 'Additional settings', kind: 'json' },
  scalar('frequencyGoal', 'Frequency goal'),
  scalar('reachBasis', 'Reach basis', 'enum'),
  scalar('includeYoutube', 'Include YouTube', 'bool'),
  ignored('forecastStale', 'Forecast out of date'),
  ignored('savedAt', 'Saved'),
  ignored('savedAtSim', 'Saved (sim)'),
  scalar('convertedCampaignId', 'Campaign'),
  ignored('version', 'Version'),
  { path: 'createdAt', label: 'Created', kind: 'date', ignore: true },
  { path: 'updatedAt', label: 'Updated', kind: 'date', ignore: true },
];

const rowFields: FieldDef[] = [
  ignored('id', 'ID'),
  ignored('sandboxId', 'Sandbox'),
  ignored('planId', 'Plan'),
  ignored('ordinal', 'Position'),
  scalar('name', 'Name', 'text'),
  scalar('buyingMethod', 'Buying method', 'enum'),
  { path: 'locations', label: 'Locations', kind: 'json' },
  scalar('startDate', 'Start date', 'date'),
  scalar('endDate', 'End date', 'date'),
  { path: 'targeting', label: 'Targeting', kind: 'json' },
  { path: 'audienceRefs', label: 'Audiences', kind: 'json' },
  scalar('pricing', 'Pricing'),
  scalar('dealId', 'Deal'),
  scalar('feePct', 'Fee'),
  scalar('budgetNet', 'Budget', 'money'),
  scalar('budgetTotal', 'Total budget', 'money'),
  scalar('maxCpm', 'Max. CPM', 'money'),
  ignored('isCpmLocked', 'CPM locked'),
];

export async function loadPlanImage(tx: Tx, id: string): Promise<Image | null> {
  const row = await tx.plan.findUnique({
    where: { id },
    include: { rows: { orderBy: { ordinal: 'asc' } } },
  });
  if (!row) return null;
  return row;
}

export const planRegistry: EntityRegistry = {
  entityType: 'PLAN',
  model: 'Plan',
  noun: 'plan',
  version: 1,
  fields: [
    ...planFields,
    {
      path: 'rows',
      label: 'Plan line items',
      kind: 'list',
      elementKey: (el) => String(el.id),
      elementLabel: (el) => `Plan line item ${Number(el.ordinal) + 1}`,
      elementNoun: 'plan line item',
      childFields: rowFields,
    },
  ],
  load: loadPlanImage,
};
