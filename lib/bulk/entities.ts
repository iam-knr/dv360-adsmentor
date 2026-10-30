// The three grids that carry the Bulk Action bar (module 11 2.2).
export type BulkEntityKey = 'campaign' | 'insertionOrder' | 'lineItem';

export const ENTITY_NOUN: Record<BulkEntityKey, { one: string; many: string }> = {
  campaign: { one: 'campaign', many: 'campaigns' },
  insertionOrder: { one: 'insertion order', many: 'insertion orders' },
  lineItem: { one: 'line item', many: 'line items' },
};

export function nounFor(entity: BulkEntityKey, n: number): string {
  return n === 1 ? ENTITY_NOUN[entity].one : ENTITY_NOUN[entity].many;
}
