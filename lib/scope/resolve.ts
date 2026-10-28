import 'server-only';
// Scope resolvers with the entity chain check (routes.md R10, 5.1). `/p/1/a/2/c/3` is valid only when campaign 3 is in
// advertiser 2, which is in partner 1, inside the sandbox of the signed in person. Anything else is "not found",
// so a foreign id and a missing id look the same. Each resolver is cached per request, so the (app) and (full)
// layouts and the pages share one read per level.
import { cache } from 'react';
import type { Prisma } from '@prisma/client';
import { getSessionUser } from '@/lib/auth/session';
import type { SessionUser } from '@/lib/auth/types';
import { withSandbox, type Tx } from '@/lib/db';
import { parseIdRef, whereId } from '@/lib/routes/params';
import type {
  AdvertiserInfo,
  CampaignInfo,
  EntityStatusKey,
  IoInfo,
  LiInfo,
  PartnerInfo,
} from './types';

export const getViewer = cache(getSessionUser);

type Row = { id: string; publicId: bigint; name: string; status: EntityStatusKey };
const ref = (r: Row) => ({
  id: r.id,
  publicId: r.publicId.toString(),
  name: r.name,
  status: r.status,
});
const BASE = { id: true, publicId: true, name: true, status: true } as const;

/** Run a scope read in the viewer's sandbox. No sandbox, no scope. */
async function inSandbox<T>(
  fn: (tx: Tx, user: SessionUser) => Promise<T | null>,
): Promise<T | null> {
  const user = await getViewer();
  if (!user?.sandboxId) return null;
  return withSandbox(user.sandboxId, (tx) => fn(tx, user));
}

/** Partner from the `[partnerId]` segment. */
export const resolvePartner = cache(async (pid: string): Promise<PartnerInfo | null> => {
  const id = parseIdRef(pid);
  if (!id) return null;
  return inSandbox(async (tx) => {
    const row = await tx.partner.findFirst({
      where: whereId(id),
      select: { ...BASE, currencyCode: true, timeZone: true },
    });
    return row ? { ...ref(row), currencyCode: row.currencyCode, timeZone: row.timeZone } : null;
  });
});

export const resolveAdvertiser = cache(
  async (
    pid: string,
    aid: string,
  ): Promise<{ partner: PartnerInfo; advertiser: AdvertiserInfo } | null> => {
    const id = parseIdRef(aid);
    const partner = id ? await resolvePartner(pid) : null;
    if (!id || !partner) return null;
    const advertiser = await inSandbox(async (tx) => {
      const row = await tx.advertiser.findFirst({
        where: { ...whereId(id), partnerId: partner.id },
        select: { ...BASE, currencyCode: true, timeZone: true, sdfVersion: true },
      });
      return row
        ? {
            ...ref(row),
            currencyCode: row.currencyCode,
            timeZone: row.timeZone,
            sdfVersion: row.sdfVersion,
            paused: row.status === 'PAUSED',
            scheduledForDeletion: row.status === 'SCHEDULED_FOR_DELETION',
          }
        : null;
    });
    return advertiser ? { partner, advertiser } : null;
  },
);

type CampaignChain = { partner: PartnerInfo; advertiser: AdvertiserInfo; campaign: CampaignInfo };

export const resolveCampaign = cache(
  async (pid: string, aid: string, cid: string): Promise<CampaignChain | null> => {
    const id = parseIdRef(cid);
    const up = id ? await resolveAdvertiser(pid, aid) : null;
    if (!id || !up) return null;
    const campaign = await inSandbox(async (tx) => {
      const row = await tx.campaign.findFirst({
        where: { ...whereId(id), advertiserId: up.advertiser.id },
        select: BASE,
      });
      return row ? ref(row) : null;
    });
    return campaign ? { ...up, campaign } : null;
  },
);

type IoChain = CampaignChain & { io: IoInfo };

export const resolveIo = cache(
  async (pid: string, aid: string, cid: string, ioId: string): Promise<IoChain | null> => {
    const id = parseIdRef(ioId);
    const up = id ? await resolveCampaign(pid, aid, cid) : null;
    if (!id || !up) return null;
    const io = await inSandbox(async (tx) => {
      const row = await tx.insertionOrder.findFirst({
        where: { ...whereId(id), campaignId: up.campaign.id },
        select: BASE,
      });
      return row ? ref(row) : null;
    });
    return io ? { ...up, io } : null;
  },
);

export const resolveLi = cache(
  async (
    pid: string,
    aid: string,
    cid: string,
    ioId: string,
    liId: string,
  ): Promise<(IoChain & { li: LiInfo }) | null> => {
    const id = parseIdRef(liId);
    const up = id ? await resolveIo(pid, aid, cid, ioId) : null;
    if (!id || !up) return null;
    const li = await inSandbox(async (tx) => {
      const row = await tx.lineItem.findFirst({
        where: { ...whereId(id), ioId: up.io.id },
        select: { ...BASE, type: true },
      });
      return row ? { ...ref(row), type: row.type } : null;
    });
    return li ? { ...up, li } : null;
  },
);

/** Kind segment of an audience details URL (routes.md 3.8, 6.3 `[A]/audience/{id}/details`). */
const AUDIENCE_KIND: Record<string, string> = {
  TAG_BASED: 'tagbased',
  CUSTOMER_MATCH: 'customermatch',
  YOUTUBE_USERS: 'youtubeusers',
  LOOKALIKE: 'lookalike',
  COMBINED: 'combined',
  CUSTOM_AFFINITY: 'affinity',
  CUSTOM_INTENT_DISPLAY_VIDEO: 'intent',
  CUSTOM_INTENT_YOUTUBE: 'intent',
  PARTNER: 'partner',
};

export async function resolveAudienceKind(
  advertiserRowId: string,
  audienceId: string,
): Promise<string | null> {
  const id = parseIdRef(audienceId);
  if (!id) return null;
  const where: Prisma.AudienceWhereInput = { ...whereId(id), advertiserId: advertiserRowId };
  return inSandbox(async (tx) => {
    const row = await tx.audience.findFirst({ where, select: { type: true } });
    return row ? (AUDIENCE_KIND[row.type] ?? null) : null;
  });
}
