// Left navigation trees (routes.md 4.2 to 4.4, design-system 2.2) as typed data. The shell renders them with DvNav.
// `href(ctx)` builds the link from the public ids of the current scope. `match` lists path prefixes relative to the
// level base (`/p/1` for partner, `/p/1/a/2` for advertiser, `/p/1/a/2/c/3` for campaign).
import type { DvRole } from '@/lib/auth/types';
import { advertiserPath, campaignPath, partnerPath, type ScopeIds } from '@/lib/routes/paths';
import type { ViewCode } from '@/lib/routes/route-table';

export type NavLevel = 'partner' | 'advertiser' | 'campaign';

export interface NavNode {
  key: string;
  label: string;
  secondLine?: string;
  /** Icon meaning or name for top-level items (design-system 3). Children have no icon. */
  icon?: string;
  href?: (ctx: Required<Pick<ScopeIds, 'partnerId'>> & ScopeIds) => string;
  match?: string[];
  children?: NavNode[];
  dividerAfter?: boolean;
  newDot?: boolean;
  badge?: 'NEW';
  /** Lowest view code that sees the item (routes.md 2). Groups are shown when a child is. */
  minLevel?: ViewCode;
}

type Ctx = Required<Pick<ScopeIds, 'partnerId'>> & ScopeIds;
const p =
  (...sub: string[]) =>
  (c: Ctx) =>
    partnerPath(c.partnerId, ...sub);
const a =
  (...sub: string[]) =>
  (c: Ctx) =>
    advertiserPath(c.partnerId, c.advertiserId ?? '', ...sub);
const cmp =
  (...sub: string[]) =>
  (c: Ctx) =>
    campaignPath(c.partnerId, c.advertiserId ?? '', c.campaignId ?? '', ...sub);

/** Partner level, routes.md 4.2. */
export const PARTNER_TREE: NavNode[] = [
  {
    key: 'overview',
    label: 'Overview',
    icon: 'navOverview',
    href: p('home_v3'),
    match: ['/home_v3'],
  },
  {
    key: 'advertisers',
    label: 'Advertisers',
    icon: 'navAdvertisers',
    href: p('advertisers'),
    match: ['/advertisers'],
    dividerAfter: true,
  },
  {
    key: 'reports',
    label: 'Reports',
    icon: 'navReports',
    dividerAfter: true,
    children: [
      { key: 'reports.instant', label: 'Instant & offline', href: p('reporting'), minLevel: 'REP' },
      {
        key: 'reports.cmr',
        label: 'Cross-media reach',
        href: p('cross-media-reach'),
        match: ['/cross-media-reach'],
        minLevel: 'REP',
      },
    ],
  },
  {
    key: 'resources',
    label: 'Resources',
    icon: 'navResources',
    children: [
      {
        key: 'resources.brand',
        label: 'Brand controls',
        href: p('brand', 'controls'),
        match: ['/brand/controls'],
      },
      { key: 'resources.channels', label: 'Channels', href: p('channels'), match: ['/channels'] },
      {
        key: 'resources.cb',
        label: 'Custom bidding',
        href: p('custom-bidding'),
        match: ['/custom-bidding'],
      },
      {
        key: 'resources.floodlights',
        label: 'Floodlight groups',
        href: p('floodlights'),
        match: ['/floodlights'],
        newDot: true,
      },
    ],
  },
  {
    key: 'settings',
    label: 'Partner settings',
    icon: 'navSettings',
    children: [
      { key: 'settings.details', label: 'Basic details', href: p('details'), match: ['/details'] },
      {
        key: 'settings.targeting',
        label: 'Targeting',
        href: p('targeting'),
        match: ['/targeting'],
      },
      {
        key: 'settings.config',
        label: 'Advertiser configurations',
        href: p('third-party-configuration'),
        match: ['/third-party-configuration'],
      },
    ],
  },
];

/** Advertiser level, routes.md 4.3. */
export const ADVERTISER_TREE: NavNode[] = [
  {
    key: 'campaigns',
    label: 'Campaigns',
    icon: 'navCampaigns',
    href: a('cs'),
    match: ['/cs', '/explorerios', '/explorerlis'],
  },
  {
    key: 'audiences',
    label: 'Audiences',
    icon: 'navAudiences',
    children: [
      {
        key: 'audiences.all',
        label: 'All audiences',
        href: a('first-party-audiences'),
        match: [
          '/first-party-audiences',
          '/custom-lists',
          '/combined-audiences',
          '/partner-audiences',
          '/audience/',
        ],
      },
      {
        key: 'audiences.analysis',
        label: 'Analysis',
        href: a('audience-analysis'),
        match: [
          '/audience-analysis',
          '/audience-geo-distribution',
          '/audience-composition-insights',
        ],
      },
    ],
  },
  {
    key: 'creative',
    label: 'Creative',
    icon: 'navCreative',
    children: [
      {
        key: 'creative.creatives',
        label: 'Creatives',
        href: a('creatives'),
        match: ['/creatives'],
      },
      { key: 'creative.formats', label: 'Format gallery', href: a('formats'), match: ['/formats'] },
      {
        key: 'creative.appeals',
        label: 'Appeals history',
        href: a('appeals-history'),
        match: ['/appeals-history'],
      },
    ],
  },
  {
    key: 'inventory',
    label: 'Inventory',
    icon: 'navInventory',
    children: [
      {
        key: 'inventory.plans',
        label: 'Plans',
        href: a('marketplace', 'plans'),
        match: ['/marketplace/plans'],
      },
      {
        key: 'inventory.mine',
        label: 'My inventory',
        href: a('marketplace', 'inventory'),
        match: ['/marketplace/inventory', '/tid/'],
      },
      {
        key: 'inventory.marketplace',
        label: 'Marketplace',
        href: a('marketplace', 'featured-v3'),
        match: ['/marketplace/featured', '/marketplace-discovery'],
      },
      {
        key: 'inventory.negotiations',
        label: 'Negotiations',
        href: a('marketplace', 'negotiations'),
        match: ['/marketplace/negotiations'],
      },
    ],
  },
  {
    key: 'reports',
    label: 'Reports',
    icon: 'navReports',
    dividerAfter: true,
    children: [
      {
        key: 'reports.instant',
        label: 'Instant & offline',
        href: (c) => `${partnerPath(c.partnerId, 'reporting')}?sim_aid=${c.advertiserId ?? ''}`,
        minLevel: 'REP',
      },
      {
        key: 'reports.cmr',
        label: 'Cross-media reach',
        href: a('cross-media-reach'),
        match: ['/cross-media-reach'],
        minLevel: 'REP',
      },
    ],
  },
  {
    key: 'experiments',
    label: 'Experiments',
    icon: 'navExperiments',
    href: a('experiments'),
    match: ['/experiments', '/e/', '/brand-lift-measurements'],
  },
  {
    key: 'templates',
    label: 'Targeting templates',
    icon: 'navTargetingTemplates',
    href: a('templates'),
    match: ['/templates'],
  },
  {
    key: 'resources',
    label: 'Resources',
    icon: 'navResources',
    children: [
      {
        key: 'resources.brand',
        label: 'Brand controls',
        href: a('brand', 'controls'),
        match: ['/brand/controls'],
      },
      {
        key: 'resources.channels',
        label: 'Channels & keywords',
        href: a('channels'),
        match: ['/channels', '/negative-keywords'],
      },
      {
        key: 'resources.floodlight',
        label: 'Floodlight group',
        href: a('fl', 'events'),
        match: ['/fl/'],
        newDot: true,
      },
      {
        key: 'resources.ytAssets',
        label: 'Location & sitelink assets',
        href: a('location-extension'),
        match: ['/location-extension'],
      },
      {
        key: 'resources.creators',
        label: 'YouTube creator partnerships',
        href: a('creator-partnerships-hub', 'discover'),
        match: ['/creator-partnerships-hub'],
      },
      {
        key: 'resources.locationLists',
        label: 'Location lists',
        href: a('location-lists-v2'),
        match: ['/location-lists-v2', '/ll/'],
      },
      {
        key: 'resources.cb',
        label: 'Custom bidding',
        href: a('custom-bidding'),
        match: ['/custom-bidding'],
      },
    ],
  },
  {
    key: 'settings',
    label: 'Advertiser settings',
    icon: 'navSettings',
    children: [
      { key: 'settings.details', label: 'Basic details', href: a('details'), match: ['/details'] },
      {
        key: 'settings.targeting',
        label: 'Targeting rules',
        href: a('targeting'),
        match: ['/targeting'],
      },
      {
        key: 'settings.dataManager',
        label: 'Data manager',
        secondLine: '(Linked accounts)',
        href: a('data-manager'),
        match: ['/data-manager', '/linked-accounts'],
      },
      {
        key: 'settings.alerts',
        label: 'Alert preferences',
        href: a('alert-config'),
        match: ['/alert-config'],
      },
      {
        key: 'settings.policy',
        label: 'Policy center',
        href: a('policy-center'),
        match: ['/policy-center'],
      },
    ],
  },
  { key: 'history', label: 'History', icon: 'navHistory', href: a('history'), match: ['/history'] },
];

/** Campaign level, routes.md 4.4. */
export const CAMPAIGN_TREE: NavNode[] = [
  {
    key: 'campaign',
    label: 'Campaign',
    icon: 'navCampaigns',
    href: cmp(),
    match: ['/explorerios', '/explorerlis', '/explorercombined'],
  },
  {
    key: 'inventory',
    label: 'Inventory',
    icon: 'navInventory',
    children: [
      {
        key: 'inventory.mine',
        label: 'My inventory',
        href: cmp('marketplace', 'inventory'),
        match: ['/marketplace/inventory', '/tid/'],
      },
      {
        key: 'inventory.marketplace',
        label: 'Marketplace',
        href: cmp('marketplace', 'featured-v3'),
        match: ['/marketplace/featured', '/marketplace-discovery'],
      },
      {
        key: 'inventory.negotiations',
        label: 'Negotiations',
        href: cmp('marketplace', 'negotiations'),
        match: ['/marketplace/negotiations'],
      },
    ],
  },
  {
    key: 'settings',
    label: 'Campaign settings',
    icon: 'navCampaignSettings',
    href: cmp('details'),
    match: ['/details'],
  },
  {
    key: 'alerts',
    label: 'Alerts',
    icon: 'navCampaignAlerts',
    href: cmp('alerts'),
    match: ['/alerts'],
  },
  {
    key: 'history',
    label: 'History',
    icon: 'navHistory',
    href: cmp('history'),
    match: ['/history'],
  },
];

export const TREES: Record<NavLevel, NavNode[]> = {
  partner: PARTNER_TREE,
  advertiser: ADVERTISER_TREE,
  campaign: CAMPAIGN_TREE,
};

const RANK: Record<ViewCode, number> = { PUBLIC: 0, ANY: 0, REP: 1, RO: 2, STD: 3, ADM: 4 };

/** The view code a DV360 access level reaches (routes.md 2). */
export function viewRank(role: DvRole): number {
  switch (role) {
    case 'ADMIN':
      return RANK.ADM;
    case 'STANDARD':
      return RANK.STD;
    case 'READ_ONLY':
    case 'PARTNER_CLIENT':
    case 'CREATIVE':
      return RANK.RO;
    case 'REPORTING_ONLY':
      return RANK.REP;
  }
}

/** May `role` open a page whose view code is `code`? */
export function canView(role: DvRole, code: ViewCode): boolean {
  return viewRank(role) >= RANK[code];
}

/** Items the role sees (routes.md 4.5 rule 6). Groups without visible children disappear. */
export function filterTree(nodes: NavNode[], role: DvRole): NavNode[] {
  const out: NavNode[] = [];
  for (const n of nodes) {
    if (n.children) {
      const children = filterTree(n.children, role);
      if (children.length) out.push({ ...n, children });
    } else if (canView(role, n.minLevel ?? 'RO')) {
      out.push(n);
    }
  }
  return out;
}

export interface ResolvedNavItem {
  id: string;
  label: string;
  secondLine?: string;
  icon?: string;
  href?: string;
  children?: ResolvedNavItem[];
  dividerAfter?: boolean;
  newDot?: boolean;
  badge?: 'NEW';
}

/** The tree for one level and role, with hrefs built from the scope ids. */
export function buildTree(level: NavLevel, ctx: Ctx, role: DvRole): ResolvedNavItem[] {
  const resolve = (n: NavNode): ResolvedNavItem => ({
    id: n.key,
    label: n.label,
    ...(n.secondLine ? { secondLine: n.secondLine } : {}),
    ...(n.icon ? { icon: n.icon } : {}),
    ...(n.href ? { href: n.href(ctx) } : {}),
    ...(n.children ? { children: n.children.map(resolve) } : {}),
    ...(n.dividerAfter ? { dividerAfter: true } : {}),
    ...(n.newDot ? { newDot: true } : {}),
    ...(n.badge ? { badge: n.badge } : {}),
  });
  return filterTree(TREES[level], role).map(resolve);
}

function leaves(nodes: NavNode[]): NavNode[] {
  return nodes.flatMap((n) => (n.children ? leaves(n.children) : [n]));
}

/**
 * Key of the active leaf for `pathname` (routes.md 4.3 "Active when path starts with"). The longest matching prefix
 * wins, so `/marketplace/inventory` and `/marketplace/plans` never compete. Null when nothing matches.
 */
export function activeKey(level: NavLevel, pathname: string, base: string): string | null {
  if (!pathname.startsWith(base)) return null;
  const rel = pathname.slice(base.length) || '/';
  let best: { key: string; len: number } | null = null;
  for (const leaf of leaves(TREES[level])) {
    for (const m of leaf.match ?? []) {
      if (rel.startsWith(m) && (!best || m.length > best.len))
        best = { key: leaf.key, len: m.length };
    }
  }
  return best?.key ?? null;
}

/** Key of the group that holds `leafKey`, if any. */
export function groupOf(level: NavLevel, leafKey: string): string | null {
  for (const n of TREES[level]) {
    if (n.children?.some((c) => c.key === leafKey)) return n.key;
  }
  return null;
}
