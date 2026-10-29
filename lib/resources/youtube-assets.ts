import 'server-only';
// YouTube assets list (module 15 S4, 4.5): read only in v1. Metrics are split from the advertiser's YouTube line item
// totals by seeded weights `[SIM]`, so the same asset always shows the same share.
import type { YoutubeAssetKind } from '@prisma/client';
import type { SessionUser } from '@/lib/auth/types';
import { withSandbox } from '@/lib/db';
import { assertResourceRead, loadAdvertiser, serviceCtx } from './kit';
import type { YoutubeAssetRow } from './wire';

function weight(id: string): number {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return 1 + (h % 100);
}

export function describeFilters(filters: unknown): string {
  if (!filters || typeof filters !== 'object') return '-';
  const entries = Object.entries(filters as Record<string, unknown>);
  return entries.length ? entries.map(([k, v]) => `${k}: ${String(v)}`).join(', ') : '-';
}

export async function listYoutubeAssets(
  user: SessionUser,
  aid: string,
  tab: 'location' | 'affiliate' | 'sitelink' = 'location',
): Promise<YoutubeAssetRow[]> {
  const kind: YoutubeAssetKind =
    tab === 'affiliate' ? 'AFFILIATE_LOCATION' : tab === 'sitelink' ? 'SITELINK' : 'LOCATION';
  const ctx = await serviceCtx(user);
  assertResourceRead(ctx);
  return withSandbox(ctx.sandboxId, async (tx) => {
    const adv = await loadAdvertiser(tx, aid);
    const assets = await tx.youtubeAsset.findMany({
      where: { advertiserId: adv.id, kind },
      orderBy: [{ parentId: 'asc' }, { name: 'asc' }, { id: 'asc' }],
    });
    const totals = await tx.simDailyMetric.aggregate({
      where: {
        sliceKind: 'total',
        lineItem: {
          advertiserId: adv.id,
          type: { in: ['YT_VIDEO', 'YT_AUDIO', 'YT_ON_CTV', 'DEMAND_GEN'] },
        },
      },
      _sum: { impressions: true, clicks: true },
    });
    const revenue = await tx.simDailyMetric.aggregate({
      where: {
        sliceKind: 'total',
        lineItem: {
          advertiserId: adv.id,
          type: { in: ['YT_VIDEO', 'YT_AUDIO', 'YT_ON_CTV', 'DEMAND_GEN'] },
        },
      },
      _sum: { revenue: true },
    });
    const impressions = Number(totals._sum.impressions ?? 0);
    const clicks = Number(totals._sum.clicks ?? 0);
    const spend = Number(revenue._sum.revenue ?? 0);
    const leaves = assets.filter(
      (a) => a.parentId !== null || !assets.some((b) => b.parentId === a.id),
    );
    const sum = leaves.reduce((n, a) => n + weight(a.id), 0) || 1;
    return assets.map((a) => {
      const isLeaf = leaves.includes(a);
      const share = isLeaf ? weight(a.id) / sum : 0;
      const kids = assets.filter((b) => b.parentId === a.id);
      const shareOf = (x: number) => (isLeaf ? Math.round(x * share) : 0);
      let imp = shareOf(impressions);
      let clk = shareOf(clicks);
      let cost = isLeaf ? spend * share : 0;
      if (!isLeaf) {
        const kidShare = kids.reduce((n, k) => n + weight(k.id) / sum, 0);
        imp = Math.round(impressions * kidShare);
        clk = Math.round(clicks * kidShare);
        cost = spend * kidShare;
      }
      return {
        id: a.id,
        name: a.name,
        filters: describeFilters(a.filters),
        status: a.status,
        clicks: clk,
        impressions: imp,
        ctr: imp > 0 ? clk / imp : null,
        avgCpc: clk > 0 ? cost / clk : null,
        parentId: a.parentId,
      };
    });
  });
}
