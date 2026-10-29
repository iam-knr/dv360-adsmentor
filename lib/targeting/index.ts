// Public API of lib/targeting (build-plan 2.7 names kept). Pure parts are re-exported; load and persist take the
// Prisma client as an argument, so this file has only type imports from Prisma.
import type { Prisma, PrismaClient, TargetingDimension } from '@prisma/client';
import { rowsToState, stateToRows, type TargetingRow } from './rows';
import type { TargetingState } from './types';

export * from './types';
export * from './dimensions';
export * from './rows';
export * from './summary';
export * from './merge';
export * from './options';

type Db = PrismaClient | Prisma.TransactionClient;

/** DM dimensions the LI form owns (exchanges, quality). Targeting saves never touch them. */
const NOT_CARD = ['INVENTORY_SOURCE', 'AUTHORIZED_SELLER'] as const;

type StoredRow = {
  dimension: string;
  mode: 'INCLUDE' | 'EXCLUDE';
  optionId: string | null;
  refType: string | null;
  refId: string | null;
  valueText: string | null;
  groupIndex: number;
  audienceSection: string | null;
  config: Prisma.JsonValue;
  isLocked: boolean;
};

async function toRows(db: Db, stored: StoredRow[]): Promise<TargetingRow[]> {
  const ids = [...new Set(stored.map((r) => r.optionId).filter((v): v is string => !!v))];
  const options = ids.length
    ? await db.targetingOption.findMany({
        where: { id: { in: ids } },
        select: { id: true, code: true, name: true },
      })
    : [];
  const byId = new Map(options.map((o) => [o.id, o]));
  return stored.map((r): TargetingRow => {
    const option = r.optionId ? byId.get(r.optionId) : undefined;
    // Rows written for codes the catalogue does not hold keep the code in valueText with `config.codeInText`.
    const cfg = (r.config ?? undefined) as Record<string, unknown> | undefined;
    const codeInText = cfg?.codeInText === true;
    const { codeInText: _drop, ...rest } = cfg ?? {};
    return {
      dimension: r.dimension,
      mode: r.mode,
      ...(option ? { code: option.code, label: option.name } : {}),
      ...(codeInText && r.valueText ? { code: r.valueText } : {}),
      ...(r.refType ? { refType: r.refType as TargetingRow['refType'] } : {}),
      ...(r.refId ? { refId: r.refId } : {}),
      ...(r.valueText && !codeInText ? { valueText: r.valueText } : {}),
      ...(r.groupIndex ? { groupIndex: r.groupIndex } : {}),
      ...(r.audienceSection
        ? { audienceSection: r.audienceSection as TargetingRow['audienceSection'] }
        : {}),
      ...(cfg && Object.keys(rest).length ? { config: rest } : {}),
      ...(r.isLocked ? { isLocked: true } : {}),
    };
  });
}

const SELECT = {
  dimension: true,
  mode: true,
  optionId: true,
  refType: true,
  refId: true,
  valueText: true,
  groupIndex: true,
  audienceSection: true,
  config: true,
  isLocked: true,
} as const;

/** LI rows plus the advertiser's locked rules, merged on read with `isLocked` (module 10 3.2, 4.3 rule 8). */
export async function loadTargetingState(db: Db, liId: string): Promise<TargetingState> {
  const li = await db.lineItem.findUniqueOrThrow({
    where: { id: liId },
    select: { type: true, advertiserId: true },
  });
  const [own, locked] = await Promise.all([
    db.targetingAssignment.findMany({
      where: { lineItemId: liId, ownerType: 'LINE_ITEM', dimension: { notIn: [...NOT_CARD] } },
      select: SELECT,
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    }),
    db.targetingAssignment.findMany({
      where: {
        advertiserId: li.advertiserId,
        ownerType: 'ADVERTISER',
        isLocked: true,
        dimension: { notIn: [...NOT_CARD] },
      },
      select: SELECT,
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    }),
  ]);
  const lockedDims = new Set(locked.map((r) => r.dimension));
  const rows = [
    ...own.filter((r) => !lockedDims.has(r.dimension)),
    ...locked.map((r) => ({ ...r, isLocked: true })),
  ];
  return rowsToState(await toRows(db, rows), li.type);
}

type Owner = { kind: 'LINE_ITEM'; id: string } | { kind: 'AD_GROUP'; id: string };

async function persistRows(
  tx: Prisma.TransactionClient,
  owner: Owner,
  sandboxId: string,
  state: TargetingState,
): Promise<void> {
  const rows = stateToRows(state).filter((r) => !r.isLocked);
  const wanted = rows.filter((r) => r.code !== undefined);
  const options = wanted.length
    ? await tx.targetingOption.findMany({
        where: {
          OR: wanted.map((r) => ({ dimension: r.dimension as TargetingDimension, code: r.code! })),
        },
        select: { id: true, dimension: true, code: true },
      })
    : [];
  const optionId = new Map(options.map((o) => [`${o.dimension}:${o.code}`, o.id]));
  const ownerKey = owner.kind === 'LINE_ITEM' ? { lineItemId: owner.id } : { adGroupId: owner.id };

  await tx.targetingAssignment.deleteMany({
    where: { ...ownerKey, ownerType: owner.kind, dimension: { notIn: [...NOT_CARD] } },
  });
  if (rows.length === 0) return;
  await tx.targetingAssignment.createMany({
    data: rows.map((r): Prisma.TargetingAssignmentCreateManyInput => {
      const id = r.code !== undefined ? optionId.get(`${r.dimension}:${r.code}`) : undefined;
      const codeInText = r.code !== undefined && !id;
      const config = codeInText ? { ...r.config, codeInText: true } : r.config;
      return {
        sandboxId,
        ownerType: owner.kind,
        ...ownerKey,
        dimension: r.dimension as TargetingDimension,
        mode: r.mode,
        optionId: id ?? null,
        refType: r.refType ?? null,
        refId: r.refId ?? null,
        valueText: codeInText ? r.code! : (r.valueText ?? null),
        groupIndex: r.groupIndex ?? 0,
        audienceSection: r.audienceSection ?? null,
        ...(config ? { config: config as Prisma.InputJsonValue } : {}),
      };
    }),
  });
}

/** Replaces the LI's own card rows. Locked rows are never written by an LI save (module 10 3.2). */
export async function persistTargeting(
  tx: Prisma.TransactionClient,
  liId: string,
  state: TargetingState,
): Promise<void> {
  const li = await tx.lineItem.findUniqueOrThrow({
    where: { id: liId },
    select: { sandboxId: true },
  });
  await persistRows(tx, { kind: 'LINE_ITEM', id: liId }, li.sandboxId, state);
}

/** Ad group targeting (module 09 2.4): the ad group's own rows, no advertiser locks (P4-06). */
export const AD_GROUP_TARGETING_TYPE = 'YT_AD_GROUP';

/** Demand Gen ad groups use the DG column of MX-10 (module 09 4.6). */
export const DG_AD_GROUP_TARGETING_TYPE = 'DG_AD_GROUP';

export async function loadAdGroupTargeting(
  db: Db,
  adGroupId: string,
  type: string = AD_GROUP_TARGETING_TYPE,
): Promise<TargetingState> {
  const own = await db.targetingAssignment.findMany({
    where: { adGroupId, ownerType: 'AD_GROUP' },
    select: SELECT,
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
  });
  return rowsToState(await toRows(db, own), type);
}

export async function persistAdGroupTargeting(
  tx: Prisma.TransactionClient,
  adGroupId: string,
  state: TargetingState,
): Promise<void> {
  const ag = await tx.adGroup.findUniqueOrThrow({
    where: { id: adGroupId },
    select: { sandboxId: true },
  });
  await persistRows(tx, { kind: 'AD_GROUP', id: adGroupId }, ag.sandboxId, state);
}
