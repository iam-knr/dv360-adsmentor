import 'server-only';
// Plans list (module 13 S8): read only. The plan page and editor belong to the planning module (P4-08).
import type { SessionUser } from '@/lib/auth/types';
import { loadAdvertiser, readCtx } from './guard';
import type { PlanRow } from './types';

export type PlanStatusKey = 'PLANNED' | 'TRAFFICKED';
export const DEFAULT_PLAN_STATUSES: PlanStatusKey[] = ['PLANNED', 'TRAFFICKED'];

const CHANNEL_LABEL: Record<string, string> = {
  DIGITAL: 'Digital',
  TV: 'TV',
  CROSS_MEDIA: 'Cross-media',
};

export async function listPlans(
  user: SessionUser,
  aid: string,
  q: { status?: PlanStatusKey[] } = {},
): Promise<PlanRow[]> {
  return readCtx(user, async (tx, ctx) => {
    const adv = await loadAdvertiser(tx, ctx, aid);
    const rows = await tx.plan.findMany({
      where: {
        advertiserId: adv.id,
        status: { in: q.status?.length ? q.status : DEFAULT_PLAN_STATUSES },
      },
      orderBy: [{ startDate: 'desc' }, { publicId: 'asc' }],
    });
    return rows.map((p) => ({
      id: p.id,
      publicId: p.publicId.toString(),
      name: p.name,
      status: p.status,
      totalBudget: p.totalBudget === null ? null : Number(p.totalBudget),
      currencyCode: p.currencyCode,
      startDate: p.startDate.toISOString().slice(0, 10),
      endDate: p.endDate.toISOString().slice(0, 10),
      channels: p.channels.map((c) => CHANNEL_LABEL[c] ?? c),
    }));
  });
}
