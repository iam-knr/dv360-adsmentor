import 'server-only';
// Advertiser configurations of the partner (module 02 4.7, S6): six feature flags with a per-advertiser scope.
import { withChangeLog } from '@/lib/changelog';
import { withSandbox, type Tx } from '@/lib/db';
import type { SessionUser } from '@/lib/auth/types';
import { CONFIG_CARDS, CONFIG_DEFAULTS, TERMS_KEYS, type ConfigKey } from './constants';
import { googleInventoryOffWarning, validateConfigurations, type SettingsIssue } from './rules';
import {
  asResult,
  assertCan,
  changeCtx,
  checkVersion,
  failIf,
  isLimited,
  loadPartner,
  mayDo,
  serviceCtx,
  warningsOf,
  type Result,
  type WriteMeta,
} from './kit';

export interface ConfigFlag {
  enabled: boolean;
  scope: 'ALL_ADVERTISERS' | 'SELECTED';
  advertiserIds: string[]; // advertiser row ids
  termsAccepted: boolean;
}

export interface Configurations {
  flags: Record<ConfigKey, ConfigFlag>;
  advertisers: { id: string; publicId: string; name: string }[];
  version: number;
  canWrite: boolean;
  limitedAccess: boolean;
}

export async function getAdvertiserConfigurations(
  user: SessionUser,
  pid: string,
): Promise<Result<Configurations>> {
  return asResult(async () => {
    const ctx = await serviceCtx(user);
    return withSandbox(ctx.sandboxId, async (tx) => {
      const p = await loadPartner(tx, pid);
      const [rows, advertisers] = await Promise.all([
        tx.partnerFeatureFlag.findMany({
          where: { partnerId: p.id },
          include: { advertisers: { select: { advertiserId: true } } },
        }),
        tx.advertiser.findMany({
          where: { partnerId: p.id },
          orderBy: { name: 'asc' },
          select: { id: true, publicId: true, name: true },
        }),
      ]);
      const by = new Map(rows.map((r) => [r.key, r]));
      const flags = Object.fromEntries(
        CONFIG_CARDS.map((c) => {
          const r = by.get(c.key);
          const flag: ConfigFlag = {
            enabled: r ? r.enabled : (CONFIG_DEFAULTS[c.key] ?? false),
            scope: r?.scope ?? 'ALL_ADVERTISERS',
            advertiserIds: r?.advertisers.map((a) => a.advertiserId) ?? [],
            termsAccepted: Boolean(r?.termsAcceptedAt),
          };
          return [c.key, flag];
        }),
      ) as Record<ConfigKey, ConfigFlag>;
      return {
        data: {
          flags,
          advertisers: advertisers.map((a) => ({
            id: a.id,
            publicId: a.publicId.toString(),
            name: a.name,
          })),
          version: p.version,
          canWrite: mayDo(ctx, 'partner.settings.write'),
          limitedAccess: isLimited(ctx),
        },
      };
    });
  });
}

const YT_DG_TYPES = ['YT_VIDEO', 'YT_AUDIO', 'YT_ON_CTV', 'DEMAND_GEN'] as const;

/** Advertisers a flag applies to, given its enabled state and scope. */
function appliesTo(
  flag: { enabled: boolean; scope: string; advertiserIds: string[] },
  all: string[],
): Set<string> {
  if (!flag.enabled) return new Set();
  return new Set(flag.scope === 'ALL_ADVERTISERS' ? all : flag.advertiserIds);
}

export async function saveAdvertiserConfigurations(
  user: SessionUser,
  pid: string,
  input: {
    flags: Record<
      string,
      { enabled: boolean; scope: 'ALL_ADVERTISERS' | 'SELECTED'; advertiserIds: string[] }
    >;
  },
  meta: WriteMeta = {},
): Promise<Result<{ version: number }>> {
  return asResult(async () => {
    const ctx = await serviceCtx(user);
    assertCan(ctx, 'partner.settings.write');
    return withSandbox(ctx.sandboxId, async (tx) => {
      const p = await loadPartner(tx, pid);
      checkVersion(p.version, meta.expectedVersion);
      const stored = await tx.partnerFeatureFlag.findMany({ where: { partnerId: p.id } });
      const by = new Map(stored.map((r) => [r.key, r]));
      const advertisers = await tx.advertiser.findMany({
        where: { partnerId: p.id },
        select: { id: true },
      });
      const all = advertisers.map((a) => a.id);
      // Only the six cards are writable here; a flag that is missing keeps its stored value.
      const flags: Record<
        string,
        { enabled: boolean; scope: 'ALL_ADVERTISERS' | 'SELECTED'; advertiserIds: string[] }
      > = {};
      for (const c of CONFIG_CARDS) {
        const given = input.flags[c.key];
        const row = by.get(c.key);
        flags[c.key] = given ?? {
          enabled: row ? row.enabled : (CONFIG_DEFAULTS[c.key] ?? false),
          scope: row?.scope ?? 'ALL_ADVERTISERS',
          advertiserIds: [],
        };
      }
      const issues: SettingsIssue[] = validateConfigurations(
        { flags },
        {
          enhancedAutomation:
            by.get('ENHANCED_AUTOMATION')?.enabled ?? CONFIG_DEFAULTS.ENHANCED_AUTOMATION ?? false,
          productImprovement:
            by.get('PRODUCT_IMPROVEMENT')?.enabled ?? CONFIG_DEFAULTS.PRODUCT_IMPROVEMENT ?? false,
          instantDealsTermsAccepted: Boolean(
            by.get('YOUTUBE_GUARANTEED_INSTANT_DEALS')?.termsAcceptedAt,
          ),
        },
      );
      failIf(issues);

      // PRT-015: Google & partner inventory turned off for advertisers that still have YouTube or Demand Gen items.
      const g = flags.GOOGLE_PARTNER_INVENTORY;
      const warnings: SettingsIssue[] = [];
      if (g) {
        const after = appliesTo(g, all);
        const losing = all.filter((id) => !after.has(id));
        if (losing.length) {
          const n = await tx.lineItem.count({
            where: {
              advertiserId: { in: losing },
              status: { not: 'ARCHIVED' },
              type: { in: [...YT_DG_TYPES] },
            },
          });
          if (n > 0) warnings.push(googleInventoryOffWarning(n));
        }
      }

      const updated = await withChangeLog(
        changeCtx(ctx, tx, { ...(meta.note ? { note: meta.note } : {}) }),
        { type: 'PARTNER', id: p.id, chain: {} },
        async (t) => {
          for (const c of CONFIG_CARDS) {
            const f = flags[c.key];
            if (!f) continue;
            const row = await t.partnerFeatureFlag.upsert({
              where: { partnerId_key: { partnerId: p.id, key: c.key } },
              create: {
                sandboxId: ctx.sandboxId,
                partnerId: p.id,
                key: c.key,
                enabled: f.enabled,
                scope: f.scope,
              },
              update: { enabled: f.enabled, scope: f.scope },
            });
            await t.partnerFeatureAdvertiser.deleteMany({ where: { flagId: row.id } });
            if (f.scope === 'SELECTED' && f.advertiserIds.length) {
              const valid = f.advertiserIds.filter((id) => all.includes(id));
              await t.partnerFeatureAdvertiser.createMany({
                data: valid.map((advertiserId) => ({
                  sandboxId: ctx.sandboxId,
                  flagId: row.id,
                  advertiserId,
                })),
              });
            }
          }
          if (g) await applyGoogleInventory(t, g, all);
          return t.partner.update({
            where: { id: p.id },
            data: { version: { increment: 1 } },
            select: { id: true, version: true },
          });
        },
        { fanOut: { advertiserIds: all } },
      );
      return { data: { version: updated.version }, warnings: warningsOf(warnings) };
    });
  });
}

/** GOOGLE_PARTNER_INVENTORY gates YouTube & partners and Demand Gen line items per advertiser (Δ-08-10, VAL MX-11). */
async function applyGoogleInventory(
  t: Tx,
  flag: { enabled: boolean; scope: string; advertiserIds: string[] },
  all: string[],
): Promise<void> {
  const on = appliesTo(flag, all);
  await t.advertiser.updateMany({
    where: { id: { in: [...on] } },
    data: { googleInventoryEnabled: true },
  });
  await t.advertiser.updateMany({
    where: { id: { in: all.filter((id) => !on.has(id)) } },
    data: { googleInventoryEnabled: false },
  });
}

export async function acceptConfigurationTerms(
  user: SessionUser,
  pid: string,
  key: string,
): Promise<Result<null>> {
  return asResult(async () => {
    const ctx = await serviceCtx(user);
    assertCan(ctx, 'partner.settings.write');
    if (!(TERMS_KEYS as readonly string[]).includes(key))
      failIf([{ path: 'key', severity: 'error', code: 'PRT-013', message: 'Unknown terms.' }]);
    return withSandbox(ctx.sandboxId, async (tx) => {
      const p = await loadPartner(tx, pid);
      const flagKey = key as ConfigKey;
      await withChangeLog(
        changeCtx(ctx, tx),
        { type: 'PARTNER', id: p.id, chain: {} },
        async (t) => {
          await t.partnerFeatureFlag.upsert({
            where: { partnerId_key: { partnerId: p.id, key: flagKey } },
            create: {
              sandboxId: ctx.sandboxId,
              partnerId: p.id,
              key: flagKey,
              enabled: CONFIG_DEFAULTS[flagKey] ?? false,
              termsAcceptedAt: ctx.simNow,
              termsAcceptedById: user.id,
            },
            update: { termsAcceptedAt: ctx.simNow, termsAcceptedById: user.id },
          });
          return { id: p.id };
        },
      );
      return { data: null };
    });
  });
}
