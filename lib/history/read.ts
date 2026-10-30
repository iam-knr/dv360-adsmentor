import 'server-only';
// Readers of the change log (module 05 4.2, 4.8): the History page of an advertiser, campaign, insertion order or line
// item, and its CSV. Every group stores the full parent chain, so one chain-id query returns all descendants (C-05-2).
import type { Prisma } from '@prisma/client';
import type { SessionUser } from '@/lib/auth/types';
import { historyWhere } from '@/lib/changelog/query';
import { ServiceFailure, type ServiceCtx } from '@/lib/campaigns/service-kit';
import type { Tx } from '@/lib/db';
import {
  addDaysIso,
  DateRangeParamError,
  parseDateRangeParam,
  simDateIn,
} from '@/lib/metrics/date-range';
import { buildCsv, HIS_020, MAX_DOWNLOAD_ROWS } from './csv';
import { canWriteNotes, loadEntity, readCtx, type EntityScope } from './guard';
import { actorText, entityNoun, entryLines, registryOrNull } from './lines';
import type {
  HistoryChange,
  HistoryDay,
  HistoryPageData,
  HistoryQuery,
  SpendPoint,
} from './types';
import {
  dayIn,
  endOfDayIn,
  formatZoneLabel,
  isKnownZone,
  startOfDayIn,
  timeIn,
  weekdayOf,
} from './zone';

export const DEFAULT_RANGE = '90D_TODAY';
/** Days returned per page; the rest load with "Load more" (module 05 2.1, Q5). */
export const DAYS_PER_PAGE = 30;
/** Range limit: 2 years (module 05 4.2). */
const MAX_RANGE_DAYS = 731;
/** More bars than this are grouped by week (module 05 2.2). */
const MAX_BARS = 120;

const bad = (path: string, code: string, message: string) =>
  new ServiceFailure('INVALID', [{ path, severity: 'error', code, message }]);

interface Resolved {
  entity: EntityScope;
  advertiser: { timeZone: string; currencyCode: string };
  zone: string;
  zoneIsAdvertiser: boolean;
  today: string;
  range: { from: string; to: string };
}

async function resolve(tx: Tx, ctx: ServiceCtx, q: HistoryQuery): Promise<Resolved> {
  const entity = await loadEntity(tx, q.entityType, q.entityId);
  const advertiser = await tx.advertiser.findFirst({
    where: { id: entity.advertiserId },
    select: { timeZone: true, currencyCode: true },
  });
  if (!advertiser) throw new ServiceFailure('NOT_FOUND');
  const useLocal = q.tz === 'local' && !!q.zone && isKnownZone(q.zone);
  const zone = useLocal ? q.zone! : advertiser.timeZone;
  // Changes are stamped with real time (Q2), so "today" is whichever of the sim clock and the wall clock is later.
  const today = [simDateIn(ctx.simNow, zone), dayIn(zone, new Date())].sort().pop()!;
  let range;
  try {
    range = parseDateRangeParam(q.d || DEFAULT_RANGE, today);
  } catch (e) {
    if (e instanceof DateRangeParamError) throw bad('d', 'HIS_RANGE', '[SIM] Choose a valid date range.');
    throw e;
  }
  if (range.to > today) range = { ...range, to: today };
  const earliest = addDaysIso(today, -(MAX_RANGE_DAYS - 1));
  if (range.from < earliest) range = { ...range, from: earliest };
  if (range.from > range.to) range = { from: range.to, to: range.to };
  return {
    entity,
    advertiser,
    zone,
    zoneIsAdvertiser: zone === advertiser.timeZone,
    today,
    range,
  };
}

function groupWhere(ctx: ServiceCtx, r: Resolved, q: HistoryQuery, to?: string) {
  return historyWhere({
    sandboxId: ctx.sandboxId,
    scope: r.entity.scope,
    from: startOfDayIn(r.zone, r.range.from),
    to: endOfDayIn(r.zone, to ?? r.range.to),
    includeSystem: !!q.includeSystem,
  });
}

async function spendSeries(
  tx: Tx,
  ctx: ServiceCtx,
  r: Resolved,
): Promise<{ spend: SpendPoint[]; grain: 'Daily' | 'Weekly' }> {
  const items = await tx.lineItem.findMany({ where: r.entity.lineItemWhere, select: { id: true } });
  if (items.length === 0) return { spend: [], grain: 'Daily' };
  const rows = await tx.simDailyMetric.groupBy({
    by: ['simDate'],
    where: {
      sandboxId: ctx.sandboxId,
      lineItemId: { in: items.map((i) => i.id) },
      sliceKind: 'total',
      sliceKey: '',
      simDate: { gte: new Date(`${r.range.from}T00:00:00Z`), lte: new Date(`${r.range.to}T00:00:00Z`) },
    },
    _sum: { revenue: true },
    orderBy: { simDate: 'asc' },
  });
  const days: SpendPoint[] = rows.map((row) => ({
    date: row.simDate.toISOString().slice(0, 10),
    amount: Number(row._sum.revenue ?? 0),
  }));
  if (days.length <= MAX_BARS) return { spend: days, grain: 'Daily' };
  const weeks = new Map<string, number>();
  for (const d of days) {
    const sunday = addDaysIso(d.date, -new Date(`${d.date}T00:00:00Z`).getUTCDay());
    weeks.set(sunday, (weeks.get(sunday) ?? 0) + d.amount);
  }
  return { spend: [...weeks].map(([date, amount]) => ({ date, amount })), grain: 'Weekly' };
}

/** The History page data (module 05 4.2). Pagination is by day: `cursor` is the oldest date already shown. */
export async function getHistory(user: SessionUser, q: HistoryQuery): Promise<HistoryPageData> {
  return readCtx(user, async (tx, ctx) => {
    const r = await resolve(tx, ctx, q);
    const upper = q.cursor && /^\d{4}-\d{2}-\d{2}$/.test(q.cursor) ? addDaysIso(q.cursor, -1) : r.range.to;
    const where = groupWhere(ctx, r, q, upper < r.range.to ? upper : r.range.to);

    // Cheap pass over every group in range to cut day pages; only the first 30 days load entries.
    const stamps = await tx.changeGroup.findMany({
      where,
      select: { id: true, occurredAt: true },
      orderBy: [{ occurredAt: 'desc' }, { id: 'desc' }],
    });
    const byDay = new Map<string, string[]>();
    for (const s of stamps) {
      const day = dayIn(r.zone, s.occurredAt);
      const list = byDay.get(day);
      if (list) list.push(s.id);
      else byDay.set(day, [s.id]);
    }
    const dayKeys = [...byDay.keys()]; // newest first
    const pageDays = dayKeys.slice(0, DAYS_PER_PAGE);
    const nextCursor = dayKeys.length > DAYS_PER_PAGE ? pageDays[pageDays.length - 1] : undefined;
    const ids = pageDays.flatMap((d) => byDay.get(d) ?? []);

    const groups = ids.length
      ? await tx.changeGroup.findMany({
          where: { id: { in: ids } },
          include: { entries: { orderBy: { sortOrder: 'asc' } } },
          orderBy: [{ occurredAt: 'desc' }, { id: 'desc' }],
        })
      : [];

    const notes = pageDays.length
      ? await tx.historyNote.groupBy({
          by: ['noteDate'],
          where: {
            sandboxId: ctx.sandboxId,
            entityType: r.entity.type,
            entityId: r.entity.id,
            noteDate: { gte: new Date(`${pageDays[pageDays.length - 1]}T00:00:00Z`), lte: new Date(`${pageDays[0]}T00:00:00Z`) },
          },
          _count: { _all: true },
        })
      : [];
    const noteCounts = new Map(notes.map((n) => [n.noteDate.toISOString().slice(0, 10), n._count._all]));

    const days: HistoryDay[] = pageDays.map((date) => {
      const mine = groups.filter((g) => dayIn(r.zone, g.occurredAt) === date);
      const types = new Set(mine.map((g) => g.entityType));
      const only = types.size === 1 ? [...types][0]! : null;
      const changes: HistoryChange[] = mine.map((g) => ({
        groupId: g.id,
        time: timeIn(r.zone, g.occurredAt),
        tzLabel: formatZoneLabel(r.zone, g.occurredAt),
        user: actorText(g),
        system: g.actorType === 'SYSTEM',
        summary: g.summary,
        lines: entryLines(registryOrNull(g.entityType), g.entries),
      }));
      return {
        date,
        weekday: weekdayOf(date),
        entityLabel: only ? entityNoun(only) : '',
        count: changes.length,
        notesCount: noteCounts.get(date) ?? 0,
        changes,
      };
    });

    const { spend, grain } = await spendSeries(tx, ctx, r);
    return {
      spend,
      spendGrain: grain,
      days,
      ...(nextCursor ? { nextCursor } : {}),
      currency: r.advertiser.currencyCode,
      timeZone: r.zone,
      advertiserTimeZone: r.advertiser.timeZone,
      range: r.range,
      today: r.today,
      entityName: r.entity.name,
      canAddNotes: canWriteNotes(user),
    };
  });
}

/** CSV of the filtered log, one row per entry (module 05 4.8). Returns the file text. */
export async function getHistoryCsv(user: SessionUser, q: HistoryQuery): Promise<string> {
  return readCtx(user, async (tx, ctx) => {
    const r = await resolve(tx, ctx, q);
    const where: Prisma.ChangeGroupWhereInput = groupWhere(ctx, r, q);
    const rowCount = await tx.changeEntry.count({ where: { group: where } });
    if (rowCount > MAX_DOWNLOAD_ROWS) throw bad('d', 'HIS-020', HIS_020);
    const groups = await tx.changeGroup.findMany({
      where,
      include: { entries: { orderBy: { sortOrder: 'asc' } } },
      orderBy: [{ occurredAt: 'desc' }, { id: 'desc' }],
    });
    const rows: (string | null)[][] = [];
    for (const g of groups) {
      const zoneLabel = formatZoneLabel(r.zone, g.occurredAt);
      const when = `${dayIn(r.zone, g.occurredAt)} ${timeIn(r.zone, g.occurredAt)}`;
      for (const e of g.entries) {
        rows.push([
          when,
          zoneLabel,
          entityNoun(g.entityType),
          g.entityPublicId?.toString() ?? g.entityId,
          g.entityName,
          actorText(g),
          g.source,
          e.parentPath ? `${e.parentPath}: ${e.label}` : e.label,
          e.oldValue,
          e.newValue,
          g.note,
        ]);
      }
    }
    return buildCsv(rows);
  });
}
