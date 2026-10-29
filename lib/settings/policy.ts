import 'server-only';
// Policy center (module 03 4.6, S8). Certificates are informational in v1 (RC-046); an instructor decides.
import { withChangeLog } from '@/lib/changelog';
import { withSandbox, type Tx } from '@/lib/db';
import type { SessionUser } from '@/lib/auth/types';
import { CERT_KINDS, type CertKind } from './constants';
import { certPending, validateCertificateRequest } from './rules';
import {
  asResult,
  assertCan,
  changeCtx,
  failIf,
  forbidden,
  isLimited,
  loadAdvertiser,
  mayDo,
  mergeConfig,
  notFound,
  serviceCtx,
  type Result,
} from './kit';

export interface CertificateRow {
  id: string | null;
  kind: CertKind;
  status: 'NONE' | 'REQUESTED' | 'APPROVED' | 'REJECTED';
  countryCode: string;
  notes: string | null;
  rejectionReason: string | null;
}

export interface PolicyCenter {
  certificates: CertificateRow[];
  canRequest: boolean;
  limitedAccess: boolean;
}

export async function getPolicyCenter(
  user: SessionUser,
  aid: string,
): Promise<Result<PolicyCenter>> {
  return asResult(async () => {
    const ctx = await serviceCtx(user);
    return withSandbox(ctx.sandboxId, async (tx) => {
      const a = await loadAdvertiser(tx, aid);
      const rows = await tx.policyCertificate.findMany({
        where: { advertiserId: a.id },
        orderBy: { requestedAt: 'asc' },
      });
      const certificates: CertificateRow[] = [];
      for (const k of CERT_KINDS) {
        const mine = rows.filter((r) => r.kind === k.kind && r.status !== 'NONE');
        if (mine.length === 0)
          certificates.push({
            id: null,
            kind: k.kind,
            status: 'NONE',
            countryCode: '',
            notes: null,
            rejectionReason: null,
          });
        for (const r of mine)
          certificates.push({
            id: r.id,
            kind: k.kind,
            status: r.status,
            countryCode: r.countryCode,
            notes: r.notes,
            rejectionReason: r.rejectionReason,
          });
      }
      return {
        data: {
          certificates,
          canRequest: mayDo(ctx, 'entity.write'),
          limitedAccess: isLimited(ctx),
        },
      };
    });
  });
}

/** AC-03-19: ADV-027 country, ADV-028 duplicate pending request. Permission STD. */
export async function requestPolicyCertificate(
  user: SessionUser,
  aid: string,
  input: { kind: CertKind; countryCode?: string; notes?: string },
): Promise<Result<{ id: string }>> {
  return asResult(async () => {
    const ctx = await serviceCtx(user);
    assertCan(ctx, 'entity.write');
    const def = CERT_KINDS.find((k) => k.kind === input.kind);
    if (!def) throw notFound();
    return withSandbox(ctx.sandboxId, async (tx) => {
      const a = await loadAdvertiser(tx, aid);
      failIf(
        validateCertificateRequest({ needsCountry: def.country, countryCode: input.countryCode }),
      );
      const country = def.country ? (input.countryCode ?? '') : '';
      const existing = await tx.policyCertificate.findUnique({
        where: {
          advertiserId_kind_countryCode: {
            advertiserId: a.id,
            kind: input.kind,
            countryCode: country,
          },
        },
      });
      if (existing?.status === 'REQUESTED') failIf([certPending()]);
      const row = await withChangeLog(
        changeCtx(ctx, tx),
        { type: 'ADVERTISER', id: a.id, chain: { advertiserId: a.id } },
        async (t) => {
          const data = {
            status: 'REQUESTED' as const,
            notes: input.notes?.trim() || null,
            rejectionReason: null,
            requestedAt: ctx.simNow,
            decidedAt: null,
            decidedById: null,
          };
          const saved = existing
            ? await t.policyCertificate.update({ where: { id: existing.id }, data })
            : await t.policyCertificate.create({
                data: {
                  sandboxId: ctx.sandboxId,
                  advertiserId: a.id,
                  kind: input.kind,
                  countryCode: country,
                  ...data,
                },
              });
          await touchCerts(t, a);
          return saved;
        },
        { summary: `Requested certificate: ${def.title}` },
      );
      return { data: { id: row.id } };
    });
  });
}

/**
 * Instructor side (C-03-5). Needs the Admin or Super admin account level: a plain user cannot decide their own request.
 * The instructor console that calls it is Phase 5; the action works from any session that holds view-as with act-as.
 */
export async function decidePolicyCertificate(
  user: SessionUser,
  certId: string,
  decision: 'APPROVED' | 'REJECTED',
  reason?: string,
): Promise<Result<null>> {
  return asResult(async () => {
    if (user.appRole === 'user') throw forbidden();
    const ctx = await serviceCtx(user);
    return withSandbox(ctx.sandboxId, async (tx) => {
      const cert = await tx.policyCertificate.findUnique({ where: { id: certId } });
      if (!cert) throw notFound();
      const def = CERT_KINDS.find((k) => k.kind === cert.kind);
      await withChangeLog(
        changeCtx(ctx, tx),
        { type: 'ADVERTISER', id: cert.advertiserId, chain: { advertiserId: cert.advertiserId } },
        async (t) => {
          await t.policyCertificate.update({
            where: { id: cert.id },
            data: {
              status: decision,
              decidedAt: ctx.simNow,
              decidedById: user.actor?.id ?? user.id,
              rejectionReason: decision === 'REJECTED' ? reason?.trim() || null : null,
            },
          });
          const adv = await t.advertiser.findUniqueOrThrow({
            where: { id: cert.advertiserId },
            select: { id: true, thirdPartyConfig: true },
          });
          return touchCerts(t, adv);
        },
        {
          summary: `Certificate ${decision === 'APPROVED' ? 'approved' : 'rejected'}: ${def?.title ?? cert.kind}`,
        },
      );
      return { data: null };
    });
  });
}

/** Version bump plus the audit summary of the certificates (see mergeConfig). */
async function touchCerts(t: Tx, a: { id: string; thirdPartyConfig: unknown }) {
  const rows = await t.policyCertificate.findMany({
    where: { advertiserId: a.id, status: { not: 'NONE' } },
    orderBy: [{ kind: 'asc' }, { countryCode: 'asc' }],
  });
  return t.advertiser.update({
    where: { id: a.id },
    data: {
      version: { increment: 1 },
      thirdPartyConfig: mergeConfig(a.thirdPartyConfig, {
        certificates: rows.map((r) => `${r.kind}:${r.countryCode}:${r.status}`),
      }),
    },
    select: { id: true },
  });
}
