// Settling of simulated ad reviews and the two YouTube alerts (module 09 Δ-09-8, 5.1, ENG 3.7). Shared by the ad group
// service (lazy, when a page reads the ads) and the engine tick (lib/engine/io/youtube.ts). Tx-in, no server-only.
import { withChangeLog } from '@/lib/changelog';
import type { Tx } from '@/lib/db';
import { newId } from '@/lib/db/ids';
import { feedbackFor } from './review';
import type { ReviewStatus } from './types';

export interface SyncCtx {
  sandboxId: string;
  classroomId: string;
}

/**
 * Close every pending ad review whose time has passed. One change group per ad, written by SIM_ENGINE at the sim time
 * the review was due. `adGroupIds` limits the work to the groups of a page; omit it for the whole sandbox.
 */
export async function settleDueAdReviews(
  tx: Tx,
  ctx: SyncCtx,
  simNowMs: number,
  adGroupIds?: string[],
): Promise<number> {
  const due = await tx.ad.findMany({
    where: {
      sandboxId: ctx.sandboxId,
      ...(adGroupIds ? { adGroupId: { in: adGroupIds } } : {}),
      reviewStatus: 'PENDING',
      reviewDecideAt: { not: null, lte: new Date(simNowMs) },
    },
    include: {
      adGroup: { include: { lineItem: { select: { id: true, ioId: true, campaignId: true } } } },
    },
    orderBy: [{ reviewDecideAt: 'asc' }, { id: 'asc' }],
  });
  for (const ad of due) {
    const verdict = (ad.plannedVerdict ?? 'APPROVED') as Exclude<ReviewStatus, 'PENDING'>;
    await withChangeLog(
      {
        sandboxId: ctx.sandboxId,
        classroomId: ctx.classroomId,
        actor: { type: 'SYSTEM', systemActor: 'SIM_ENGINE' },
        source: 'ENGINE',
        tx,
        now: ad.reviewDecideAt ?? new Date(simNowMs),
      },
      {
        type: 'AD',
        id: ad.id,
        chain: {
          advertiserId: ad.advertiserId,
          campaignId: ad.adGroup.lineItem.campaignId,
          ioId: ad.adGroup.lineItem.ioId,
          lineItemId: ad.adGroup.lineItemId,
        },
      },
      (t) =>
        t.ad.update({
          where: { id: ad.id },
          data: {
            reviewStatus: verdict,
            reviewFeedback: feedbackFor(verdict),
            reviewDecideAt: null,
            plannedVerdict: null,
          },
          select: { id: true },
        }),
    );
  }
  return due.length;
}

const REJECTED_CODE = 'YT_AD_REJECTED';
const NOT_RUNNING_CODE = 'AD_GROUP_NOT_RUNNING';

const plural = (n: number, one: string, many: string): string => `${n} ${n === 1 ? one : many}`;

async function setAlert(
  tx: Tx,
  ctx: SyncCtx,
  li: { id: string; advertiserId: string; campaignId: string; ioId: string },
  spec: {
    code: string;
    type: 'YOUTUBE_AD_REJECTED' | 'AD_GROUP_NOT_RUNNING';
    severity: 'CRITICAL' | 'NEEDS_ATTENTION';
    category: 'CREATIVES' | 'SETTINGS';
    title: string;
    count: number;
  },
  at: Date,
): Promise<boolean> {
  const where = {
    sandboxId: ctx.sandboxId,
    advertiserId: li.advertiserId,
    lineItemId: li.id,
    diagnosticCode: spec.code,
    state: 'OPEN' as const,
  };
  const open = await tx.alert.findFirst({ where, select: { id: true } });
  if (spec.count === 0) {
    if (open)
      await tx.alert.update({
        where: { id: open.id },
        data: { state: 'RESOLVED', resolvedAt: at, lastSeenAt: at },
      });
    return false;
  }
  if (open) {
    await tx.alert.update({
      where: { id: open.id },
      data: { title: spec.title, affectedCount: spec.count, lastSeenAt: at },
    });
    return false;
  }
  await tx.alert.create({
    data: {
      id: newId(),
      sandboxId: ctx.sandboxId,
      advertiserId: li.advertiserId,
      campaignId: li.campaignId,
      ioId: li.ioId,
      lineItemId: li.id,
      type: spec.type,
      severity: spec.severity,
      category: spec.category,
      title: spec.title,
      affectedCount: spec.count,
      diagnosticCode: spec.code,
      firstSeenAt: at,
      lastSeenAt: at,
    },
  });
  return true;
}

/**
 * Raise and resolve `YT_AD_REJECTED` (Critical, one alert per line item counting its rejected ads) and
 * `AD_GROUP_NOT_RUNNING` (Needs attention, active ad groups without an active ad, or only paused ad groups) for the
 * sandbox's YouTube line items. Returns the codes raised this call.
 */
export async function syncYoutubeAlerts(tx: Tx, ctx: SyncCtx, simNowMs: number): Promise<string[]> {
  const at = new Date(simNowMs);
  const lis = await tx.lineItem.findMany({
    where: {
      sandboxId: ctx.sandboxId,
      type: { in: ['YT_VIDEO', 'YT_AUDIO', 'YT_ON_CTV'] },
      status: { in: ['ACTIVE', 'PAUSED'] },
    },
    select: {
      id: true,
      status: true,
      advertiserId: true,
      campaignId: true,
      ioId: true,
      adGroups: { select: { status: true, ads: { select: { status: true, reviewStatus: true } } } },
    },
    orderBy: { id: 'asc' },
  });
  const raised: string[] = [];
  for (const li of lis) {
    const rejected = li.adGroups.reduce(
      (n, g) =>
        n + g.ads.filter((a) => a.reviewStatus === 'REJECTED' && a.status === 'ACTIVE').length,
      0,
    );
    const active = li.adGroups.filter((g) => g.status === 'ACTIVE');
    const idle = active.filter((g) => !g.ads.some((a) => a.status === 'ACTIVE')).length;
    const allPaused = li.adGroups.length > 0 && active.length === 0;
    const notRunning = li.status === 'ACTIVE' ? idle + (allPaused ? 1 : 0) : 0;
    if (
      await setAlert(
        tx,
        ctx,
        li,
        {
          code: REJECTED_CODE,
          type: 'YOUTUBE_AD_REJECTED',
          severity: 'CRITICAL',
          category: 'CREATIVES',
          title: `${plural(rejected, 'YouTube ad', 'YouTube ads')} rejected`,
          count: rejected,
        },
        at,
      )
    )
      raised.push(REJECTED_CODE);
    if (
      await setAlert(
        tx,
        ctx,
        li,
        {
          code: NOT_RUNNING_CODE,
          type: 'AD_GROUP_NOT_RUNNING',
          severity: 'NEEDS_ATTENTION',
          category: 'SETTINGS',
          title: `${plural(notRunning, 'ad group is', 'ad groups are')} not running`,
          count: notRunning,
        },
        at,
      )
    )
      raised.push(NOT_RUNNING_CODE);
  }
  return raised;
}
