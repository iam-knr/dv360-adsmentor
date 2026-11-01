import 'server-only';
// Search service (module 01 4.6): the resolver of resolve.ts plus direct name/ID hits inside one advertiser, or the
// advertisers of one partner. Permission RO, sandbox scoped (the transaction sets the tenant, so RLS applies).
import type { SessionUser } from '@/lib/auth/types';
import {
  asResult,
  assertRead,
  notFound,
  serviceCtx,
  ServiceFailure,
  type Result,
} from '@/lib/campaigns/service-kit';
import { withSandbox } from '@/lib/db';
import { parseIdRef, whereId } from '@/lib/routes/params';
import { maxLen } from '@/lib/validation/primitives';
import { MSG, format } from '@/lib/validation/messages';
import { advertiserPath, campaignPath, ioPath, liPath, partnerPath } from '@/lib/routes/paths';
import { resolveSearch, SEARCH_QUERY_MAX } from './resolve';
import { DIRECT_RESULT_LIMIT } from './types';
import { SEARCH_SUGGESTIONS, type SearchSuggestion } from './suggestions';
import type { DirectKind, DirectResult, SearchResponse } from './types';

export type { DirectKind, DirectResult, SearchResponse } from './types';

const KIND_LABEL: Record<DirectKind, string> = {
  advertiser: 'Advertiser',
  campaign: 'Campaign',
  insertionOrder: 'Insertion order',
  lineItem: 'Line item',
  creative: 'Creative',
  audience: 'Audience',
};
const AUDIENCE_SLUG: Record<string, string> = {
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

function checkQuery(raw: unknown): string {
  const q = typeof raw === 'string' ? raw.trim() : '';
  if (!q) {
    throw new ServiceFailure('INVALID', [
      { path: 'query', severity: 'error', code: 'GEN-001', message: 'Enter a value' },
    ]);
  }
  if (!maxLen(q, SEARCH_QUERY_MAX)) {
    throw new ServiceFailure('INVALID', [
      {
        path: 'query',
        severity: 'error',
        code: 'GEN-004',
        message: format(MSG.MAX_CHARS, { max: SEARCH_QUERY_MAX }),
      },
    ]);
  }
  return q;
}

/** Search one advertiser: filter link from the resolver plus up to 10 direct name/ID hits. */
export async function searchAdvertiser(
  user: SessionUser,
  aid: string,
  input: { query: string },
): Promise<Result<SearchResponse>> {
  return asResult(async () => {
    const query = checkQuery(input.query);
    const ref = parseIdRef(aid);
    if (!ref) throw notFound();
    const ctx = await serviceCtx(user);
    assertRead(ctx);
    const numeric = /^\d{1,18}$/.test(query) ? BigInt(query) : null;
    const contains = { contains: query, mode: 'insensitive' as const };
    const match = (extra: object = {}) => ({
      OR: [{ name: contains }, ...(numeric !== null ? [{ publicId: numeric }] : [])],
      ...extra,
    });
    const found = await withSandbox(ctx.sandboxId, async (tx) => {
      const adv = await tx.advertiser.findFirst({
        where: whereId(ref),
        select: { id: true, publicId: true, partner: { select: { publicId: true } } },
      });
      if (!adv) return null;
      const own = { advertiserId: adv.id };
      const take = DIRECT_RESULT_LIMIT;
      const [campaigns, ios, lis, creatives, audiences] = await Promise.all([
        tx.campaign.findMany({
          where: match(own),
          select: { publicId: true, name: true },
          orderBy: { name: 'asc' },
          take,
        }),
        tx.insertionOrder.findMany({
          where: match(own),
          select: { publicId: true, name: true, campaign: { select: { publicId: true } } },
          orderBy: { name: 'asc' },
          take,
        }),
        tx.lineItem.findMany({
          where: match(own),
          select: {
            publicId: true,
            name: true,
            io: { select: { publicId: true } },
            campaign: { select: { publicId: true } },
          },
          orderBy: { name: 'asc' },
          take,
        }),
        tx.creative.findMany({
          where: match(own),
          select: { publicId: true, name: true },
          orderBy: { name: 'asc' },
          take,
        }),
        tx.audience.findMany({
          where: match(own),
          select: { publicId: true, name: true, type: true },
          orderBy: { name: 'asc' },
          take,
        }),
      ]);
      return { adv, campaigns, ios, lis, creatives, audiences };
    });
    if (!found) throw notFound();
    const p = found.adv.partner.publicId.toString();
    const a = found.adv.publicId.toString();
    const row = (kind: DirectKind, id: bigint, name: string, href: string): DirectResult => ({
      kind,
      id: id.toString(),
      name,
      href,
      label: KIND_LABEL[kind],
    });
    const all: DirectResult[] = [
      ...found.campaigns.map((r) =>
        row(
          'campaign',
          r.publicId,
          r.name,
          campaignPath(p, a, r.publicId.toString(), 'explorerios'),
        ),
      ),
      ...found.ios.map((r) =>
        row(
          'insertionOrder',
          r.publicId,
          r.name,
          ioPath(p, a, r.campaign.publicId.toString(), r.publicId.toString(), 'explorerlis'),
        ),
      ),
      ...found.lis.map((r) =>
        row(
          'lineItem',
          r.publicId,
          r.name,
          liPath(
            p,
            a,
            r.campaign.publicId.toString(),
            r.io.publicId.toString(),
            r.publicId.toString(),
            'details',
          ),
        ),
      ),
      ...found.creatives.map((r) =>
        row(
          'creative',
          r.publicId,
          r.name,
          advertiserPath(p, a, 'creatives', r.publicId.toString()),
        ),
      ),
      ...found.audiences.map((r) =>
        row(
          'audience',
          r.publicId,
          r.name,
          advertiserPath(
            p,
            a,
            'audience',
            AUDIENCE_SLUG[r.type] ?? 'tagbased',
            r.publicId.toString(),
            'details',
          ),
        ),
      ),
    ].slice(0, DIRECT_RESULT_LIMIT);
    const resolved = resolveSearch(query, 'advertiser');
    return {
      data: {
        interpretation: resolved.interpretation,
        target: resolved.target,
        fallback: resolved.fallback,
        base: advertiserPath(p, a),
        scope: 'advertiser' as const,
        results: all,
      },
    };
  });
}

/** Partner pages: advertisers by name or ID only. */
export async function searchPartner(
  user: SessionUser,
  pid: string,
  input: { query: string },
): Promise<Result<SearchResponse>> {
  return asResult(async () => {
    const query = checkQuery(input.query);
    const ref = parseIdRef(pid);
    if (!ref) throw notFound();
    const ctx = await serviceCtx(user);
    assertRead(ctx);
    const numeric = /^\d{1,18}$/.test(query) ? BigInt(query) : null;
    const found = await withSandbox(ctx.sandboxId, async (tx) => {
      const partner = await tx.partner.findFirst({
        where: whereId(ref),
        select: { id: true, publicId: true },
      });
      if (!partner) return null;
      const advertisers = await tx.advertiser.findMany({
        where: {
          partnerId: partner.id,
          OR: [
            { name: { contains: query, mode: 'insensitive' } },
            ...(numeric !== null ? [{ publicId: numeric }] : []),
          ],
        },
        select: { publicId: true, name: true },
        orderBy: { name: 'asc' },
        take: DIRECT_RESULT_LIMIT,
      });
      return { partner, advertisers };
    });
    if (!found) throw notFound();
    const p = found.partner.publicId.toString();
    const resolved = resolveSearch(query, 'partner');
    return {
      data: {
        interpretation: resolved.interpretation,
        target: resolved.target,
        fallback: resolved.fallback,
        base: partnerPath(p),
        scope: 'partner' as const,
        results: found.advertisers.map((r) => ({
          kind: 'advertiser' as const,
          id: r.publicId.toString(),
          name: r.name,
          href: advertiserPath(p, r.publicId.toString(), 'cs'),
          label: KIND_LABEL.advertiser,
        })),
      },
    };
  });
}

export interface SuggestionDto {
  key: string;
  label: string;
  route: string;
  query: Record<string, string[]>;
  intent: string;
}

/** GET …/search/suggestions: the 7 chips, as saved filter links. */
export async function getSearchSuggestions(
  user: SessionUser,
  aid: string,
): Promise<Result<SuggestionDto[]>> {
  return asResult(async () => {
    const ref = parseIdRef(aid);
    if (!ref) throw notFound();
    const ctx = await serviceCtx(user);
    assertRead(ctx);
    const exists = await withSandbox(ctx.sandboxId, (tx) =>
      tx.advertiser.findFirst({ where: whereId(ref), select: { id: true } }),
    );
    if (!exists) throw notFound();
    const data = SEARCH_SUGGESTIONS.map((s: SearchSuggestion) => ({ ...s }));
    return { data };
  });
}
