import 'server-only';
// Alert preferences (module 03 4.4, S7). The engine reads these rows each tick (ENG 3.7); this service resolves the
// open alerts of a type that was switched off (Q5: resolved with `PREF_DISABLED`).
import { withChangeLog } from '@/lib/changelog';
import { withSandbox } from '@/lib/db';
import type { SessionUser } from '@/lib/auth/types';
import { ALERT_ROWS, UNDERPACING_DEFAULT_PCT, type AlertKey } from './constants';
import { validateAlertPrefs, type AlertPrefInput } from './rules';
import {
  asResult,
  assertCan,
  changeCtx,
  checkVersion,
  failIf,
  isLimited,
  loadAdvertiser,
  mayDo,
  mergeConfig,
  serviceCtx,
  type Result,
  type WriteMeta,
} from './kit';

export interface AlertPrefs {
  prefs: Record<
    AlertKey,
    { enabled: boolean; thresholdPct: number | null; thresholdAmount: number | null }
  >;
  currencyCode: string;
  version: number;
  canWrite: boolean;
  limitedAccess: boolean;
}

export function defaultPrefs(): AlertPrefs['prefs'] {
  return Object.fromEntries(
    ALERT_ROWS.map((r) => [
      r.type,
      {
        enabled: r.default,
        thresholdPct: r.type === 'UNDERPACING' ? UNDERPACING_DEFAULT_PCT : null,
        thresholdAmount: r.type === 'EXCEEDED_SPEND_THRESHOLD' ? 0 : null,
      },
    ]),
  ) as AlertPrefs['prefs'];
}

export async function getAlertPreferences(
  user: SessionUser,
  aid: string,
): Promise<Result<AlertPrefs>> {
  return asResult(async () => {
    const ctx = await serviceCtx(user);
    return withSandbox(ctx.sandboxId, async (tx) => {
      const a = await loadAdvertiser(tx, aid);
      const rows = await tx.advertiserAlertPreference.findMany({ where: { advertiserId: a.id } });
      const prefs = defaultPrefs();
      for (const r of rows) {
        const k = r.alertType as AlertKey;
        if (!(k in prefs)) continue;
        prefs[k] = {
          enabled: r.enabled,
          thresholdPct: r.thresholdPct ?? prefs[k].thresholdPct,
          thresholdAmount:
            r.thresholdAmount === null
              ? prefs[k].thresholdAmount
              : Number(r.thresholdAmount.toString()),
        };
      }
      return {
        data: {
          prefs,
          currencyCode: a.currencyCode,
          version: a.version,
          canWrite: mayDo(ctx, 'entity.write'),
          limitedAccess: isLimited(ctx),
        },
      };
    });
  });
}

/** AC-03-16, AC-03-17. Changes log on the advertiser as "Alert preference: Underpacing threshold changed". */
export async function saveAlertPreferences(
  user: SessionUser,
  aid: string,
  prefs: Record<AlertKey, AlertPrefInput>,
  meta: WriteMeta = {},
): Promise<Result<{ resolvedAlerts: number }>> {
  return asResult(async () => {
    const ctx = await serviceCtx(user);
    assertCan(ctx, 'entity.write');
    return withSandbox(ctx.sandboxId, async (tx) => {
      const a = await loadAdvertiser(tx, aid);
      checkVersion(a.version, meta.expectedVersion);
      failIf(validateAlertPrefs(prefs));
      const before = await tx.advertiserAlertPreference.findMany({ where: { advertiserId: a.id } });
      const was = new Map(before.map((b) => [b.alertType, b]));
      const nowOff: AlertKey[] = [];
      for (const r of ALERT_ROWS) {
        const prev = was.get(r.type)?.enabled ?? r.default;
        if (prev && !prefs[r.type].enabled) nowOff.push(r.type);
      }
      let resolved = 0;
      await withChangeLog(
        changeCtx(ctx, tx, { ...(meta.note ? { note: meta.note } : {}) }),
        { type: 'ADVERTISER', id: a.id, chain: { advertiserId: a.id } },
        async (t) => {
          for (const r of ALERT_ROWS) {
            const p = prefs[r.type];
            const pct = r.type === 'UNDERPACING' ? Math.trunc(Number(p.thresholdPct)) : null;
            const amount = r.type === 'EXCEEDED_SPEND_THRESHOLD' ? Number(p.thresholdAmount) : null;
            await t.advertiserAlertPreference.upsert({
              where: { advertiserId_alertType: { advertiserId: a.id, alertType: r.type } },
              create: {
                sandboxId: ctx.sandboxId,
                advertiserId: a.id,
                alertType: r.type,
                enabled: p.enabled,
                thresholdPct: pct,
                thresholdAmount: amount,
              },
              update: {
                enabled: p.enabled,
                thresholdPct: pct ?? undefined,
                thresholdAmount: amount ?? undefined,
              },
            });
          }
          if (nowOff.length) {
            const r = await t.alert.updateMany({
              where: { advertiserId: a.id, type: { in: nowOff }, state: 'OPEN' },
              data: { state: 'RESOLVED', resolvedAt: ctx.simNow, diagnosticCode: 'PREF_DISABLED' },
            });
            resolved = r.count;
          }
          // Alert preferences are children of the advertiser: bump its version so the diff below has a trail.
          return t.advertiser.update({
            where: { id: a.id },
            data: {
              version: { increment: 1 },
              thirdPartyConfig: mergeConfig(a.thirdPartyConfig, { alertPrefs: summaryOf(prefs) }),
            },
            select: { id: true },
          });
        },
      );
      return { data: { resolvedAlerts: resolved } };
    });
  });
}

function summaryOf(prefs: Record<AlertKey, AlertPrefInput>): Record<string, unknown> {
  return Object.fromEntries(
    ALERT_ROWS.map((r) => [
      r.type,
      r.type === 'UNDERPACING'
        ? `${prefs[r.type].enabled ? 'on' : 'off'} ${Math.trunc(Number(prefs[r.type].thresholdPct))}%`
        : r.type === 'EXCEEDED_SPEND_THRESHOLD'
          ? `${prefs[r.type].enabled ? 'on' : 'off'} ${Number(prefs[r.type].thresholdAmount)}`
          : prefs[r.type].enabled
            ? 'on'
            : 'off',
    ]),
  );
}
