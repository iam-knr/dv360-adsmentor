import 'server-only';
// Advertiser targeting rules (module 03 2.4, S4): the locked advertiser-level rows that line items and templates
// inherit. Read only in this build; the rows are written by the seed (see docs/gaps/nav-wire-b.md).
import { withSandbox } from '@/lib/db';
import type { SessionUser } from '@/lib/auth/types';
import { asResult, isLimited, loadAdvertiser, serviceCtx, type Result } from './kit';

export interface TargetingRuleRow {
  key: 'BRAND_SUITABILITY' | 'CHANNELS' | 'KEYWORDS' | 'VIEWABILITY';
  title: string;
  locked: boolean;
  lines: string[];
}

export interface TargetingRules {
  rows: TargetingRuleRow[];
  limitedAccess: boolean;
}

type Cfg = Record<string, unknown>;
const obj = (v: unknown): Cfg =>
  v && typeof v === 'object' && !Array.isArray(v) ? (v as Cfg) : {};

const INVENTORY_MODE: Record<string, string> = {
  MAXIMUM: 'Maximum inventory',
  STANDARD: 'Standard inventory',
  LIMITED: 'Limited inventory',
};

export async function getAdvertiserTargetingRules(
  user: SessionUser,
  aid: string,
): Promise<Result<TargetingRules>> {
  return asResult(async () => {
    const ctx = await serviceCtx(user);
    return withSandbox(ctx.sandboxId, async (tx) => {
      const a = await loadAdvertiser(tx, aid);
      const stored = await tx.targetingAssignment.findMany({
        where: { advertiserId: a.id, ownerType: 'ADVERTISER' },
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
        select: { dimension: true, mode: true, config: true, valueText: true, isLocked: true },
      });
      const of = (d: string) => stored.filter((r) => r.dimension === d);

      const brand = of('BRAND_SUITABILITY')[0];
      const brandLines = [
        `Inventory mode: ${INVENTORY_MODE[String(obj(brand?.config).inventoryMode)] ?? 'Maximum inventory'}`,
        'Content type exclusions: Embedded YouTube videos, Live streaming videos',
      ];

      const channels = of('APPS_URLS');
      const keywords = [...of('KEYWORDS'), ...of('KEYWORD_EXCLUSIONS')];
      const view = of('VIEWABILITY')[0];
      const rows: TargetingRuleRow[] = [
        {
          key: 'BRAND_SUITABILITY',
          title: 'Brand suitability',
          locked: brand?.isLocked ?? true,
          lines: brandLines,
        },
        {
          key: 'CHANNELS',
          title: 'Channels & YouTube URLs',
          locked: channels.some((r) => r.isLocked),
          lines: [channels.length ? `${channels.length} restrictions` : 'No restrictions'],
        },
        {
          key: 'KEYWORDS',
          title: 'Keywords',
          locked: keywords.some((r) => r.isLocked),
          lines: [
            keywords.length
              ? `${keywords.length} contextual keyword rule${keywords.length === 1 ? '' : 's'}`
              : 'No contextual keywords selected',
          ],
        },
        {
          key: 'VIEWABILITY',
          title: 'Viewability',
          locked: view?.isLocked ?? false,
          lines: [
            obj(view?.config).openMeasurement === true
              ? 'Open Measurement: target only OM-enabled mobile display inventory'
              : 'No viewability rule',
          ],
        },
      ];
      return { data: { rows, limitedAccess: isLimited(ctx) } };
    });
  });
}
