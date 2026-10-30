// Scope shapes passed from the scope layouts to the client chrome. Ids are strings; `publicId` is the URL id.
import type { DvRole } from '@/lib/auth/types';

export type EntityStatusKey = 'DRAFT' | 'ACTIVE' | 'PAUSED' | 'ARCHIVED' | 'SCHEDULED_FOR_DELETION';

export interface EntityRef {
  /** Row id (cuid). */
  id: string;
  /** Public id, as in the URL. */
  publicId: string;
  name: string;
  status: EntityStatusKey;
}

export interface PartnerInfo extends EntityRef {
  currencyCode: string;
  timeZone: string;
}

export interface AdvertiserInfo extends EntityRef {
  currencyCode: string;
  timeZone: string;
  sdfVersion: string;
  paused: boolean;
  scheduledForDeletion: boolean;
}

export type CampaignInfo = EntityRef;
export type IoInfo = EntityRef;
export interface LiInfo extends EntityRef {
  type: string;
}

export interface ScopeInfo {
  partner?: PartnerInfo;
  advertiser?: AdvertiserInfo;
  campaign?: CampaignInfo;
  io?: IoInfo;
  li?: LiInfo;
}

/** What the client chrome knows about the person (module 01 5.2 `ViewerContext`). */
export interface ViewerInfo {
  name: string;
  initials: string;
  appRole: 'user' | 'super_admin';
  dvRole: DvRole;
  /** READ_ONLY and PARTNER_CLIENT: the grey "Limited Access" chip (routes.md 2). */
  limitedAccess: boolean;
  /** No create or edit anywhere: limited access, reporting only, or view-as without Act as student. */
  readOnly: boolean;
  viewAs: { name: string; actAs: boolean } | null;
}
