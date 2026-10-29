// Every row of routes.md section 3 as data. The shell tests walk it: each page row must have a page file in the
// right frame, return 200 for a STANDARD student and 404 for a foreign sandbox (routes.md 9 smoke).
//
// `path` uses the DV360 placeholders of routes.md: {pid} {aid} {cid} {ioId} {liId}, and {x} for any other id.
// `folder` is the folder under app/ that holds page.tsx. `view` is the view code of the Access column (routes.md 2).

export type Frame = 'G' | 'P' | 'A' | 'C' | 'IO' | 'LI' | 'F' | 'R' | '404' | '-';
export type ViewCode = 'PUBLIC' | 'ANY' | 'REP' | 'RO' | 'STD' | 'ADM';

export interface RouteRow {
  path: string;
  folder: string;
  frame: Frame;
  /** Module spec that owns the page (docs/specs/modules/NN-*.md). */
  module: string;
  title: string;
  view: ViewCode;
  /** Redirect rows: where they land (placeholders as in `path`). */
  redirectTo?: string;
}

const G = '(dv)/(app)/(global)';
const AP = '(dv)/(app)/p/[partnerId]';
const FP = '(dv)/(full)/p/[partnerId]';
const AA = `${AP}/a/[advertiserId]`;
const FA = `${FP}/a/[advertiserId]`;
const AC = `${AA}/c/[campaignId]`;
const FC = `${FA}/c/[campaignId]`;
const AIO = `${AC}/io/[ioId]`;
const FIO = `${FC}/io/[ioId]`;
const ALI = `${AIO}/li/[liId]`;

const P = '/p/{pid}';
const A = `${P}/a/{aid}`;
const C = `${A}/c/{cid}`;
const IO = `${C}/io/{ioId}`;
const LI = `${IO}/li/{liId}`;

type Row = [
  path: string,
  folder: string,
  frame: Frame,
  module: string,
  title: string,
  view: ViewCode,
];
const row = ([path, folder, frame, module, title, view]: Row): RouteRow => ({
  path,
  folder,
  frame,
  module,
  title,
  view,
});

const PAGES: Row[] = [
  // 3.1 Global
  ['/bulk-status', `${G}/bulk-status`, 'G', '01', 'Bulk status', 'REP'],
  ['/users', `${G}/users`, 'G', '02', 'Users', 'RO'],
  ['/users/new', `${G}/users/new`, 'G', '02', 'New user', 'ADM'],
  ['/users/{x}', `${G}/users/[userId]`, 'G', '02', 'Edit user', 'ADM'],
  ['/email-preferences', `${G}/email-preferences`, 'G', '02', 'Email preferences', 'ANY'],
  ['/404', '404', '404', '01', 'Page not found', 'PUBLIC'],
  // 3.2 Partner
  [`${P}/home_v3`, `${AP}/(partner)/home_v3`, 'P', '01', 'Overview', 'RO'],
  [`${P}/advertisers`, `${AP}/(partner)/advertisers`, 'P', '02', 'Advertisers', 'RO'],
  [`${P}/advertisers/new`, `${FP}/advertisers/new`, 'F', '02', 'New advertiser', 'STD'],
  [`${P}/details`, `${AP}/(partner)/details`, 'P', '02', 'Basic details', 'RO'],
  [`${P}/targeting`, `${AP}/(partner)/targeting`, 'P', '02', 'Targeting', 'RO'],
  [
    `${P}/third-party-configuration`,
    `${AP}/(partner)/third-party-configuration`,
    'P',
    '02',
    'Advertiser configurations',
    'RO',
  ],
  [`${P}/brand/controls`, `${AP}/(partner)/brand/controls`, 'P', '02', 'Brand controls', 'RO'],
  [`${P}/channels`, `${AP}/(partner)/channels`, 'P', '15', 'Channels', 'RO'],
  [`${P}/custom-bidding`, `${AP}/(partner)/custom-bidding`, 'P', '15', 'Custom bidding', 'RO'],
  [`${P}/custom-bidding/new`, `${FP}/custom-bidding/new`, 'F', '15', 'New algorithm', 'STD'],
  [`${P}/floodlights`, `${AP}/(partner)/floodlights`, 'P', '15', 'Floodlight groups', 'RO'],
  [
    `${P}/cross-media-reach`,
    `${AP}/(partner)/cross-media-reach`,
    'P',
    '04',
    'Cross-media reach',
    'REP',
  ],
  [
    `${P}/cross-media-reach/new`,
    `${FP}/cross-media-reach/new`,
    'F',
    '04',
    'Create a report',
    'REP',
  ],
  [
    `${P}/cross-media-reach/{x}`,
    `${FP}/cross-media-reach/[reportId]`,
    'F',
    '04',
    'Cross-media reach report',
    'REP',
  ],
  // 3.3 Advertiser
  [`${A}/cs`, `${AA}/(advertiser)/cs`, 'A', '06', 'Campaigns', 'RO'],
  [`${A}/cs/new`, `${FA}/cs/new`, 'F', '06', 'New campaign', 'STD'],
  [`${A}/explorerios`, `${AA}/(advertiser)/explorerios`, 'A', '07', 'Insertion orders', 'RO'],
  [`${A}/explorerlis`, `${AA}/(advertiser)/explorerlis`, 'A', '08', 'Line items', 'RO'],
  [`${A}/history`, `${AA}/(advertiser)/history`, 'A', '05', 'History', 'RO'],
  [`${A}/templates`, `${AA}/(advertiser)/templates`, 'A', '10', 'Targeting templates', 'RO'],
  [`${A}/templates/new`, `${FA}/templates/new`, 'F', '10', 'New template', 'STD'],
  [`${A}/templates/{x}`, `${FA}/templates/[templateId]`, 'F', '10', 'Edit template', 'STD'],
  [`${A}/experiments`, `${AA}/(advertiser)/experiments`, 'A', '17', 'Experiments', 'RO'],
  [`${A}/experiments/new`, `${FA}/experiments/new`, 'F', '17', 'Create A/B test', 'STD'],
  [`${A}/e/{x}`, `${FA}/e/[testId]`, 'F', '17', 'A/B test report', 'RO'],
  [
    `${A}/e/{x}/report/settings`,
    `${FA}/e/[testId]/report/settings`,
    'F',
    '17',
    'A/B test settings',
    'RO',
  ],
  [
    `${A}/e/{x}/report/diff`,
    `${FA}/e/[testId]/report/diff`,
    'F',
    '17',
    'A/B test differences',
    'RO',
  ],
  [
    `${A}/brand-lift-measurements`,
    `${AA}/(advertiser)/brand-lift-measurements`,
    'A',
    '17',
    'Lift studies',
    'RO',
  ],
  [
    `${A}/brand-lift-measurements/new`,
    `${FA}/brand-lift-measurements/new`,
    'F',
    '17',
    'New lift study',
    'STD',
  ],
  [
    `${A}/brand-lift-measurements/{x}/report`,
    `${FA}/brand-lift-measurements/[studyId]/report`,
    'F',
    '17',
    'Brand Lift Report',
    'RO',
  ],
  [
    `${A}/brand-lift-measurements/{x}/edit`,
    `${FA}/brand-lift-measurements/[studyId]/edit`,
    'F',
    '17',
    'Review and fix',
    'STD',
  ],
  // 3.4 Campaign
  [`${C}/explorerios`, `${AC}/(campaign)/explorerios`, 'C', '06', 'Insertion orders', 'RO'],
  [`${C}/explorerlis`, `${AC}/(campaign)/explorerlis`, 'C', '06', 'Line items', 'RO'],
  [`${C}/explorercombined`, `${AC}/(campaign)/explorercombined`, 'C', '06', 'Combined', 'RO'],
  [`${C}/details`, `${AC}/(campaign)/details`, 'C', '06', 'Campaign settings', 'RO'],
  [`${C}/alerts`, `${AC}/(campaign)/alerts`, 'C', '06', 'Alerts', 'RO'],
  [`${C}/history`, `${AC}/(campaign)/history`, 'C', '05', 'History', 'RO'],
  [
    `${C}/marketplace/inventory`,
    `${AC}/(campaign)/marketplace/inventory`,
    'C',
    '13',
    'My inventory',
    'RO',
  ],
  [
    `${C}/marketplace/inventory/package`,
    `${AC}/(campaign)/marketplace/inventory/package`,
    'C',
    '13',
    'Packages',
    'RO',
  ],
  [
    `${C}/marketplace/inventory/groups`,
    `${AC}/(campaign)/marketplace/inventory/groups`,
    'C',
    '13',
    'Deal groups',
    'RO',
  ],
  [
    `${C}/tid/{x}/marketplace/inventory/details`,
    `${AC}/(campaign)/tid/[tid]/marketplace/inventory/details`,
    'C',
    '13',
    'Deal',
    'RO',
  ],
  [
    `${C}/marketplace/featured-v3`,
    `${AC}/(campaign)/marketplace/featured-v3`,
    'C',
    '13',
    'Marketplace',
    'RO',
  ],
  [
    `${C}/marketplace-discovery`,
    `${AC}/(campaign)/marketplace-discovery`,
    'C',
    '13',
    'Discover',
    'RO',
  ],
  [
    `${C}/marketplace/negotiations`,
    `${AC}/(campaign)/marketplace/negotiations`,
    'C',
    '13',
    'Negotiations',
    'RO',
  ],
  [
    `${C}/marketplace/negotiations/{x}`,
    `${AC}/(campaign)/marketplace/negotiations/[negId]`,
    'C',
    '13',
    'Negotiation',
    'RO',
  ],
  [`${C}/ios/new`, `${FC}/ios/new`, 'F', '07', 'New insertion order', 'STD'],
  // 3.5 Insertion order
  [`${IO}/explorerlis`, `${AIO}/(io)/explorerlis`, 'IO', '07', 'Line items', 'RO'],
  [`${IO}/details`, `${AIO}/(io)/details`, 'IO', '07', 'Insertion order details', 'RO'],
  [`${IO}/history`, `${AIO}/(io)/history`, 'IO', '05', 'History', 'RO'],
  [`${IO}/lis/new`, `${FIO}/lis/new`, 'F', '08', 'New line item', 'STD'],
  // 3.6 Line item and ad group
  [`${LI}/details`, `${ALI}/details`, 'LI', '08', 'Line item details', 'RO'],
  [`${LI}/troubleshooter`, `${ALI}/troubleshooter`, 'LI', '08', 'Troubleshooter', 'RO'],
  [`${LI}/history`, `${ALI}/history`, 'LI', '05', 'History', 'RO'],
  [`${LI}/adgroups`, `${ALI}/adgroups`, 'LI', '09', 'Ad groups', 'RO'],
  // 3.7 Creatives
  [`${A}/creatives`, `${AA}/(advertiser)/creatives`, 'A', '12', 'Creatives', 'RO'],
  [`${A}/creatives/new`, `${FA}/creatives/new`, 'F', '12', 'New creative', 'STD'],
  [`${A}/creatives/{x}`, `${FA}/creatives/[creativeId]`, 'F', '12', 'Creative details', 'RO'],
  [
    `${A}/creatives/{x}/status`,
    `${FA}/creatives/[creativeId]/status`,
    'F',
    '12',
    'Creative status',
    'RO',
  ],
  [
    `${A}/creatives/{x}/history`,
    `${FA}/creatives/[creativeId]/history`,
    'F',
    '12',
    'History',
    'RO',
  ],
  [`${A}/formats`, `${AA}/(advertiser)/formats`, 'A', '12', 'Format gallery', 'RO'],
  [
    `${A}/appeals-history`,
    `${AA}/(advertiser)/appeals-history`,
    'A',
    '12',
    'Appeals history',
    'RO',
  ],
  // 3.8 Audiences
  [
    `${A}/first-party-audiences`,
    `${AA}/(advertiser)/first-party-audiences`,
    'A',
    '14',
    'All audiences',
    'RO',
  ],
  [`${A}/custom-lists`, `${AA}/(advertiser)/custom-lists`, 'A', '14', 'Custom lists', 'RO'],
  [`${A}/combined-audiences`, `${AA}/(advertiser)/combined-audiences`, 'A', '14', 'Combined', 'RO'],
  [`${A}/partner-audiences`, `${AA}/(advertiser)/partner-audiences`, 'A', '14', 'Partner', 'RO'],
  [`${A}/audience/new`, `${FA}/audience/new`, 'F', '14', 'New audience', 'STD'],
  [
    `${A}/audience/tagbased/new`,
    `${FA}/audience/tagbased/new`,
    'F',
    '14',
    'Tag-based audience',
    'STD',
  ],
  [
    `${A}/audience/customermatch/new`,
    `${FA}/audience/customermatch/new`,
    'F',
    '14',
    'Customer match',
    'STD',
  ],
  [
    `${A}/audience/youtubeusers/new`,
    `${FA}/audience/youtubeusers/new`,
    'F',
    '14',
    'YouTube users',
    'STD',
  ],
  [
    `${A}/combinedaudience/new`,
    `${FA}/combinedaudience/new`,
    'F',
    '14',
    'Combined audience',
    'STD',
  ],
  [
    `${A}/audience/lookalike/new`,
    `${FA}/audience/lookalike/new`,
    'F',
    '14',
    'Lookalike audience',
    'STD',
  ],
  [
    `${A}/customaudience/affinity/new`,
    `${FA}/customaudience/affinity/new`,
    'F',
    '14',
    'Custom affinity list',
    'STD',
  ],
  [
    `${A}/customaudience/intent/new`,
    `${FA}/customaudience/intent/new`,
    'F',
    '14',
    'Custom intent list',
    'STD',
  ],
  [
    `${A}/audience/tagbased/{x}/details`,
    `${AA}/(advertiser)/audience/tagbased/[audienceId]/details`,
    'A',
    '14',
    'Audience details',
    'RO',
  ],
  // Folder `[kind]` holds the audience id here: one dynamic name per level is a Next.js rule (PR deviation).
  [
    `${A}/audience/{x}/explorerlis`,
    `${AA}/(advertiser)/audience/[kind]/explorerlis`,
    'A',
    '14',
    'Line items',
    'RO',
  ],
  [
    `${A}/audience/{kind}/{x}/details`,
    `${AA}/(advertiser)/audience/[kind]/[audienceId]/details`,
    'A',
    '14',
    'Audience details',
    'RO',
  ],
  [`${A}/audience-analysis`, `${AA}/(advertiser)/audience-analysis`, 'A', '14', 'Analysis', 'RO'],
  [
    `${A}/audience-geo-distribution`,
    `${AA}/(advertiser)/audience-geo-distribution`,
    'A',
    '14',
    'Geographic distribution',
    'RO',
  ],
  [
    `${A}/audience-composition-insights`,
    `${AA}/(advertiser)/audience-composition-insights`,
    'A',
    '14',
    'Audience insights',
    'RO',
  ],
  // 3.9 Inventory, Marketplace, Planning
  [
    `${A}/marketplace/inventory`,
    `${AA}/(advertiser)/marketplace/inventory`,
    'A',
    '13',
    'My inventory',
    'RO',
  ],
  [
    `${A}/marketplace/inventory/package`,
    `${AA}/(advertiser)/marketplace/inventory/package`,
    'A',
    '13',
    'Packages',
    'RO',
  ],
  [
    `${A}/marketplace/inventory/groups`,
    `${AA}/(advertiser)/marketplace/inventory/groups`,
    'A',
    '13',
    'Deal groups',
    'RO',
  ],
  [
    `${A}/tid/{x}/marketplace/inventory/details`,
    `${AA}/(advertiser)/tid/[tid]/marketplace/inventory/details`,
    'A',
    '13',
    'Deal',
    'RO',
  ],
  [
    `${A}/marketplace/inventory/instant-deal/new`,
    `${FA}/marketplace/inventory/instant-deal/new`,
    'F',
    '13',
    'New instant deal',
    'STD',
  ],
  [
    `${A}/marketplace/featured-v3`,
    `${AA}/(advertiser)/marketplace/featured-v3`,
    'A',
    '13',
    'Marketplace',
    'RO',
  ],
  [
    `${A}/marketplace-discovery`,
    `${AA}/(advertiser)/marketplace-discovery`,
    'A',
    '13',
    'Discover',
    'RO',
  ],
  [`${A}/marketplace/plans`, `${AA}/(advertiser)/marketplace/plans`, 'A', '04', 'Plans', 'RO'],
  [
    `${A}/pr/{x}/marketplace/plan`,
    `${FA}/pr/[planId]/marketplace/plan`,
    'F',
    '04',
    'Adjust your plan and view forecast',
    'RO',
  ],
  [
    `${A}/marketplace/negotiations`,
    `${AA}/(advertiser)/marketplace/negotiations`,
    'A',
    '13',
    'Negotiations',
    'RO',
  ],
  [
    `${A}/marketplace/negotiations/{x}`,
    `${AA}/(advertiser)/marketplace/negotiations/[negId]`,
    'A',
    '13',
    'Negotiation',
    'RO',
  ],
  [
    `${A}/cross-media-reach`,
    `${AA}/(advertiser)/cross-media-reach`,
    'A',
    '04',
    'Cross-media reach',
    'REP',
  ],
  [
    `${A}/cross-media-reach/new`,
    `${FA}/cross-media-reach/new`,
    'F',
    '04',
    'Create a report',
    'REP',
  ],
  [
    `${A}/cross-media-reach/{x}`,
    `${FA}/cross-media-reach/[reportId]`,
    'F',
    '04',
    'Cross-media reach report',
    'REP',
  ],
  // 3.10 Resources
  [`${A}/brand/controls`, `${AA}/(advertiser)/brand/controls`, 'A', '15', 'Brand controls', 'RO'],
  [`${A}/channels`, `${AA}/(advertiser)/channels`, 'A', '15', 'Channels', 'RO'],
  [
    `${A}/negative-keywords`,
    `${AA}/(advertiser)/negative-keywords`,
    'A',
    '15',
    'Negative keyword lists',
    'RO',
  ],
  [`${A}/fl/events`, `${AA}/(advertiser)/fl/events`, 'A', '15', 'Floodlight conversions', 'RO'],
  [`${A}/fl/events/new`, `${FA}/fl/events/new`, 'F', '15', 'New Floodlight conversion', 'STD'],
  [`${A}/fl/events/{x}`, `${FA}/fl/events/[eventId]`, 'F', '15', 'Edit conversion', 'RO'],
  [`${A}/fl/details`, `${AA}/(advertiser)/fl/details`, 'A', '15', 'Basic details', 'RO'],
  [`${A}/fl/google-tag`, `${AA}/(advertiser)/fl/google-tag`, 'A', '15', 'Google tag', 'RO'],
  [`${A}/fl/history`, `${AA}/(advertiser)/fl/history`, 'A', '15', 'History', 'RO'],
  [
    `${A}/location-extension`,
    `${AA}/(advertiser)/location-extension`,
    'A',
    '15',
    'YouTube assets',
    'RO',
  ],
  [
    `${A}/creator-partnerships-hub/discover`,
    `${AA}/(advertiser)/creator-partnerships-hub/discover`,
    'A',
    '15',
    'YouTube creator partnerships',
    'RO',
  ],
  [
    `${A}/location-lists-v2`,
    `${AA}/(advertiser)/location-lists-v2`,
    'A',
    '15',
    'Location lists',
    'RO',
  ],
  [`${A}/ll/new`, `${FA}/ll/new`, 'F', '15', 'New location list', 'STD'],
  [`${A}/ll/{x}`, `${FA}/ll/[listId]`, 'F', '15', 'Edit location list', 'RO'],
  [`${A}/custom-bidding`, `${AA}/(advertiser)/custom-bidding`, 'A', '15', 'Custom bidding', 'RO'],
  [`${A}/custom-bidding/new`, `${FA}/custom-bidding/new`, 'F', '15', 'New algorithm', 'STD'],
  [`${A}/custom-bidding/{x}`, `${FA}/custom-bidding/[algorithmId]`, 'F', '15', 'Algorithm', 'RO'],
  // 3.11 Advertiser settings
  [`${A}/details`, `${AA}/(advertiser)/details`, 'A', '03', 'Basic details', 'RO'],
  [`${A}/targeting`, `${AA}/(advertiser)/targeting`, 'A', '03', 'Targeting rules', 'RO'],
  [`${A}/data-manager`, `${AA}/(advertiser)/data-manager`, 'A', '03', 'Data manager', 'RO'],
  [
    `${A}/linked-accounts`,
    `${AA}/(advertiser)/linked-accounts`,
    'A',
    '03',
    'Linked accounts',
    'RO',
  ],
  [`${A}/alert-config`, `${AA}/(advertiser)/alert-config`, 'A', '03', 'Alert preferences', 'RO'],
  [`${A}/policy-center`, `${AA}/(advertiser)/policy-center`, 'A', '03', 'Policy center', 'RO'],
  // 3.12 Reporting app
  [`${P}/reporting`, `${FP}/reporting`, 'R', '16', 'Reports', 'REP'],
  [
    `${P}/reporting/instant/new`,
    `${FP}/reporting/instant/new`,
    'R',
    '16',
    'Untitled report',
    'REP',
  ],
  [
    `${P}/reporting/instant/{x}`,
    `${FP}/reporting/instant/[reportId]`,
    'R',
    '16',
    'Instant report',
    'REP',
  ],
  [
    `${P}/reporting/{kind}/{x}/runs`,
    `${FP}/reporting/[kind]/[reportId]/runs`,
    'R',
    '16',
    'Report runs',
    'REP',
  ],
  [`${P}/reporting/offline/new`, `${FP}/reporting/offline/new`, 'R', '16', 'Offline report', 'REP'],
  [
    `${P}/reporting/offline/{x}`,
    `${FP}/reporting/offline/[reportId]`,
    'R',
    '16',
    'Offline report',
    'REP',
  ],
];

type Redirect = [path: string, folder: string, to: string];
const REDIRECTS: Redirect[] = [
  ['/', '', '(role home)'],
  [P, AP, `${P}/home_v3`],
  [A, AA, `${A}/cs`],
  [C, AC, `${C}/explorerios`],
  [IO, AIO, `${IO}/explorerlis`],
  [LI, ALI, `${LI}/details`],
  [`${A}/marketplace/featured-v2`, `${AA}/marketplace/featured-v2`, `${A}/marketplace/featured-v3`],
  [`${A}/fl`, `${AA}/fl`, `${A}/fl/events`],
  [
    `${A}/audience/{x}/details`,
    `${AA}/audience/[kind]/details`,
    `${A}/audience/{kind}/{x}/details`,
  ],
];

export const ROUTE_TABLE: readonly RouteRow[] = [
  ...PAGES.map(row),
  ...REDIRECTS.map(([path, folder, to]) => ({
    path,
    folder,
    frame: '-' as const,
    module: '01',
    title: 'Redirect',
    view: 'RO' as const,
    redirectTo: to,
  })),
];

export const PAGE_ROWS: readonly RouteRow[] = ROUTE_TABLE.filter((r) => !r.redirectTo);

/** Paths that `/p/{pid}/a/{aid}/...` must not have (routes.md 3.8, explore 17): they render the 404 page. */
export const INVALID_ADVERTISER_PATHS = [`${A}/audiences`, `${A}/reporting`] as const;
