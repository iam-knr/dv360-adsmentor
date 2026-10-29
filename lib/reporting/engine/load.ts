// Database reads of the query engine (module 16 4.3 step 4). The line item set is mapped from the partner tree, the
// metric rows are read with one statement per table, keyed by (lineItemId, simDate, sliceKind, sliceKey) so the unique
// index drives the scan (data-model 7.2 rule 4). Everything runs inside the caller's `withSandbox` transaction.
import { Prisma } from '@prisma/client';
import type { Tx } from '@/lib/db';
import type { HourlyRow, KindRows, RawSlice, Values } from './compute';
import { poolFromSnapshot } from './reach';
import type { ReportPlan } from './plan';

function columnsOfModel(model: string): Set<string> {
  const m = Prisma.dmmf.datamodel.models.find((x) => x.name === model);
  return new Set((m?.fields ?? []).map((f) => f.name));
}

const DAILY_COLUMNS = columnsOfModel('SimDailyMetric');
const HOURLY_COLUMNS = columnsOfModel('SimHourlyMetric');
const SAFE = /^[A-Za-z][A-Za-z0-9]*$/;

function select(cols: string[], allowed: Set<string>): Prisma.Sql {
  const use = cols.filter((c) => allowed.has(c) && SAFE.test(c));
  if (use.length === 0) return Prisma.raw('0::float8 AS "_none"');
  return Prisma.join(
    use.map((c) => Prisma.raw(`m."${c}"::float8 AS "${c}"`)),
    ', ',
  );
}

function valuesOf(row: Record<string, unknown>, cols: string[]): Values {
  const v: Values = {};
  for (const c of cols) {
    const x = row[c];
    if (x !== null && x !== undefined) v[c] = Number(x);
  }
  return v;
}

export async function loadDaily(
  tx: Tx,
  sandboxId: string,
  lineItemIds: string[],
  plan: ReportPlan,
  from: string,
  to: string,
): Promise<Map<string, KindRows>> {
  const out = new Map<string, KindRows>();
  if (lineItemIds.length === 0) return out;
  const kinds = ['total', ...plan.kinds, ...(plan.pair ? [plan.pair] : [])];
  const cols = [...new Set([...plan.columns, ...plan.snapshotColumns, 'impressions'])];
  const rows = await tx.$queryRaw<
    (Record<string, unknown> & { li: string; d: string; kind: string; key: string })[]
  >(
    Prisma.sql`
    SELECT m."lineItemId" AS li, to_char(m."simDate", 'YYYY-MM-DD') AS d, m."sliceKind" AS kind, m."sliceKey" AS key,
      ${select(cols, DAILY_COLUMNS)}
    FROM "SimDailyMetric" m
    WHERE m."sandboxId" = ${sandboxId}
      AND m."lineItemId" = ANY(${lineItemIds}::text[])
      AND m."simDate" BETWEEN ${from}::date AND ${to}::date
      AND m."sliceKind" = ANY(${kinds}::text[])
    ORDER BY m."lineItemId", m."simDate", m."sliceKind", m."sliceKey"`,
  );
  for (const r of rows) {
    let kr = out.get(r.kind);
    if (!kr) {
      kr = new Map();
      out.set(r.kind, kr);
    }
    const k = `${r.li}|${r.d}`;
    const list: RawSlice[] = kr.get(k) ?? [];
    list.push({ sliceKey: r.key, v: valuesOf(r, cols) });
    kr.set(k, list);
  }
  return out;
}

export async function loadHourly(
  tx: Tx,
  sandboxId: string,
  lineItemIds: string[],
  plan: ReportPlan,
  from: string,
  to: string,
): Promise<HourlyRow[]> {
  if (lineItemIds.length === 0) return [];
  const cols = [...new Set([...plan.columns, ...plan.snapshotColumns])];
  const rows = await tx.$queryRaw<(Record<string, unknown> & { li: string; t: Date })[]>(Prisma.sql`
    SELECT m."lineItemId" AS li, m."simHour" AS t, ${select(cols, HOURLY_COLUMNS)}
    FROM "SimHourlyMetric" m
    WHERE m."sandboxId" = ${sandboxId}
      AND m."lineItemId" = ANY(${lineItemIds}::text[])
      AND m."adGroupId" IS NULL
      AND m."simHour" >= (${from}::date - 1)::timestamp
      AND m."simHour" < (${to}::date + 2)::timestamp
    ORDER BY m."lineItemId", m."simHour"`);
  return rows.map((r) => ({
    lineItemId: r.li,
    hourStartMs: new Date(r.t).getTime(),
    v: valuesOf(r, cols),
  }));
}

/** Pools of the reach formula from the latest lifetime snapshot of each line item, and lifetime impressions. */
export async function loadReach(
  tx: Tx,
  sandboxId: string,
  lineItemIds: string[],
  to: string,
): Promise<{ pools: Map<string, number>; lifetime: Map<string, number> }> {
  const pools = new Map<string, number>();
  const lifetime = new Map<string, number>();
  if (lineItemIds.length === 0) return { pools, lifetime };
  const life = await tx.$queryRaw<{ li: string; impr: number }[]>(Prisma.sql`
    SELECT m."lineItemId" AS li, coalesce(sum(m."impressions"), 0)::float8 AS impr
    FROM "SimDailyMetric" m
    WHERE m."sandboxId" = ${sandboxId} AND m."lineItemId" = ANY(${lineItemIds}::text[])
      AND m."sliceKind" = 'total' AND m."simDate" <= ${to}::date
    GROUP BY m."lineItemId"`);
  for (const r of life) lifetime.set(r.li, Number(r.impr));
  const snaps = await tx.$queryRaw<{ li: string; reach: number; impr: number }[]>(Prisma.sql`
    WITH snap AS (
      SELECT DISTINCT ON ("scopeId") "scopeId" AS li, "simDate" AS d, "impressionReach" AS reach
      FROM "SimReachSnapshot"
      WHERE "sandboxId" = ${sandboxId} AND "scopeType" = 'LINE_ITEM' AND "windowDays" = 0
        AND "scopeId" = ANY(${lineItemIds}::text[]) AND "simDate" <= ${to}::date
      ORDER BY "scopeId", "simDate" DESC
    )
    SELECT s.li, s.reach::float8 AS reach, coalesce(sum(m."impressions"), 0)::float8 AS impr
    FROM snap s
    LEFT JOIN "SimDailyMetric" m
      ON m."lineItemId" = s.li AND m."sliceKind" = 'total' AND m."simDate" <= s.d
    GROUP BY s.li, s.reach`);
  for (const s of snaps) {
    const pool = poolFromSnapshot(Number(s.impr), Number(s.reach));
    if (pool) pools.set(s.li, pool);
  }
  return { pools, lifetime };
}
