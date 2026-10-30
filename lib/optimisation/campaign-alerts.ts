import 'server-only';
// Campaign Alerts page read model (module 06 2.5, A15): open alerts of one campaign grouped Critical / Needs attention,
// one row per alert type and insertion order, each with the affected children as links. Read only.
import type { SessionUser } from '@/lib/auth/types';
import { withSandbox } from '@/lib/db';
import {
  assertRead,
  asResult,
  notFound,
  serviceCtx,
  type Result,
} from '@/lib/campaigns/service-kit';
import { parseIdRef, whereId } from '@/lib/routes/params';
import { ioPath, liPath } from '@/lib/routes/paths';

export interface AlertChild {
  id: string;
  label: string;
  href: string;
}

export interface AlertGroupRow {
  id: string;
  code: string;
  category: 'BUDGET' | 'CREATIVES' | 'OTHER';
  title: string;
  detail: string;
  children: AlertChild[];
}

export interface CampaignAlerts {
  campaignName: string;
  critical: AlertGroupRow[];
  needsAttention: AlertGroupRow[];
  ios: { id: string; label: string }[];
  lis: { id: string; ioId: string; label: string }[];
  prefsHref: string;
}

const HEAD: Record<
  string,
  { title: string; unit: 'io' | 'li' | 'creative'; phrase: (n: number) => string }
> = {
  NO_SPEND_LI: {
    title: 'Line items not spending',
    unit: 'li',
    phrase: (n) => (n === 1 ? "isn't spending" : "aren't spending"),
  },
  NO_SPEND_IO: {
    title: 'Insertion orders not spending',
    unit: 'io',
    phrase: (n) => (n === 1 ? "hasn't spent anything" : "haven't spent anything"),
  },
  UNDERPACING_IO: {
    title: 'Insertion orders underpacing',
    unit: 'io',
    phrase: (n) => (n === 1 ? 'is underpacing' : 'are underpacing'),
  },
  CONFLICT_IO: {
    title: 'Insertion orders with conflicting settings',
    unit: 'io',
    phrase: (n) => (n === 1 ? 'has conflicting settings' : 'have conflicting settings'),
  },
  CONFLICT_LI: {
    title: 'Line items with conflicting settings',
    unit: 'li',
    phrase: (n) => (n === 1 ? 'has conflicting settings' : 'have conflicting settings'),
  },
  LIMITED_AUDIENCE_LI: {
    title: 'Line items with a limited audience',
    unit: 'li',
    phrase: (n) => (n === 1 ? 'has a very limited audience' : 'have a very limited audience'),
  },
  UNDERPERFORMING_IO: {
    title: 'Insertion orders underperforming',
    unit: 'io',
    phrase: (n) => (n === 1 ? 'is underperforming' : 'are underperforming'),
  },
  CREATIVE_REJECTED: { title: 'Creatives rejected', unit: 'creative', phrase: () => 'rejected' },
  CREATIVE_RESTRICTED: {
    title: 'Creatives restricted',
    unit: 'creative',
    phrase: () => 'restricted',
  },
};

export async function getCampaignAlerts(
  user: SessionUser,
  campaignId: string,
  filter: { ioId?: string; liId?: string; group?: 'budget' | 'creatives' } = {},
): Promise<Result<CampaignAlerts>> {
  return asResult(async () => {
    const ctx = await serviceCtx(user);
    assertRead(ctx);
    const data = await withSandbox(ctx.sandboxId, async (tx) => {
      const ref = parseIdRef(campaignId);
      if (!ref) throw notFound();
      const c = await tx.campaign.findFirst({
        where: whereId(ref),
        select: {
          id: true,
          name: true,
          publicId: true,
          advertiserId: true,
          advertiser: { select: { publicId: true, partner: { select: { publicId: true } } } },
        },
      });
      if (!c) throw notFound();
      const [ios, lis, alerts] = await Promise.all([
        tx.insertionOrder.findMany({
          where: { campaignId: c.id, status: { not: 'ARCHIVED' } },
          select: { id: true, publicId: true, name: true },
          orderBy: { name: 'asc' },
        }),
        tx.lineItem.findMany({
          where: { campaignId: c.id, status: { not: 'ARCHIVED' } },
          select: { id: true, publicId: true, name: true, ioId: true },
          orderBy: { name: 'asc' },
        }),
        tx.alert.findMany({
          where: { advertiserId: c.advertiserId, campaignId: c.id, state: 'OPEN' },
          orderBy: [{ firstSeenAt: 'asc' }, { id: 'asc' }],
        }),
      ]);
      const p = c.advertiser.partner.publicId.toString();
      const a = c.advertiser.publicId.toString();
      const cp = c.publicId.toString();
      const ioMap = new Map(ios.map((i) => [i.id, i]));
      const liMap = new Map(lis.map((l) => [l.id, l]));
      const ioIdFilter = filter.ioId
        ? (ios.find((i) => i.id === filter.ioId || i.publicId.toString() === filter.ioId)?.id ??
          '__none__')
        : null;
      const liIdFilter = filter.liId
        ? (lis.find((l) => l.id === filter.liId || l.publicId.toString() === filter.liId)?.id ??
          '__none__')
        : null;

      const groups = new Map<string, { sev: string; rows: typeof alerts }>();
      for (const al of alerts) {
        const cat =
          al.category === 'BUDGET' ? 'budget' : al.category === 'CREATIVES' ? 'creatives' : 'other';
        if (filter.group && cat !== filter.group) continue;
        const ioOf =
          al.ioId ?? (al.lineItemId ? liMap.get(al.lineItemId)?.ioId : undefined) ?? null;
        if (ioIdFilter && ioOf !== ioIdFilter) continue;
        if (liIdFilter && al.lineItemId !== liIdFilter) continue;
        const key = `${al.diagnosticCode ?? al.type}|${HEAD[al.diagnosticCode ?? '']?.unit === 'li' ? (ioOf ?? '') : ''}`;
        const g = groups.get(key) ?? { sev: al.severity, rows: [] };
        g.rows.push(al);
        if (al.severity === 'CRITICAL') g.sev = 'CRITICAL';
        groups.set(key, g);
      }
      const critical: AlertGroupRow[] = [];
      const needs: AlertGroupRow[] = [];
      for (const [key, g] of groups) {
        const first = g.rows[0]!;
        const code = first.diagnosticCode ?? first.type;
        const head = HEAD[code];
        const n = g.rows.length;
        const children: AlertChild[] = [];
        let detail: string;
        if (head?.unit === 'li') {
          const ioId = first.ioId ?? liMap.get(first.lineItemId ?? '')?.ioId ?? '';
          const io = ioMap.get(ioId);
          const total = lis.filter((l) => l.ioId === ioId).length;
          detail = `${n} of ${total} line items ${head.phrase(n)}${io ? ` in ${io.name}` : ''}`;
          for (const r of g.rows) {
            const li = r.lineItemId ? liMap.get(r.lineItemId) : undefined;
            if (li && io)
              children.push({
                id: li.id,
                label: li.name,
                href: liPath(p, a, cp, io.publicId.toString(), li.publicId.toString(), 'details'),
              });
          }
        } else if (head?.unit === 'io') {
          detail = `${n} ${n === 1 ? 'insertion order' : 'insertion orders'} ${head.phrase(n)}`;
          for (const r of g.rows) {
            const io = r.ioId ? ioMap.get(r.ioId) : undefined;
            if (io)
              children.push({
                id: io.id,
                label: io.name,
                href: ioPath(p, a, cp, io.publicId.toString()),
              });
          }
        } else {
          detail = first.title;
          for (const r of g.rows) {
            const li = r.lineItemId ? liMap.get(r.lineItemId) : undefined;
            const io = li ? ioMap.get(li.ioId) : undefined;
            if (li && io)
              children.push({
                id: li.id,
                label: li.name,
                href: liPath(p, a, cp, io.publicId.toString(), li.publicId.toString(), 'details'),
              });
          }
        }
        const row: AlertGroupRow = {
          id: key,
          code,
          category:
            first.category === 'BUDGET'
              ? 'BUDGET'
              : first.category === 'CREATIVES'
                ? 'CREATIVES'
                : 'OTHER',
          title: head?.title ?? first.title,
          detail,
          children,
        };
        (g.sev === 'CRITICAL' ? critical : needs).push(row);
      }
      const byTitle = (x: AlertGroupRow, y: AlertGroupRow) => (x.id < y.id ? -1 : 1);
      critical.sort(byTitle);
      needs.sort(byTitle);
      return {
        campaignName: c.name,
        critical,
        needsAttention: needs,
        ios: ios.map((i) => ({ id: i.id, label: i.name })),
        lis: lis.map((l) => ({ id: l.id, ioId: l.ioId, label: l.name })),
        prefsHref: `/p/${p}/a/${a}/alert-config`,
      } satisfies CampaignAlerts;
    });
    return { data };
  });
}
