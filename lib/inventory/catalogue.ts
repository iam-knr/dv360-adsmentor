// Global Marketplace catalogue (module 13 3.3): five Featured carousels, nine instant-deal sellers, and Discover-only
// packages, deals and publishers. Deterministic: ids are `stableId('marketplace', key)`, so the seed is an upsert.
// Names are written for Adsmetor (descriptive, no real brands); sellers use vendor names from the allow list (RC-055).
import type { DealType, InventoryFormat, MarketplaceProductType, SellerKind } from '@prisma/client';
import { exchangeId } from '../seed/reference';
import { mulberry32, stableId } from '../seed/prng';

export interface CatalogueProduct {
  id: string;
  type: MarketplaceProductType;
  exchangeId: string;
  name: string;
  description: string;
  sellerKind: SellerKind | null;
  isInstantSeller: boolean;
  instantTargetingOptions: Record<string, string[]> | null;
  sevenDayImpressions: bigint;
  floorPrice: number;
  floorCurrency: 'INR';
  featuredCarousel: string | null;
  featuredCarouselOrder: number | null;
  bannerKey: string | null;
  categories: string[];
  googleAudienceCount: number;
  scale: ProductScale;
  searchText: string;
}

export interface ProductScale {
  format: InventoryFormat;
  dealType: DealType;
  devices: string[];
  countries: string[];
  genres: string[];
  gender: Record<string, number>;
  geo: Record<string, number>;
  device: Record<string, number>;
  formatMix: Record<string, number>;
  audiences: string[];
}

export const FEATURED_CAROUSELS: { key: string; title: string; count: number; format: InventoryFormat }[] = [
  { key: 'premium-ctv', title: 'Premium CTV: Always-On Video', count: 7, format: 'VIDEO' },
  { key: 'top-video', title: 'Top Performing: Video and Streaming', count: 7, format: 'VIDEO' },
  { key: 'display-viewability', title: 'Display and High Viewability', count: 15, format: 'DISPLAY' },
  { key: 'audio', title: 'Audio Essentials', count: 16, format: 'AUDIO' },
  { key: 'media-entertainment', title: 'Media and Entertainment: Passionate Audiences', count: 18, format: 'DISPLAY' },
];

export const MARKETPLACE_BANNERS = [
  {
    key: 'always-on',
    title: 'Always-on premium video, ready to assign',
    body: 'Browse curated packages from trusted sellers and assign them to your line items in a few clicks.',
    ctaLabel: 'Explore Discover',
    ctaTarget: 'discover',
  },
] as const;

/** The nine instant-deal sellers: exchange code, badge kind and the values their targeting rows offer. */
export const INSTANT_SELLERS: {
  code: string;
  name: string;
  kind: SellerKind;
  format: InventoryFormat;
  floor: number;
  impressions: number;
}[] = [
  { code: 'netflix', name: 'Netflix', kind: 'PUBLISHER', format: 'VIDEO', floor: 780, impressions: 90_000_000_000 },
  { code: 'tubi', name: 'Tubi', kind: 'PUBLISHER', format: 'VIDEO', floor: 360, impressions: 180_000_000_000 },
  { code: 'google-ad-manager', name: 'Google Ad Manager', kind: 'EXCHANGE', format: 'DISPLAY', floor: 90, impressions: 4_000_000_000_000 },
  { code: 'index-exchange', name: 'Index Exchange', kind: 'EXCHANGE', format: 'DISPLAY', floor: 85, impressions: 1_200_000_000_000 },
  { code: 'openx', name: 'OpenX', kind: 'EXCHANGE', format: 'DISPLAY', floor: 80, impressions: 900_000_000_000 },
  { code: 'pubmatic', name: 'PubMatic', kind: 'EXCHANGE', format: 'DISPLAY', floor: 75, impressions: 1_100_000_000_000 },
  { code: 'magnite-dv', name: 'Magnite DV+', kind: 'EXCHANGE', format: 'VIDEO', floor: 240, impressions: 650_000_000_000 },
  { code: 'spotify-ad-exchange', name: 'Spotify Ad Exchange', kind: 'PUBLISHER', format: 'AUDIO', floor: 420, impressions: 70_000_000_000 },
  { code: 'taboola', name: 'Taboola', kind: 'EXCHANGE', format: 'DISPLAY', floor: 55, impressions: 500_000_000_000 },
];

const SELLER_TARGETING: Record<string, string[]> = {
  'Country & Region': ['India', 'Singapore', 'United Arab Emirates', 'United Kingdom', 'Australia', 'Maharashtra', 'Karnataka'],
  Format: ['Display', 'Video', 'Audio', 'Native'],
  Verticals: ['News', 'Sports', 'Entertainment', 'Finance', 'Travel', 'Technology', 'Lifestyle'],
  Device: ['Mobile', 'Desktop', 'Tablet', 'Connected TV'],
  Publisher: ['Publisher group A', 'Publisher group B', 'Publisher group C', 'Premium publishers'],
};

const ADJ = ['Prime', 'Elite', 'Core', 'Daily', 'Rising', 'Peak', 'Urban', 'Metro', 'Pulse', 'Horizon', 'Summit', 'Vivid', 'Bright', 'Nova', 'Atlas', 'Echo', 'Spark', 'Crest', 'Aura', 'Orbit'];
const NOUN: Record<InventoryFormat, string[]> = {
  VIDEO: ['Streaming Originals', 'Living Room Video', 'Series Premieres', 'Sports Live Video', 'Movie Nights', 'Short Form Video', 'Binge Watch'],
  DISPLAY: ['Homepage Takeover', 'News Readers', 'Finance Readers', 'Lifestyle Reads', 'Tech Enthusiasts', 'Travel Planners', 'Match Day Display', 'Shopping Intent'],
  AUDIO: ['Music Streaming', 'Podcast Listeners', 'Morning Drive', 'Workout Playlists', 'Talk Radio', 'Focus Playlists', 'Late Night Audio'],
};
const THEMES = ['Sports', 'News', 'Entertainment', 'Finance', 'Travel', 'Technology', 'Lifestyle', 'Food', 'Auto'];
const COUNTRIES = ['India', 'Singapore', 'United Arab Emirates', 'United Kingdom', 'Australia'];
const AUDIENCES = ['In-market: Consumer Electronics', 'Affinity: Sports Fans', 'In-market: Travel', 'Affinity: News Readers', 'Life events: Moving', 'In-market: Financial Services', 'Affinity: Movie Lovers', 'In-market: Autos'];
const DEVICES: Record<InventoryFormat, string[][]> = {
  VIDEO: [['Connected TV'], ['Connected TV', 'Mobile'], ['Mobile', 'Desktop']],
  DISPLAY: [['Desktop', 'Mobile'], ['Mobile'], ['Desktop', 'Mobile', 'Tablet']],
  AUDIO: [['Mobile'], ['Mobile', 'Desktop'], ['Mobile', 'Connected TV']],
};

function split(rng: () => number, keys: string[]): Record<string, number> {
  const raw = keys.map(() => 0.2 + rng());
  const total = raw.reduce((a, b) => a + b, 0);
  const out: Record<string, number> = {};
  keys.forEach((k, i) => (out[k] = Math.round(((raw[i] as number) / total) * 1000) / 10));
  return out;
}

function make(
  key: string,
  o: {
    type: MarketplaceProductType;
    exchangeCode: string;
    name: string;
    format: InventoryFormat;
    dealType: DealType;
    carousel?: { key: string; order: number };
    seller?: { kind: SellerKind; floor: number; impressions: number };
    index: number;
  },
): CatalogueProduct {
  const rng = mulberry32(0x13a0 + o.index * 7919);
  const theme = THEMES[o.index % THEMES.length] as string;
  const devices = DEVICES[o.format][o.index % 3] as string[];
  const countries = [COUNTRIES[o.index % COUNTRIES.length] as string, ...(o.index % 3 === 0 ? ['India'] : [])];
  const impressions = o.seller
    ? o.seller.impressions
    : Math.round(Math.exp(Math.log(100_000_000) + rng() * (Math.log(5_000_000_000_000) - Math.log(100_000_000))) / 1_000_000) * 1_000_000;
  const floor = o.seller ? o.seller.floor : Math.round(40 + rng() * 860);
  const categories = [theme, THEMES[(o.index + 3) % THEMES.length] as string];
  const audiences = Array.from({ length: 4 }, (_, i) => AUDIENCES[(o.index + i) % AUDIENCES.length] as string);
  return {
    id: stableId('marketplace', key),
    type: o.type,
    exchangeId: exchangeId(o.exchangeCode),
    name: o.name,
    description: `${o.name}: ${theme.toLowerCase()} inventory on ${devices.join(' and ').toLowerCase()}, sold as ${o.dealType === 'PREFERRED_DEAL' ? 'a preferred deal' : 'a private auction package'}.`,
    sellerKind: o.seller?.kind ?? (o.type === 'PUBLISHER' ? 'PUBLISHER' : null),
    isInstantSeller: !!o.seller,
    instantTargetingOptions: o.seller ? SELLER_TARGETING : null,
    sevenDayImpressions: BigInt(impressions),
    floorPrice: floor,
    floorCurrency: 'INR',
    featuredCarousel: o.carousel?.key ?? null,
    featuredCarouselOrder: o.carousel?.order ?? null,
    bannerKey: null,
    categories,
    googleAudienceCount: 8 + Math.floor(rng() * 40),
    scale: {
      format: o.format,
      dealType: o.dealType,
      devices,
      countries,
      genres: [theme],
      gender: split(rng, ['Female', 'Male', 'Unknown']),
      geo: split(rng, countries.concat(['Other'])),
      device: split(rng, devices.concat(['Other'])),
      formatMix: split(rng, [o.format === 'VIDEO' ? 'Video' : o.format === 'AUDIO' ? 'Audio' : 'Display', 'Native']),
      audiences,
    },
    searchText: [o.name, theme, ...categories, ...devices, ...countries, o.format.toLowerCase(), ...audiences].join(' ').toLowerCase(),
  };
}

const PACKAGE_EXCHANGES = ['google-ad-manager', 'index-exchange', 'openx', 'pubmatic', 'magnite-dv', 'netflix', 'tubi', 'spotify-ad-exchange', 'taboola', 'equativ'];

export function buildCatalogue(): CatalogueProduct[] {
  const out: CatalogueProduct[] = [];
  let i = 0;
  for (const c of FEATURED_CAROUSELS) {
    for (let n = 0; n < c.count; n++, i++) {
      const noun = (NOUN[c.format][n % NOUN[c.format].length] as string);
      const name = `${ADJ[(i * 3) % ADJ.length]} ${noun}${n >= NOUN[c.format].length ? ` ${Math.floor(n / NOUN[c.format].length) + 1}` : ''}`;
      out.push(
        make(`featured:${c.key}:${n}`, {
          type: 'PACKAGE',
          exchangeCode: PACKAGE_EXCHANGES[(i + n) % PACKAGE_EXCHANGES.length] as string,
          name,
          format: c.format,
          dealType: n % 4 === 3 ? 'PREFERRED_DEAL' : 'PRIVATE_AUCTION',
          carousel: { key: c.key, order: n },
          index: i,
        }),
      );
    }
  }
  INSTANT_SELLERS.forEach((s, n) => {
    out.push(
      make(`seller:${s.code}`, {
        type: 'PUBLISHER',
        exchangeCode: s.code,
        name: s.name,
        format: s.format,
        dealType: 'PRIVATE_AUCTION',
        seller: { kind: s.kind, floor: s.floor, impressions: s.impressions },
        index: 100 + n,
      }),
    );
  });
  const formats: InventoryFormat[] = ['DISPLAY', 'VIDEO', 'AUDIO'];
  const types: MarketplaceProductType[] = ['PACKAGE', 'DEAL', 'PUBLISHER', 'PACKAGE', 'CENTRAL_PARTNER_DEAL'];
  for (let n = 0; n < 14; n++, i++) {
    const format = formats[n % 3] as InventoryFormat;
    out.push(
      make(`discover:${n}`, {
        type: types[n % types.length] as MarketplaceProductType,
        exchangeCode: PACKAGE_EXCHANGES[(n * 3) % PACKAGE_EXCHANGES.length] as string,
        name: `${ADJ[(n * 5 + 2) % ADJ.length]} ${NOUN[format][(n + 2) % NOUN[format].length]} Select`,
        format,
        dealType: n % 3 === 1 ? 'PREFERRED_DEAL' : 'PRIVATE_AUCTION',
        index: 200 + n,
      }),
    );
  }
  out[0] = { ...(out[0] as CatalogueProduct), bannerKey: MARKETPLACE_BANNERS[0].key };
  return out;
}
