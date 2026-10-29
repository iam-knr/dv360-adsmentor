// Deal registry (module 05 4.1, module 13 4.6): what the deal History tab shows. Students change status, frequency cap
// and advertiser access; the rest of the row is the seller's and is created once, so it is logged on create only.
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

export const dealFields: FieldDef[] = [
  ignored('id', 'ID'),
  ignored('sandboxId', 'Sandbox'),
  ignored('publicId', 'Deal ID'),
  ignored('partnerId', 'Partner'),
  ignored('orderId', 'Order'),
  ignored('exchangeId', 'Exchange'),
  scalar('dealId', 'Deal ID'),
  scalar('name', 'Name', 'text'),
  scalar('description', 'Description', 'text'),
  scalar('status', 'Status', 'enum'),
  scalar('dealType', 'Deal type', 'enum'),
  scalar('sellerName', 'Seller'),
  ignored('sellerKind', 'Seller kind'),
  scalar('allowPausing', 'Allow pausing', 'bool'),
  scalar('deliveryMethod', 'Delivery method', 'enum'),
  scalar('commitment', 'Commitment', 'enum'),
  scalar('pgDirect', 'Programmatic Guaranteed Direct', 'bool'),
  scalar('rateType', 'Rate type', 'enum'),
  scalar('rate', 'Rate', 'money'),
  scalar('floorPrice', 'Floor price', 'money'),
  scalar('quantityImpressions', 'Quantity'),
  scalar('startAt', 'Start date', 'date'),
  scalar('endAt', 'End date', 'date'),
  { path: 'frequencyCap', label: 'Frequency cap', kind: 'json' },
  scalar('format', 'Format', 'enum'),
  scalar('allAdvertisers', 'All advertisers permissioned', 'bool'),
  scalar('source', 'Source', 'enum'),
  ignored('fillPct', 'Fill'),
  ignored('lastDeliveredAt', 'Last delivered'),
  ignored('shortfallImpressions', 'Shortfall'),
  ignored('dayTimeSpec', 'Day and time'),
  ignored('targetingSummary', 'Targeting'),
  ignored('bidRatioPct', 'Bid ratio'),
  ignored('centralPartnerDeal', 'Central partner deal'),
  ignored('creativeSource', 'Creative source'),
  ignored('durationSeconds', 'Duration'),
  ignored('cost', 'Cost'),
  ignored('shareOfVoicePct', 'Share of voice'),
  ignored('sizes', 'Sizes'),
  ignored('version', 'Version'),
  { path: 'createdAt', label: 'Created', kind: 'date', ignore: true },
  { path: 'updatedAt', label: 'Updated', kind: 'date', ignore: true },
];

const accessFields: FieldDef[] = [
  {
    path: 'advertiserAccess',
    label: 'Advertiser access',
    kind: 'list',
    elementKey: (el) => String(el.advertiserId),
    elementLabel: (el) => String(el.advertiserName ?? el.advertiserId),
    elementNoun: 'advertiser',
  },
  {
    path: 'lineItems',
    label: 'Line items',
    kind: 'list',
    elementKey: (el) => String(el.lineItemId),
    elementLabel: (el) => String(el.lineItemName ?? el.lineItemId),
    elementNoun: 'line item',
  },
];

/** The deal with its advertiser access list and assigned line items as one image. */
export async function loadDealImage(tx: Tx, id: string): Promise<Image | null> {
  const row = await tx.inventorySourceDeal.findUnique({
    where: { id },
    include: { access: true },
  });
  if (!row) return null;
  const advertiserIds = row.access.map((a) => a.advertiserId).filter((v): v is string => !!v);
  const names = advertiserIds.length
    ? await tx.advertiser.findMany({
        where: { id: { in: advertiserIds } },
        select: { id: true, name: true },
      })
    : [];
  const nameOf = new Map(names.map((n) => [n.id, n.name]));
  const assigned = await tx.lineItemInventory.findMany({
    where: { kind: 'DEAL', refId: id, mode: 'INCLUDE' },
    select: { lineItemId: true, lineItem: { select: { name: true } } },
    orderBy: { lineItemId: 'asc' },
  });
  const { access: _access, ...columns } = row;
  void _access;
  return {
    ...columns,
    advertiserAccess: advertiserIds.map((advertiserId) => ({
      advertiserId,
      advertiserName: nameOf.get(advertiserId) ?? advertiserId,
    })),
    lineItems: assigned.map((a) => ({ lineItemId: a.lineItemId, lineItemName: a.lineItem.name })),
  };
}

export const dealRegistry: EntityRegistry = {
  entityType: 'DEAL',
  model: 'InventorySourceDeal',
  noun: 'deal',
  version: 1,
  fields: [...dealFields, ...accessFields],
  load: loadDealImage,
};
