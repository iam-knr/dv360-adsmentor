// The one aggregation query per level and request (build-plan P3-09 item 4). Entities above the line item are not
// stored (engine 9.1): the query maps the requested ids to their line items, sums `SimDailyMetric` day totals per line
// item over the range, then per requested id. The join drives the unique index (lineItemId, simDate, sliceKind,
// sliceKey) (data-model 7.2 rule 4). Ad groups read their `adGroup` slice (sliceKey = ad group id).
import { Prisma } from '@prisma/client';
import type { Tx } from '@/lib/db';
import {
  COUNTER_KEYS,
  MONEY_COUNTER_KEYS,
  type Counters,
  type DateRange,
  type MetricLevel,
} from './types';

export interface AggregateRow {
  key: string;
  /** Day rows in the range (0 = no data). */
  days: number;
  counters: Counters;
  /** Revenue from the first day up to `range.to`, for budget remaining. */
  revenueToDate: number;
  /** Last pacing snapshot in the range: LI pacing (LI level) or IO pacing (IO level). */
  liPacingPct: number | null;
  ioPacingPct: number | null;
  /** Sum over the line items of their last daily target in the range. */
  dailyTarget: number | null;
}

const ALL_KEYS = [...COUNTER_KEYS, ...MONEY_COUNTER_KEYS] as const;

const ENTITY_COLUMN: Record<Exclude<MetricLevel, 'adGroup'>, string> = {
  li: 'id',
  io: 'ioId',
  campaign: 'campaignId',
  advertiser: 'advertiserId',
};

// The sandbox filter sits on the entity lookup (RLS_ENABLED=false fallback, build-plan F-4); metric rows follow
// their line item, so the metric scan is keyed by (lineItemId, simDate) only.
function entitiesCte(level: MetricLevel, ids: string[], sandboxId: string): Prisma.Sql {
  if (level === 'adGroup') {
    return Prisma.sql`SELECT ag."id" AS "key", ag."lineItemId", 'adGroup'::text AS "sliceKind", ag."id" AS "sliceKey"
      FROM "AdGroup" ag WHERE ag."sandboxId" = ${sandboxId} AND ag."id" = ANY(${ids}::text[])`;
  }
  const col = Prisma.raw(`"${ENTITY_COLUMN[level]}"`);
  return Prisma.sql`SELECT li.${col} AS "key", li."id" AS "lineItemId", 'total'::text AS "sliceKind", ''::text AS "sliceKey"
    FROM "LineItem" li WHERE li."sandboxId" = ${sandboxId} AND li.${col} = ANY(${ids}::text[])`;
}

/** The SQL, exported for the EXPLAIN test. */
export function aggregateSql(
  level: MetricLevel,
  ids: string[],
  range: DateRange,
  sandboxId: string,
): Prisma.Sql {
  const inRange = Prisma.sql`m."simDate" >= ${range.from}::date`;
  const perLiSums = Prisma.join(
    ALL_KEYS.map(
      (k) =>
        Prisma.sql`sum(m.${Prisma.raw(`"${k}"`)}) FILTER (WHERE ${inRange}) AS ${Prisma.raw(`"${k}"`)}`,
    ),
    ', ',
  );
  const outerSums = Prisma.join(
    ALL_KEYS.map((k) => Prisma.raw(`coalesce(sum(p."${k}"), 0)::float8 AS "${k}"`)),
    ', ',
  );
  const last = (col: string) =>
    Prisma.sql`(array_agg(m.${Prisma.raw(`"${col}"`)} ORDER BY m."simDate" DESC) FILTER (WHERE ${inRange}))[1]`;
  return Prisma.sql`
    WITH ent AS (${entitiesCte(level, ids, sandboxId)}),
    per_li AS (
      SELECT e."key", m."lineItemId",
        count(*) FILTER (WHERE ${inRange}) AS "days",
        ${perLiSums},
        sum(m."revenue") AS "revenueToDate",
        ${last('liPacingPct')} AS "liPacingPct",
        ${last('ioPacingPct')} AS "ioPacingPct",
        ${last('dailyTarget')} AS "dailyTarget"
      FROM ent e
      JOIN "SimDailyMetric" m
        ON m."lineItemId" = e."lineItemId" AND m."sliceKind" = e."sliceKind" AND m."sliceKey" = e."sliceKey"
      WHERE m."simDate" <= ${range.to}::date
      GROUP BY e."key", m."lineItemId"
    )
    SELECT p."key", coalesce(sum(p."days"), 0)::int AS "days", ${outerSums},
      coalesce(sum(p."revenueToDate"), 0)::float8 AS "revenueToDate",
      max(p."liPacingPct")::float8 AS "liPacingPct",
      max(p."ioPacingPct")::float8 AS "ioPacingPct",
      sum(p."dailyTarget")::float8 AS "dailyTarget"
    FROM per_li p
    GROUP BY p."key"`;
}

type RawRow = Record<string, unknown> & { key: string; days: number };

const num = (v: unknown): number => (v === null || v === undefined ? 0 : Number(v));
const numOrNull = (v: unknown): number | null => (v === null || v === undefined ? null : Number(v));

export async function aggregate(
  tx: Tx,
  level: MetricLevel,
  ids: string[],
  range: DateRange,
  sandboxId: string,
): Promise<Map<string, AggregateRow>> {
  const out = new Map<string, AggregateRow>();
  if (ids.length === 0) return out;
  const rows = await tx.$queryRaw<RawRow[]>(aggregateSql(level, ids, range, sandboxId));
  for (const r of rows) {
    const counters = Object.fromEntries(ALL_KEYS.map((k) => [k, num(r[k])])) as Counters;
    out.set(r.key, {
      key: r.key,
      days: num(r.days),
      counters,
      revenueToDate: num(r.revenueToDate),
      liPacingPct: numOrNull(r.liPacingPct),
      ioPacingPct: numOrNull(r.ioPacingPct),
      dailyTarget: numOrNull(r.dailyTarget),
    });
  }
  return out;
}

/** Revenue per day (chart cards): one query, summed over the ids' line items. */
export async function dailySeries(
  tx: Tx,
  level: MetricLevel,
  ids: string[],
  range: DateRange,
  sandboxId: string,
): Promise<Map<string, Counters>> {
  const out = new Map<string, Counters>();
  if (ids.length === 0) return out;
  const sums = Prisma.join(
    ALL_KEYS.map((k) => Prisma.raw(`coalesce(sum(m."${k}"), 0)::float8 AS "${k}"`)),
    ', ',
  );
  const rows = await tx.$queryRaw<(Record<string, unknown> & { day: string })[]>(Prisma.sql`
    WITH ent AS (${entitiesCte(level, ids, sandboxId)})
    SELECT to_char(m."simDate", 'YYYY-MM-DD') AS "day", ${sums}
    FROM ent e
    JOIN "SimDailyMetric" m
      ON m."lineItemId" = e."lineItemId" AND m."sliceKind" = e."sliceKind" AND m."sliceKey" = e."sliceKey"
    WHERE m."simDate" BETWEEN ${range.from}::date AND ${range.to}::date
    GROUP BY m."simDate"`);
  for (const r of rows) {
    out.set(r.day, Object.fromEntries(ALL_KEYS.map((k) => [k, num(r[k])])) as Counters);
  }
  return out;
}
