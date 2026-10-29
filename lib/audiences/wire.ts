// Wire types of the audience screens (module 14 4.1, routes.md 8.11). Client safe. Ids are public ids as strings.
import type { WireIssue } from '@/lib/campaigns/wire';
import type { Bucket, GeoDistribution, AudienceInsights } from './analysis';
import type { SizeBucket } from './sizes';

export type { WireIssue } from '@/lib/campaigns/wire';
export type { Bucket, GeoDistribution, AudienceInsights } from './analysis';

export type AudienceTab = 'FIRST_PARTY' | 'CUSTOM' | 'COMBINED' | 'PARTNER';
export type AudienceTypeKey =
  | 'TAG_BASED'
  | 'CUSTOMER_MATCH'
  | 'YOUTUBE_USERS'
  | 'LOOKALIKE'
  | 'COMBINED'
  | 'CUSTOM_AFFINITY'
  | 'CUSTOM_INTENT_DISPLAY_VIDEO'
  | 'CUSTOM_INTENT_YOUTUBE'
  | 'PARTNER';
export type AudienceStatusKey = 'PROCESSING' | 'ACTIVE' | 'INACTIVE' | 'ARCHIVED';

export interface WriteMeta {
  expectedVersion?: number;
  changeNote?: string;
}

export const TYPE_LABEL: Record<AudienceTypeKey, string> = {
  TAG_BASED: 'Tag-based',
  CUSTOMER_MATCH: 'Customer match',
  YOUTUBE_USERS: 'YouTube users',
  LOOKALIKE: 'Lookalike',
  COMBINED: 'Combined',
  CUSTOM_AFFINITY: 'Custom affinity',
  CUSTOM_INTENT_DISPLAY_VIDEO: 'Custom intent',
  CUSTOM_INTENT_YOUTUBE: 'Custom intent',
  PARTNER: 'Commerce',
};

export const STATUS_LABEL: Record<AudienceStatusKey, string> = {
  PROCESSING: 'Processing',
  ACTIVE: 'Active',
  INACTIVE: 'Inactive',
  ARCHIVED: 'Archived',
};

export const SOURCE_LABEL: Record<string, string> = {
  DISPLAY_VIDEO_360: 'Display & Video 360',
  GOOGLE_ANALYTICS: 'Analytics',
  COMMERCE_PARTNER: 'Commerce partner',
  YOUTUBE: 'YouTube',
};

export interface SizeCell {
  bucket: SizeBucket;
  /** Exact value, shown on hover. */
  exact: number;
  fraction: number;
}

export interface AudienceRow {
  id: string;
  name: string;
  type: AudienceTypeKey;
  typeLabel: string;
  status: AudienceStatusKey;
  source: string;
  display: SizeCell;
  youtube: SizeCell;
  mobileApp: SizeCell;
  ctv: SizeCell;
  lineItems: number;
  /** Hours until the list is available; 0 when it is. */
  availableInHours: number;
  /** Combined lists: the YouTube size is "Unavailable" when a member has none. */
  youtubeUnavailable: boolean;
  /** Custom lists: Display size of active members only. */
  activeDisplay: SizeCell | null;
  createdAt: string;
}

export interface AudienceListResult {
  rows: AudienceRow[];
  total: number;
}

export interface TagRuleDraft {
  variableKey: string;
  operator: 'EQUALS' | 'NOT_EQUALS' | 'CONTAINS' | 'STARTS_WITH' | 'GREATER_THAN' | 'LESS_THAN';
  value: string;
}

export interface CombinedMemberDraft {
  kind: 'AUDIENCE' | 'GOOGLE_AUDIENCE' | 'CUSTOM_LIST';
  id: string;
}

export interface CombinedDraft {
  include: CombinedMemberDraft[][];
  exclude: CombinedMemberDraft[];
}

export type YtUserAction =
  | 'VIEWED_ANY_VIDEO'
  | 'VISITED_CHANNEL'
  | 'SUBSCRIBED'
  | 'LIKED_VIDEO'
  | 'SHARED_VIDEO'
  | 'VIEWED_SPECIFIC_VIDEOS';

export const YT_ACTION_LABEL: Record<YtUserAction, string> = {
  VIEWED_ANY_VIDEO: 'Viewed any video',
  VISITED_CHANNEL: 'Visited channel page',
  SUBSCRIBED: 'Subscribed',
  LIKED_VIDEO: 'Liked a video',
  SHARED_VIDEO: 'Shared a video',
  VIEWED_SPECIFIC_VIDEOS: 'Viewed specific videos',
};

export type ContactTypeKey = 'EMAIL' | 'PHONE' | 'MAIL_ADDRESS' | 'MOBILE_DEVICE_ID';

export const CONTACT_LABEL: Record<ContactTypeKey, string> = {
  EMAIL: 'Email',
  PHONE: 'Phone',
  MAIL_ADDRESS: 'Mailing address',
  MOBILE_DEVICE_ID: 'Mobile device ID',
};

export const CONNECTED_PRODUCTS = [
  { key: 'sample-crm', label: 'Sample CRM', rows: 48_000 },
  { key: 'sample-warehouse', label: 'Sample data warehouse', rows: 120_000 },
  { key: 'sample-csv-drop', label: 'Sample CSV drop', rows: 9_500 },
] as const;

export type AudienceInput =
  | { kind: 'TAG_BASED'; name: string; floodlightActivityId: string | null; rules: TagRuleDraft[]; membershipDays: number | string }
  | {
      kind: 'CUSTOMER_MATCH';
      name: string;
      description?: string;
      source: 'CONNECT' | 'UPLOAD' | 'LATER' | null;
      connectedProductKey?: string | null;
      contactType?: ContactTypeKey | null;
      /** The CSV text, already hashed in the browser (module 14 S7). */
      fileName?: string;
      fileText?: string;
      membershipDays: number | string;
      consentAck: boolean;
    }
  | {
      kind: 'YOUTUBE_USERS';
      name: string;
      linkedAccountId: string | null;
      action: YtUserAction | null;
      videoIds: string[];
      membershipDays: number | string;
    }
  | { kind: 'COMBINED'; name: string; description?: string; draft: CombinedDraft }
  | { kind: 'LOOKALIKE'; name: string; seedIds: string[]; reachPct: number; countries: string[] }
  | {
      kind: 'CUSTOM_AFFINITY' | 'CUSTOM_INTENT_DISPLAY_VIDEO' | 'CUSTOM_INTENT_YOUTUBE';
      name: string;
      description?: string;
      interests: string[];
      urls: string[];
      apps: string[];
      keywords: string[];
    };

export interface AudienceView {
  id: string;
  name: string;
  description: string | null;
  type: AudienceTypeKey;
  typeLabel: string;
  status: AudienceStatusKey;
  source: string;
  /** Tag-based lists created outside Audience Manager: only the Line items tab is supported. */
  externalSource: boolean;
  version: number;
  membershipDays: number | null;
  availableAt: string | null;
  availableInHours: number;
  createdAt: string;
  updatedAt: string;
  sizes: { label: string; cell: SizeCell }[];
  lineItemCount: number;
  floodlight: { id: string; name: string; rules: TagRuleDraft[] } | null;
  lookalike: { seeds: { id: string; name: string; users: number }[]; reachPct: number; countries: string[] } | null;
  customerMatch: {
    contactType: ContactTypeKey | null;
    dataSource: string | null;
    uploads: { fileName: string; rows: number; matched: number; matchRatePct: number | null }[];
  } | null;
  combined: { include: { name: string; kind: string }[][]; exclude: { name: string; kind: string }[]; expression: string } | null;
  entries: { kind: string; value: string }[];
  youtube: { channel: string | null; action: string | null; videoIds: string[] } | null;
}

export interface PickerRow {
  id: string;
  name: string;
  path: string[];
  type: string;
  sizeBucket: SizeBucket;
  eligibility: string[];
  availableInHours: number;
}

export interface LinkedLineItem {
  id: string;
  name: string;
  status: string;
  type: string;
  mode: 'Included' | 'Excluded';
}

export interface AudienceLookups {
  activities: { id: string; name: string; type: string; counting: string; remarketing: boolean }[];
  linkedChannels: { id: string; name: string }[];
  firstParty: { id: string; name: string; users: number; type: string }[];
  countries: { code: string; name: string }[];
}

export type { WireIssue as AudienceIssue };
export type { Bucket as AudienceBucket };
