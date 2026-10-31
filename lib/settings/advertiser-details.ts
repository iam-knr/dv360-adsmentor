import 'server-only';
// Advertiser basic details (module 03 4.1, 4.2; S1 to S3, S9): update with diff, EU political ads propagation,
// panels, schedule and cancel deletion. STANDARD edits the fields of RC-047; the rest needs ADMIN.
import { withChangeLog } from '@/lib/changelog';
import { withSandbox, type Tx } from '@/lib/db';
import type { SessionUser } from '@/lib/auth/types';
import { AUTHORIZATIONS, type AuthorizationKey, sdfKeyOf, sdfLabel } from './constants';
import {
  demandGenOffWarning,
  validateAdvertiser,
  validateThirdParty,
  type SettingsIssue,
} from './rules';
import {
  asResult,
  assertCan,
  changeCtx,
  checkVersion,
  failIf,
  forbidden,
  isLimited,
  loadAdvertiser,
  mayDo,
  mergeConfig,
  serviceCtx,
  ServiceFailure,
  warningsOf,
  type Result,
  type ServiceCtx,
  type WriteMeta,
} from './kit';

export type EuAnswer = 'YES' | 'NO' | null;
const EU_ENUM = {
  YES: 'CONTAINS_EU_POLITICAL_ADS',
  NO: 'DOES_NOT_CONTAIN_EU_POLITICAL_ADS',
} as const;
const euAnswerOf = (v: string | null): EuAnswer =>
  v === 'CONTAINS_EU_POLITICAL_ADS'
    ? 'YES'
    : v === 'DOES_NOT_CONTAIN_EU_POLITICAL_ADS'
      ? 'NO'
      : null;

export interface VendorOption {
  key: string;
  name: string;
  group: string;
  feePct: number | null;
  termsText: string | null;
}

export interface AdvertiserDetails {
  id: string;
  publicId: string;
  partnerPublicId: string;
  name: string;
  status: 'ACTIVE' | 'PAUSED' | 'SCHEDULED_FOR_DELETION';
  website: string;
  currencyCode: string;
  timeZone: string;
  sdfVersion: string; // "9.1"
  sdfAdminEmail: string | null;
  adServer: 'THIRD_PARTY_ONLY' | 'CM360_HYBRID';
  attributionFloodlightGroupId: string | null;
  floodlightGroups: { id: string; name: string }[];
  authorizations: Record<AuthorizationKey, boolean>;
  euPoliticalAds: EuAnswer;
  demandGenFloodlightOptimization: boolean;
  demandGenLineItems: number;
  businessName: string | null;
  integrationCode: string | null;
  iasClientId: number;
  vendors: VendorOption[];
  selectedVendors: string[];
  rateCards: { vendorKey: string; selected: boolean; affirmed: boolean }[];
  scheduledDeletionAt: string | null;
  partnerDataTermsAccepted: boolean;
  version: number;
  canEdit: boolean; // STANDARD and ADMIN
  canEditAdmin: boolean; // ad server, attribution, third-party services
  canSchedule: boolean; // ADMIN
  limitedAccess: boolean;
}

export async function getAdvertiserDetails(
  user: SessionUser,
  aid: string,
): Promise<Result<AdvertiserDetails>> {
  return asResult(async () => {
    const ctx = await serviceCtx(user);
    return withSandbox(ctx.sandboxId, async (tx) => {
      const a = await loadAdvertiser(tx, aid);
      const [partner, groups, vendors, selections, cards, dgCount] = await Promise.all([
        tx.partner.findUniqueOrThrow({
          where: { id: a.partnerId },
          select: { publicId: true, dataTermsAcceptedAt: true },
        }),
        tx.floodlightGroup.findMany({
          where: { OR: [{ advertiserId: a.id }, { partnerId: a.partnerId }] },
          orderBy: { name: 'asc' },
          select: { id: true, name: true },
        }),
        tx.thirdPartyVendor.findMany({ orderBy: [{ group: 'asc' }, { name: 'asc' }] }),
        tx.advertiserVendorSelection.findMany({ where: { advertiserId: a.id, enabled: true } }),
        tx.thirdPartyRateCard.findMany({ where: { advertiserId: a.id } }),
        tx.lineItem.count({
          where: { advertiserId: a.id, type: 'DEMAND_GEN', status: { not: 'ARCHIVED' } },
        }),
      ]);
      const auth = Object.fromEntries(AUTHORIZATIONS.map((x) => [x.key, a[x.key]])) as Record<
        AuthorizationKey,
        boolean
      >;
      const data: AdvertiserDetails = {
        id: a.id,
        publicId: a.publicId.toString(),
        partnerPublicId: partner.publicId.toString(),
        name: a.name,
        status:
          a.status === 'PAUSED'
            ? 'PAUSED'
            : a.status === 'SCHEDULED_FOR_DELETION'
              ? 'SCHEDULED_FOR_DELETION'
              : 'ACTIVE',
        website: a.websiteUrl,
        currencyCode: a.currencyCode,
        timeZone: a.timeZone,
        sdfVersion: sdfLabel(a.sdfVersion),
        sdfAdminEmail: a.sdfAdminEmail,
        adServer: a.adServer,
        attributionFloodlightGroupId: a.floodlightGroupId,
        floodlightGroups: groups,
        authorizations: auth,
        euPoliticalAds: euAnswerOf(a.euPoliticalAds),
        demandGenFloodlightOptimization: a.demandGenFloodlightOptimization,
        demandGenLineItems: dgCount,
        businessName: a.ytBusinessName,
        integrationCode: a.integrationCode,
        iasClientId: Number(a.iasClientId),
        vendors: vendors.map((v) => ({
          key: v.key,
          name: v.name,
          group: v.group,
          feePct: v.feePct === null ? null : Number(v.feePct.toString()),
          termsText: v.termsText,
        })),
        selectedVendors: selections.map((s) => s.vendorKey),
        rateCards: cards.map((c) => ({
          vendorKey: c.vendorKey,
          selected: true,
          affirmed: c.termsAcceptedAt !== null,
        })),
        scheduledDeletionAt: a.scheduledDeletionAt ? a.scheduledDeletionAt.toISOString() : null,
        partnerDataTermsAccepted: partner.dataTermsAcceptedAt !== null,
        version: a.version,
        canEdit: mayDo(ctx, 'entity.write'),
        canEditAdmin: mayDo(ctx, 'partner.settings.write'),
        canSchedule: mayDo(ctx, 'partner.settings.write'),
        limitedAccess: isLimited(ctx),
      };
      return { data };
    });
  });
}

export interface UpdateAdvertiserInput {
  name: string;
  status: string;
  website: string;
  currencyCode: string;
  timeZone: string;
  sdfVersion: string; // "9.1"
  sdfAdminEmail?: string | null;
  adServer: 'THIRD_PARTY_ONLY' | 'CM360_HYBRID';
  attributionFloodlightGroupId?: string | null;
  authorizations: Record<AuthorizationKey, boolean>;
  euPoliticalAds: EuAnswer;
  demandGenFloodlightOptimization: boolean;
  businessName?: string | null;
  integrationCode?: string | null;
  iasClientId: number | string;
  /** Vendor keys ticked in the Third-party services panel, any group. */
  vendors: string[];
  rateCards: { vendorKey: string; selected: boolean; affirmed: boolean }[];
}

type Stored = Awaited<ReturnType<typeof loadAdvertiser>>;

/** Fields a STANDARD user may not change: the ad server and attribution panel and the third-party services panel (module 03 4.2 says ADM). Business name and integration code have no engine effect and are STANDARD too (adv-details-fix). */
function adminOnlyChanged(a: Stored, i: UpdateAdvertiserInput): boolean {
  return (
    a.adServer !== i.adServer ||
    (a.floodlightGroupId ?? null) !== (i.attributionFloodlightGroupId ?? null) ||
    Number(a.iasClientId) !== Number(i.iasClientId)
  );
}

/** AC-03-2 to AC-03-9, AC-03-23. */
export async function updateAdvertiser(
  user: SessionUser,
  aid: string,
  input: UpdateAdvertiserInput,
  meta: WriteMeta = {},
): Promise<Result<{ version: number; affectedLineItems?: number }>> {
  return asResult(async () => {
    const ctx = await serviceCtx(user);
    assertCan(ctx, 'entity.write');
    return withSandbox(ctx.sandboxId, async (tx) => {
      const a = await loadAdvertiser(tx, aid);
      if (a.status === 'SCHEDULED_FOR_DELETION') throw forbidden(); // read only except Cancel deletion
      checkVersion(a.version, meta.expectedVersion);
      if (adminOnlyChanged(a, input)) assertCan(ctx, 'partner.settings.write');
      const partner = await tx.partner.findUniqueOrThrow({
        where: { id: a.partnerId },
        select: { dataTermsAcceptedAt: true },
      });
      const sdfKey = sdfKeyOf(input.sdfVersion);
      const issues: SettingsIssue[] = validateAdvertiser(
        {
          ...input,
          website: input.website,
          sdfVersion: sdfKey ?? input.sdfVersion,
          euPoliticalAds: input.euPoliticalAds ? EU_ENUM[input.euPoliticalAds] : null,
          productImprovement: input.authorizations.productImprovement,
        },
        { currencyCode: a.currencyCode, timeZone: a.timeZone },
        { partnerDataTermsAccepted: partner.dataTermsAcceptedAt !== null },
      );
      issues.push(
        ...validateThirdParty({ iasClientId: input.iasClientId, rateCards: input.rateCards }),
      );
      failIf(issues);

      const warnings: SettingsIssue[] = [];
      if (a.demandGenFloodlightOptimization && !input.demandGenFloodlightOptimization) {
        const n = await tx.lineItem.count({
          where: { advertiserId: a.id, type: 'DEMAND_GEN', status: { not: 'ARCHIVED' } },
        });
        if (n > 0) warnings.push(demandGenOffWarning(n));
      }
      if (input.attributionFloodlightGroupId) {
        const ok = await tx.floodlightGroup.findFirst({
          where: {
            id: input.attributionFloodlightGroupId,
            OR: [{ advertiserId: a.id }, { partnerId: a.partnerId }],
          },
          select: { id: true },
        });
        if (!ok)
          failIf([
            {
              path: 'attributionFloodlightGroupId',
              severity: 'error',
              code: 'GEN-005',
              message: 'A selection is required',
            },
          ]);
      }
      const vendorRows = await tx.thirdPartyVendor.findMany();
      const bidding = new Map(
        vendorRows.filter((v) => v.group === 'BIDDING').map((v) => [v.key, v]),
      );
      const validVendors = new Set(
        vendorRows.filter((v) => v.group !== 'BIDDING').map((v) => v.key),
      );
      const vendorKeys = input.vendors.filter((k) => validVendors.has(k)).sort();
      const cards = input.rateCards.filter((r) => r.selected && bidding.has(r.vendorKey));
      const config = {
        vendors: vendorKeys,
        rateCards: cards.map((c) => c.vendorKey).sort(),
        iasClientId: Number(input.iasClientId),
      };

      const euNew = input.euPoliticalAds ? EU_ENUM[input.euPoliticalAds] : null;
      const euChanged = euNew !== null && a.euPoliticalAds !== euNew;
      const updated = await withChangeLog(
        changeCtx(ctx, tx, { ...(meta.note ? { note: meta.note } : {}) }),
        { type: 'ADVERTISER', id: a.id, chain: { advertiserId: a.id } },
        async (t) => {
          await syncVendors(t, ctx, a.id, vendorKeys, cards, bidding);
          const authData = Object.fromEntries(
            AUTHORIZATIONS.map((x) => [x.key, input.authorizations[x.key]]),
          );
          return t.advertiser.update({
            where: { id: a.id },
            data: {
              name: input.name.trim(),
              status: input.status as 'ACTIVE' | 'PAUSED',
              websiteUrl: input.website.trim(),
              sdfVersion: sdfKey ?? a.sdfVersion,
              sdfAdminEmail: input.sdfAdminEmail?.trim() || null,
              adServer: input.adServer,
              floodlightGroupId: input.attributionFloodlightGroupId ?? a.floodlightGroupId,
              ...authData,
              ...(euNew ? { euPoliticalAds: euNew } : {}),
              demandGenFloodlightOptimization: input.demandGenFloodlightOptimization,
              ytBusinessName: input.businessName?.trim() || null,
              integrationCode: input.integrationCode?.trim() || null,
              iasClientId: BigInt(Math.trunc(Number(input.iasClientId))),
              // Nothing chosen and nothing stored: leave the column null, so a first save logs no change.
              ...(a.thirdPartyConfig === null && !config.vendors.length && !config.rateCards.length
                ? {}
                : { thirdPartyConfig: mergeConfig(a.thirdPartyConfig, config) }),
              version: { increment: 1 },
            },
            select: { id: true, version: true },
          });
        },
      );
      let affected: number | undefined;
      if (euChanged && euNew) affected = await propagateEuAnswer(tx, ctx, a, euNew, user);
      return {
        data: {
          version: updated.version,
          ...(affected !== undefined ? { affectedLineItems: affected } : {}),
        },
        warnings: warningsOf(warnings),
      };
    });
  });
}

async function syncVendors(
  t: Tx,
  ctx: ServiceCtx,
  advertiserId: string,
  vendorKeys: string[],
  cards: { vendorKey: string; affirmed: boolean }[],
  bidding: Map<string, { key: string; name: string; feePct: { toString(): string } | null }>,
): Promise<void> {
  await t.advertiserVendorSelection.deleteMany({ where: { advertiserId } });
  if (vendorKeys.length)
    await t.advertiserVendorSelection.createMany({
      data: vendorKeys.map((vendorKey) => ({
        sandboxId: ctx.sandboxId,
        advertiserId,
        vendorKey,
        enabled: true,
      })),
    });
  const keep = cards.map((c) => c.vendorKey);
  await t.thirdPartyRateCard.deleteMany({ where: { advertiserId, vendorKey: { notIn: keep } } });
  for (const c of cards) {
    const v = bidding.get(c.vendorKey);
    if (!v) continue;
    const existing = await t.thirdPartyRateCard.findFirst({
      where: { advertiserId, vendorKey: c.vendorKey },
    });
    const accepted = c.affirmed ? (existing?.termsAcceptedAt ?? ctx.simNow) : null;
    if (existing)
      await t.thirdPartyRateCard.update({
        where: { id: existing.id },
        data: { termsAcceptedAt: accepted },
      });
    else
      await t.thirdPartyRateCard.create({
        data: {
          sandboxId: ctx.sandboxId,
          advertiserId,
          vendorKey: c.vendorKey,
          vendorName: v.name,
          rateMediaFeePct: v.feePct ? v.feePct.toString() : '0',
          termsAcceptedAt: accepted,
        },
      });
  }
}

/** DELTA-03-7: one BulkJob, one ChangeGroup per line item (module 03 4.2). Returns the line item count. */
async function propagateEuAnswer(
  tx: Tx,
  ctx: ServiceCtx,
  a: Stored,
  value: (typeof EU_ENUM)[EuAnswer & string],
  user: SessionUser,
): Promise<number> {
  const lis = await tx.lineItem.findMany({
    where: { advertiserId: a.id },
    select: { id: true, ioId: true, campaignId: true, euPoliticalAds: true },
  });
  const word = value === 'CONTAINS_EU_POLITICAL_ADS' ? 'Yes' : 'No';
  const actor = ctx.user.actor ?? ctx.user;
  const job = await tx.bulkJob.create({
    data: {
      sandboxId: ctx.sandboxId,
      advertiserId: a.id,
      partnerId: a.partnerId,
      requestedById: actor.id,
      source: 'BULK_EDIT',
      action: 'EDIT_SETTINGS',
      description: `EU political ads set to ${word} on ${lis.length} line items`,
      status: 'COMPLETED',
      selectionCount: lis.length,
    },
    select: { id: true },
  });
  const bulkCtx = changeCtx(ctx, tx, { source: 'BULK_EDIT', bulkJobId: job.id });
  for (const li of lis) {
    await withChangeLog(
      bulkCtx,
      {
        type: 'LINE_ITEM',
        id: li.id,
        chain: { advertiserId: a.id, campaignId: li.campaignId, ioId: li.ioId, lineItemId: li.id },
      },
      (t) =>
        t.lineItem.update({
          where: { id: li.id },
          data: { euPoliticalAds: value, version: { increment: 1 } },
          select: { id: true },
        }),
    );
  }
  void user;
  return lis.length;
}

/** Days a scheduled advertiser is kept before it is purged (VAL Q18 default, a classroom setting later). */
export const DELETION_RETENTION_DAYS = 7;

/** AC-03-11, AC-03-12. ADMIN only (ADV-010). */
export async function scheduleAdvertiserDeletion(
  user: SessionUser,
  aid: string,
  meta: WriteMeta = {},
): Promise<Result<{ scheduledDeletionAt: string }>> {
  return asResult(async () => {
    const ctx = await serviceCtx(user);
    assertCan(ctx, 'partner.settings.write');
    return withSandbox(ctx.sandboxId, async (tx) => {
      const a = await loadAdvertiser(tx, aid);
      if (a.status !== 'ACTIVE' && a.status !== 'PAUSED')
        throw new ServiceFailure('INVALID', [
          {
            path: 'status',
            severity: 'error',
            code: 'ADV-010',
            message: "This status change isn't available for this advertiser.",
          },
        ]);
      checkVersion(a.version, meta.expectedVersion);
      const at = new Date(ctx.simNow.getTime() + DELETION_RETENTION_DAYS * 86_400_000);
      await withChangeLog(
        changeCtx(ctx, tx, { ...(meta.note ? { note: meta.note } : {}) }),
        { type: 'ADVERTISER', id: a.id, chain: { advertiserId: a.id } },
        (t) =>
          t.advertiser.update({
            where: { id: a.id },
            data: {
              status: 'SCHEDULED_FOR_DELETION',
              previousStatus: a.status,
              scheduledDeletionAt: at,
              deletionCancelledAt: null,
              version: { increment: 1 },
            },
            select: { id: true },
          }),
      );
      return { data: { scheduledDeletionAt: at.toISOString() } };
    });
  });
}

export async function cancelAdvertiserDeletion(
  user: SessionUser,
  aid: string,
): Promise<Result<{ status: 'ACTIVE' | 'PAUSED' }>> {
  return asResult(async () => {
    const ctx = await serviceCtx(user);
    assertCan(ctx, 'partner.settings.write');
    return withSandbox(ctx.sandboxId, async (tx) => {
      const a = await loadAdvertiser(tx, aid);
      if (a.status !== 'SCHEDULED_FOR_DELETION')
        throw new ServiceFailure('INVALID', [
          {
            path: 'status',
            severity: 'error',
            code: 'ADV-010',
            message: 'This advertiser is not scheduled for deletion.',
          },
        ]);
      const restore = a.previousStatus === 'PAUSED' ? 'PAUSED' : 'ACTIVE';
      await withChangeLog(
        changeCtx(ctx, tx),
        { type: 'ADVERTISER', id: a.id, chain: { advertiserId: a.id } },
        (t) =>
          t.advertiser.update({
            where: { id: a.id },
            data: {
              status: restore,
              previousStatus: null,
              scheduledDeletionAt: null,
              deletionCancelledAt: ctx.simNow,
              version: { increment: 1 },
            },
            select: { id: true },
          }),
      );
      return { data: { status: restore } };
    });
  });
}
