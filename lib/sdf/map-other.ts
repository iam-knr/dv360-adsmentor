// AdGroups.csv, Ads.csv and Media Products.csv cells (module 11 4.4 B, E, F). These files are exported from the
// stored rows; an upload applies Name, Status and Bid Value of existing ad groups and Name and Status of existing
// ads (docs/gaps/p4-10a.md). Media products are read-only reference data.
import { encDate, encEpoch, encNum } from './codec';

const STATUS = { ACTIVE: 'Active', PAUSED: 'Paused', DRAFT: 'Draft', ARCHIVED: 'Archived' } as Record<string, string>;
const REVIEW = { PENDING: 'Pending', APPROVED: 'Approved', REJECTED: 'Rejected', RESTRICTED: 'Restricted' } as Record<string, string>;
const AD_FORMAT = {
  RESPONSIVE: 'Responsive (video)',
  DEMAND_GEN_VIDEO: 'Demand Gen video',
  DEMAND_GEN_IMAGE: 'Demand Gen image',
  DEMAND_GEN_CAROUSEL: 'Demand Gen carousel',
} as Record<string, string>;
const DEAL_TYPE = {
  PRIVATE_AUCTION: 'Private Auction',
  PREFERRED_DEAL: 'Preferred',
  PROGRAMMATIC_GUARANTEED: 'Programmatic Guaranteed',
  INSTANT_DEAL: 'Instant',
} as Record<string, string>;
const iso = (d: Date | null | undefined) => (d ? d.toISOString().slice(0, 10) : null);

export interface AdGroupRowIn {
  publicId: bigint;
  lineItemPublicId: bigint;
  name: string;
  status: string;
  updatedAt: Date;
  adSourceLabel: string | null;
  bidValue: { toString(): string } | null;
}

export function adGroupCells(g: AdGroupRowIn): Record<string, string> {
  return {
    'Ad Group Id': g.publicId.toString(),
    'Line Item Id': g.lineItemPublicId.toString(),
    Name: g.name,
    Timestamp: encEpoch(g.updatedAt),
    Status: STATUS[g.status] ?? g.status,
    'Ad Source': g.adSourceLabel ?? '',
    'Bid Value': encNum(g.bidValue?.toString() ?? null),
  };
}

export interface AdRowIn {
  publicId: bigint;
  adGroupPublicId: bigint;
  name: string;
  status: string;
  updatedAt: Date;
  format: string;
  youtubeVideoId: string | null;
  headline: string | null;
  longHeadline: string | null;
  description: string | null;
  callToAction: string | null;
  businessName: string | null;
  logoAssetId: string | null;
  displayUrl: string | null;
  path1: string | null;
  path2: string | null;
  landingPageUrl: string;
  clickTrackerUrl: string | null;
  impressionTrackerUrl: string | null;
  urlSuffix: string | null;
  reviewStatus: string;
  reviewFeedback: string | null;
}

export function adCells(a: AdRowIn): Record<string, string> {
  return {
    'Ad Id': a.publicId.toString(),
    'Ad Group Id': a.adGroupPublicId.toString(),
    Name: a.name,
    Timestamp: encEpoch(a.updatedAt),
    Status: STATUS[a.status] ?? a.status,
    Format: AD_FORMAT[a.format] ?? a.format,
    'Video Id': a.youtubeVideoId ?? '',
    Headline: a.headline ?? '',
    'Long Headline': a.longHeadline ?? '',
    Description: a.description ?? '',
    'Call To Action': a.callToAction ?? '',
    'Business Name': a.businessName ?? '',
    'Logo Asset Id': a.logoAssetId ?? '',
    'Display URL Domain': a.displayUrl ?? '',
    'Display URL Path 1': a.path1 ?? '',
    'Display URL Path 2': a.path2 ?? '',
    'Landing Page URL': a.landingPageUrl,
    'Click Tracker URL': a.clickTrackerUrl ?? '',
    'Impression Tracker URL': a.impressionTrackerUrl ?? '',
    'Url Suffix': a.urlSuffix ?? '',
    'Review Status': REVIEW[a.reviewStatus] ?? a.reviewStatus,
    'Review Feedback': a.reviewFeedback ?? '',
  };
}

export interface MediaProductIn {
  dealId: string;
  name: string;
  dealType: string;
  exchangeName: string;
  status: string;
  rate: { toString(): string };
  startAt: Date;
  endAt: Date;
  advertiserPublicIds: string[];
}

export function mediaCells(d: MediaProductIn): Record<string, string> {
  return {
    'Media Product Id': d.dealId,
    Name: d.name,
    Type: DEAL_TYPE[d.dealType] ?? d.dealType,
    Exchange: d.exchangeName,
    Status: STATUS[d.status] ?? d.status,
    Rate: encNum(d.rate.toString()),
    'Start Date': encDate(iso(d.startAt)),
    'End Date': encDate(iso(d.endAt)),
    'Advertiser Ids': d.advertiserPublicIds.join(';'),
  };
}
