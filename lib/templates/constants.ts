// Client safe labels of the targeting template form (module 10 2.7).
export type InventoryQualityKey =
  | 'AUTHORIZED_DIRECT_SELLERS'
  | 'AUTHORIZED_DIRECT_SELLERS_AND_RESELLERS'
  | 'AUTHORIZED_AND_NON_PARTICIPATING';

export const INVENTORY_QUALITY_LABEL: Record<InventoryQualityKey, string> = {
  AUTHORIZED_DIRECT_SELLERS: 'Authorized Direct Sellers',
  AUTHORIZED_DIRECT_SELLERS_AND_RESELLERS: 'Authorized Direct Sellers And Resellers',
  AUTHORIZED_AND_NON_PARTICIPATING: 'Authorized and Non-Participating Publishers',
};
