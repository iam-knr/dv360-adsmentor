// SDF column layouts per entity and version (module 11 4.4, Δ-11-1). One table per entity with `since` and `until`;
// the header of a version is the columns whose range contains it. Simulator definitions that approximate the public
// SDF reference (Q-11-01). Client safe: names and flags only, the value mappers live in `map-*.ts`.
import { versionIndex, type SdfEntity, type SdfVersion } from './versions';

export type ColumnKind =
  'int' | 'text' | 'epoch' | 'bool' | 'date' | 'money' | 'pct' | 'enum' | 'list' | 'tuple';

export interface ColumnDef {
  name: string;
  kind: ColumnKind;
  /** R in the tables. */
  required: boolean;
  /** RO in the tables: ignored on upload, a changed value raises BLK-028. */
  readOnly: boolean;
  since: SdfVersion;
  until?: SdfVersion;
  /** Legacy campaign / IO targeting column: must stay empty (BLK-003). */
  legacy: boolean;
}

type Opts = Partial<Pick<ColumnDef, 'required' | 'readOnly' | 'since' | 'until' | 'legacy'>>;
const col = (name: string, kind: ColumnKind, o: Opts = {}): ColumnDef => ({
  name,
  kind,
  required: false,
  readOnly: false,
  since: '9',
  legacy: false,
  ...o,
});
const req = (name: string, kind: ColumnKind, o: Opts = {}) =>
  col(name, kind, { required: true, ...o });
const ro = (name: string, kind: ColumnKind, o: Opts = {}) =>
  col(name, kind, { readOnly: true, ...o });
const legacy = (name: string) => col(name, 'text', { legacy: true, until: '9.2' });

const CAMPAIGNS: ColumnDef[] = [
  ro('Campaign Id', 'int', { required: true }),
  req('Advertiser Id', 'int'),
  req('Name', 'text'),
  col('Timestamp', 'epoch'),
  req('Status', 'enum'),
  req('Campaign Goal', 'enum'),
  req('Campaign Goal KPI', 'enum'),
  col('Campaign Goal KPI Value', 'money'),
  col('Campaign Goal KPI Other Text', 'text'),
  req('Creative Types', 'list'),
  col('Planned Spend', 'money'),
  req('Start Date', 'date'),
  col('End Date', 'date'),
  req('Frequency Enabled', 'bool'),
  col('Frequency Exposures', 'int'),
  col('Frequency Period', 'enum'),
  col('Frequency Amount', 'int'),
  col('Budget Type', 'enum'),
  col('Budgets', 'tuple'),
  col('Landing Page URLs', 'list'),
  col('Keywords', 'list'),
  legacy('Inventory Source Targeting - Include'),
  legacy('Geography Targeting - Include'),
  legacy('Geography Targeting - Exclude'),
  legacy('Language Targeting - Include'),
];

const MEDIA_PRODUCTS: ColumnDef[] = [
  ro('Media Product Id', 'text', { required: true }),
  ro('Name', 'text'),
  ro('Type', 'enum'),
  ro('Exchange', 'text'),
  ro('Status', 'enum'),
  ro('Rate', 'money'),
  ro('Start Date', 'date'),
  ro('End Date', 'date'),
  ro('Advertiser Ids', 'list'),
];

const INSERTION_ORDERS: ColumnDef[] = [
  ro('Io Id', 'int', { required: true }),
  req('Campaign Id', 'int'),
  req('Name', 'text'),
  col('Timestamp', 'epoch'),
  req('Status', 'enum'),
  req('Io Type', 'enum'),
  req('Objective', 'enum'),
  req('Budget Type', 'enum'),
  req('Budget Segments', 'tuple'),
  req('Pacing', 'enum'),
  req('Pacing Type', 'enum'),
  col('Pacing Amount', 'money'),
  req('Frequency Enabled', 'bool'),
  col('Frequency Exposures', 'int'),
  col('Frequency Period', 'enum'),
  col('Frequency Amount', 'int'),
  col('Performance Goal Type', 'enum'),
  col('Performance Goal Value', 'money'),
  req('Bid And Budget Control', 'enum'),
  col('Optimized Towards', 'enum'),
  col('Prioritize Full Budget', 'bool'),
  col('Auto Budget Allocation', 'bool'),
  col('Youtube Reach Frequency Optimization', 'bool', { since: '10' }),
  col('CPM Fee 1 Type', 'enum'),
  col('CPM Fee 1 Amount', 'money'),
  col('CPM Fee 1 Invoiced', 'bool'),
  col('CPM Fee 2 Type', 'enum'),
  col('CPM Fee 2 Amount', 'money'),
  col('CPM Fee 2 Invoiced', 'bool'),
  col('Media Fee 2 Type', 'enum'),
  col('Media Fee 2 Percent', 'pct'),
  col('Media Fee 2 Invoiced', 'bool'),
  col('Integration Code', 'text'),
  col('Details', 'text'),
  legacy('Inventory Source Targeting - Include'),
  legacy('Geography Targeting - Include'),
  legacy('Geography Targeting - Exclude'),
];

const LINE_ITEMS: ColumnDef[] = [
  ro('Line Item Id', 'int', { required: true }),
  req('Io Id', 'int'),
  req('Type', 'enum'),
  col('Subtype', 'enum'),
  req('Name', 'text'),
  col('Timestamp', 'epoch'),
  req('Status', 'enum'),
  col('Mobile App Platform', 'enum'),
  col('Mobile App Id', 'text'),
  col('App Ad Format', 'enum'),
  req('Flight Mode', 'enum'),
  col('Start Date', 'date'),
  col('End Date', 'date'),
  req('Budget Mode', 'enum'),
  col('Budget Amount', 'money'),
  req('Pacing', 'enum'),
  req('Pacing Type', 'enum'),
  col('Pacing Amount', 'money'),
  col('Frequency Enabled', 'bool'),
  col('Frequency Exposures', 'int'),
  col('Frequency Period', 'enum'),
  col('Frequency Amount', 'int'),
  col('View Frequency Enabled', 'bool'),
  col('View Frequency Views', 'int'),
  col('View Frequency Period', 'enum'),
  col('View Frequency Amount', 'int'),
  col('Target Frequency Exposures', 'int', { since: '10' }),
  col('Target Frequency Period', 'enum', { since: '10' }),
  col('Target Frequency Amount', 'int', { since: '10' }),
  req('Bid Strategy Type', 'enum'),
  col('Bid Strategy Value', 'money'),
  col('Bid Priority', 'enum'),
  col('Custom Bidding Algorithm Id', 'int'),
  req('Inventory Quality', 'enum'),
  col('Public Inventory Exchanges', 'list'),
  col('Target New Exchanges', 'bool'),
  col('Target Curated CTV', 'bool', { since: '9.1' }),
  col('Deal Ids', 'list'),
  col('Deal Group Ids', 'list'),
  col('Optimized Targeting', 'bool'),
  col('Targeting Template Id', 'int'),
  col('Geography Targeting - Include', 'list'),
  col('Geography Targeting - Exclude', 'list'),
  col('Geography Radius', 'tuple'),
  col('Location List Ids', 'list'),
  col('Language Targeting - Include', 'list'),
  col('Language Targeting - Exclude', 'list'),
  col('Audience Targeting - First Party Include Groups', 'tuple'),
  col('Audience Targeting - Google Include', 'list'),
  col('Audience Targeting - Combined Include', 'list'),
  col('Audience Targeting - Custom List Include', 'list'),
  col('Audience Targeting - First Party Exclude', 'list'),
  col('Audience Targeting - Google Exclude', 'list'),
  col('Gender Targeting', 'list'),
  col('Age Range', 'text'),
  col('Parental Status', 'list'),
  col('Household Income Targeting', 'list'),
  col('Day And Time Targeting', 'tuple'),
  col('Day And Time Time Zone', 'enum'),
  col('Device Type Targeting - Include', 'list'),
  col('Device Type Targeting - Exclude', 'list'),
  col('Operating System Targeting', 'list'),
  col('Make Model Targeting', 'list'),
  col('Browser Targeting - Include', 'list'),
  col('Browser Targeting - Exclude', 'list'),
  col('Connection Speed Targeting', 'enum'),
  col('Carrier And ISP Targeting - Include', 'list'),
  col('Carrier And ISP Targeting - Exclude', 'list'),
  col('Environment Targeting', 'list'),
  col('Viewability Targeting Predicted', 'text'),
  col('Position Targeting - On Screen', 'list'),
  col('Position Targeting - In Content', 'list'),
  col('Position Targeting - Native', 'list'),
  col('Video Player Size Targeting', 'list'),
  col('Content Duration Targeting', 'list'),
  col('Livestream Targeting', 'enum'),
  col('Rewarded Targeting', 'enum'),
  col('Category Targeting - Include', 'list'),
  col('Category Targeting - Exclude', 'list'),
  col('Keyword Targeting - Include', 'list'),
  col('Keyword Targeting - Exclude', 'list'),
  col('Negative Keyword List Ids', 'list'),
  col('Apps And Urls Targeting - Include', 'list'),
  col('Apps And Urls Targeting - Exclude', 'list'),
  col('Brand Suitability Third Party Provider', 'enum'),
  col('Brand Suitability Third Party Options', 'list'),
  ro('Brand Suitability Inventory Mode', 'enum'),
  col('Creative Ids', 'list'),
  col('Creative Optimization', 'bool'),
  col('Conversion Floodlight Activity Ids', 'list'),
  col('Conversion Counting', 'enum'),
  col('Conversion Counting Percent', 'int'),
  col('Attribution Model Id', 'int'),
  col('Contains EU Political Ads', 'enum', { since: '9.2' }),
  col('Revenue Model Type', 'enum'),
  col('Revenue Model Value', 'money'),
  col('CPM Fee 1 Type', 'enum'),
  col('CPM Fee 1 Amount', 'money'),
  col('CPM Fee 1 Invoiced', 'bool'),
  col('CPM Fee 2 Type', 'enum'),
  col('CPM Fee 2 Amount', 'money'),
  col('CPM Fee 2 Invoiced', 'bool'),
  col('Media Fee 2 Type', 'enum'),
  col('Media Fee 2 Percent', 'pct'),
  col('Media Fee 2 Invoiced', 'bool'),
  col('Product Feed Enabled', 'bool'),
  col('Related Video Ids', 'list'),
  col('Youtube Ad Formats', 'list'),
  col('Demand Gen Audience Expansion', 'bool', { since: '10' }),
  col('Integration Code', 'text'),
  col('Details', 'text'),
  ro('Advanced Ad Serving Rate', 'money'),
  col('Inventory Source Targeting - Include', 'text', { legacy: false, until: '9.1' }),
  col('Inventory Source Targeting - Exclude', 'text', { legacy: false, until: '9.1' }),
];

const AD_GROUPS: ColumnDef[] = [
  ro('Ad Group Id', 'int', { required: true }),
  req('Line Item Id', 'int'),
  req('Name', 'text'),
  col('Timestamp', 'epoch'),
  req('Status', 'enum'),
  ro('Ad Source', 'text'),
  req('Bid Value', 'money'),
  col('Gender Targeting', 'list'),
  col('Age Range', 'text'),
  col('Parental Status', 'list'),
  col('Household Income Targeting', 'list'),
  col('Audience Targeting - Include', 'list'),
  col('Audience Targeting - Exclude', 'list'),
  col('Audience Expansion', 'bool', { since: '9.1' }),
  col('Placement Channels', 'list'),
  col('Placement Videos', 'list'),
  col('Placement Apps', 'list'),
  col('Keyword Targeting - Include', 'list'),
  col('Category Targeting - Include', 'list'),
];

const ADS: ColumnDef[] = [
  ro('Ad Id', 'int', { required: true }),
  req('Ad Group Id', 'int'),
  req('Name', 'text'),
  col('Timestamp', 'epoch'),
  req('Status', 'enum'),
  req('Format', 'enum'),
  req('Video Id', 'text'),
  col('Headline', 'text'),
  req('Long Headline', 'text'),
  req('Description', 'text'),
  col('Call To Action', 'text'),
  col('Business Name', 'text', { since: '10.1' }),
  col('Logo Asset Id', 'int', { since: '10.1' }),
  col('Display URL Domain', 'text'),
  col('Display URL Path 1', 'text'),
  col('Display URL Path 2', 'text'),
  req('Landing Page URL', 'text'),
  col('Click Tracker URL', 'text'),
  col('Impression Tracker URL', 'text', { since: '11' }),
  col('Url Suffix', 'text', { since: '11' }),
  ro('Review Status', 'enum'),
  ro('Review Feedback', 'text'),
];

export const LAYOUTS: Record<SdfEntity, readonly ColumnDef[]> = {
  CAMPAIGNS,
  MEDIA_PRODUCTS,
  INSERTION_ORDERS,
  LINE_ITEMS,
  AD_GROUPS,
  ADS,
};

const inVersion = (c: ColumnDef, v: SdfVersion) =>
  versionIndex(v) >= versionIndex(c.since) &&
  (!c.until || versionIndex(v) <= versionIndex(c.until));

/** The columns of one entity file in one version, in file order. */
export function columnsFor(entity: SdfEntity, version: SdfVersion): ColumnDef[] {
  return LAYOUTS[entity].filter((c) => inVersion(c, version));
}

export const headerFor = (entity: SdfEntity, version: SdfVersion): string[] =>
  columnsFor(entity, version).map((c) => c.name);

/** Rows: the entity files and what identifies them (4.4 notes). */
export const ID_COLUMN: Record<SdfEntity, string> = {
  CAMPAIGNS: 'Campaign Id',
  MEDIA_PRODUCTS: 'Media Product Id',
  INSERTION_ORDERS: 'Io Id',
  LINE_ITEMS: 'Line Item Id',
  AD_GROUPS: 'Ad Group Id',
  ADS: 'Ad Id',
};

export const PARENT_COLUMN: Partial<Record<SdfEntity, string>> = {
  INSERTION_ORDERS: 'Campaign Id',
  LINE_ITEMS: 'Io Id',
  AD_GROUPS: 'Line Item Id',
  ADS: 'Ad Group Id',
};
