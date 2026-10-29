import 'server-only';
// Data manager and linked accounts (module 03 4.5; S5, S6). Linking is instant and simulated.
import { withChangeLog } from '@/lib/changelog';
import { withSandbox, type Tx } from '@/lib/db';
import type { SessionUser } from '@/lib/auth/types';
import { LINK_TYPES, type LinkType } from './constants';
import { alreadyLinked, validateLink } from './rules';
import {
  asResult,
  assertCan,
  changeCtx,
  failIf,
  isLimited,
  loadAdvertiser,
  mayDo,
  mergeConfig,
  notFound,
  serviceCtx,
  type Result,
} from './kit';

export interface LinkedRow {
  id: string;
  type: string;
  displayName: string;
  externalId: string;
  status: 'LINKED' | 'PENDING';
}

export interface DataManager {
  partnerPublicId: string;
  googleTag: { name: string; floodlightGroupPublicId: string } | null;
  accounts: LinkedRow[];
  counts: Record<string, number>;
  canWrite: boolean;
  limitedAccess: boolean;
}

export async function getDataManager(user: SessionUser, aid: string): Promise<Result<DataManager>> {
  return asResult(async () => {
    const ctx = await serviceCtx(user);
    return withSandbox(ctx.sandboxId, async (tx) => {
      const a = await loadAdvertiser(tx, aid);
      const [partner, rows, group] = await Promise.all([
        tx.partner.findUniqueOrThrow({ where: { id: a.partnerId }, select: { publicId: true } }),
        tx.linkedAccount.findMany({
          where: { advertiserId: a.id, status: { not: 'REMOVED' } },
          orderBy: { linkedAt: 'asc' },
        }),
        a.floodlightGroupId
          ? tx.floodlightGroup.findUnique({
              where: { id: a.floodlightGroupId },
              select: { name: true, publicId: true, googleTagId: true },
            })
          : null,
      ]);
      const counts: Record<string, number> = {};
      for (const r of rows) if (r.status === 'LINKED') counts[r.type] = (counts[r.type] ?? 0) + 1;
      return {
        data: {
          partnerPublicId: partner.publicId.toString(),
          googleTag: group
            ? {
                name: group.googleTagId ?? group.name,
                floodlightGroupPublicId: group.publicId.toString(),
              }
            : null,
          accounts: rows.map((r) => ({
            id: r.id,
            type: r.type,
            displayName: r.displayName,
            externalId: r.externalId,
            status: r.status === 'PENDING' ? 'PENDING' : 'LINKED',
          })),
          counts,
          canWrite: mayDo(ctx, 'partner.settings.write'),
          limitedAccess: isLimited(ctx),
        },
      };
    });
  });
}

/** AC-03-15: ADV-025 name required, ADV-026 duplicate external id. Permission ADM. */
export async function linkAccount(
  user: SessionUser,
  aid: string,
  input: { type: LinkType; displayName: string; externalId?: string },
): Promise<Result<{ id: string }>> {
  return asResult(async () => {
    const ctx = await serviceCtx(user);
    assertCan(ctx, 'partner.settings.write');
    if (!LINK_TYPES.some((t) => t.type === input.type)) throw notFound();
    return withSandbox(ctx.sandboxId, async (tx) => {
      const a = await loadAdvertiser(tx, aid);
      failIf(validateLink(input));
      const externalId =
        input.externalId?.trim() || `${input.type.toLowerCase()}-${Date.now().toString(36)}`;
      const dup = await tx.linkedAccount.findFirst({ where: { advertiserId: a.id, externalId } });
      if (dup && dup.status !== 'REMOVED') failIf([alreadyLinked()]);
      const created = await withChangeLog(
        changeCtx(ctx, tx),
        { type: 'ADVERTISER', id: a.id, chain: { advertiserId: a.id } },
        async (t) => {
          const row = dup
            ? await t.linkedAccount.update({
                where: { id: dup.id },
                data: { status: 'LINKED', displayName: input.displayName.trim(), type: input.type },
              })
            : await t.linkedAccount.create({
                data: {
                  sandboxId: ctx.sandboxId,
                  advertiserId: a.id,
                  type: input.type,
                  externalId,
                  displayName: input.displayName.trim(),
                },
              });
          await touchLinked(t, a);
          return row;
        },
        { summary: `Linked account added: ${input.displayName.trim()}` },
      );
      return { data: { id: created.id } };
    });
  });
}

export async function removeLinkedAccount(
  user: SessionUser,
  aid: string,
  id: string,
): Promise<Result<null>> {
  return asResult(async () => {
    const ctx = await serviceCtx(user);
    assertCan(ctx, 'partner.settings.write');
    return withSandbox(ctx.sandboxId, async (tx) => {
      const a = await loadAdvertiser(tx, aid);
      const row = await tx.linkedAccount.findFirst({ where: { id, advertiserId: a.id } });
      if (!row) throw notFound();
      await withChangeLog(
        changeCtx(ctx, tx),
        { type: 'ADVERTISER', id: a.id, chain: { advertiserId: a.id } },
        async (t) => {
          await t.linkedAccount.update({ where: { id: row.id }, data: { status: 'REMOVED' } });
          return touchLinked(t, a);
        },
        { summary: `Linked account removed: ${row.displayName}` },
      );
      return { data: null };
    });
  });
}

/** The creator-video card: a PENDING link that an instructor flips later (Q6). */
export async function requestCreatorVideoAccess(
  user: SessionUser,
  aid: string,
): Promise<Result<{ id: string }>> {
  return asResult(async () => {
    const ctx = await serviceCtx(user);
    assertCan(ctx, 'partner.settings.write');
    return withSandbox(ctx.sandboxId, async (tx) => {
      const a = await loadAdvertiser(tx, aid);
      const open = await tx.linkedAccount.findFirst({
        where: { advertiserId: a.id, type: 'YOUTUBE_CREATOR_VIDEOS', status: { not: 'REMOVED' } },
      });
      if (open) return { data: { id: open.id } };
      const created = await withChangeLog(
        changeCtx(ctx, tx),
        { type: 'ADVERTISER', id: a.id, chain: { advertiserId: a.id } },
        async (t) => {
          const row = await t.linkedAccount.create({
            data: {
              sandboxId: ctx.sandboxId,
              advertiserId: a.id,
              type: 'YOUTUBE_CREATOR_VIDEOS',
              externalId: `creator-videos-${a.id.slice(-6)}`,
              displayName: 'YouTube creator videos',
              status: 'PENDING',
            },
          });
          await touchLinked(t, a);
          return row;
        },
        { summary: 'Requested access to YouTube creator videos' },
      );
      return { data: { id: created.id } };
    });
  });
}

/** Version bump plus the audit summary of the linked accounts (see mergeConfig). */
async function touchLinked(t: Tx, a: { id: string; thirdPartyConfig: unknown }) {
  const rows = await t.linkedAccount.findMany({
    where: { advertiserId: a.id, status: { not: 'REMOVED' } },
    orderBy: { externalId: 'asc' },
  });
  return t.advertiser.update({
    where: { id: a.id },
    data: {
      version: { increment: 1 },
      thirdPartyConfig: mergeConfig(a.thirdPartyConfig, {
        linkedAccounts: rows.map((r) => `${r.type}:${r.externalId}:${r.status}`),
      }),
    },
    select: { id: true },
  });
}
