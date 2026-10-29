// Wire types of the YouTube ad group and ad services (module 09 4, Δ-09-11). Client safe: plain data only.
import type { TargetingState } from '@/lib/targeting';
import type { AdFormatKey, UrlProtocol, YtBidKind } from '@/lib/validation/constants/youtube';
import type { Issue } from '@/lib/validation/types';

export type Result<T> =
  | { ok: true; data: T; warnings?: Issue[] }
  | { ok: false; issues: Issue[]; code?: 'FORBIDDEN' | 'NOT_FOUND' | 'CONFLICT' };

export type YtStatus = 'ACTIVE' | 'PAUSED';
export type ReviewStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'RESTRICTED';

/** What the ad group slide-over edits. The bid is typed in major units of the advertiser currency. */
export interface AdGroupFormValue {
  name: string;
  status: YtStatus;
  bid: string;
  targetingState: TargetingState;
}

export interface AdGroupRow {
  id: string;
  publicId: string;
  lineItemId: string;
  name: string;
  status: YtStatus;
  alertCount: number;
  /** Ad format label of the first ad (the column title), "Mixed" for several (Q-09-10). */
  adFormatLabel: string;
  adSource: string;
  cm360Id: string | null;
  adCount: number;
  impressions: number;
  coViewedImpressions: number;
  revenue: number;
  avgCpm: number | null;
  views: number;
  viewRate: number | null;
  avgCpv: number | null;
  conversions: number;
  avgCpa: number | null;
}

export interface AdGroupList {
  rows: AdGroupRow[];
  total: AdGroupRow | null;
  currency: string;
  lineItem: {
    id: string;
    publicId: string;
    name: string;
    type: string;
    bidKind: YtBidKind;
    status: string;
  };
  readOnly: boolean;
}

export interface AdRow {
  id: string;
  publicId: string;
  adGroupId: string;
  name: string;
  status: YtStatus;
  format: 'RESPONSIVE';
  reviewStatus: ReviewStatus;
  reviewFeedback: string | null;
  thumbnailUrl: string;
  formats: AdFormatKey[];
  trackers: { kind: 'CLICK' | 'IMPRESSION'; url: string }[];
}

export interface AdGroupDetail {
  id: string;
  publicId: string;
  version: number;
  lineItemId: string;
  lineItemName: string;
  lineItemBidKind: YtBidKind;
  currency: string;
  value: AdGroupFormValue;
  ads: AdRow[];
  readOnly: boolean;
}

export interface AdFormValue {
  name: string;
  status: YtStatus;
  videoRef: string;
  videoId: string | null;
  headline: string;
  longHeadline: string;
  description: string;
  callToAction: string;
  businessName: string;
  logoAssetId: string | null;
  displayUrl: string;
  path1: string;
  path2: string;
  landingProtocol: UrlProtocol;
  landingPage: string;
  clickTrackerProtocol: UrlProtocol;
  clickTracker: string;
  impressionTrackerUrl: string;
  urlSuffix: string;
  companionMode: 'NONE' | 'OWN';
  companionAssetId: string | null;
}

export interface YoutubeVideoHit {
  videoId: string;
  title: string;
  channelName: string;
  durationSec: number;
  orientation: 'HORIZONTAL' | 'VERTICAL';
  thumbnailUrl: string;
}

export interface AdDetail {
  id: string;
  publicId: string;
  version: number;
  adGroupId: string;
  adGroupName: string;
  value: AdFormValue;
  video: YoutubeVideoHit | null;
  reviewStatus: ReviewStatus;
  reviewFeedback: string | null;
  formats: AdFormatKey[];
  logoUrl: string | null;
  /** Defaults of Advertiser settings > YouTube and Demand Gen (banner of 2.5). */
  defaults: { businessName: string; logoAssetId: string | null };
  /** Ticks of the parent line item, for the preview (LI-YT-005). */
  allowedSurfaces: ('IN_STREAM' | 'IN_FEED' | 'SHORTS')[] | null;
  nonSkippable: boolean;
  readOnly: boolean;
}

export const EMPTY_AD_FORM: AdFormValue = {
  name: '',
  status: 'ACTIVE',
  videoRef: '',
  videoId: null,
  headline: '',
  longHeadline: '',
  description: '',
  callToAction: '',
  businessName: '',
  logoAssetId: null,
  displayUrl: '',
  path1: '',
  path2: '',
  landingProtocol: 'https://',
  landingPage: '',
  clickTrackerProtocol: 'https://',
  clickTracker: '',
  impressionTrackerUrl: '',
  urlSuffix: '',
  companionMode: 'NONE',
  companionAssetId: null,
};
