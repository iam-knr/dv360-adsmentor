// withChangeLog: the only way a service writes DV360 tenant rows (module 05 4.1, data-model 6.3).
// Before image, mutation, after image, diff through the registry, group and entries: one transaction.
import type { ChangeSource, EntityType, Prisma } from '@prisma/client';
import { withBypass, withSandbox, rlsEnabled, type Tx } from '@/lib/db';
import { actorLabel, isHiddenActor, type ChangeActorRef } from './actors';
import { createEntries, deleteEntries, diffImages, type EntryDraft } from './diff';
import { getRegistry } from './registries';
import type { EntityRegistry, FmtCtx, Image } from './registry-types';
import { summarise, type SaveKind } from './summary';

export {
  SYSTEM_ACTORS,
  SYSTEM_ACTOR_LABELS,
  type SystemActor,
  type ChangeActorRef,
} from './actors';
export { UI_STATE_TABLES, ENGINE_OWNED_TABLES } from './ui-state-tables';
export { diffImages, createEntries, deleteEntries, type EntryDraft } from './diff';
export { summarise } from './summary';
export { renderLine, sentenceCase } from './render';
export { canonical } from './canon';
export { historyWhere, type HistoryFilter } from './query';
export type { EntityRegistry, FieldDef, FieldKind, FmtCtx, Image } from './registry-types';

export interface ChangeCtx {
  sandboxId: string;
  classroomId: string;
  actor: ChangeActorRef;
  /** Channel of the change. Default UI. */
  source?: ChangeSource;
  bulkJobId?: string;
  note?: string;
  /** Group time. Users: real time (default). Engine and scenario loader: the sim instant (module 05 4.1.2). */
  now?: Date;
  /** A repeated key within 10 minutes writes no second group (module 05 4.1.7). */
  idempotencyKey?: string;
  /** Join a transaction the caller already opened with withSandbox or withBypass. */
  tx?: Tx;
  /** Run in a transaction that sees every sandbox (engine and instructor jobs only). Ignored when `tx` is given. */
  bypass?: boolean;
  fmt?: FmtCtx;
}

export interface EntityRef {
  type: EntityType;
  /** Required for updates and deletes. For a create it may be left out when the mutation returns the new row ({ id }). */
  id?: string;
  publicId?: bigint | number | null;
  name?: string | null;
  /** Parent chain snapshot (plain ids) for whichever levels exist for the entity. */
  chain: { advertiserId?: string; campaignId?: string; ioId?: string; lineItemId?: string };
}

export interface ChangeLogOptions<T> {
  registry?: EntityRegistry;
  /** Replaces the generated summary (for example "Budget allocated automatically"). */
  summary?: string;
  /** Partner level changes: also write one PARTNER_FANOUT group per advertiser (module 05 4.1.4). */
  fanOut?: { advertiserIds: string[] };
  /** Called instead of `mutate` when the idempotency key was already used. Without it a DuplicateChangeError is thrown. */
  onDuplicate?: (priorGroupId: string) => T | Promise<T>;
}

export class DuplicateChangeError extends Error {
  constructor(readonly priorGroupId: string) {
    super(`Change already recorded in group ${priorGroupId}`);
    this.name = 'DuplicateChangeError';
  }
}

export class ChangeLogError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ChangeLogError';
  }
}

const IDEMPOTENCY_WINDOW_MS = 10 * 60 * 1000;
const MODEL_NAME = /^[A-Za-z][A-Za-z0-9]*$/;

const lowerFirst = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);

async function loadImage(
  tx: Tx,
  registry: EntityRegistry,
  id: string,
  lock: boolean,
): Promise<Image | null> {
  if (!MODEL_NAME.test(registry.model))
    throw new ChangeLogError(`Bad model name "${registry.model}"`);
  if (lock) {
    await tx.$queryRawUnsafe(`SELECT 1 FROM "${registry.model}" WHERE "id" = $1 FOR UPDATE`, id);
  }
  if (registry.load) return registry.load(tx, id);
  const delegate = (tx as unknown as Record<string, unknown>)[lowerFirst(registry.model)] as
    { findUnique: (args: unknown) => Promise<Image | null> } | undefined;
  if (!delegate?.findUnique) throw new ChangeLogError(`No Prisma model "${registry.model}"`);
  return delegate.findUnique({
    where: { id },
    ...(registry.include ? { include: registry.include } : {}),
  });
}

async function run<T>(
  tx: Tx,
  ctx: ChangeCtx,
  ref: EntityRef,
  mutate: (tx: Tx) => Promise<T>,
  opts: ChangeLogOptions<T>,
): Promise<T> {
  const registry = opts.registry ?? getRegistry(ref.type);
  if (ctx.tx && rlsEnabled()) {
    const rows = await tx.$queryRaw<
      { v: string | null }[]
    >`SELECT current_setting('app.sandbox_id', true) AS v`;
    const current = rows[0]?.v;
    // A joined transaction opened by withBypass has no sandbox setting; that is allowed.
    if (current && current !== ctx.sandboxId) {
      throw new ChangeLogError('ctx.sandboxId differs from the sandbox of the joined transaction');
    }
  }
  const now = ctx.now ?? new Date();

  if (ctx.idempotencyKey) {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`${ctx.sandboxId}:${ctx.idempotencyKey}`}))`;
    const prior = await tx.changeGroup.findFirst({
      where: {
        sandboxId: ctx.sandboxId,
        idempotencyKey: ctx.idempotencyKey,
        occurredAt: { gte: new Date(now.getTime() - IDEMPOTENCY_WINDOW_MS) },
      },
      select: { id: true },
    });
    if (prior) {
      if (opts.onDuplicate) return opts.onDuplicate(prior.id);
      throw new DuplicateChangeError(prior.id);
    }
  }

  const before = ref.id ? await loadImage(tx, registry, ref.id, true) : null;
  const result = await mutate(tx);
  const id = ref.id ?? (result as { id?: unknown } | null | undefined)?.id;
  if (typeof id !== 'string' || !id) {
    throw new ChangeLogError('withChangeLog needs ref.id or a mutation that returns { id }');
  }
  const after = await loadImage(tx, registry, id, false);

  let saveKind: SaveKind;
  let entries: EntryDraft[];
  if (!before && after) {
    saveKind = 'CREATE';
    entries = createEntries(registry, after, ctx.fmt);
  } else if (before && !after) {
    saveKind = 'DELETE';
    entries = deleteEntries(registry, before);
  } else if (before && after) {
    saveKind = 'UPDATE';
    entries = diffImages(registry, before, after, ctx.fmt);
  } else {
    return result; // nothing existed before or after
  }
  if (entries.length === 0) return result; // a save with no real change leaves no trace (AC-05-2)

  const snapshot = (after ?? before) as Image;
  const name = ref.name ?? (typeof snapshot.name === 'string' ? snapshot.name : null);
  const publicIdRaw =
    ref.publicId ?? (snapshot.publicId as bigint | number | null | undefined) ?? null;
  const publicId = publicIdRaw === null ? null : BigInt(publicIdRaw);
  const summary = opts.summary ?? summarise({ kind: saveKind, entries, noun: registry.noun });
  const actor = ctx.actor;

  const base = {
    sandboxId: ctx.sandboxId,
    classroomId: ctx.classroomId,
    advertiserId: ref.chain.advertiserId ?? null,
    campaignId: ref.chain.campaignId ?? null,
    ioId: ref.chain.ioId ?? null,
    lineItemId: ref.chain.lineItemId ?? null,
    entityType: ref.type,
    entityId: id,
    entityPublicId: publicId,
    entityName: name,
    summary,
    note: ctx.note ?? null,
    bulkJobId: ctx.bulkJobId ?? null,
    schemaVersion: registry.version,
    occurredAt: now,
  } satisfies Partial<Prisma.ChangeGroupUncheckedCreateInput>;

  const group = await tx.changeGroup.create({
    data: {
      ...base,
      actorType: actor.type,
      userId: actor.type === 'USER' ? actor.userId : null,
      actorLabel: actorLabel(actor) ?? null,
      systemActor: actor.type === 'SYSTEM' ? actor.systemActor : null,
      source: ctx.source ?? 'UI',
      isHidden: isHiddenActor(actor),
      idempotencyKey: ctx.idempotencyKey ?? null,
    },
    select: { id: true },
  });
  const entryRows = (groupId: string) =>
    entries.map((e) => ({
      groupId,
      sandboxId: ctx.sandboxId,
      kind: e.kind,
      fieldPath: e.fieldPath,
      label: e.label,
      oldValue: e.oldValue,
      newValue: e.newValue,
      parentPath: e.parentPath,
      sortOrder: e.sortOrder,
    }));
  await tx.changeEntry.createMany({ data: entryRows(group.id) });

  for (const advertiserId of opts.fanOut?.advertiserIds ?? []) {
    const fan = await tx.changeGroup.create({
      data: {
        ...base,
        advertiserId,
        campaignId: null,
        ioId: null,
        lineItemId: null,
        actorType: 'SYSTEM',
        userId: null,
        actorLabel: actorLabel({ type: 'SYSTEM', systemActor: 'PARTNER_SETTING_UPDATER' }),
        systemActor: 'PARTNER_SETTING_UPDATER',
        source: 'PARTNER_FANOUT',
        fanOutFromGroupId: group.id,
        isHidden: false,
      },
      select: { id: true },
    });
    await tx.changeEntry.createMany({ data: entryRows(fan.id) });
  }
  return result;
}

/**
 * Run `mutate` and log what it changed. Returns whatever `mutate` returns.
 * Creates, updates, status changes and deletes are told apart by the before and after image.
 */
export async function withChangeLog<T>(
  ctx: ChangeCtx,
  ref: EntityRef,
  mutate: (tx: Tx) => Promise<T>,
  opts: ChangeLogOptions<T> = {},
): Promise<T> {
  if (ctx.tx) return run(ctx.tx, ctx, ref, mutate, opts);
  if (ctx.bypass) return withBypass((tx) => run(tx, ctx, ref, mutate, opts));
  return withSandbox(ctx.sandboxId, (tx) => run(tx, ctx, ref, mutate, opts));
}
