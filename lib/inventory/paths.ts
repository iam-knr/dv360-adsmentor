// URL builders of the inventory pages (routes.md 3.9, 3.4). Campaign scope reuses the same pages under the campaign.
import { advertiserPath, campaignPath } from '@/lib/routes/paths';

export type InventoryTab = 'orders' | 'package' | 'groups';
export type DealTab = 'overviewTab' | 'accessTab' | 'settingsTab' | 'historyTab';

export interface Scope {
  partnerId: string;
  advertiserId: string;
  campaignId?: string | undefined;
}

const root = (s: Scope, ...sub: string[]) =>
  s.campaignId
    ? campaignPath(s.partnerId, s.advertiserId, s.campaignId, ...sub)
    : advertiserPath(s.partnerId, s.advertiserId, ...sub);

export const inventoryPath = (s: Scope, tab: InventoryTab = 'orders'): string =>
  root(s, 'marketplace', 'inventory', ...(tab === 'orders' ? [] : [tab]));

export const dealPath = (s: Scope, tid: string, tab: DealTab = 'overviewTab'): string =>
  `${root(s, 'tid', tid, 'marketplace', 'inventory', 'details')}${tab === 'overviewTab' ? '' : `?activeTab=${tab}`}`;

export const featuredPath = (s: Scope): string => root(s, 'marketplace', 'featured-v3');
export const discoverPath = (s: Scope, panel?: string): string =>
  `${root(s, 'marketplace-discovery')}${panel ? `?sim_panel=${panel}` : ''}`;
export const negotiationsPath = (s: Scope, id?: string): string =>
  root(s, 'marketplace', 'negotiations', ...(id ? [id] : []));
export const plansPath = (s: Scope): string => root(s, 'marketplace', 'plans');
/** Full-screen form (frame F), advertiser level only. */
export const instantDealPath = (pid: string, aid: string): string =>
  advertiserPath(pid, aid, 'marketplace', 'inventory', 'instant-deal', 'new');
export const lineItemPath = (href: string): string => href;
