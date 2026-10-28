// Closed-form history stub (build-plan P3-05b item 3). Deterministic, no engine import, no random state: every number
// is a function of the plan, the day and a keyed noise value. It lets the UI and reports work before the engine runs;
// P3-INT replaces it with engine.fastForward.
//
// Grain: for every line item and day the stub computes one funnel per (exchange x device) cell with integer stage
// counts, so  available = sum(filtered by stage) + won  holds exactly in every cell. Day totals are sums of cells, the
// exchange and device slices are sums of the same cells (so each partition adds up to the total), and the hourly rows
// split the day total with largest remainder, so hourly sums equal the daily total.
import type { Prisma } from '@prisma/client';
import { addDays, daysBetween, eachDay, maxIso, minIso, toDate, weekday } from './dates';
import { keyedNoise } from './prng';
import {
  AVERAGE_ORDER_VALUE_INR,
  DAY_OF_WEEK,
  DEFAULT_IVT_RATE,
  DEFAULT_PRICE_IDX,
  DEVICE_MULTIPLIER,
  DEVICE_SHARE,
  DV360_FEE_PCT,
  EXCHANGE_IVT_RATE,
  EXCHANGE_PRICE_IDX,
  FORMAT_PARAMS,
  formatExchanges,
  hourCurve,
  inrTo,
} from './params-stub';
import { exchangeId, FX_PER_USD } from './reference';
import type { LiProfile, SandboxPlan } from './types';

/** Days of DeliveryDiagnostic rows (Troubleshooter default range, engine.md 3.5). */
export const DIAGNOSTIC_DAYS = 7;

type Vec = Record<string, number>;

/** Columns that are integer counts. Money columns are integer micros (1e-6 of the currency unit). */
const FUNNEL_LEAVES = [
  'lostTargeting',
  'lostCreative',
  'lostFrequency',
  'lostBudget',
  'lostPacing',
  'lostBelowMinBid',
  'lostInternal',
  'lostExternalBid',
  'lostExternalCreative',
  'lostExternalOther',
  'lostNotReported',
] as const;

const EVENT_COUNT_COLUMNS = [
  'billableImpressions',
  'invalidImpressions',
  'beginToRenderImpressions',
  'floodlightImpressions',
  'clicks',
  'invalidClicks',
  'engagements',
  'measurableImpressions',
  'viewableImpressions',
  'viewable10sImpressions',
  'audibleImpressions',
  'videoStarts',
  'videoQ1',
  'videoMid',
  'videoQ3',
  'videoCompletions',
  'skips',
  'convPostClick',
  'convPostView',
  'convTotal',
  'convTransactions',
] as const;

const MONEY_COLUMNS = [
  'mediaCost',
  'refund',
  'cpmFee1',
  'mediaFee1',
  'mediaFee2',
  'verificationCost',
  'totalMediaCost',
  'revenue',
  'clientCost',
  'convRevenue',
] as const;

/** Decimal(20,4) columns: counts written as 4 decimals. */
const CONV_DECIMAL = new Set(['convPostClick', 'convPostView', 'convTotal', 'convTransactions']);

/** Largest remainder split of an integer over weights. Sums to exactly `total`. */
export function apportion(total: number, weights: readonly number[]): number[] {
  const sum = weights.reduce((s, w) => s + w, 0);
  if (total <= 0 || sum <= 0) return weights.map(() => 0);
  const quotas = weights.map((w) => (total * w) / sum);
  const out = quotas.map((q) => Math.floor(q));
  let rest = total - out.reduce((s, x) => s + x, 0);
  const order = quotas
    .map((q, i) => ({ i, f: q - Math.floor(q) }))
    .sort((a, b) => b.f - a.f || a.i - b.i);
  for (let k = 0; rest > 0 && k < order.length; k++, rest--)
    out[(order[k] as { i: number }).i]! += 1;
  return out;
}

function derivedFunnel(v: Vec): void {
  const won = v.impressions ?? 0;
  const ext =
    (v.lostExternalBid ?? 0) +
    (v.lostExternalCreative ?? 0) +
    (v.lostExternalOther ?? 0) +
    (v.lostNotReported ?? 0);
  v.bidResponses = won + ext;
  v.bidsSubmitted = v.bidResponses + (v.lostBelowMinBid ?? 0) + (v.lostInternal ?? 0);
  v.eligibleRequests =
    v.bidsSubmitted + (v.lostFrequency ?? 0) + (v.lostBudget ?? 0) + (v.lostPacing ?? 0);
  v.bidRequests = v.eligibleRequests + (v.lostTargeting ?? 0) + (v.lostCreative ?? 0);
}

export interface ReasonCount {
  stage: Prisma.DeliveryDiagnosticCreateManyInput['stage'];
  code: string;
  count: number;
}

interface Cell {
  exchangeCode: string;
  device: string;
  v: Vec;
  reasons: ReasonCount[];
}

function stageCut(n: number, pass: number): { next: number; cut: number } {
  const next = Math.max(0, Math.min(n, Math.round(n * pass)));
  return { next, cut: n - next };
}

function splitReasons(
  cut: number,
  weights: readonly (readonly [string, number])[],
  stage: ReasonCount['stage'],
): ReasonCount[] {
  if (cut <= 0) return [];
  const parts = apportion(
    cut,
    weights.map(([, w]) => w),
  );
  return weights
    .map(([code], i) => ({ stage, code, count: parts[i] as number }))
    .filter((r) => r.count > 0);
}

interface DayInput {
  profile: LiProfile;
  date: string;
  /** Planned impressions of the day (segment plan x day-of-week x noise), before supply and pass effects. */
  plannedImpressions: number;
  budgetPass: number;
}

function computeCells(d: DayInput, liKey: string): Cell[] {
  const { profile, date } = d;
  const fp = FORMAT_PARAMS[profile.format];
  const exchanges = formatExchanges(profile.format);
  const devices =
    DEVICE_SHARE[profile.format].length > 0
      ? DEVICE_SHARE[profile.format]
      : ([['NONE', 1]] as const);
  const currencyFactor = inrTo(profile.currency, FX_PER_USD);
  const totalAvailable = (d.plannedImpressions * profile.supplyMul) / profile.healthyProduct;
  const p = profile.passes;
  const cells: Cell[] = [];

  for (const ex of exchanges) {
    for (const [device, deviceWeight] of devices) {
      const available = Math.round(totalAvailable * ex.weight * deviceWeight);
      const reasons: ReasonCount[] = [];
      const v: Vec = {};
      const disapprovedHere = profile.disapprovedExchangeCodes.includes(ex.code);

      let n = available;
      let s = stageCut(n, p.targeting);
      reasons.push(...splitReasons(s.cut, profile.reasons.targeting, 'TARGETING'));
      v.lostTargeting = s.cut;
      n = s.next;

      s = stageCut(n, disapprovedHere ? 0 : p.creative);
      reasons.push(
        ...splitReasons(
          s.cut,
          disapprovedHere ? [['C.NOT_APPROVED_EXCHANGE:DISAPPROVED', 1]] : profile.reasons.creative,
          'CREATIVE',
        ),
      );
      v.lostCreative = s.cut;
      n = s.next;

      s = stageCut(n, p.frequency);
      reasons.push(...splitReasons(s.cut, profile.reasons.frequency, 'FREQUENCY'));
      v.lostFrequency = s.cut;
      n = s.next;

      s = stageCut(n, d.budgetPass);
      reasons.push(...splitReasons(s.cut, profile.reasons.budget, 'BUDGET'));
      v.lostBudget = s.cut;
      n = s.next;

      s = stageCut(n, p.pacing);
      reasons.push(...splitReasons(s.cut, profile.reasons.pacing, 'PACING'));
      v.lostPacing = s.cut;
      n = s.next;

      s = stageCut(n, p.belowMinBid);
      if (s.cut > 0) reasons.push({ stage: 'AUCTION', code: 'A.BELOW_MIN_BID', count: s.cut });
      v.lostBelowMinBid = s.cut;
      n = s.next;

      s = stageCut(n, p.internal);
      if (s.cut > 0) reasons.push({ stage: 'AUCTION', code: 'A.LOST_INTERNAL', count: s.cut });
      v.lostInternal = s.cut;
      n = s.next;

      const responses = n;
      const extBid = Math.min(responses, Math.round(responses * p.extBid));
      const extCreative = Math.min(responses - extBid, Math.round(responses * p.extCreative));
      const extOther = Math.min(
        responses - extBid - extCreative,
        Math.round(responses * p.extOther),
      );
      const extNotReported = Math.min(
        responses - extBid - extCreative - extOther,
        Math.round(responses * p.extNotReported),
      );
      v.lostExternalBid = extBid;
      v.lostExternalCreative = extCreative;
      v.lostExternalOther = extOther;
      v.lostNotReported = extNotReported;
      for (const [code, count] of [
        ['E.BID_TOO_LOW', extBid],
        ['E.CREATIVE', extCreative],
        ['E.OTHER', extOther],
        ['E.LOST_NOT_REPORTED', extNotReported],
      ] as const) {
        if (count > 0) reasons.push({ stage: 'EXTERNAL', code, count });
      }
      const won = responses - extBid - extCreative - extOther - extNotReported;
      v.impressions = won;
      derivedFunnel(v);

      // Events and money
      const dm = DEVICE_MULTIPLIER[device] ?? DEVICE_MULTIPLIER.NONE!;
      const ivt = EXCHANGE_IVT_RATE[ex.code] ?? DEFAULT_IVT_RATE;
      const priceIdx = EXCHANGE_PRICE_IDX[ex.code] ?? DEFAULT_PRICE_IDX;
      const cpm =
        fp.clearCpm *
        currencyFactor *
        priceIdx *
        dm.price *
        keyedNoise(`${liKey}:${date}:cpm`, 0.93, 1.07);
      v.invalidImpressions = Math.round(won * ivt);
      v.billableImpressions = won - v.invalidImpressions;
      v.beginToRenderImpressions = Math.round(won * 0.995);
      v.clicks = Math.round(won * fp.ctr * profile.ctrMul * dm.ctr);
      v.invalidClicks = Math.round(v.clicks * 0.02);
      v.engagements = Math.round(won * fp.engagementRate);
      v.measurableImpressions = Math.round(won * fp.measurable);
      v.viewableImpressions = Math.round(
        v.measurableImpressions * fp.viewable * profile.viewMul * dm.view,
      );
      if (fp.startRate > 0) {
        v.viewable10sImpressions = Math.round(v.viewableImpressions * 0.6);
        v.audibleImpressions = Math.round(won * 0.7);
        v.videoStarts = Math.round(won * fp.startRate);
        v.videoQ1 = Math.round(v.videoStarts * fp.quartiles[0]);
        v.videoMid = Math.round(v.videoQ1 * (fp.quartiles[1] / fp.quartiles[0]));
        v.videoQ3 = Math.round(v.videoMid * (fp.quartiles[2] / fp.quartiles[1]));
        v.videoCompletions = Math.round(v.videoQ3 * (fp.quartiles[3] / fp.quartiles[2]));
        v.skips = Math.round(
          v.videoStarts * fp.skippableViewRate * (profile.format === 'video_instream' ? 1 : 0),
        );
      }
      const postClick = Math.round(v.clicks * fp.cvrClick * profile.cvrMul);
      const postView = Math.round(won * fp.cvrView * profile.cvrMul);
      v.convPostClick = postClick;
      v.convPostView = postView;
      v.convTotal =
        profile.conversionMode === 'POST_CLICK_ONLY'
          ? postClick
          : profile.conversionMode === 'PERCENTAGE'
            ? postClick + Math.round((postView * profile.conversionPct) / 100)
            : postClick + postView;
      v.convTransactions = v.convTotal;
      v.floodlightImpressions = v.convTotal > 0 ? won : 0;
      v.convRevenue = Math.round(v.convTotal * AVERAGE_ORDER_VALUE_INR * currencyFactor * 1e6);

      v.mediaCost = Math.round(won * cpm * 1000);
      v.refund = won > 0 ? Math.round((v.mediaCost * v.invalidImpressions) / won) : 0;
      v.mediaFee1 = Math.round(v.mediaCost * DV360_FEE_PCT);
      v.cpmFee1 = Math.round(won * profile.cpmFee1 * 1000);
      v.mediaFee2 = Math.round((v.mediaCost * profile.mediaFee2Pct) / 100);
      v.verificationCost = Math.round(won * profile.verificationCpm * 1000);
      v.totalMediaCost = v.mediaCost + v.mediaFee1 + v.cpmFee1 + v.mediaFee2 + v.verificationCost;
      v.revenue = v.totalMediaCost;
      v.clientCost = v.totalMediaCost;

      cells.push({ exchangeCode: ex.code, device, v, reasons });
    }
  }
  return cells;
}

function sumVecs(vs: readonly Vec[]): Vec {
  const out: Vec = {};
  for (const v of vs) for (const [k, x] of Object.entries(v)) out[k] = (out[k] ?? 0) + x;
  return out;
}

/** Split one day vector over `weights.length` parts (hours). Funnel leaves by weight, events by the parts' impressions. */
export function splitVector(total: Vec, weights: readonly number[]): Vec[] {
  const parts: Vec[] = weights.map(() => ({}));
  for (const key of [...FUNNEL_LEAVES, 'impressions']) {
    const split = apportion(total[key] ?? 0, weights);
    split.forEach((x, i) => ((parts[i] as Vec)[key] = x));
  }
  const impressionWeights = parts.map((p) => p.impressions ?? 0);
  const hasImpressions = impressionWeights.some((x) => x > 0);
  for (const key of [...EVENT_COUNT_COLUMNS, ...MONEY_COLUMNS]) {
    const split = hasImpressions
      ? apportion(total[key] ?? 0, impressionWeights)
      : weights.map(() => 0);
    split.forEach((x, i) => ((parts[i] as Vec)[key] = x));
  }
  for (const part of parts) derivedFunnel(part);
  return parts;
}

// ---------------------------------------------------------------------------------------------------------------
// Row formatting

function micros(n: number): string {
  const sign = n < 0 ? '-' : '';
  const abs = Math.abs(Math.round(n));
  return `${sign}${Math.floor(abs / 1e6)}.${String(abs % 1e6).padStart(6, '0')}`;
}

function metricColumns(v: Vec): Record<string, number | string> {
  const out: Record<string, number | string> = {};
  for (const [key, x] of Object.entries(v)) {
    if (x === 0) continue;
    if ((MONEY_COLUMNS as readonly string[]).includes(key)) out[key] = micros(x);
    else if (CONV_DECIMAL.has(key)) out[key] = `${x}.0000`;
    else out[key] = x;
  }
  return out;
}

export interface HistoryRows {
  daily: Prisma.SimDailyMetricCreateManyInput[];
  hourly: Prisma.SimHourlyMetricCreateManyInput[];
  diagnostics: Prisma.DeliveryDiagnosticCreateManyInput[];
}

function segmentFor(profile: LiProfile, date: string) {
  return profile.segments.find((s) => s.start <= date && date <= s.end);
}

function plannedDailySpend(profile: LiProfile, impressions: number): number {
  return (impressions * profile.plannedCpm) / 1000;
}

export function buildHistory(plan: SandboxPlan): HistoryRows {
  const { sandboxId, classroomId, today, knobs } = plan.meta;
  const firstDay = addDays(today, -knobs.historyDays);
  const lastDay = addDays(today, -1);
  const sliceFrom = addDays(today, -knobs.sliceDays);
  const hourlyFrom = addDays(today, -knobs.hourlyDays);
  const diagFrom = addDays(today, -DIAGNOSTIC_DAYS);

  const daily: Prisma.SimDailyMetricCreateManyInput[] = [];
  const hourly: Prisma.SimHourlyMetricCreateManyInput[] = [];
  const diagnostics: Prisma.DeliveryDiagnosticCreateManyInput[] = [];

  // IO level accumulators for pacing percentages (IO plan = sum of the plans of its line items)
  const ioPlanned = new Map<string, Map<string, number>>();
  const ioRevenue = new Map<string, Map<string, number>>();
  const addTo = (m: Map<string, Map<string, number>>, key: string, date: string, x: number) => {
    let inner = m.get(key);
    if (!inner) m.set(key, (inner = new Map<string, number>()));
    inner.set(date, (inner.get(date) ?? 0) + x);
  };
  const totalRowsByIo = new Map<
    string,
    { row: Prisma.SimDailyMetricCreateManyInput; date: string }[]
  >();

  for (const profile of plan.profiles) {
    const liKey = profile.noiseKey;
    // Planned spend for IO pacing counts every line item that is meant to deliver, also after it stopped.
    if (profile.planShare > 0 && profile.liveFrom !== null) {
      for (const date of eachDay(maxIso(profile.liveFrom, firstDay), lastDay)) {
        const seg = segmentFor(profile, date);
        if (seg)
          addTo(ioPlanned, profile.ioId, date, plannedDailySpend(profile, seg.dailyImpressions));
      }
    }
    if (profile.liveFrom === null) continue;
    const from = maxIso(profile.liveFrom, firstDay);
    const to = minIso(profile.liveUntil ?? lastDay, lastDay);
    if (from > to) continue;

    let cumulativeRevenue = 0;
    let cumulativePlanned = 0;
    const rowsOfLi: { date: string; total: Vec }[] = [];
    for (const date of eachDay(from, to)) {
      const seg = segmentFor(profile, date);
      if (!seg) continue;
      const noise = keyedNoise(`${liKey}:${date}:vol`, 0.95, 1.05);
      const planned = Math.round(
        seg.dailyImpressions * (DAY_OF_WEEK[weekday(date)] as number) * noise,
      );

      let budgetPass = 1;
      if (profile.budgetCap !== null) {
        const remaining = profile.budgetCap * 1e6 - cumulativeRevenue;
        if (remaining <= 0) budgetPass = 0;
        else {
          const probe = sumVecs(
            computeCells({ profile, date, plannedImpressions: planned, budgetPass: 1 }, liKey).map(
              (c) => c.v,
            ),
          );
          const need = probe.revenue ?? 0;
          if (need > remaining) budgetPass = remaining / need;
        }
      }
      let cells = computeCells({ profile, date, plannedImpressions: planned, budgetPass }, liKey);
      let total = sumVecs(cells.map((c) => c.v));
      if (profile.budgetCap !== null) {
        // Rounding of impression counts can overshoot the cap by a few impressions; trim until the budget holds.
        const remaining = profile.budgetCap * 1e6 - cumulativeRevenue;
        for (
          let guard = 0;
          guard < 50 && budgetPass > 0 && (total.revenue ?? 0) > remaining;
          guard++
        ) {
          budgetPass *= Math.max(0, remaining / (total.revenue as number)) * 0.999;
          cells = computeCells({ profile, date, plannedImpressions: planned, budgetPass }, liKey);
          total = sumVecs(cells.map((c) => c.v));
        }
      }
      cumulativeRevenue += total.revenue ?? 0;
      const dailyTarget = plannedDailySpend(profile, seg.dailyImpressions);
      cumulativePlanned += dailyTarget;
      addTo(ioRevenue, profile.ioId, date, total.revenue ?? 0);
      rowsOfLi.push({ date, total });

      const dayDate = toDate(date);
      const base = { sandboxId, classroomId, lineItemId: profile.liId, simDate: dayDate };
      const totalRow: Prisma.SimDailyMetricCreateManyInput = {
        ...base,
        sliceKind: 'total',
        sliceKey: '',
        ...(metricColumns(total) as object),
        liPacingPct:
          cumulativePlanned > 0
            ? ((cumulativeRevenue / 1e6 / cumulativePlanned) * 100).toFixed(4)
            : null,
        dailyTarget: dailyTarget.toFixed(6),
        budgetSegmentBudget: undefined,
      };
      daily.push(totalRow);
      let list = totalRowsByIo.get(profile.ioId);
      if (!list) totalRowsByIo.set(profile.ioId, (list = []));
      list.push({ row: totalRow, date });

      if (date >= sliceFrom) {
        const byExchange = new Map<string, Vec[]>();
        const byDevice = new Map<string, Vec[]>();
        for (const c of cells) {
          (
            byExchange.get(c.exchangeCode) ??
            byExchange.set(c.exchangeCode, []).get(c.exchangeCode)!
          ).push(c.v);
          (byDevice.get(c.device) ?? byDevice.set(c.device, []).get(c.device)!).push(c.v);
        }
        for (const [code, vs] of byExchange) {
          daily.push({
            ...base,
            sliceKind: 'exchange',
            sliceKey: code,
            exchangeId: exchangeId(code),
            ...(metricColumns(sumVecs(vs)) as object),
          });
        }
        if (!byDevice.has('NONE')) {
          for (const [device, vs] of byDevice) {
            daily.push({
              ...base,
              sliceKind: 'device',
              sliceKey: device,
              deviceType: device as Prisma.SimDailyMetricCreateManyInput['deviceType'],
              ...(metricColumns(sumVecs(vs)) as object),
            });
          }
        }
      }

      if (date >= diagFrom) {
        const byExchange = new Map<string, Cell[]>();
        for (const c of cells)
          (
            byExchange.get(c.exchangeCode) ??
            byExchange.set(c.exchangeCode, []).get(c.exchangeCode)!
          ).push(c);
        for (const [code, cs] of byExchange) {
          const exId = exchangeId(code);
          const sum = sumVecs(cs.map((c) => c.v));
          const milestones: [string, ReasonCount['stage'], number][] = [
            ['M.AVAILABLE', 'AVAILABLE', sum.bidRequests ?? 0],
            ['M.ELIGIBLE', 'CREATIVE', sum.eligibleRequests ?? 0],
            ['M.BIDS_SUBMITTED', 'PACING', sum.bidsSubmitted ?? 0],
            ['M.BID_RESPONSES', 'AUCTION', sum.bidResponses ?? 0],
            ['M.WON', 'WON', sum.impressions ?? 0],
          ];
          for (const [codeName, stage, count] of milestones) {
            if (count > 0)
              diagnostics.push({
                sandboxId,
                lineItemId: profile.liId,
                date: dayDate,
                exchangeId: exId,
                stage,
                reasonCode: codeName,
                count,
              });
          }
          const merged = new Map<string, ReasonCount>();
          for (const c of cs)
            for (const r of c.reasons) {
              const prev = merged.get(r.code);
              if (prev) prev.count += r.count;
              else merged.set(r.code, { ...r });
            }
          for (const r of merged.values())
            diagnostics.push({
              sandboxId,
              lineItemId: profile.liId,
              date: dayDate,
              exchangeId: exId,
              stage: r.stage,
              reasonCode: r.code,
              count: r.count,
            });
        }
      }
    }

    // Hourly totals for the last hourlyDays days: the day total split over 24 hours.
    const curve = hourCurve(profile.format);
    for (const { date, total } of rowsOfLi) {
      if (date < hourlyFrom) continue;
      const parts = splitVector(total, curve);
      parts.forEach((part, h) => {
        if ((part.bidRequests ?? 0) === 0) return;
        hourly.push({
          sandboxId,
          lineItemId: profile.liId,
          simHour: new Date(toDate(date).getTime() + h * 3_600_000),
          ...(metricColumns(part) as object),
        });
      });
    }
  }

  // IO pacing percentage and segment budget on the day totals
  for (const [ioId, list] of totalRowsByIo) {
    const planned = ioPlanned.get(ioId);
    const revenue = ioRevenue.get(ioId);
    const io = plan.insertionOrders.find((x) => x.id === ioId);
    const segs = plan.budgetSegments.filter((x) => x.ioId === ioId);
    let cumPlanned = 0;
    let cumRevenue = 0;
    const days = [...new Set([...(planned?.keys() ?? []), ...list.map((x) => x.date)])].sort();
    const pctByDate = new Map<string, number>();
    for (const date of days) {
      cumPlanned += planned?.get(date) ?? 0;
      cumRevenue += (revenue?.get(date) ?? 0) / 1e6;
      if (cumPlanned > 0) pctByDate.set(date, (cumRevenue / cumPlanned) * 100);
    }
    for (const { row, date } of list) {
      const pct = pctByDate.get(date);
      if (pct !== undefined) row.ioPacingPct = pct.toFixed(4);
      const seg = segs.find(
        (s) => toDate(date) >= (s.startDate as Date) && toDate(date) <= (s.endDate as Date),
      );
      if (seg) row.budgetSegmentBudget = seg.amount;
    }
    void io;
  }
  void daysBetween;
  return { daily, hourly, diagnostics };
}
