// runTick: the pure part of one engine tick (engine.md 11.5). It reads a World, the engine state
// and the parameters and returns what to persist plus the next state. It never touches the clock,
// the database or the global random generator. Entities are processed sorted by id (1.3).

import { tickToLocal, MS_HOUR, isoToDay } from './calendar';
import { runAuction, type AuctionResult, type OwnEntry } from './auction';
import {
  autoAllocateWeights,
  automatedWeights,
  advanceLearning,
  learningSpendCap,
  planBids,
  signatureOf,
  strategyFor,
  STRATEGIES,
  type BidPlan,
  type Strategy,
} from './bidding';
import { computeCellMoney, ZERO_MONEY, type CellMoney } from './costs';
import { cellMetrics, buildSlices, type CellRow } from './aggregation';
import {
  consumptionLinear,
  fxToCurrency,
  resolveFees,
  type ConsumptionLinear,
  type FeeSchedule,
} from './economics';
import {
  evaluateAlerts,
  conflictsForIo,
  conflictsForLi,
  lifecycleStatus,
  liveStatusFromFunnel,
  reconcileAlerts,
  reconcileSuggestions,
  recordFunnel,
  suggestionsFor,
  type ActiveAlert,
  type FunnelRow,
  type IoAlertFacts,
  type LiAlertFacts,
  type LiveStatus,
  type RecommendationType,
} from './diagnostics';
import { runFunnel, type LiElig } from './eligibility/funnel';
import {
  applyWins,
  lifetimeReached,
  newFreqState,
  newUserShare,
  refreshFreqState,
  type FreqState,
} from './eligibility/frequency';
import { approvalOn } from './eligibility/creatives';
import { addMetrics, emptyMetrics, METRIC_INDEX, type Metrics } from './metrics';
import {
  emptyOutput,
  type DailyRow,
  type HourlyRow,
  type PacingRow,
  type ReachRow,
  type TickOutput,
} from './output';
import {
  creditSplit,
  countConversion,
  incrementalityClass,
  postViewWeight,
  scheduleLags,
  simulateOutcomes,
  windowHours,
  type AssistCandidate,
  type LiOutcomes,
} from './outcomes';
import { activeSegment, daysBetween, remainingDays } from './pacing/budgetState';
import { waterFill } from './pacing/allocation';
import {
  dailyTarget,
  evaluateUnderpacing,
  hourlyAllowance,
  pacingKind,
  type PacingKind,
} from './pacing/targets';
import { throttle, type CapEntry, type ThrottleResult } from './pacing/throttle';
import type { LoadedParams } from './params/load';
import { rng } from './rng/streams';
import { supplyCells } from './supply/cells';
import { cloneState, type LiState, type SimStateData } from './state';
import {
  dayRecord,
  ensureIoState,
  ensureLiState,
  kpiActual,
  sumDays,
  worseThanGoal,
} from './tickSupport';
import { formatsForType } from './types';
import {
  indexWorld,
  type BudgetSegment,
  type IoEntity,
  type LineItemEntity,
  type World,
  type WorldIndex,
} from './world';

export interface RunTickResult {
  output: TickOutput;
  state: SimStateData;
}

interface IoRun {
  io: IoEntity;
  seg: BudgetSegment;
  kind: PacingKind;
  target: number;
  /** Hourly allowance of the whole insertion order (may be Infinity). */
  allowance: number;
  segRemaining: number;
  dailyRemaining: number;
  weights: Record<string, number>;
  liveLis: LineItemEntity[];
}

interface LiRun {
  li: LineItemEntity;
  io: IoEntity;
  ioRun: IoRun;
  elig: LiElig;
  fees: FeeSchedule;
  cons: ConsumptionLinear;
  strategy: Strategy;
  plan: BidPlan;
  thr: ThrottleResult;
  ownShare: {
    pace: number;
    seg: number;
    daily: number;
    liPace: number;
    liBudget: number;
    liDaily: number;
  };
  auction?: AuctionResult;
  outcomes?: LiOutcomes;
  cellRows: CellRow[];
  funnel: FunnelRow[];
}

const MICROS = 1_000_000;

export interface RunTickOptions {
  /** Daily slice kinds to produce instead of `params.aggregation.dailySliceKinds` (fast-forward history mode). */
  sliceKinds?: readonly string[];
}

export function runTick(
  world: World,
  state: SimStateData,
  loaded: LoadedParams,
  tick: number,
  opts: RunTickOptions = {},
): RunTickResult {
  const params = loaded.params;
  const idx = indexWorld(world);
  const adv = world.advertiser;
  const advLocal = tickToLocal(world.simStartMs, adv.tzOffsetMin, tick);
  const date = advLocal.date;
  const hourStartMs = world.simStartMs + tick * MS_HOUR;

  if (tick < state.nextTick)
    return { output: emptyOutput(tick, false, hourStartMs, date, advLocal.hour), state };
  if (tick > state.nextTick)
    throw new Error(`Ticks must be applied in order: expected ${state.nextTick}, got ${tick}`);

  const next = cloneState(state);
  const out = emptyOutput(tick, true, hourStartMs, date, advLocal.hour);
  const fxAdv = fxToCurrency(params, adv.currency);
  const market = params.markets[world.country];
  if (!market) throw new Error(`Unknown market ${world.country}`);
  const localTick = advLocal.dayIndex * 24 + advLocal.hour;
  const hoursLeft = 24 - advLocal.hour;
  const mctx = {
    country: world.country,
    marketSeed: world.marketSeed,
    simStartMs: world.simStartMs,
    tzOffsetMin: world.tzOffsetMin,
  };

  // windows roll at their local boundaries (3.9)
  for (const key of Object.keys(next.freq).sort()) {
    const s = next.freq[key] as FreqState;
    const wid = Math.floor(localTick / s.windowTicks);
    if (wid !== s.windowId) {
      const h = new Array<number>(s.cap + 1).fill(0);
      h[0] = s.U;
      next.freq[key] = { ...s, windowId: wid, h };
    }
  }

  // ---- lifecycle: who is live ------------------------------------------------------------
  const status = new Map<string, LiveStatus | null>();
  for (const li of idx.sortedLis) {
    ensureLiState(next, li.id, date, tick, params);
    const io = idx.ios.get(li.ioId);
    status.set(
      li.id,
      lifecycleStatus(li, io, io ? idx.campaigns.get(io.campaignId) : undefined, date),
    );
  }
  const ioRuns = new Map<string, IoRun>();
  for (const io of idx.sortedIos) {
    const { s: ios, rolled } = ensureIoState(next, io.id, date, tick);
    const liveLis = idx.sortedLis.filter((l) => l.ioId === io.id && status.get(l.id) === null);
    if (rolled && io.autoBudgetAllocation && io.bidBudgetControl === 'LI_CONTROLLED') {
      const ids = idx.sortedLis
        .filter((l) => l.ioId === io.id && l.status === 'ACTIVE')
        .map((l) => l.id);
      if (ids.length > 0) ios.weights = autoAllocateWeights(ios.weights, ids, ios.eff, params);
    }
    if (liveLis.length === 0) continue;
    const seg = activeSegment(io.segments, date) as BudgetSegment;
    const kind = pacingKind(io.pacing.period, io.pacing.type);
    const segSpent = ios.segSpent[seg.id] ?? 0;
    const R = Math.max(0, seg.amount - (segSpent - ios.spentToday));
    const D = remainingDays(date, seg.endDay);
    const T = dailyTarget(kind, R, D, io.pacing.dailyAmount, params);
    let weights: Record<string, number>;
    if (io.bidBudgetControl === 'IO_AUTOMATED') {
      weights = automatedWeights(
        liveLis.map((l) => l.id),
        ios.eff,
        params,
      );
    } else {
      weights = {};
      let sum = 0;
      for (const l of liveLis) {
        weights[l.id] = ios.weights[l.id] ?? 1;
        sum += weights[l.id] as number;
      }
      for (const l of liveLis) weights[l.id] = (weights[l.id] as number) / sum;
    }
    ioRuns.set(io.id, {
      io,
      seg,
      kind,
      target: T,
      allowance: hourlyAllowance(kind, T, ios.spentToday, hoursLeft),
      segRemaining: Math.max(0, seg.amount - segSpent),
      dailyRemaining:
        io.pacing.period === 'DAILY' && io.pacing.dailyAmount
          ? Math.max(0, io.pacing.dailyAmount - ios.spentToday)
          : Infinity,
      weights,
      liveLis,
    });
  }

  // ---- pass 1: eligibility, bids, throttle -----------------------------------------------
  const runs: LiRun[] = [];
  for (const ioRun of [...ioRuns.values()].sort((a, b) => (a.io.id < b.io.id ? -1 : 1))) {
    const { io } = ioRun;
    const campaign = idx.campaigns.get(io.campaignId);
    const ioPart: LiRun[] = [];
    for (const li of ioRun.liveLis) {
      const ls = next.li[li.id] as LiState;
      const cells = supplyCells(
        mctx,
        params,
        loaded.hash,
        tick,
        formatsForType(li.type),
        world.partner.enabledExchanges,
      );
      const elig = runFunnel({
        li,
        io,
        campaign,
        advertiser: adv,
        index: idx,
        params,
        tick,
        advLocal,
        cells: cells.filter((c) => c.requests > 0),
        freq: next.freq,
        reach: next.reach[li.id],
        liveTicks: ls.liveTicks,
        poolScale: market.volumeIdx,
      });
      const fees = resolveFees({
        li,
        io,
        params,
        currency: adv.currency,
        audiences: idx.audiences,
        creatives: idx.creatives,
      });
      const cons = consumptionLinear(io.budgetUnit, fees);
      const goal =
        io.bidBudgetControl === 'IO_AUTOMATED'
          ? (io.optimizeTarget ?? 'MAX_VIEWABLE_IMPRESSIONS')
          : li.bid.goal;
      const strategy =
        io.bidBudgetControl === 'IO_AUTOMATED'
          ? STRATEGIES[goal ?? 'MAX_VIEWABLE_IMPRESSIONS']
          : strategyFor(goal, li.bid.kind === 'FIXED');

      // caps of this line item (7.2)
      const liSeg = ioRun.seg;
      const kindLi: PacingKind =
        io.bidBudgetControl === 'IO_AUTOMATED'
          ? 'FLIGHT_ASAP'
          : pacingKind(li.pacing.period, li.pacing.type);
      const ownPaced =
        li.budget.mode === 'FIXED' || li.pacing.period === 'DAILY' || li.flight !== undefined;
      const fixedLeft =
        li.budget.mode === 'FIXED'
          ? Math.max(0, (li.budget.amount ?? 0) - (ls.spentFlight - ls.spendToday))
          : Infinity;
      const Rli =
        li.budget.mode === 'FIXED'
          ? fixedLeft
          : Math.max(
              0,
              liSeg.amount -
                ((next.io[io.id]?.segSpent[liSeg.id] ?? 0) - (next.io[io.id]?.spentToday ?? 0)),
            );
      const flightEnd = li.flight?.end ?? liSeg.endDay;
      const Tli = ownPaced
        ? dailyTarget(kindLi, Rli, remainingDays(date, flightEnd), li.pacing.dailyAmount, params)
        : Infinity;
      const liPace = ownPaced ? hourlyAllowance(kindLi, Tli, ls.spendToday, hoursLeft) : Infinity;
      const liBudget =
        li.budget.mode === 'FIXED'
          ? Math.max(0, (li.budget.amount ?? 0) - ls.spentFlight)
          : Infinity;
      const liDaily =
        li.pacing.period === 'DAILY' && li.pacing.dailyAmount
          ? Math.max(0, li.pacing.dailyAmount - ls.spendToday)
          : Infinity;

      ioPart.push({
        li,
        io,
        ioRun,
        elig,
        fees,
        cons,
        strategy,
        plan: undefined as unknown as BidPlan,
        thr: undefined as unknown as ThrottleResult,
        ownShare: { pace: 0, seg: 0, daily: 0, liPace, liBudget, liDaily },
        cellRows: [],
        funnel: [],
      });
    }
    // allocate the insertion order's allowance and remaining budget across line items (7.5)
    const ids = ioPart.map((r) => r.li.id);
    const weights = ids.map((id) => ioRun.weights[id] ?? 1 / ids.length);
    const caps = ioPart.map((r) => {
      const c = (next.li[r.li.id] as LiState).lastCapacity;
      return c >= 0 ? c * params.pacing.allocationHeadroom : Infinity;
    });
    const paceShare = waterFill(ioRun.allowance, weights, caps);
    const segShare = waterFill(
      ioRun.segRemaining,
      weights,
      caps.map(() => Infinity),
    );
    const dailyShare = waterFill(
      ioRun.dailyRemaining,
      weights,
      caps.map(() => Infinity),
    );
    const allocCode =
      io.bidBudgetControl === 'IO_AUTOMATED' || io.autoBudgetAllocation
        ? 'P.IO_ALLOCATION'
        : 'P.IO_PACING';
    ioPart.forEach((r, i) => {
      r.ownShare.pace = paceShare[i] as number;
      r.ownShare.seg = segShare[i] as number;
      r.ownShare.daily = dailyShare[i] as number;
      const ls = next.li[r.li.id] as LiState;
      const learnCap =
        r.strategy.kind === 'fixed' ? 1 : learningSpendCap(ls.learning, tick, params);
      const budgetCaps: CapEntry[] = [
        { amount: r.ownShare.liBudget, code: 'B.LINE_ITEM_BUDGET' },
        { amount: r.ownShare.seg, code: 'B.IO_SEGMENT' },
        { amount: r.ownShare.liDaily, code: 'B.LINE_ITEM_DAILY' },
        { amount: r.ownShare.daily, code: 'B.IO_DAILY' },
      ];
      const paceCaps: CapEntry[] = [
        { amount: r.ownShare.liPace * learnCap, code: 'P.LINE_ITEM_PACING' },
        { amount: r.ownShare.pace * learnCap, code: allocCode },
      ];
      const budgetMin = Math.min(...budgetCaps.map((c) => c.amount));
      const paceMin = Math.min(...paceCaps.map((c) => c.amount));
      const activities = activitiesOf(r.li, idx);
      r.plan = planBids({
        li: r.li,
        strategy: r.strategy,
        elig: r.elig,
        params,
        tick,
        sandboxSeed: world.sandboxSeed,
        fees: r.fees,
        cons: r.cons,
        fxToAdv: fxAdv,
        activities,
        learning: ls.learning,
        prevLambda: ls.lambda > 0 ? ls.lambda : undefined,
        allowance: Math.min(paceMin, budgetMin),
        reach: next.reach[r.li.id],
      });
      r.thr = throttle({
        sFull: r.plan.sFull,
        budgetCaps,
        paceCaps,
        overshootMax: params.pacing.overshootMax,
      });
    });
    runs.push(...ioPart);
  }

  // ---- pass 2: auction ---------------------------------------------------------------------
  const own = new Map<string, OwnEntry[]>();
  for (const r of runs) {
    r.elig.cells.forEach((ec, i) => {
      const bid = r.plan.bids[i] ?? 0;
      if (ec.nSurv <= 0 || bid <= 0 || ec.nA <= 0) return;
      let list = own.get(ec.cell.id);
      if (!list) {
        list = [];
        own.set(ec.cell.id, list);
      }
      list.push({ liId: r.li.id, bid, bidRate: (ec.nSurv * r.thr.r) / ec.nA });
    });
  }
  for (const r of runs) {
    const capIsBudget = r.thr.budgetRemaining <= params.pacing.overshootMax * r.thr.allowance;
    r.auction = runAuction({
      liId: r.li.id,
      elig: r.elig,
      plan: r.plan,
      throttle: {
        rBudget: r.thr.rBudget,
        r: r.thr.r,
        budgetCode: r.thr.budgetCode,
        paceCode: r.thr.paceCode,
        spendCap: r.thr.spendCap,
        capIsBudget,
      },
      cons: r.cons,
      fxToAdv: fxAdv,
      params,
      tick,
      sandboxSeed: world.sandboxSeed,
      own,
    });
    const activities = activitiesOf(r.li, idx);
    r.outcomes = simulateOutcomes({
      liId: r.li.id,
      auction: r.auction,
      rate: r.elig.rate,
      activities,
      params,
      tick,
      sandboxSeed: world.sandboxSeed,
    });
  }

  // ---- conversions: release what is due, schedule what was generated ---------------------
  const convBook = new Map<
    string,
    { total: Partial<Metrics>; byActivity: Map<string, Partial<Metrics>> }
  >();
  releaseConversions(next, world, idx, params, fxAdv, tick, convBook);
  for (const r of runs) {
    for (const rc of (r.outcomes as LiOutcomes).rawConversions) {
      const act = idx.activities.get(rc.activityId);
      if (!act) continue;
      const hours = windowHours(r.li, rc.activityId, rc.kind, params);
      const lags = scheduleLags(
        rng(world.sandboxSeed, 'lag', tick, r.li.id, rc.activityId, rc.kind),
        rc.count,
        rc.kind,
        hours,
        params,
      );
      for (const l of lags) {
        mergePending(next, {
          liId: r.li.id,
          activityId: rc.activityId,
          kind: rc.kind,
          dueTick: tick + l.dueOffset,
          adEventTick: tick,
          count: l.n,
        });
      }
    }
  }

  // ---- money, metrics, state ---------------------------------------------------------------
  const wins = new Map<string, number>();
  const reachInfo = new Map<string, number>();
  for (const r of runs) {
    const outc = r.outcomes as LiOutcomes;
    const coByCell = new Map(outc.cells.map((c) => [c.ca.elc, c]));
    const caByCell = new Map((r.auction as AuctionResult).cells.map((c) => [c.elc, c]));
    let sumRevenue = 0;
    let billable = 0;
    let W = 0;
    const moneyOf = new Map<unknown, CellMoney>();
    for (const ec of r.elig.cells) {
      const co = coByCell.get(ec);
      const money = co ? computeCellMoney(co, r.fees, fxAdv, params) : ZERO_MONEY;
      if (co) moneyOf.set(ec, money);
      const m = cellMetrics(ec, caByCell.get(ec), co, co ? money : undefined);
      r.cellRows.push({ elc: ec, metrics: m });
      sumRevenue += money.revenue;
      billable += m[METRIC_INDEX.billableImpressions] as number;
      W += m[METRIC_INDEX.impressions] as number;
    }
    wins.set(r.li.id, W);
    const consumed = r.io.budgetUnit === 'IMPRESSIONS' ? billable : sumRevenue / MICROS;
    const ls = next.li[r.li.id] as LiState;
    const ios = next.io[r.io.id] as NonNullable<SimStateData['io'][string]>;
    ls.spendToday += consumed;
    ls.spentFlight += consumed;
    ios.spentToday += consumed;
    ios.segSpent[r.ioRun.seg.id] = (ios.segSpent[r.ioRun.seg.id] ?? 0) + consumed;
    ls.liveTicks += 1;
    ls.liveTicksToday += 1;
    ls.lastCapacity = r.plan.sFull;
    ls.lastR = r.thr.r;
    ls.winsLast = ls.winsLast * 0.994 + W;
    if (r.strategy.kind !== 'fixed') ls.lambda = r.plan.lambda;

    // learning (4.3)
    let eventsDelta = 0;
    const pnew = newUserShare(next.reach[r.li.id]);
    for (const c of outc.cells) {
      switch (r.strategy.event) {
        case 'clicks':
          eventsDelta += c.clicks.clicks;
          break;
        case 'viewable_impressions':
          eventsDelta += c.imp.viewable;
          break;
        case 'completed_views':
          eventsDelta += c.video.views;
          break;
        case 'reach_impressions':
          eventsDelta += c.ca.W * pnew;
          break;
        default:
          break;
      }
    }
    if (r.strategy.event === 'conversions')
      for (const rc of outc.rawConversions) eventsDelta += rc.count;
    if (r.strategy.kind !== 'fixed') {
      ls.learning = advanceLearning(
        ls.learning,
        signatureOf(r.li, r.io),
        eventsDelta,
        r.strategy.event,
        r.li.optimizedTargeting,
        tick,
        params,
        world.sandboxSeed,
        r.li.id,
      );
      const e = ios.eff[r.li.id] ?? { events: 0, spend: 0 };
      ios.eff[r.li.id] = { events: e.events + eventsDelta, spend: e.spend + consumed };
    }

    // day record for KPIs
    const day = dayRecord(ls, date);
    day.spend += sumRevenue / MICROS;
    for (const row of r.cellRows) {
      day.impressions += row.metrics[METRIC_INDEX.billableImpressions] as number;
      day.clicks += row.metrics[METRIC_INDEX.clicks] as number;
      day.viewable += row.metrics[METRIC_INDEX.viewableImpressions] as number;
      day.measurable += row.metrics[METRIC_INDEX.measurableImpressions] as number;
      day.views += row.metrics[METRIC_INDEX.videoViews] as number;
    }
    reachInfo.set(r.li.id, r.elig.pool);
  }

  // frequency and reach state (3.9)
  const byScope = new Map<
    string,
    {
      scope: { kind: 'LI' | 'IO' | 'CAMPAIGN'; key: string; cap: number; windowTicks: number };
      wins: number;
      pools: number[];
    }
  >();
  for (const r of runs) {
    for (const s of r.elig.scopes) {
      const e = byScope.get(s.key) ?? { scope: s, wins: 0, pools: [] };
      e.wins += wins.get(r.li.id) ?? 0;
      e.pools.push(r.elig.pool);
      byScope.set(s.key, e);
    }
    const W = wins.get(r.li.id) ?? 0;
    // the reach state keeps a daily exposure histogram (CTR decay) and a lifetime one (reach)
    const reachScope = { kind: 'LI' as const, key: `REACH:${r.li.id}`, cap: 10, windowTicks: 24 };
    let rs = next.reach[r.li.id];
    rs = rs
      ? refreshFreqState(rs, reachScope, r.elig.pool, localTick)
      : newFreqState(reachScope, r.elig.pool, localTick);
    next.reach[r.li.id] = applyWins(rs, W);
  }
  for (const key of [...byScope.keys()].sort()) {
    const e = byScope.get(key) as NonNullable<ReturnType<typeof byScope.get>>;
    const U = e.scope.kind === 'LI' ? (e.pools[0] as number) : 1.15 * Math.max(...e.pools);
    const cur = next.freq[key];
    const fresh = cur
      ? refreshFreqState(cur, e.scope, U, localTick)
      : newFreqState(e.scope, U, localTick);
    next.freq[key] = applyWins(fresh, e.wins);
  }

  // ---- aggregation rows -----------------------------------------------------------------------
  const liIdsWithOutput = new Set<string>(runs.map((r) => r.li.id));
  for (const k of convBook.keys()) liIdsWithOutput.add(k);
  // History mode asks for fewer slices on old days; the totals and the state do not depend on them.
  const kinds = opts.sliceKinds ?? params.aggregation.dailySliceKinds;
  for (const id of [...liIdsWithOutput].sort()) {
    const r = runs.find((x) => x.li.id === id);
    const conv = convBook.get(id) ?? { total: {}, byActivity: new Map() };
    const { total, slices } = buildSlices(r?.cellRows ?? [], String(advLocal.hour), kinds, conv);
    if (Object.values(total).some((v) => v !== 0)) {
      out.hourly.push({
        lineItemId: id,
        hourStartMs,
        date,
        hour: advLocal.hour,
        metrics: total,
      } satisfies HourlyRow);
      out.daily.push({
        lineItemId: id,
        date,
        sliceKind: 'total',
        sliceKey: '',
        metrics: total,
      } satisfies DailyRow);
      for (const s of slices)
        out.daily.push({
          lineItemId: id,
          date,
          sliceKind: s.sliceKind,
          sliceKey: s.sliceKey,
          metrics: s.metrics,
        });
    }
    const li = idx.lis.get(id);
    if (li) {
      const ls = next.li[id] as LiState;
      const day = dayRecord(ls, date);
      day.conversions += total.convTotal;
    }
  }

  // ---- diagnostics ---------------------------------------------------------------------------
  for (const r of runs) {
    r.funnel = recordFunnel(r.li.id, date, r.elig, r.auction);
    out.funnel.push(...r.funnel);
    const sum = liveStatusFromFunnel(r.funnel);
    status.set(r.li.id, null);
    (next.li[r.li.id] as LiState).lastStatus = sum.status;
    out.liveStatus.push({ lineItemId: r.li.id, status: sum.status, topLoss: sum.topLoss });
    const ls = next.li[r.li.id] as LiState;
    out.learning.push({
      lineItemId: r.li.id,
      phase: ls.learning.phase,
      quality: ls.learning.q,
      events: ls.learning.events,
    });
  }
  for (const li of idx.sortedLis) {
    const st = status.get(li.id);
    if (st) {
      (next.li[li.id] as LiState).lastStatus = st;
      out.liveStatus.push({ lineItemId: li.id, status: st, topLoss: null });
    }
  }
  out.liveStatus.sort((a, b) => (a.lineItemId < b.lineItemId ? -1 : 1));

  // pacing snapshot, underpacing, alerts
  const ioFacts: IoAlertFacts[] = [];
  const liFacts: LiAlertFacts[] = [];
  const underpacingIo = new Set<string>();
  for (const io of idx.sortedIos) {
    const ios = next.io[io.id];
    const run = ioRuns.get(io.id);
    let underpacing = false;
    let underperforming = false;
    if (run && ios) {
      const seg = run.seg;
      const segSpent = ios.segSpent[seg.id] ?? 0;
      const elapsedDaysSeg = (isoToDay(date) - isoToDay(seg.startDay)) * 24 + advLocal.hour;
      const sinceActive = tick - ios.activatedTick;
      const elapsedDays = Math.min(elapsedDaysSeg, sinceActive) / 24;
      const window = params.pacing.underpacing.rateWindowDays;
      const recent = [
        ...ios.daily.slice(-Math.max(0, Math.ceil(window) - 1)).map((d) => d.spend),
        ios.spentToday,
      ].reduce((a, b) => a + b, 0);
      const up = evaluateUnderpacing(
        {
          segmentBudget: seg.amount,
          spentToDate: segSpent,
          elapsedDays: Math.max(0, elapsedDays),
          remainingDays: remainingDays(date, seg.endDay) - 1,
          segmentDays: daysBetween(seg.startDay, seg.endDay),
          recentSpend: recent,
          thresholdPct:
            adv.alertPrefs.underpacingThresholdPct ?? params.pacing.underpacing.defaultThresholdPct,
        },
        params,
      );
      underpacing = up.underpacing;
      if (underpacing) underpacingIo.add(io.id);
      out.pacing.push({
        scopeKind: 'INSERTION_ORDER',
        scopeId: io.id,
        date,
        segmentId: seg.id,
        segmentBudget: seg.amount,
        spentToDate: segSpent,
        dailyTarget: run.target,
        pacingPct: up.pacingPct,
        budgetRemaining: Math.max(0, seg.amount - segSpent),
        projected: up.projected,
        budgetAtRisk: up.budgetAtRisk,
        underpacing: up.underpacing,
      } satisfies PacingRow);
      if (io.kpi) {
        const days = run.liveLis.flatMap((l) => (next.li[l.id] as LiState).days);
        const agg = sumDays(
          days.filter((d) => d.date <= date).slice(-7 * run.liveLis.length),
          7 * run.liveLis.length,
        );
        const actual = kpiActual(io.kpi.kind, agg, params);
        underperforming =
          actual !== null &&
          worseThanGoal(io.kpi.kind, actual, io.kpi.value, params.alerts.underperformingPct);
      }
    }
    const iolis = idx.sortedLis.filter((l) => l.ioId === io.id);
    ioFacts.push({
      id: io.id,
      live: !!run,
      liIds: iolis.map((l) => l.id),
      conflicts: conflictsForIo(io, iolis, date),
      underpacing,
      underperforming,
    });
  }
  for (const li of idx.sortedLis) {
    const ls = next.li[li.id] as LiState;
    const io = idx.ios.get(li.ioId);
    const r = runs.find((x) => x.li.id === li.id);
    const exchangesInPlay = new Set((r?.elig.cells ?? []).map((c) => c.cell.exchangeId));
    const assigned = li.creativeIds
      .map((id) => idx.creatives.get(id))
      .filter((c): c is NonNullable<typeof c> => !!c && c.status === 'ACTIVE');
    const disapproved = assigned.filter((c) =>
      [...exchangesInPlay].some((ex) => approvalOn(c, ex) === 'DISAPPROVED'),
    );
    const geoInc = li.targeting.geo?.includeRegions;
    const restricted = assigned.some((c) =>
      (c.restrictedRegions ?? []).some((rr) => (geoInc ? geoInc.includes(rr) : true)),
    );
    liFacts.push({
      id: li.id,
      ioId: li.ioId,
      live: status.get(li.id) === null,
      spendToday: ls.spendToday,
      spendYesterday: ls.spendYesterday,
      liveTicksToday: ls.liveTicksToday,
      liveTicksYesterday: ls.liveTicksYesterday,
      conflicts: conflictsForLi(
        li,
        io,
        params,
        date,
        world.partner.enabledExchanges ??
          Object.keys(params.exchanges).filter((k) => params.exchanges[k]?.enabledByDefault),
      ),
      eligibleRequestsPerHour: r ? r.elig.cells.reduce((a, c) => a + c.nE, 0) : 0,
      underpacingOn: underpacingIo.has(li.ioId),
      allCreativesDisapproved: assigned.length > 0 && disapproved.length === assigned.length,
      someCreativeDisapproved: disapproved.length > 0,
      creativeRestricted: restricted,
      restrictedAudience: r?.elig.plan.restrictedAudience ?? false,
    });
  }
  const advYesterday = Object.values(next.io).reduce((a, s) => a + s.spentYesterday, 0);
  const active: ActiveAlert[] = evaluateAlerts({
    params,
    prefs: adv.alertPrefs,
    lis: liFacts,
    ios: ioFacts,
    advertiserId: adv.id,
    advertiserSpendYesterday: advYesterday,
    hourOfDay: advLocal.hour,
  });
  const rec = reconcileAlerts(next.alerts, active, tick, params.alerts.resolveAfterClearTicks);
  next.alerts = rec.next;
  out.alerts = rec.decisions;

  // intelligence suggestions
  const sugFacts = new Map<
    string,
    { type: RecommendationType; scopeKind: 'LINE_ITEM' | 'INSERTION_ORDER'; scopeId: string }
  >();
  for (const r of runs) {
    const learning =
      r.strategy.kind !== 'fixed' && (next.li[r.li.id] as LiState).learning.phase !== 'STABLE';
    for (const type of suggestionsFor(
      {
        liId: r.li.id,
        rows: r.funnel,
        learning,
        optimizedTargeting: r.li.optimizedTargeting,
      },
      params,
    )) {
      sugFacts.set(`${type}|LINE_ITEM|${r.li.id}`, {
        type,
        scopeKind: 'LINE_ITEM',
        scopeId: r.li.id,
      });
    }
  }
  for (const run of [...ioRuns.values()].sort((a, b) => (a.io.id < b.io.id ? -1 : 1))) {
    if (
      run.io.autoBudgetAllocation ||
      run.io.bidBudgetControl === 'IO_AUTOMATED' ||
      run.liveLis.length < 2
    )
      continue;
    const rs = run.liveLis.map((l) => (next.li[l.id] as LiState).lastR);
    if (rs.some((x) => x < 0.9) && rs.some((x) => x >= 0.999)) {
      sugFacts.set(`ENABLE_AUTO_BUDGET_ALLOCATION|INSERTION_ORDER|${run.io.id}`, {
        type: 'ENABLE_AUTO_BUDGET_ALLOCATION',
        scopeKind: 'INSERTION_ORDER',
        scopeId: run.io.id,
      });
    }
  }
  const sug = reconcileSuggestions(next.recommendations, new Set(sugFacts.keys()), sugFacts);
  next.recommendations = sug.next;
  out.recommendations = sug.decisions;

  // reach snapshots at the end of the advertiser day
  if (advLocal.hour === 23) {
    for (const r of runs) {
      const rs = next.reach[r.li.id];
      if (!rs) continue;
      const reached = lifetimeReached(rs);
      let exposures = 0;
      for (let k = 1; k < rs.lifetime.length; k++) exposures += k * (rs.lifetime[k] ?? 0);
      out.reach.push({
        lineItemId: r.li.id,
        date,
        impressionReach: reached,
        avgFrequency: reached > 0 ? exposures / reached : 0,
        pool: rs.U,
      } satisfies ReachRow);
    }
  }

  next.nextTick = tick + 1;
  return { output: out, state: next };
}

// ---- conversions release (6.4, 6.5) ---------------------------------------------------------------

function mergePending(s: SimStateData, p: SimStateData['pending'][number]): void {
  const k = (x: SimStateData['pending'][number]) =>
    `${x.liId}|${x.activityId}|${x.kind}|${x.dueTick}`;
  const key = k(p);
  const hit = s.pending.find((x) => k(x) === key);
  if (hit) hit.count += p.count;
  else s.pending.push(p);
}

function releaseConversions(
  s: SimStateData,
  world: World,
  idx: WorldIndex,
  params: LoadedParams['params'],
  fxAdv: number,
  tick: number,
  book: Map<string, { total: Partial<Metrics>; byActivity: Map<string, Partial<Metrics>> }>,
): void {
  const due = s.pending
    .filter((p) => p.dueTick <= tick)
    .sort((a, b) =>
      `${a.liId}|${a.activityId}|${a.kind}|${a.dueTick}` <
      `${b.liId}|${b.activityId}|${b.kind}|${b.dueTick}`
        ? -1
        : 1,
    );
  s.pending = s.pending
    .filter((p) => p.dueTick > tick)
    .sort((a, b) =>
      `${a.liId}|${a.activityId}|${a.kind}|${a.dueTick}` <
      `${b.liId}|${b.activityId}|${b.kind}|${b.dueTick}`
        ? -1
        : 1,
    );
  type Acc = {
    click: number;
    view: number;
    total: number;
    revenue: number;
    trans: number;
    items: number;
  };
  const acc = new Map<string, Acc>();
  const getAcc = (liId: string, act: string): Acc => {
    const k = `${liId}|${act}`;
    let a = acc.get(k);
    if (!a) {
      a = { click: 0, view: 0, total: 0, revenue: 0, trans: 0, items: 0 };
      acc.set(k, a);
    }
    return a;
  };
  for (const p of due) {
    const li = idx.lis.get(p.liId);
    const act = idx.activities.get(p.activityId);
    if (!li || !act || act.tagStatus !== 'active') continue;
    const candidates: AssistCandidate[] = idx.sortedLis
      .filter((l) => l.id !== li.id && l.floodlight.some((f) => f.activityId === act.id))
      .map((l) => ({ liId: l.id, weight: s.li[l.id]?.winsLast ?? 0, klass: l.type }));
    const credits = creditSplit(
      li,
      withClasses(candidates, idx),
      params,
      world.sandboxSeed,
      tick,
      act.id,
    );
    for (const c of credits) {
      const target = idx.lis.get(c.liId);
      if (!target) continue;
      const counted = countConversion(p.count * c.share, act, params, fxAdv);
      const a = getAcc(c.liId, act.id);
      const w = p.kind === 'click' ? 1 : postViewWeight(target);
      if (p.kind === 'click') a.click += counted.counted;
      else a.view += counted.counted;
      a.total += counted.counted * w;
      a.revenue += counted.revenue * w;
      a.trans += counted.transactions * w;
      a.items += counted.items * w;
    }
  }
  for (const key of [...acc.keys()].sort()) {
    const [liId, actId] = key.split('|') as [string, string];
    const a = acc.get(key) as Acc;
    const part: Partial<Metrics> = {
      convPostClick: Math.round(a.click * 1e6),
      convPostView: Math.round(a.view * 1e6),
      convTotal: Math.round(a.total * 1e6),
      convTransactions: Math.round(a.trans * 1e6),
      convItems: Math.round(a.items * 1e6),
      convRevenue: Math.round(a.revenue * 1e6),
    };
    let e = book.get(liId);
    if (!e) {
      e = { total: emptyMetrics(), byActivity: new Map() };
      book.set(liId, e);
    }
    addMetrics(e.total as Metrics, part);
    e.byActivity.set(actId, part);
  }
}

function withClasses(cands: AssistCandidate[], idx: WorldIndex): AssistCandidate[] {
  return cands.map((c) => {
    const li = idx.lis.get(c.liId);
    return { ...c, klass: li ? incrementalityClass(li) : 'prospecting' };
  });
}

/** Floodlight activities of a line item sorted by id, so sums never depend on storage order. */
function activitiesOf(li: LineItemEntity, idx: WorldIndex) {
  return li.floodlight
    .map((f) => idx.activities.get(f.activityId))
    .filter((a): a is NonNullable<typeof a> => !!a)
    .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}
