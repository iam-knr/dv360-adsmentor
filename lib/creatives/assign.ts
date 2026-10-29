import 'server-only';
// Assignment helpers (module 12 section 1, RC-050: the wrappers call the line item module's `assignCreatives`, so the
// LI-060, LI-061 and LI-064 rules have one implementation).
import type { SessionUser } from '@/lib/auth/types';
import { asResult, invalid, notFound, type Result } from '@/lib/campaigns/service-kit';
import { assignCreatives } from '@/lib/line-items/service';
import { creativeFormatAllowed } from '@/lib/validation/constants/creatives';
import { LI_TYPE_LABEL, type LiType } from '@/lib/validation/constants/li-compat';
import { loadAdvertiser, parseIdRef, readCtx, whereId, writeCtx } from './guard';
import { CREATIVE_INCLUDE, exchangeNames, toRow } from './load';
import { mx09FormatOf } from './kinds';
import type { BulkResponse, CreativeRow } from './types';

export type EligibleTab = 'ALL' | 'ELIGIBLE' | 'ASSIGNED';

export async function assignCreativesToLineItems(
  user: SessionUser,
  aid: string,
  req: { creativeIds: string[]; lineItemIds: string[]; mode: 'ADD' | 'REMOVE' },
): Promise<Result<BulkResponse>> {
  return asResult(async () => {
    const scope = await writeCtx(user, async (tx, ctx) => {
      const adv = await loadAdvertiser(tx, aid);
      const creatives = await tx.creative.count({
        where: { id: { in: req.creativeIds }, advertiserId: adv.id },
      });
      const lis = await tx.lineItem.findMany({
        where: { id: { in: req.lineItemIds }, advertiserId: adv.id },
        select: { id: true, name: true },
      });
      if (
        creatives !== new Set(req.creativeIds).size ||
        lis.length !== new Set(req.lineItemIds).size
      )
        throw notFound();
      let jobId: string | null = null;
      if (lis.length > 1) {
        const actor = ctx.user.actor ?? ctx.user;
        const job = await tx.bulkJob.create({
          data: {
            sandboxId: ctx.sandboxId,
            advertiserId: adv.id,
            partnerId: adv.partnerId,
            requestedById: actor.id,
            source: 'BULK_EDIT',
            action: 'EDIT_CREATIVE_ASSIGNMENT',
            description: `Creative assignment edited on ${lis.length} line items`,
            status: 'COMPLETED',
            selectionCount: lis.length,
          },
          select: { id: true },
        });
        jobId = job.id;
      }
      return { lis, jobId };
    });
    // Each line item is its own transaction through the line item service: one failure does not undo the others.
    const errors: BulkResponse['errors'] = [];
    let done = 0;
    for (const li of scope.lis) {
      const change = req.mode === 'ADD' ? { add: req.creativeIds } : { remove: req.creativeIds };
      const res = await assignCreatives(user, li.id, change);
      if (res.ok) done += 1;
      else
        errors.push({
          id: li.id,
          message: `${li.name}: ${res.issues[0]?.message ?? "Couldn't change the creatives."}`,
        });
    }
    if (done === 0 && errors.length) {
      const first = errors[0]!;
      throw invalid([
        {
          ruleId: 'LI-064',
          severity: 'error',
          path: 'creatives',
          message: first.message,
          blocking: true,
        },
      ]);
    }
    return { data: { jobId: scope.jobId, done, failed: errors.length, errors } };
  });
}

/** Creatives for the "Select creatives" panel of one line item (tabs All, Eligible, Assigned). */
export async function getEligibleCreatives(
  user: SessionUser,
  liId: string,
  q: { tab: EligibleTab; q?: string },
): Promise<(CreativeRow & { eligible: boolean; why?: string })[]> {
  return readCtx(user, async (tx, ctx) => {
    const ref = parseIdRef(liId);
    const li = ref
      ? await tx.lineItem.findFirst({
          where: whereId(ref),
          select: {
            id: true,
            advertiserId: true,
            type: true,
            appAdFormat: true,
            assignments: { select: { creativeId: true } },
          },
        })
      : null;
    if (!li) throw notFound();
    const stored = await tx.creative.findMany({
      where: {
        advertiserId: li.advertiserId,
        companionOfCreativeId: null,
        ...(q.q?.trim() ? { name: { contains: q.q.trim(), mode: 'insensitive' as const } } : {}),
      },
      include: CREATIVE_INCLUDE,
      orderBy: { createdAt: 'desc' },
    });
    const names = await exchangeNames(tx);
    const exts = await tx.creativeExt.findMany({
      where: { creativeId: { in: stored.map((c) => c.id) } },
    });
    const extBy = new Map(exts.map((e) => [e.creativeId, e]));
    const assigned = new Set(li.assignments.map((a) => a.creativeId));
    const type = li.type as LiType;
    const adType =
      li.appAdFormat === 'VIDEO' ? 'VIDEO' : li.appAdFormat === 'DISPLAY' ? 'DISPLAY' : null;
    const all = stored.map((c) => {
      const formatOk = creativeFormatAllowed(type, mx09FormatOf(c.kind), adType);
      const eligible = formatOk && c.status === 'ACTIVE';
      const why = !formatOk
        ? `This creative can't be used in ${LI_TYPE_LABEL[type]} line items.`
        : c.status !== 'ACTIVE'
          ? `The creative is ${c.status === 'PAUSED' ? 'paused' : 'archived'}.`
          : undefined;
      return {
        ...toRow(c, extBy.get(c.id) ?? null, names, ctx.simNow, new Set(), 0),
        eligible,
        ...(why ? { why } : {}),
      };
    });
    return q.tab === 'ELIGIBLE'
      ? all.filter((r) => r.eligible)
      : q.tab === 'ASSIGNED'
        ? all.filter((r) => assigned.has(r.id))
        : all;
  });
}
