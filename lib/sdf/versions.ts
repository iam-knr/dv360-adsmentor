// SDF versions (module 11 4.4 version matrix). Client safe.
export const SDF_VERSIONS = ['9', '9.1', '9.2', '10', '10.1', '11'] as const;
export type SdfVersion = (typeof SDF_VERSIONS)[number];

export const DEFAULT_SDF_VERSION: SdfVersion = '11';

export const versionIndex = (v: SdfVersion) => SDF_VERSIONS.indexOf(v);
export const isVersionAtLeast = (v: SdfVersion, min: SdfVersion) =>
  versionIndex(v) >= versionIndex(min);

/** Prisma enum value `V9_1` to the wire string `9.1`, and back. */
export const fromDbVersion = (v: string): SdfVersion =>
  v.replace(/^V/, '').replace('_', '.') as SdfVersion;
export const toDbVersion = (v: SdfVersion) =>
  `V${v.replace('.', '_')}` as 'V9' | 'V9_1' | 'V9_2' | 'V10' | 'V10_1' | 'V11';

/** Version 9 stops being supported on this sim date (BLK-022). */
export const SDF9_END = '2027-01-28';

export const SDF_ENTITIES = [
  'CAMPAIGNS',
  'MEDIA_PRODUCTS',
  'INSERTION_ORDERS',
  'LINE_ITEMS',
  'AD_GROUPS',
  'ADS',
] as const;
export type SdfEntity = (typeof SDF_ENTITIES)[number];

/** Processing order of an upload (4.7). Media products are reference data. */
export const UPLOAD_ORDER: readonly SdfEntity[] = [
  'CAMPAIGNS',
  'INSERTION_ORDERS',
  'LINE_ITEMS',
  'AD_GROUPS',
  'ADS',
];

export const ENTITY_FILE: Record<SdfEntity, string> = {
  CAMPAIGNS: 'SDF-Campaigns.csv',
  MEDIA_PRODUCTS: 'SDF-MediaProducts.csv',
  INSERTION_ORDERS: 'SDF-InsertionOrders.csv',
  LINE_ITEMS: 'SDF-LineItems.csv',
  AD_GROUPS: 'SDF-AdGroups.csv',
  ADS: 'SDF-Ads.csv',
};

export const ENTITY_LABEL: Record<SdfEntity, string> = {
  CAMPAIGNS: 'Campaigns',
  MEDIA_PRODUCTS: 'Media Products',
  INSERTION_ORDERS: 'Insertion orders',
  LINE_ITEMS: 'Line items',
  AD_GROUPS: 'Ad groups',
  ADS: 'Ads',
};
