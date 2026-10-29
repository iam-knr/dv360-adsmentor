// queryReport: definition to QueryResult (module 16 4.1). The caller supplies the transaction (REPEATABLE READ for
// runs, RC-067) and the viewer's access flags; permission checks live in lib/reporting/service.ts.
import { parseDateRangeParam, simDateIn } from '@/lib/metrics/date-range';
import type { Tx } from '@/lib/db';
import { FIELD_BY_KEY } from '../catalogue';
import type { QueryResult, ReportDefinition, RuleIssue } from '../types';
import { compute } from './compute';
import { loadDaily, loadHourly, loadReach } from './load';
import { plan as makePlan, type StoredKind } from './plan';
import { validateForRun } from './rules';
import { loadWorld, type World } from './world';

export class ReportInvalid extends Error {
  constructor(readonly issues: RuleIssue[]) {
    super(issues[0]?.message ?? 'Invalid report');
    this.name = 'ReportInvalid';
  }
}

export interface QueryOptions {
  limit?: number;
  allowPartnerCost: boolean;
  world?: World;
}

/** Sim "today" in the partner time zone. */
export function todayOf(world: World): string {
  return simDateIn(world.simNow, world.partner.timeZone);
}

export function resolveRange(
  dateRange: string,
  today: string,
): { from: string; to: string } | null {
  try {
    return parseDateRangeParam(dateRange, today);
  } catch {
    return null;
  }
}

export async function runQuery(
  tx: Tx,
  sandboxId: string,
  partnerId: string,
  def: ReportDefinition,
  opts: QueryOptions,
): Promise<QueryResult> {
  const world = opts.world ?? (await loadWorld(tx, sandboxId, partnerId));
  const today = todayOf(world);
  const range = resolveRange(def.dateRange, today);
  const issues = validateForRun(def, {
    today,
    range,
    hourlyRetentionDays: world.hourlyDays,
    allowPartnerCost: opts.allowPartnerCost,
  });
  const blocking = issues.filter((i) => i.severity === 'error');
  if (blocking.length || !range) throw new ReportInvalid(blocking);

  // Slice filters need their kinds in the plan too.
  const filterKinds: StoredKind[] = [];
  for (const f of def.filters) {
    const field = FIELD_BY_KEY.get(f.field);
    const src = field?.source;
    if (src?.t === 'SLICE' && src.kind !== 'date' && src.kind !== 'hour')
      filterKinds.push(src.kind as StoredKind);
    if (src?.t === 'DERIVED') filterKinds.push(src.parent as StoredKind);
  }
  const plan = makePlan(def, [...new Set(filterKinds)]);
  const lineItemIds = [...world.lineItems.keys()];
  const fetchFrom = def.timeZone === 'UTC' ? shift(range.from, -1) : range.from;
  const fetchTo = def.timeZone === 'UTC' ? shift(range.to, 1) : range.to;
  const [daily, hourly, reach] = await Promise.all([
    plan.hourly
      ? Promise.resolve(new Map())
      : loadDaily(tx, sandboxId, lineItemIds, plan, fetchFrom, fetchTo),
    plan.hourly
      ? loadHourly(tx, sandboxId, lineItemIds, plan, fetchFrom, fetchTo)
      : Promise.resolve([]),
    plan.reach
      ? loadReach(tx, sandboxId, lineItemIds, range.to)
      : Promise.resolve({ pools: new Map(), lifetime: new Map() }),
  ]);
  return compute({
    def,
    plan,
    world,
    range,
    today,
    daily,
    hourly,
    reachPools: reach.pools,
    lifetimeImpressions: reach.lifetime,
    ...(opts.limit !== undefined ? { limit: opts.limit } : {}),
  });
}

function shift(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
