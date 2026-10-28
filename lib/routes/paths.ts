// Path builders for the DV360 routes (routes.md 3, 6). Ids are the public ids shown in URLs (data-model header).
// Every function returns a path without the `/ng_nav` prefix (routes.md R1).

export type ScopeLevel = 'global' | 'partner' | 'advertiser' | 'campaign' | 'io' | 'li';

export interface ScopeIds {
  partnerId?: string;
  advertiserId?: string;
  campaignId?: string;
  ioId?: string;
  liId?: string;
}

function join(base: string, sub: string[]): string {
  const rest = sub.filter(Boolean).join('/');
  return rest ? `${base}/${rest}` : base;
}

export function partnerPath(pid: string, ...sub: string[]): string {
  return join(`/p/${pid}`, sub);
}

export function advertiserPath(pid: string, aid: string, ...sub: string[]): string {
  return join(`/p/${pid}/a/${aid}`, sub);
}

export function campaignPath(pid: string, aid: string, cid: string, ...sub: string[]): string {
  return join(`/p/${pid}/a/${aid}/c/${cid}`, sub);
}

export function ioPath(
  pid: string,
  aid: string,
  cid: string,
  ioId: string,
  ...sub: string[]
): string {
  return join(`/p/${pid}/a/${aid}/c/${cid}/io/${ioId}`, sub);
}

export function liPath(
  pid: string,
  aid: string,
  cid: string,
  ioId: string,
  liId: string,
  ...sub: string[]
): string {
  return join(`/p/${pid}/a/${aid}/c/${cid}/io/${ioId}/li/${liId}`, sub);
}

/** Partner Overview, or `/` when there is no partner (top bar item 3). */
export function homePath(ids: ScopeIds): string {
  return ids.partnerId ? partnerPath(ids.partnerId, 'home_v3') : '/';
}

/** Reports: `[P]/reporting`, with `?sim_aid=` on advertiser pages (routes.md 3.12, 4.1 item 11). */
export function reportingPath(ids: ScopeIds): string | null {
  if (!ids.partnerId) return null;
  const base = partnerPath(ids.partnerId, 'reporting');
  return ids.advertiserId ? `${base}?sim_aid=${encodeURIComponent(ids.advertiserId)}` : base;
}

/** The catch-all destination (routes.md 6.5). */
export function notFoundPath(url: string): string {
  return `/404?url=${encodeURIComponent(url)}`;
}

/** Deepest level the ids describe. */
export function levelOf(ids: ScopeIds): ScopeLevel {
  if (ids.liId) return 'li';
  if (ids.ioId) return 'io';
  if (ids.campaignId) return 'campaign';
  if (ids.advertiserId) return 'advertiser';
  if (ids.partnerId) return 'partner';
  return 'global';
}

/** Base path of a level: `/p/1/a/2` for advertiser. Null when an id is missing. */
export function basePath(level: ScopeLevel, ids: ScopeIds): string | null {
  const { partnerId: p, advertiserId: a, campaignId: c, ioId: io, liId: li } = ids;
  switch (level) {
    case 'global':
      return '';
    case 'partner':
      return p ? partnerPath(p) : null;
    case 'advertiser':
      return p && a ? advertiserPath(p, a) : null;
    case 'campaign':
      return p && a && c ? campaignPath(p, a, c) : null;
    case 'io':
      return p && a && c && io ? ioPath(p, a, c, io) : null;
    case 'li':
      return p && a && c && io && li ? liPath(p, a, c, io, li) : null;
  }
}

/** Campaign tab a pinned preference points at (routes.md 6.3, RT Q3). */
export type CampaignTab = 'combined' | 'ios' | 'lis';
const CAMPAIGN_TAB_SEGMENT: Record<CampaignTab, string> = {
  combined: 'explorercombined',
  ios: 'explorerios',
  lis: 'explorerlis',
};

export function campaignTabSegment(tab: CampaignTab | null | undefined): string {
  return tab ? CAMPAIGN_TAB_SEGMENT[tab] : 'explorerios';
}

/** Line item types whose first tab is Ad groups (routes.md 3.6, 6.3). */
export const AD_GROUP_LI_TYPES: readonly string[] = [
  'YT_VIDEO',
  'YT_AUDIO',
  'YT_ON_CTV',
  'DEMAND_GEN',
];

export function lineItemLanding(type: string): 'adgroups' | 'details' {
  return AD_GROUP_LI_TYPES.includes(type) ? 'adgroups' : 'details';
}

/**
 * Where Shift+N goes on the current page (routes.md 4.7). Null when the page has no create target.
 * Shift+I and Shift+L have their own scopes.
 */
export function newTargetFor(pathname: string, ids: ScopeIds): string | null {
  const { partnerId: p, advertiserId: a, campaignId: c, ioId: io } = ids;
  if (p && a && c && io && pathname === ioPath(p, a, c, io, 'explorerlis')) {
    return ioPath(p, a, c, io, 'lis', 'new');
  }
  if (p && a && c && !io && pathname === campaignPath(p, a, c, 'explorerios')) {
    return campaignPath(p, a, c, 'ios', 'new');
  }
  if (p && a && !c && pathname === advertiserPath(p, a, 'cs')) {
    return advertiserPath(p, a, 'cs', 'new');
  }
  return null;
}

/** Shift+I: New insertion order, campaign scope only (IO and LI pages are outside it). */
export function newIoTarget(ids: ScopeIds): string | null {
  const { partnerId: p, advertiserId: a, campaignId: c, ioId } = ids;
  return p && a && c && !ioId ? campaignPath(p, a, c, 'ios', 'new') : null;
}

/** Shift+L: New line item, IO scope only. */
export function newLiTarget(ids: ScopeIds): string | null {
  const { partnerId: p, advertiserId: a, campaignId: c, ioId: io, liId } = ids;
  return p && a && c && io && !liId ? ioPath(p, a, c, io, 'lis', 'new') : null;
}
