import 'server-only';
// Partner targeting defaults (module 02 2.5, 4.6; S5). Four rows of the shared targeting state are stored as
// TargetingAssignment rows with ownerType PARTNER. The page only edits Geography, Environment, Position and Apps & URLs;
// the inventory source summary is read from the partner's exchanges.
import { withChangeLog } from '@/lib/changelog';
import { withSandbox } from '@/lib/db';
import { rowsToState, stateToRows, type TargetingRow } from '@/lib/targeting/rows';
import type { TargetingCriteria, TargetingState } from '@/lib/targeting/types';
import type { SessionUser } from '@/lib/auth/types';
import {
  asResult,
  assertCan,
  changeCtx,
  checkVersion,
  isLimited,
  loadPartner,
  mayDo,
  serviceCtx,
  type Result,
  type WriteMeta,
} from './kit';

/** The state type of the partner defaults: a display line item has all four dimensions available. */
export const DEFAULTS_LI_TYPE = 'DISPLAY';
/** DB dimensions the page owns. */
export const DEFAULT_DIMENSIONS = [
  'GEOGRAPHY',
  'ENVIRONMENT',
  'POSITION_ON_SCREEN',
  'POSITION_IN_CONTENT',
  'APPS_AND_URLS',
] as const;
const CRITERIA_KEYS = ['geography', 'environment', 'position', 'appsAndUrls'] as const;

export interface TargetingDefaults {
  state: TargetingState;
  enabledExchangeCount: number;
  autoEnableNewExchanges: boolean;
  version: number;
  canWrite: boolean;
  limitedAccess: boolean;
}

/** Only the four keys this page owns survive a save. */
export function pickDefaults(criteria: TargetingCriteria): TargetingCriteria {
  const out: TargetingCriteria = {};
  for (const k of CRITERIA_KEYS)
    if (criteria[k] !== undefined) Object.assign(out, { [k]: criteria[k] });
  return out;
}

export async function getTargetingDefaults(
  user: SessionUser,
  pid: string,
): Promise<Result<TargetingDefaults>> {
  return asResult(async () => {
    const ctx = await serviceCtx(user);
    return withSandbox(ctx.sandboxId, async (tx) => {
      const p = await loadPartner(tx, pid);
      const [stored, enabled] = await Promise.all([
        tx.targetingAssignment.findMany({
          where: {
            ownerType: 'PARTNER',
            partnerId: p.id,
            dimension: { in: [...DEFAULT_DIMENSIONS] },
          },
          orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
        }),
        tx.partnerExchange.count({ where: { partnerId: p.id, enabled: true } }),
      ]);
      const optionIds = [...new Set(stored.map((r) => r.optionId).filter((v): v is string => !!v))];
      const options = optionIds.length
        ? await tx.targetingOption.findMany({
            where: { id: { in: optionIds } },
            select: { id: true, code: true, name: true },
          })
        : [];
      const byId = new Map(options.map((o) => [o.id, o]));
      const rows = stored.map((r): TargetingRow => {
        const o = r.optionId ? byId.get(r.optionId) : undefined;
        const cfg = (r.config ?? undefined) as Record<string, unknown> | undefined;
        const codeInText = cfg?.codeInText === true;
        const { codeInText: _drop, ...rest } = cfg ?? {};
        void _drop;
        return {
          dimension: r.dimension,
          mode: r.mode,
          ...(o ? { code: o.code, label: o.name } : {}),
          ...(codeInText && r.valueText ? { code: r.valueText } : {}),
          ...(r.refType ? { refType: r.refType as TargetingRow['refType'] } : {}),
          ...(r.refId ? { refId: r.refId } : {}),
          ...(r.valueText && !codeInText ? { valueText: r.valueText } : {}),
          ...(r.groupIndex ? { groupIndex: r.groupIndex } : {}),
          ...(cfg && Object.keys(rest).length ? { config: rest } : {}),
        };
      });
      const state = rowsToState(rows, DEFAULTS_LI_TYPE);
      return {
        data: {
          state: { ...state, criteria: pickDefaults(state.criteria) },
          enabledExchangeCount: enabled,
          autoEnableNewExchanges: p.autoEnableNewExchanges,
          version: p.version,
          canWrite: mayDo(ctx, 'partner.settings.write'),
          limitedAccess: isLimited(ctx),
        },
      };
    });
  });
}

/** AC-02-15. Replaces the partner's four default rows. Permission `partner.settings.write`. */
export async function saveTargetingDefaults(
  user: SessionUser,
  pid: string,
  input: { criteria: TargetingCriteria; autoEnableNewExchanges: boolean },
  meta: WriteMeta = {},
): Promise<Result<{ version: number }>> {
  return asResult(async () => {
    const ctx = await serviceCtx(user);
    assertCan(ctx, 'partner.settings.write');
    return withSandbox(ctx.sandboxId, async (tx) => {
      const p = await loadPartner(tx, pid);
      checkVersion(p.version, meta.expectedVersion);
      const state: TargetingState = {
        version: 1,
        lineItemType: DEFAULTS_LI_TYPE,
        criteria: pickDefaults(input.criteria),
      };
      const rows = stateToRows(state).filter((r) =>
        (DEFAULT_DIMENSIONS as readonly string[]).includes(r.dimension),
      );
      const codes = rows.filter((r) => r.code !== undefined);
      const options = codes.length
        ? await tx.targetingOption.findMany({
            where: {
              OR: codes.map((r) => ({
                dimension: r.dimension as (typeof DEFAULT_DIMENSIONS)[number],
                code: r.code!,
              })),
            },
            select: { id: true, dimension: true, code: true },
          })
        : [];
      const optionId = new Map(options.map((o) => [`${o.dimension}:${o.code}`, o.id]));
      const updated = await withChangeLog(
        changeCtx(ctx, tx, { ...(meta.note ? { note: meta.note } : {}) }),
        { type: 'PARTNER', id: p.id, chain: {} },
        async (t) => {
          await t.targetingAssignment.deleteMany({
            where: {
              ownerType: 'PARTNER',
              partnerId: p.id,
              dimension: { in: [...DEFAULT_DIMENSIONS] },
            },
          });
          if (rows.length)
            await t.targetingAssignment.createMany({
              data: rows.map((r) => {
                const id =
                  r.code !== undefined ? optionId.get(`${r.dimension}:${r.code}`) : undefined;
                const codeInText = r.code !== undefined && !id;
                const config = codeInText ? { ...r.config, codeInText: true } : r.config;
                return {
                  sandboxId: ctx.sandboxId,
                  ownerType: 'PARTNER' as const,
                  partnerId: p.id,
                  dimension: r.dimension as (typeof DEFAULT_DIMENSIONS)[number],
                  mode: r.mode,
                  optionId: id ?? null,
                  refType: r.refType ?? null,
                  refId: r.refId ?? null,
                  valueText: codeInText ? r.code! : (r.valueText ?? null),
                  groupIndex: r.groupIndex ?? 0,
                  ...(config ? { config: config as never } : {}),
                };
              }),
            });
          return t.partner.update({
            where: { id: p.id },
            data: {
              autoEnableNewExchanges: input.autoEnableNewExchanges,
              version: { increment: 1 },
            },
            select: { id: true, version: true },
          });
        },
      );
      return { data: { version: updated.version } };
    });
  });
}
