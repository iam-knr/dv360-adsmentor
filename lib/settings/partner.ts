import 'server-only';
// Partner basic details and exchanges (module 02 4.4, 4.5; S3, S4). Writes need `partner.settings.write` (ADMIN).
import { withChangeLog } from '@/lib/changelog';
import { withSandbox, type Tx } from '@/lib/db';
import { exchangeFormatOf, exchangeSupports } from '@/lib/line-items/type-config';
import { CONTACT_ROLES, type ContactKey } from './constants';
import { sdfKeyOf, sdfLabel } from './constants';
import {
  exchangeTargetedWarning,
  validateExchanges,
  validatePartner,
  type ExchangeMeta,
  type ExchangePick,
  type PartnerContactInput,
  type SettingsIssue,
} from './rules';
import {
  asResult,
  assertCan,
  changeCtx,
  checkVersion,
  failIf,
  isLimited,
  loadPartner,
  mayDo,
  notFound,
  serviceCtx,
  warningsOf,
  type Result,
  type WriteMeta,
} from './kit';
import type { SessionUser } from '@/lib/auth/types';

export interface PartnerDetails {
  id: string;
  publicId: string;
  name: string;
  status: 'ACTIVE' | 'PAUSED';
  currencyCode: string;
  timeZone: string;
  nielsenCountry: string | null;
  includeDataInCmTransfer: boolean;
  reportCostToCm: boolean;
  autoEnableNewExchanges: boolean;
  sdfVersion: string; // wire text "9.1"
  sdfAdminEmail: string | null;
  dataTermsAccepted: boolean;
  contacts: Record<ContactKey, PartnerContactInput>;
  contactPerson: ContactKey;
  enabledExchangeCount: number;
  appMediationFeesAccepted: boolean;
  rateCards: { id: string; vendorName: string; ratePct: number; accepted: boolean }[];
  version: number;
  canWrite: boolean;
  limitedAccess: boolean;
}

export interface ExchangeRow {
  id: string;
  code: string;
  name: string;
  appMediation: boolean;
  enabled: boolean;
  needsNetworkId: boolean;
  needsSeatId: boolean;
  networkId: string | null;
  agencyId: string | null;
  seatId: string | null;
}

export async function getPartnerDetails(
  user: SessionUser,
  pid: string,
): Promise<Result<PartnerDetails>> {
  return asResult(async () => {
    const ctx = await serviceCtx(user);
    return withSandbox(ctx.sandboxId, async (tx) => {
      const p = await loadPartner(tx, pid);
      const [contacts, enabled, cards, fees] = await Promise.all([
        tx.partnerContact.findMany({ where: { partnerId: p.id } }),
        tx.partnerExchange.count({ where: { partnerId: p.id, enabled: true } }),
        tx.thirdPartyRateCard.findMany({
          where: { partnerId: p.id },
          orderBy: { vendorName: 'asc' },
        }),
        tx.partnerFeatureFlag.findUnique({
          where: { partnerId_key: { partnerId: p.id, key: 'APP_MEDIATION_FEES' } },
        }),
      ]);
      const byRole = Object.fromEntries(contacts.map((c) => [c.role, c]));
      const contactMap = Object.fromEntries(
        CONTACT_ROLES.map((r) => {
          const c = byRole[r.key];
          return [
            r.key,
            {
              name: c?.name ?? '',
              email: c?.email ?? '',
              address: c?.address ?? '',
              phone: c?.phone ?? '',
            },
          ];
        }),
      ) as Record<ContactKey, PartnerContactInput>;
      const person = contacts.find((c) => c.isContactPerson)?.role ?? 'PRIMARY';
      const data: PartnerDetails = {
        id: p.id,
        publicId: p.publicId.toString(),
        name: p.name,
        status: p.status === 'PAUSED' ? 'PAUSED' : 'ACTIVE',
        currencyCode: p.currencyCode,
        timeZone: p.timeZone,
        nielsenCountry: p.nielsenContractCountry,
        includeDataInCmTransfer: p.includeDataInCmTransfer,
        reportCostToCm: p.reportCostToCm,
        autoEnableNewExchanges: p.autoEnableNewExchanges,
        sdfVersion: sdfLabel(p.sdfVersion),
        sdfAdminEmail: p.sdfAdminEmail,
        dataTermsAccepted: p.dataTermsAcceptedAt !== null,
        contacts: contactMap,
        contactPerson: person,
        enabledExchangeCount: enabled,
        appMediationFeesAccepted: Boolean(fees?.termsAcceptedAt),
        rateCards: cards.map((c) => ({
          id: c.id,
          vendorName: c.vendorName,
          ratePct: Number(c.rateMediaFeePct.toString()),
          accepted: c.termsAcceptedAt !== null,
        })),
        version: p.version,
        canWrite: mayDo(ctx, 'partner.settings.write'),
        limitedAccess: isLimited(ctx),
      };
      return { data };
    });
  });
}

export async function getExchangesPanel(
  user: SessionUser,
  pid: string,
): Promise<Result<ExchangeRow[]>> {
  return asResult(async () => {
    const ctx = await serviceCtx(user);
    return withSandbox(ctx.sandboxId, async (tx) => {
      const p = await loadPartner(tx, pid);
      const [all, mine] = await Promise.all([
        tx.exchange.findMany({ orderBy: [{ name: 'asc' }] }),
        tx.partnerExchange.findMany({ where: { partnerId: p.id } }),
      ]);
      const by = new Map(mine.map((m) => [m.exchangeId, m]));
      const data = all.map((e): ExchangeRow => {
        const m = by.get(e.id);
        return {
          id: e.id,
          code: e.code,
          name: e.name,
          appMediation: e.kind === 'APP_MEDIATION_PARTNER',
          enabled: m?.enabled ?? false,
          needsNetworkId: e.needsNetworkId,
          needsSeatId: e.needsSeatId,
          networkId: m?.networkId ?? null,
          agencyId: m?.agencyId ?? null,
          seatId: m?.seatId ?? null,
        };
      });
      return { data };
    });
  });
}

/** PRT-010: non-archived line items of the partner whose format the exchange serves. */
async function lineItemsOnExchange(tx: Tx, partnerId: string, removed: string[]): Promise<number> {
  if (removed.length === 0) return 0;
  const exchanges = await tx.exchange.findMany({ where: { id: { in: removed } } });
  const lis = await tx.lineItem.findMany({
    where: { advertiser: { partnerId }, status: { not: 'ARCHIVED' } },
    select: { id: true, type: true, appAdFormat: true },
  });
  const hit = new Set<string>();
  for (const li of lis) {
    const fmt = exchangeFormatOf(li.type, li.appAdFormat === 'VIDEO' ? 'VIDEO' : 'DISPLAY');
    if (fmt && exchanges.some((e) => exchangeSupports(fmt, e))) hit.add(li.id);
  }
  return hit.size;
}

/** Write the exchange rows of a partner. Returns the ids that were enabled before and are not any more. */
async function applyExchanges(
  tx: Tx,
  sandboxId: string,
  partnerId: string,
  picks: ExchangePick[],
): Promise<string[]> {
  const before = await tx.partnerExchange.findMany({ where: { partnerId } });
  const wanted = new Map(picks.map((p) => [p.exchangeId, p]));
  const removed: string[] = [];
  for (const row of before) {
    if (row.enabled && !wanted.has(row.exchangeId)) {
      removed.push(row.exchangeId);
      await tx.partnerExchange.update({ where: { id: row.id }, data: { enabled: false } });
    }
  }
  for (const p of picks) {
    const clean = (v: string | null | undefined) => (v && v.trim() ? v.trim() : null);
    const data = {
      enabled: true,
      networkId: clean(p.networkId),
      agencyId: clean(p.agencyId),
      seatId: clean(p.seatId),
    };
    await tx.partnerExchange.upsert({
      where: { partnerId_exchangeId: { partnerId, exchangeId: p.exchangeId } },
      create: { sandboxId, partnerId, exchangeId: p.exchangeId, ...data },
      update: data,
    });
  }
  return removed;
}

async function exchangeMeta(tx: Tx, ids: string[]): Promise<Map<string, ExchangeMeta>> {
  const rows = await tx.exchange.findMany({ where: { id: { in: ids } } });
  return new Map(
    rows.map((e) => [
      e.id,
      { id: e.id, needsNetworkId: e.needsNetworkId, needsSeatId: e.needsSeatId },
    ]),
  );
}

export interface UpdatePartnerInput {
  name: string;
  status: string;
  currencyCode: string;
  timeZone: string;
  nielsenCountry?: string | null;
  includeDataInCmTransfer: boolean;
  reportCostToCm: boolean;
  autoEnableNewExchanges: boolean;
  sdfVersion: string; // wire text
  sdfAdminEmail?: string | null;
  dataProtection: {
    accepted: boolean;
    contacts: Partial<Record<string, PartnerContactInput>>;
    contactPerson: string;
  };
  /** When present the exchange slide-over draft is saved with the page (RT 5.4 draft-bound rule). */
  exchanges?: ExchangePick[];
}

/** AC-02-9, AC-02-10, AC-02-13. */
export async function updatePartner(
  user: SessionUser,
  pid: string,
  input: UpdatePartnerInput,
  meta: WriteMeta = {},
): Promise<Result<{ version: number; enabledExchangeCount: number }>> {
  return asResult(async () => {
    const ctx = await serviceCtx(user);
    assertCan(ctx, 'partner.settings.write');
    return withSandbox(ctx.sandboxId, async (tx) => {
      const p = await loadPartner(tx, pid);
      checkVersion(p.version, meta.expectedVersion);
      const sdfKey = sdfKeyOf(input.sdfVersion);
      const issues: SettingsIssue[] = validatePartner(
        { ...input, sdfVersion: sdfKey ?? input.sdfVersion },
        {
          currencyCode: p.currencyCode,
          timeZone: p.timeZone,
          dataTermsAccepted: p.dataTermsAcceptedAt !== null,
        },
      );
      if (input.exchanges) {
        issues.push(
          ...validateExchanges(
            input.exchanges,
            await exchangeMeta(
              tx,
              input.exchanges.map((e) => e.exchangeId),
            ),
          ),
        );
      }
      failIf(issues);
      const warnings: SettingsIssue[] = [];
      const updated = await withChangeLog(
        changeCtx(ctx, tx, { ...(meta.note ? { note: meta.note } : {}) }),
        { type: 'PARTNER', id: p.id, chain: {} },
        async (t) => {
          if (input.exchanges) {
            const removed = await applyExchanges(t, ctx.sandboxId, p.id, input.exchanges);
            const n = await lineItemsOnExchange(t, p.id, removed);
            if (n > 0) warnings.push(exchangeTargetedWarning(n));
          }
          const stored = await t.partnerContact.findMany({ where: { partnerId: p.id } });
          for (const r of CONTACT_ROLES) {
            const c = input.dataProtection.contacts[r.key] ?? {};
            const data = {
              name: c.name?.trim() || null,
              email: c.email?.trim() || null,
              address: c.address?.trim() || null,
              phone: c.phone?.trim() || null,
              isContactPerson: input.dataProtection.contactPerson === r.key,
            };
            const existing = stored.find((x) => x.role === r.key);
            // No row for an untouched, empty contact: the page shows empty tabs and the default contact person.
            const untouched = !data.name && !data.email && !data.address && !data.phone;
            if (!existing && untouched && (!data.isContactPerson || r.key === 'PRIMARY')) continue;
            await t.partnerContact.upsert({
              where: { partnerId_role: { partnerId: p.id, role: r.key } },
              create: { sandboxId: ctx.sandboxId, partnerId: p.id, role: r.key, ...data },
              update: data,
            });
          }
          return t.partner.update({
            where: { id: p.id },
            data: {
              name: input.name.trim(),
              status: input.status as 'ACTIVE' | 'PAUSED',
              nielsenContractCountry: input.nielsenCountry?.trim() || null,
              includeDataInCmTransfer: input.includeDataInCmTransfer,
              reportCostToCm: input.reportCostToCm,
              autoEnableNewExchanges: input.autoEnableNewExchanges,
              sdfVersion: sdfKey ?? p.sdfVersion,
              sdfAdminEmail: input.sdfAdminEmail?.trim() || null,
              dataTermsAcceptedAt:
                p.dataTermsAcceptedAt ?? (input.dataProtection.accepted ? ctx.simNow : null),
              version: { increment: 1 },
            },
            select: { id: true, version: true },
          });
        },
        { fanOut: { advertiserIds: await advertiserIdsOf(tx, p.id) } },
      );
      const enabledExchangeCount = await tx.partnerExchange.count({
        where: { partnerId: p.id, enabled: true },
      });
      return {
        data: { version: updated.version, enabledExchangeCount },
        warnings: warningsOf(warnings),
      };
    });
  });
}

async function advertiserIdsOf(tx: Tx, partnerId: string): Promise<string[]> {
  const rows = await tx.advertiser.findMany({ where: { partnerId }, select: { id: true } });
  return rows.map((r) => r.id);
}

/** `saveExchanges` of module 02 4.5, for scenarios and the API. The page normally saves them with `updatePartner`. */
export async function saveExchanges(
  user: SessionUser,
  pid: string,
  input: { enabled: ExchangePick[]; autoEnableNew: boolean },
  meta: WriteMeta = {},
): Promise<Result<{ enabledCount: number; affectedLineItems: number }>> {
  return asResult(async () => {
    const ctx = await serviceCtx(user);
    assertCan(ctx, 'partner.settings.write');
    return withSandbox(ctx.sandboxId, async (tx) => {
      const p = await loadPartner(tx, pid);
      checkVersion(p.version, meta.expectedVersion);
      failIf(
        validateExchanges(
          input.enabled,
          await exchangeMeta(
            tx,
            input.enabled.map((e) => e.exchangeId),
          ),
        ),
      );
      let affected = 0;
      await withChangeLog(
        changeCtx(ctx, tx, { ...(meta.note ? { note: meta.note } : {}) }),
        { type: 'PARTNER', id: p.id, chain: {} },
        async (t) => {
          const removed = await applyExchanges(t, ctx.sandboxId, p.id, input.enabled);
          affected = await lineItemsOnExchange(t, p.id, removed);
          return t.partner.update({
            where: { id: p.id },
            data: { autoEnableNewExchanges: input.autoEnableNew, version: { increment: 1 } },
            select: { id: true },
          });
        },
        { fanOut: { advertiserIds: await advertiserIdsOf(tx, p.id) } },
      );
      const enabledCount = await tx.partnerExchange.count({
        where: { partnerId: p.id, enabled: true },
      });
      return {
        data: { enabledCount, affectedLineItems: affected },
        warnings: affected > 0 ? [exchangeTargetedWarning(affected)] : [],
      };
    });
  });
}

/** "Review fees" dialog Accept (DELTA-02-7): stored as the APP_MEDIATION_FEES flag. */
export async function acceptAppMediationFees(
  user: SessionUser,
  pid: string,
): Promise<Result<null>> {
  return asResult(async () => {
    const ctx = await serviceCtx(user);
    assertCan(ctx, 'partner.settings.write');
    return withSandbox(ctx.sandboxId, async (tx) => {
      const p = await loadPartner(tx, pid);
      await withChangeLog(
        changeCtx(ctx, tx),
        { type: 'PARTNER', id: p.id, chain: {} },
        async (t) => {
          await t.partnerFeatureFlag.upsert({
            where: { partnerId_key: { partnerId: p.id, key: 'APP_MEDIATION_FEES' } },
            create: {
              sandboxId: ctx.sandboxId,
              partnerId: p.id,
              key: 'APP_MEDIATION_FEES',
              enabled: true,
              termsAcceptedAt: ctx.simNow,
              termsAcceptedById: user.id,
            },
            update: { enabled: true, termsAcceptedAt: ctx.simNow, termsAcceptedById: user.id },
          });
          return { id: p.id };
        },
      );
      return { data: null };
    });
  });
}

export { notFound };
