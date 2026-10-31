// Line item registry (module 05 4.1, module 08 4.5 item 1). Every Prisma column of LineItem is registered or ignored;
// child tables (creative assignments, partner costs, conversions, inventory rows) are list fields whose element
// columns are registered in `line-item-child.ts`. tests/services/line-items/registry.db.test.ts proves it from the schema.
import type { EntityRegistry, FieldDef, Image } from '../registry-types';
import type { Tx } from '@/lib/db';
import { CARD_LABEL, rowsOf } from '@/lib/targeting/dimensions';
import { loadTargetingState } from '@/lib/targeting';
import { summarizeTargeting } from '@/lib/targeting/summary';
import {
  creativeAssignmentFields,
  floodlightFields,
  inventoryFields,
  partnerCostFields,
} from './line-item-child';

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

/** Column fields of LineItem, in form order. */
export const lineItemColumnFields: FieldDef[] = [
  ignored('id', 'ID'),
  ignored('sandboxId', 'Sandbox'),
  ignored('publicId', 'Line item ID'),
  ignored('ioId', 'Insertion order'),
  ignored('campaignId', 'Campaign'),
  ignored('advertiserId', 'Advertiser'),
  scalar('name', 'Name', 'text'),
  scalar('status', 'Status', 'enum'),
  scalar('type', 'Line item type', 'enum'),
  scalar('appAdFormat', 'Ad type', 'enum'),
  scalar('mobileAppPlatform', 'Mobile app platform', 'enum'),
  scalar('mobileAppId', 'Mobile app'),
  scalar('ytSubtype', 'YouTube subtype', 'enum'),
  { path: 'ytSurfaces', label: 'YouTube ad formats', kind: 'json' },
  scalar('targetingTemplateId', 'Targeting template'),
  scalar('inventoryQuality', 'Inventory quality', 'enum'),
  scalar('targetCuratedCtv', 'Target DV360 curated CTV auction inventory', 'bool'),
  scalar('optimizedTargeting', 'Optimized targeting', 'bool'),
  scalar('flightMode', 'Flight dates', 'enum'),
  scalar('flightStart', 'Start date', 'date'),
  scalar('flightEnd', 'End date', 'date'),
  scalar('budgetMode', 'Budget', 'enum'),
  scalar('budgetAmount', 'Budget amount', 'money'),
  scalar('pacingPeriod', 'Pacing period', 'enum'),
  scalar('pacingType', 'Pacing type', 'enum'),
  scalar('dailyMaxAmount', 'Daily amount', 'money'),
  scalar('dailyMaxImpressions', 'Daily impressions'),
  scalar('bidKind', 'Bid strategy', 'enum'),
  scalar('bidGoal', 'Optimized towards', 'enum'),
  scalar('bidPriority', 'Bid priority', 'enum'),
  scalar('bidTargetValue', 'Bid target value', 'money'),
  scalar('fixedBidCpm', 'Fixed bid', 'money'),
  scalar('customBiddingAlgorithmId', 'Custom bidding algorithm'),
  scalar('creativeOptimization', 'Creative optimization', 'bool'),
  scalar('freqMode', 'Frequency cap', 'enum'),
  scalar('freqMaxExposures', 'Frequency exposures'),
  scalar('freqUnit', 'Frequency period', 'enum'),
  scalar('freqUnitCount', 'Frequency period count'),
  scalar('viewFreqMode', 'View frequency cap', 'enum'),
  scalar('viewFreqMax', 'View frequency views'),
  scalar('viewFreqUnit', 'View frequency period', 'enum'),
  scalar('viewFreqUnitCount', 'View frequency period count'),
  scalar('targetFreqExposures', 'Target frequency exposures'),
  scalar('targetFreqUnit', 'Target frequency period', 'enum'),
  scalar('targetFreqUnitCount', 'Target frequency period count'),
  scalar('conversionCounting', 'Conversion counting', 'enum'),
  scalar('conversionCountingPct', 'Post-view conversions counted (%)'),
  scalar('attributionModelId', 'Attribution model'),
  scalar('euPoliticalAds', 'EU political ads', 'enum'),
  scalar('revenueModelType', 'Revenue model', 'enum'),
  scalar('revenueMarkupPct', 'Revenue markup (%)'),
  scalar('revenueCpm', 'Revenue CPM', 'money'),
  scalar('productFeedEnabled', 'Product feed', 'bool'),
  { path: 'relatedVideoIds', label: 'Related videos', kind: 'json' },
  scalar('integrationCode', 'Integration code', 'text'),
  scalar('integrationDetail', 'Integration detail', 'text'),
  ignored('copiedFromId', 'Copied from'),
  ignored('version', 'Version'),
  { path: 'createdAt', label: 'Created', kind: 'date', ignore: true },
  { path: 'updatedAt', label: 'Updated', kind: 'date', ignore: true },
];

/** Child tables logged per element (module 08 4.5 item 1). */
export const lineItemListFields: FieldDef[] = [
  {
    path: 'assignments',
    label: 'Creatives',
    kind: 'list',
    elementKey: (el) => String(el.creativeId),
    elementLabel: (el) => `Creative ${String(el.creativeId)}`,
    elementNoun: 'creative',
    childFields: creativeAssignmentFields.filter((f) => !f.ignore),
  },
  {
    path: 'fees',
    label: 'Partner costs',
    kind: 'list',
    elementKey: (el) => `${String(el.kind)}:${String(el.slot)}`,
    elementLabel: (el) =>
      `${el.kind === 'CPM_FEE' ? 'CPM fee' : 'Media fee'} ${Number(el.slot) + 1}`,
    elementNoun: 'partner cost',
    childFields: partnerCostFields.filter((f) => !f.ignore),
  },
  {
    path: 'lineItemFloodlightActivities',
    label: 'Conversions',
    kind: 'list',
    elementKey: (el) => String(el.activityId),
    elementLabel: (el) => `Floodlight activity ${String(el.activityId)}`,
    elementNoun: 'conversion',
    childFields: floodlightFields.filter((f) => !f.ignore),
  },
  {
    path: 'lineItemInventories',
    label: 'Inventory sources',
    kind: 'list',
    elementKey: (el) => `${String(el.kind)}:${String(el.refId)}`,
    elementLabel: (el) => `${String(el.kind)} ${String(el.refId)}`,
    elementNoun: 'inventory source',
    childFields: inventoryFields.filter((f) => !f.ignore),
  },
  // Q9: one element per targeting row of the card, with its readable summary before and after. Loaded by
  // `loadLineItemImage` below (not a relation), so a geography edit reads "Geography: Kerala to Kerala; exclusions ...".
  {
    path: 'targeting',
    label: 'Targeting',
    kind: 'list',
    elementKey: (el) => String(el.dimension),
    elementLabel: (el) => String(el.label),
    elementNoun: 'targeting row',
    childFields: [{ path: 'summary', label: 'Selection', kind: 'text' }],
  },
];

/** Default LineItem image plus the targeting rows as `{ dimension, label, summary }` elements. */
export async function loadLineItemImage(tx: Tx, id: string): Promise<Image | null> {
  const row = (await tx.lineItem.findUnique({
    where: { id },
    include: lineItemRegistry.include as never,
  })) as Image | null;
  if (!row) return null;
  const state = await loadTargetingState(tx, id);
  const targeting = rowsOf(state).flatMap((dimension) => {
    const summary = summarizeTargeting(dimension, state.criteria);
    return summary === null
      ? []
      : [{ dimension, label: CARD_LABEL[dimension] ?? dimension, summary }];
  });
  return { ...row, targeting };
}

export const lineItemRegistry: EntityRegistry = {
  entityType: 'LINE_ITEM',
  model: 'LineItem',
  noun: 'line item',
  version: 1,
  include: {
    assignments: { orderBy: { creativeId: 'asc' } },
    fees: { orderBy: [{ kind: 'asc' }, { slot: 'asc' }] },
    lineItemFloodlightActivities: { orderBy: { activityId: 'asc' } },
    lineItemInventories: { orderBy: [{ kind: 'asc' }, { refId: 'asc' }] },
  },
  load: loadLineItemImage,
  fields: [...lineItemColumnFields, ...lineItemListFields],
};
