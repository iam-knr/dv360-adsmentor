// Wire types of the inventory services (module 13 4.1). Client safe: no server or database imports.
import type { DealStatusKey } from './transitions';

export type { DealStatusKey } from './transitions';
export type { BulkResponse } from '@/lib/creatives/types';

export type Commitment = 'GUARANTEED' | 'NON_GUARANTEED';
export type Format = 'DISPLAY' | 'VIDEO' | 'AUDIO';

export interface DealRow {
  kind: 'DEAL';
  id: string;
  publicId: string;
  /** The seller's deal ID shown in the ID column. */
  dealId: string;
  name: string;
  orderId: string | null;
  status: DealStatusKey;
  dealType: string;
  dealTypeLabel: string;
  commitment: Commitment;
  commitmentLabel: string;
  deliveryMethod: string;
  centralPartnerDeal: boolean;
  /** CPM in the advertiser currency. */
  rate: number | null;
  rateType: string;
  bidRatioPct: number | null;
  sizes: string[];
  startAt: string;
  endAt: string;
  quantity: number | null;
  impressions: number | null;
  spend: number | null;
  winRate: number | null;
  format: Format;
  exchangeId: string;
  exchangeName: string;
  sellerName: string;
  lineItemCount: number;
  allowPausing: boolean;
  actionRequired: boolean;
  actionReason: string | null;
  /** Campaign scope: the deal is not used by any line item of the campaign. */
  notUsedInCampaign: boolean;
}

export interface OrderRow {
  kind: 'ORDER';
  id: string;
  publicId: string;
  name: string;
  externalCode: string;
  sellerName: string;
  exchangeName: string;
  status: string;
  children: DealRow[];
}

export interface OrdersDeals {
  actionRequired: DealRow[];
  rest: (OrderRow | DealRow)[];
  asOf: string;
  currencyCode: string;
  canWrite: boolean;
  total: number;
}

export interface OrdersDealsQuery {
  status?: DealStatusKey[];
  exchange?: string[];
  commitment?: Commitment[];
  dealType?: string[];
  format?: Format[];
  q?: string;
  campaignId?: string;
}

export interface PackageRow {
  id: string;
  publicId: string;
  packageUuid: string;
  name: string;
  format: Format;
  exchangeName: string;
  dealType: string;
  /** Advertiser currency. */
  rate: number;
  rateOriginal: { currency: string; amount: number } | null;
  currencyCode: string;
  bidRatioPct: number | null;
  startAt: string;
  assignedLineItems: number;
  notUsedInCampaign: boolean;
}

export interface DealGroupRow {
  id: string;
  publicId: string;
  name: string;
  kind: 'DEAL_GROUP' | 'PREFERRED_DEAL_GROUP';
  members: { kind: 'DEAL' | 'PACKAGE'; id: string; name: string }[];
}

export interface DealView {
  row: DealRow;
  canWriteAll: boolean;
  viewOnly: boolean;
  sellerName: string;
  description: string | null;
  exchangeName: string;
  advertiserAccess: {
    allAdvertisers: boolean;
    partnerName: string;
    advertisers: { id: string; name: string }[];
  };
  allAdvertisers: { id: string; name: string }[];
  frequencyCap: FrequencyCapView | null;
  pgDirect: boolean;
  cost: number | null;
  durationSeconds: number | null;
  creativeSource: string;
  committed: number | null;
  delivered: number | null;
  shortfall: number | null;
  version: number;
  dailySeries: { date: string; impressions: number; spend: number }[];
  currencyCode: string;
}

export interface FrequencyCapView {
  enabled: boolean;
  maxImpressions: number | null;
  periodCount: number | null;
  period: 'DAYS' | 'WEEKS' | 'MONTHS' | null;
}

export interface DealLineItemRow {
  id: string;
  publicId: string;
  name: string;
  type: string;
  status: string;
  impressions: number;
  spend: number;
  href: string;
}

export interface SellerCard {
  id: string;
  name: string;
  kind: 'EXCHANGE' | 'PUBLISHER';
  format: Format;
  floorCpm: number;
  currencyCode: string;
  /** Dimension → values the seller offers. */
  options: Record<string, string[]>;
}

export interface InstantDealPayload {
  sellerId: string;
  name: string;
  targeting: Record<string, string[]>;
  advertiserIds: string[];
}

export interface InstantDealForecastView {
  impressions7d: { p10: number; p50: number; p90: number };
  recommendedMinBid: number;
  estimatedMediaCost: number;
  floorCpm: number;
  currencyCode: string;
  asOf: string;
  forecastToken: string;
}

export interface PackageCard {
  id: string;
  name: string;
  type: string;
  sevenDayImpressions: number;
  format: Format;
}

export interface FeaturedView {
  banner: { title: string; body: string; ctaLabel: string; ctaTarget: string } | null;
  carousels: { key: string; title: string; count: number; items: PackageCard[] }[];
  instantDealSellers: SellerCard[];
}

export interface DiscoverRow {
  id: string;
  name: string;
  type: string;
  typeLabel: string;
  exchangeId: string;
  exchangeName: string;
  exchangeSharePct: number;
  sevenDayImpressions: number;
  googleAudiences: number;
  categories: string[];
  format: Format;
  floorPrice: number;
}

export interface DiscoverRequest {
  mode: 'AI' | 'KEYWORD';
  query: string;
  filters: Record<string, string[]>;
  page?: number;
  pageSize?: number;
}

export interface DiscoverResult {
  rows: DiscoverRow[];
  total: number;
  page: number;
  pageSize: number;
  chips: string[];
  facets: Record<string, { value: string; label: string }[]>;
}

export interface MarketplaceItem {
  id: string;
  name: string;
  type: string;
  typeLabel: string;
  exchangeName: string;
  sellerName: string;
  floorPrice: number;
  currencyCode: string;
  startAt: string | null;
  endAt: string | null;
  format: Format;
  dealType: string;
  scale: {
    sevenDayImpressions: number;
    gender: Record<string, number>;
    geo: Record<string, number>;
    device: Record<string, number>;
    formatMix: Record<string, number>;
  };
  audiences: string[];
  capabilities: string[];
  about: string;
  assigned: boolean;
}

export interface NegotiationRow {
  id: string;
  publicId: string;
  rfpId: string;
  name: string;
  sellerName: string;
  status: string;
  awaiting: 'BUYER' | 'SELLER' | 'NONE';
  deliveryMethod: string;
  commitment: Commitment;
  commitmentLabel: string;
  exchangeName: string;
  volume: number | null;
  averagePrice: number | null;
  spend: number | null;
  lastEditedAt: string;
}

export interface NegotiationMessageView {
  id: string;
  authorKind: 'BUYER' | 'SELLER';
  body: string;
  proposedRate: number | null;
  proposedVolume: number | null;
  sentAt: string;
}

export interface NegotiationView {
  row: NegotiationRow;
  terms: {
    rate: number;
    volume: number | null;
    startAt: string | null;
    endAt: string | null;
    format: string | null;
    targeting: string | null;
    commitment: string;
  };
  messages: NegotiationMessageView[];
  round: number;
  maxRounds: number;
  finalOffer: boolean;
  resultingDeal: { id: string; publicId: string; name: string } | null;
  banner: string | null;
  currencyCode: string;
  canWrite: boolean;
}

export interface LineItemChoice {
  id: string;
  publicId: string;
  name: string;
  type: string;
  campaignName: string;
  ioName: string;
  advertiserName: string;
}

export interface AssignInventoryItem {
  kind: 'DEAL' | 'PACKAGE' | 'GROUP';
  id: string;
  mode: 'INCLUDE' | 'EXCLUDE';
}
