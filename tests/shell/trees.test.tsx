// lib/nav/trees.ts against routes.md 4.2 to 4.4 (AC-01-3) and the active matcher (routes.md 4.5).
// Lives in tests/shell, which the components project runs, hence the .tsx name (build-plan 2.6).
import { describe, expect, it } from 'vitest';
import type { DvRole } from '@/lib/auth/types';
import {
  activeKey,
  buildTree,
  canView,
  filterTree,
  groupOf,
  TREES,
  type NavLevel,
  type ResolvedNavItem,
} from '@/lib/nav/trees';

const ctx = { partnerId: '1', advertiserId: '2', campaignId: '3' };

/** "Label" for a leaf, "Label > Child, Child" for a group, in order. */
function outline(items: ResolvedNavItem[]): string[] {
  return items.map((i) =>
    i.children ? `${i.label} > ${i.children.map((c) => c.label).join(', ')}` : i.label,
  );
}

const PARTNER_STANDARD = [
  'Overview',
  'Advertisers',
  'Reports > Instant & offline, Cross-media reach',
  'Resources > Brand controls, Channels, Custom bidding, Floodlight groups',
  'Partner settings > Basic details, Targeting, Advertiser configurations',
];

const ADVERTISER_STANDARD = [
  'Campaigns',
  'Audiences > All audiences, Analysis',
  'Creative > Creatives, Format gallery, Appeals history',
  'Inventory > Plans, My inventory, Marketplace, Negotiations',
  'Reports > Instant & offline, Cross-media reach',
  'Experiments',
  'Targeting templates',
  'Resources > Brand controls, Channels & keywords, Floodlight group, Location & sitelink assets, YouTube creator partnerships, Location lists, Custom bidding',
  'Advertiser settings > Basic details, Targeting rules, Data manager, Alert preferences, Policy center',
  'History',
];

const CAMPAIGN_STANDARD = [
  'Campaign',
  'Inventory > My inventory, Marketplace, Negotiations',
  'Campaign settings',
  'Alerts',
  'History',
];

describe('nav trees (AC-01-3)', () => {
  it('partner tree for STANDARD is routes.md 4.2 in order', () => {
    expect(outline(buildTree('partner', ctx, 'STANDARD'))).toEqual(PARTNER_STANDARD);
  });

  it('advertiser tree for STANDARD is routes.md 4.3 in order', () => {
    expect(outline(buildTree('advertiser', ctx, 'STANDARD'))).toEqual(ADVERTISER_STANDARD);
  });

  it('campaign tree for STANDARD is routes.md 4.4 in order', () => {
    expect(outline(buildTree('campaign', ctx, 'STANDARD'))).toEqual(CAMPAIGN_STANDARD);
  });

  it.each<[NavLevel, string[]]>([
    ['partner', PARTNER_STANDARD],
    ['advertiser', ADVERTISER_STANDARD],
    ['campaign', CAMPAIGN_STANDARD],
  ])('READ_ONLY sees the same %s tree as STANDARD (views every page)', (level, expected) => {
    expect(outline(buildTree(level, ctx, 'READ_ONLY'))).toEqual(expected);
    expect(outline(buildTree(level, ctx, 'ADMIN'))).toEqual(expected);
  });

  it('REPORTING_ONLY sees only the Reports group (routes.md 4.5 rule 6)', () => {
    expect(outline(buildTree('partner', ctx, 'REPORTING_ONLY'))).toEqual([
      'Reports > Instant & offline, Cross-media reach',
    ]);
    expect(outline(buildTree('advertiser', ctx, 'REPORTING_ONLY'))).toEqual([
      'Reports > Instant & offline, Cross-media reach',
    ]);
    expect(buildTree('campaign', ctx, 'REPORTING_ONLY')).toEqual([]);
  });

  it('builds the hrefs of routes.md 4.2 to 4.4 from the scope ids', () => {
    const flat = (items: ResolvedNavItem[]): Record<string, string | undefined> =>
      Object.fromEntries(
        items.flatMap((i) => (i.children ? i.children : [i])).map((i) => [i.id, i.href]),
      );
    const partner = flat(buildTree('partner', ctx, 'STANDARD'));
    expect(partner).toMatchObject({
      overview: '/p/1/home_v3',
      advertisers: '/p/1/advertisers',
      'reports.instant': '/p/1/reporting',
      'reports.cmr': '/p/1/cross-media-reach',
      'resources.brand': '/p/1/brand/controls',
      'resources.floodlights': '/p/1/floodlights',
      'settings.config': '/p/1/third-party-configuration',
    });
    const adv = flat(buildTree('advertiser', ctx, 'STANDARD'));
    expect(adv).toMatchObject({
      campaigns: '/p/1/a/2/cs',
      'audiences.all': '/p/1/a/2/first-party-audiences',
      'inventory.marketplace': '/p/1/a/2/marketplace/featured-v3',
      'reports.instant': '/p/1/reporting?sim_aid=2',
      'resources.floodlight': '/p/1/a/2/fl/events',
      'resources.creators': '/p/1/a/2/creator-partnerships-hub/discover',
      'settings.dataManager': '/p/1/a/2/data-manager',
      history: '/p/1/a/2/history',
    });
    const cmp = flat(buildTree('campaign', ctx, 'STANDARD'));
    expect(cmp).toMatchObject({
      campaign: '/p/1/a/2/c/3',
      'inventory.mine': '/p/1/a/2/c/3/marketplace/inventory',
      settings: '/p/1/a/2/c/3/details',
      alerts: '/p/1/a/2/c/3/alerts',
      history: '/p/1/a/2/c/3/history',
    });
  });

  it('carries the decorations of the spec: dividers, new dots, NEW badge, two-line label', () => {
    const partner = buildTree('partner', ctx, 'STANDARD');
    expect(partner.filter((i) => i.dividerAfter).map((i) => i.label)).toEqual([
      'Advertisers',
      'Reports',
    ]);
    const adv = buildTree('advertiser', ctx, 'STANDARD');
    expect(adv.filter((i) => i.dividerAfter).map((i) => i.label)).toEqual(['Reports']);
    const advLeaves = adv.flatMap((i) => i.children ?? [i]);
    expect(advLeaves.find((i) => i.id === 'resources.floodlight')?.newDot).toBe(true);
    expect(advLeaves.find((i) => i.id === 'settings.dataManager')?.secondLine).toBe(
      '(Linked accounts)',
    );
    const cmp = buildTree('campaign', ctx, 'STANDARD');
    expect(cmp.find((i) => i.id === 'alerts')?.badge).toBe('NEW');
    // every top-level item has an icon, children have none
    for (const level of ['partner', 'advertiser', 'campaign'] as const) {
      for (const n of TREES[level]) {
        expect(n.icon, n.key).toBeTruthy();
        for (const c of n.children ?? []) expect(c.icon, c.key).toBeUndefined();
      }
    }
  });

  it('filterTree drops groups that lose every child', () => {
    expect(filterTree(TREES.campaign, 'REPORTING_ONLY')).toEqual([]);
  });
});

describe('view codes (routes.md 2)', () => {
  const cases: [DvRole, Record<string, boolean>][] = [
    ['ADMIN', { REP: true, RO: true, STD: true, ADM: true }],
    ['STANDARD', { REP: true, RO: true, STD: true, ADM: false }],
    ['READ_ONLY', { REP: true, RO: true, STD: false, ADM: false }],
    ['PARTNER_CLIENT', { REP: true, RO: true, STD: false, ADM: false }],
    ['REPORTING_ONLY', { REP: true, RO: false, STD: false, ADM: false }],
  ];
  it.each(cases)('%s', (role, expected) => {
    for (const [code, ok] of Object.entries(expected)) {
      expect(canView(role, code as 'REP'), `${role} ${code}`).toBe(ok);
    }
    expect(canView(role, 'ANY')).toBe(true);
    expect(canView(role, 'PUBLIC')).toBe(true);
  });
});

describe('active matcher (routes.md 4.3 "Active when path starts with")', () => {
  const P = '/p/1';
  const A = '/p/1/a/2';
  const C = '/p/1/a/2/c/3';

  it.each([
    [`${P}/home_v3`, 'overview'],
    [`${P}/advertisers`, 'advertisers'],
    [`${P}/cross-media-reach`, 'reports.cmr'],
    [`${P}/brand/controls`, 'resources.brand'],
    [`${P}/floodlights`, 'resources.floodlights'],
    [`${P}/third-party-configuration`, 'settings.config'],
    [`${P}/details`, 'settings.details'],
  ])('partner %s → %s', (path, key) => {
    expect(activeKey('partner', path, P)).toBe(key);
  });

  it.each([
    [`${A}/cs`, 'campaigns'],
    [`${A}/explorerios`, 'campaigns'],
    [`${A}/explorerlis?f.status=ARCHIVED`, 'campaigns'],
    [`${A}/custom-lists`, 'audiences.all'],
    [`${A}/audience/tagbased/9/details`, 'audiences.all'],
    [`${A}/audience-geo-distribution`, 'audiences.analysis'],
    [`${A}/marketplace/plans`, 'inventory.plans'],
    [`${A}/marketplace/inventory/package`, 'inventory.mine'],
    [`${A}/tid/77/marketplace/inventory/details`, 'inventory.mine'],
    [`${A}/marketplace/featured-v3`, 'inventory.marketplace'],
    [`${A}/marketplace-discovery`, 'inventory.marketplace'],
    [`${A}/marketplace/negotiations`, 'inventory.negotiations'],
    [`${A}/brand-lift-measurements`, 'experiments'],
    [`${A}/negative-keywords`, 'resources.channels'],
    [`${A}/fl/events`, 'resources.floodlight'],
    [`${A}/fl/google-tag`, 'resources.floodlight'],
    [`${A}/linked-accounts`, 'settings.dataManager'],
    [`${A}/history`, 'history'],
    [`${A}/cross-media-reach`, 'reports.cmr'],
  ])('advertiser %s → %s', (path, key) => {
    expect(activeKey('advertiser', path, A)).toBe(key);
  });

  it.each([
    [`${C}/explorerios`, 'campaign'],
    [`${C}/explorercombined`, 'campaign'],
    [`${C}/marketplace/inventory/groups`, 'inventory.mine'],
    [`${C}/details`, 'settings'],
    [`${C}/alerts`, 'alerts'],
    [`${C}/history`, 'history'],
  ])('campaign %s → %s', (path, key) => {
    expect(activeKey('campaign', path, C)).toBe(key);
  });

  it('returns null outside the level base or on an unknown page', () => {
    expect(activeKey('advertiser', '/p/1/a/22/cs', '/p/1/a/2/')).toBeNull();
    expect(activeKey('partner', '/p/9/home_v3', P)).toBeNull();
    expect(activeKey('advertiser', `${A}/unknown`, A)).toBeNull();
  });

  it('finds the group of an active leaf so it opens on load (routes.md 4.5 rule 3)', () => {
    expect(groupOf('advertiser', 'inventory.mine')).toBe('inventory');
    expect(groupOf('partner', 'settings.config')).toBe('settings');
    expect(groupOf('advertiser', 'campaigns')).toBeNull();
  });
});
