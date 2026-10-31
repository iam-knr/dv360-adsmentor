// URL builders of the planning pages (routes.md 3.9, 3.12; module 04 C-04-2). Plan pages sit at advertiser level,
// Cross-media reach at advertiser and partner level.
import { advertiserPath, partnerPath } from '@/lib/routes/paths';

export interface PlanScope {
  partnerId: string;
  /** Absent at partner level (Cross-media reach only). */
  advertiserId?: string | undefined;
}

export const plansListPath = (pid: string, aid: string): string =>
  advertiserPath(pid, aid, 'marketplace', 'plans');
export const newPlanPath = (pid: string, aid: string): string =>
  advertiserPath(pid, aid, 'marketplace', 'plan', 'new');
export const planPagePath = (pid: string, aid: string, planPublicId: string): string =>
  advertiserPath(pid, aid, 'pr', planPublicId, 'marketplace', 'plan');

export const crossMediaPath = (s: PlanScope, ...sub: string[]): string =>
  s.advertiserId
    ? advertiserPath(s.partnerId, s.advertiserId, 'cross-media-reach', ...sub)
    : partnerPath(s.partnerId, 'cross-media-reach', ...sub);
