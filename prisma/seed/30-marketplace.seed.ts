// Global Marketplace catalogue (module 13 3.3, P4-02). Idempotent upsert by stable id.
import { prisma } from '../../lib/db/client';
import { buildCatalogue } from '../../lib/inventory/catalogue';

export async function run(): Promise<void> {
  const products = buildCatalogue();
  for (const p of products) {
    const data = {
      type: p.type,
      exchangeId: p.exchangeId,
      name: p.name,
      description: p.description,
      sellerKind: p.sellerKind,
      isInstantSeller: p.isInstantSeller,
      instantTargetingOptions: p.instantTargetingOptions ?? undefined,
      sevenDayImpressions: p.sevenDayImpressions,
      floorPrice: p.floorPrice,
      floorCurrency: p.floorCurrency,
      featuredCarousel: p.featuredCarousel,
      featuredCarouselOrder: p.featuredCarouselOrder,
      bannerKey: p.bannerKey,
      categories: p.categories,
      googleAudienceCount: p.googleAudienceCount,
      scale: p.scale as object,
      searchText: p.searchText,
    };
    await prisma.marketplaceProduct.upsert({ where: { id: p.id }, create: { id: p.id, ...data }, update: data });
  }
  console.log(`  marketplace products: ${products.length} upserted`);
}
