// Top bar crumbs (routes.md 4.5 "Breadcrumb rules"). The top bar stops at campaign level; IO and LI context lives in
// the page crumb row of their frames (routes.md 4.4).
import { advertiserPath, campaignPath, partnerPath } from '@/lib/routes/paths';

export interface CrumbScope {
  partner?: { publicId: string; name: string };
  advertiser?: { publicId: string; name: string };
  campaign?: { publicId: string; name: string };
}

export interface TopCrumb {
  level: 'Partner' | 'Advertiser' | 'Campaign';
  name: string;
  href?: string;
}

export function topCrumbs(s: CrumbScope): TopCrumb[] {
  const out: TopCrumb[] = [];
  if (!s.partner) return out;
  const pid = s.partner.publicId;
  out.push({ level: 'Partner', name: s.partner.name, href: partnerPath(pid, 'home_v3') });
  if (!s.advertiser) return out;
  const aid = s.advertiser.publicId;
  out.push({ level: 'Advertiser', name: s.advertiser.name, href: advertiserPath(pid, aid, 'cs') });
  if (!s.campaign) return out;
  out.push({
    level: 'Campaign',
    name: s.campaign.name,
    href: campaignPath(pid, aid, s.campaign.publicId),
  });
  return out;
}

/** Names longer than `max` characters end with an ellipsis (routes.md 4.5 rule 5); the full name goes in a tooltip. */
export function truncateName(name: string, max = 24): string {
  return name.length > max ? `${name.slice(0, max - 1)}…` : name;
}
