import 'server-only';
// Scope layouts (routes.md 5.1 "Shared loaders"): tiny server components used by the three-line layout files of
// both route trees. A broken chain renders the 404 page in place (HTTP 404, no redirect, routes.md R10, 6.5).
// Advertiser and deeper scopes log "Recently opened" after the response (module 01 4.2, fire and forget).
import type { ReactNode } from 'react';
import { notFound } from 'next/navigation';
import { after } from 'next/server';
import type { SessionUser } from '@/lib/auth/types';
import { ScopeBoundary } from './context';
import { requireViewer } from './guard';
import { logRecentlyOpenedSafe, type RecentEntityType } from './recent';
import {
  resolveAdvertiser,
  resolveCampaign,
  resolveIo,
  resolveLi,
  resolvePartner,
} from './resolve';

interface ScopeProps<T> {
  params: Promise<T>;
  children: ReactNode;
  /** Log a Recently opened row for this level. The (app) tree logs; the (full) tree does not log twice. */
  log?: boolean;
}

function logLater(
  user: SessionUser,
  entityType: RecentEntityType,
  entityId: string,
  partnerId: string,
) {
  after(() => logRecentlyOpenedSafe(user, { entityType, entityId, partnerId }));
}

export async function PartnerScope({ params, children }: ScopeProps<{ partnerId: string }>) {
  const { partnerId } = await params;
  await requireViewer();
  const partner = await resolvePartner(partnerId);
  if (!partner) notFound();
  return <ScopeBoundary part={{ partner }}>{children}</ScopeBoundary>;
}

export async function AdvertiserScope({
  params,
  children,
  log = true,
}: ScopeProps<{ partnerId: string; advertiserId: string }>) {
  const { partnerId, advertiserId } = await params;
  const user = await requireViewer();
  const chain = await resolveAdvertiser(partnerId, advertiserId);
  if (!chain) notFound();
  if (log) logLater(user, 'ADVERTISER', chain.advertiser.id, chain.partner.id);
  return <ScopeBoundary part={{ advertiser: chain.advertiser }}>{children}</ScopeBoundary>;
}

export async function CampaignScope({
  params,
  children,
  log = true,
}: ScopeProps<{ partnerId: string; advertiserId: string; campaignId: string }>) {
  const { partnerId, advertiserId, campaignId } = await params;
  const user = await requireViewer();
  const chain = await resolveCampaign(partnerId, advertiserId, campaignId);
  if (!chain) notFound();
  if (log) logLater(user, 'CAMPAIGN', chain.campaign.id, chain.partner.id);
  return <ScopeBoundary part={{ campaign: chain.campaign }}>{children}</ScopeBoundary>;
}

export async function IoScope({
  params,
  children,
  log = true,
}: ScopeProps<{ partnerId: string; advertiserId: string; campaignId: string; ioId: string }>) {
  const { partnerId, advertiserId, campaignId, ioId } = await params;
  const user = await requireViewer();
  const chain = await resolveIo(partnerId, advertiserId, campaignId, ioId);
  if (!chain) notFound();
  if (log) logLater(user, 'INSERTION_ORDER', chain.io.id, chain.partner.id);
  return <ScopeBoundary part={{ io: chain.io }}>{children}</ScopeBoundary>;
}

export async function LiScope({
  params,
  children,
  log = true,
}: ScopeProps<{
  partnerId: string;
  advertiserId: string;
  campaignId: string;
  ioId: string;
  liId: string;
}>) {
  const { partnerId, advertiserId, campaignId, ioId, liId } = await params;
  const user = await requireViewer();
  const chain = await resolveLi(partnerId, advertiserId, campaignId, ioId, liId);
  if (!chain) notFound();
  if (log) logLater(user, 'LINE_ITEM', chain.li.id, chain.partner.id);
  return <ScopeBoundary part={{ li: chain.li }}>{children}</ScopeBoundary>;
}
