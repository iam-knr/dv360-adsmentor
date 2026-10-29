import 'server-only';
// Page helper of the inventory routes: resolve the URL segments to the public ids the links use, 404 on a foreign id.
import { notFound } from 'next/navigation';
import { resolveAdvertiser, resolveCampaign } from '@/lib/scope/resolve';
import type { Scope } from './paths';

export interface RouteParams {
  partnerId: string;
  advertiserId: string;
  campaignId?: string;
}

export async function inventoryScope(p: RouteParams): Promise<Scope> {
  if (p.campaignId) {
    const chain = await resolveCampaign(p.partnerId, p.advertiserId, p.campaignId);
    if (!chain) notFound();
    return { partnerId: chain.partner.publicId, advertiserId: chain.advertiser.publicId, campaignId: chain.campaign.publicId };
  }
  const chain = await resolveAdvertiser(p.partnerId, p.advertiserId);
  if (!chain) notFound();
  return { partnerId: chain.partner.publicId, advertiserId: chain.advertiser.publicId };
}
