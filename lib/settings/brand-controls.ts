import 'server-only';
// Partner Brand controls (module 02 4.8, S7): four coverage bars per advertiser over its active line items.
import { withSandbox } from '@/lib/db';
import type { SessionUser } from '@/lib/auth/types';
import { COVERAGE_KEYS, COVERAGE_LABEL, type CoverageKey } from './constants';
import { asResult, loadPartner, serviceCtx, type Result } from './kit';

export type BrandTab = 'DISPLAY_VIDEO' | 'YOUTUBE';
export { COVERAGE_KEYS, COVERAGE_LABEL, type CoverageKey };

export interface Coverage {
  pct: number;
  covered: number;
  total: number;
}
export interface BrandControlRow {
  advertiserId: string;
  publicId: string;
  name: string;
  activeLineItems: number;
  coverage: Record<CoverageKey, Coverage>;
}

const YT_TYPES: readonly string[] = ['YT_VIDEO', 'YT_AUDIO', 'YT_ON_CTV', 'DEMAND_GEN'];

export interface CoverageRule {
  dimension: string;
  mode: string;
}
export interface CoverageLineItem {
  type: string;
  status: string;
  inventoryQuality: string;
  /** Rows at line item level plus those of the advertiser and the partner (inherited, locked). */
  rules: CoverageRule[];
}

const has = (rules: CoverageRule[], dims: string[], mode?: 'EXCLUDE') =>
  rules.some((r) => dims.includes(r.dimension) && (!mode || r.mode === mode));

/** The four predicates of DELTA-02-8. Pure, so tests can feed fixtures. */
export function coverageOf(
  items: CoverageLineItem[],
  tab: BrandTab,
): { active: number; coverage: Record<CoverageKey, Coverage> } {
  const scoped = items.filter(
    (li) => li.status === 'ACTIVE' && (tab === 'YOUTUBE') === YT_TYPES.includes(li.type),
  );
  const total = scoped.length;
  const count = (fn: (li: CoverageLineItem) => boolean) => scoped.filter(fn).length;
  const mk = (covered: number): Coverage => ({
    covered,
    total,
    pct: total === 0 ? 0 : Math.round((covered / total) * 100),
  });
  return {
    active: total,
    coverage: {
      DIGITAL_CONTENT_LABELS: mk(
        count(
          (li) =>
            has(li.rules, ['DIGITAL_CONTENT_LABEL', 'SENSITIVE_CATEGORY'], 'EXCLUDE') ||
            has(li.rules, ['BRAND_SUITABILITY']),
        ),
      ),
      APPS_URL_CHANNEL: mk(count((li) => has(li.rules, ['APPS_AND_URLS'], 'EXCLUDE'))),
      KEYWORDS: mk(
        count(
          (li) => has(li.rules, ['KEYWORD'], 'EXCLUDE') || has(li.rules, ['NEGATIVE_KEYWORD_LIST']),
        ),
      ),
      AUTHORIZED_SELLERS: mk(count((li) => li.inventoryQuality === 'AUTHORIZED_DIRECT_SELLERS')),
    },
  };
}

export async function getBrandControls(
  user: SessionUser,
  pid: string,
  tab: BrandTab,
): Promise<Result<BrandControlRow[]>> {
  return asResult(async () => {
    const ctx = await serviceCtx(user);
    return withSandbox(ctx.sandboxId, async (tx) => {
      const p = await loadPartner(tx, pid);
      const advertisers = await tx.advertiser.findMany({
        where: { partnerId: p.id },
        orderBy: { name: 'asc' },
        select: { id: true, publicId: true, name: true },
      });
      const ids = advertisers.map((a) => a.id);
      const lis = await tx.lineItem.findMany({
        where: { advertiserId: { in: ids }, status: 'ACTIVE' },
        select: { id: true, advertiserId: true, type: true, status: true, inventoryQuality: true },
      });
      const [partnerRows, advRows, liRows] = await Promise.all([
        tx.targetingAssignment.findMany({
          where: { ownerType: 'PARTNER', partnerId: p.id },
          select: { dimension: true, mode: true },
        }),
        tx.targetingAssignment.findMany({
          where: { ownerType: 'ADVERTISER', advertiserId: { in: ids } },
          select: { advertiserId: true, dimension: true, mode: true },
        }),
        tx.targetingAssignment.findMany({
          where: { ownerType: 'LINE_ITEM', lineItemId: { in: lis.map((l) => l.id) } },
          select: { lineItemId: true, dimension: true, mode: true },
        }),
      ]);
      const asRule = (r: { dimension: string; mode: string }): CoverageRule => ({
        dimension: r.dimension,
        mode: r.mode,
      });
      const data = advertisers.map((a): BrandControlRow => {
        const adv = advRows.filter((r) => r.advertiserId === a.id).map(asRule);
        const items = lis
          .filter((l) => l.advertiserId === a.id)
          .map((l): CoverageLineItem => ({
            type: l.type,
            status: l.status,
            inventoryQuality: l.inventoryQuality,
            rules: [
              ...liRows.filter((r) => r.lineItemId === l.id).map(asRule),
              ...adv,
              ...partnerRows.map(asRule),
            ],
          }));
        const c = coverageOf(items, tab);
        return {
          advertiserId: a.id,
          publicId: a.publicId.toString(),
          name: a.name,
          activeLineItems: c.active,
          coverage: c.coverage,
        };
      });
      return { data };
    });
  });
}
