// One batch of ticks for one sandbox inside one transaction (engine.md 1.4): lock the clock, load the Worlds once, run
// ticks in order, persist each tick, save the state and move the clock. A batch is applied completely or not at all.
import type { Tx } from '@/lib/db';
import { runDueReports } from '@/lib/reporting/due';
import { runTick } from '../tick';
import { dueTicks } from '../clock/clock';
import { defaultParams } from '../params/load';
import { MS_HOUR } from '../calendar';
import { claimTick, finishTickLog, lockClock } from './locks';
import { loadWorlds } from './loadWorld';
import { persistTick } from './persistTick';
import { trimHourly } from './retention';
import { loadStates, saveStates } from './state';
import { syncCreativeReviews } from './structural';
import { syncYoutube } from './youtube';
import type { ClockRow } from './types';

export type TickPlan =
  /** Run what real time owes, at most `max` ticks (cron, lazy catch-up). */
  | { kind: 'due'; nowMs: number; max: number }
  /** Run exactly `count` ticks whatever the clock state (step, fast-forward). */
  | { kind: 'fixed'; count: number };

export interface BatchResult {
  /** False when another transaction held the clock, the row is missing or the plan owed nothing. */
  locked: boolean;
  ticks: number;
  rows: number;
  /** Tick index after the batch. */
  tickIndex: number;
  raised: string[];
  stoppedBy?: string;
  clock: ClockRow | null;
}

export interface BatchOptions {
  /** Called after each tick; return a reason to stop the batch early (fast-forward conditions). */
  stopAfterTick?: (info: { tick: number; simDate: string; raised: string[] }) => string | undefined;
  /** Stop before starting another tick when this returns true (time budget). */
  outOfTime?: () => boolean;
}

export const BATCH_TICKS = 24;

function ticksFor(clock: ClockRow, plan: TickPlan): { n: number; remainderMs: number } {
  if (plan.kind === 'fixed') return { n: plan.count, remainderMs: clock.remainderMs };
  if (clock.state !== 'RUNNING') return { n: 0, remainderMs: clock.remainderMs };
  const { due, remainderMs } = dueTicks(
    {
      minutesPerSimDay: clock.minutesPerSimDay,
      lastAdvanceRealMs: clock.lastAdvanceRealMs ?? plan.nowMs,
      remainderMs: clock.remainderMs,
    },
    plan.nowMs,
    plan.max,
  );
  return { n: due, remainderMs };
}

export async function runBatch(
  tx: Tx,
  sandboxId: string,
  plan: TickPlan,
  options: BatchOptions = {},
): Promise<BatchResult> {
  const empty: BatchResult = {
    locked: false,
    ticks: 0,
    rows: 0,
    tickIndex: 0,
    raised: [],
    clock: null,
  };
  const clock = await lockClock(tx, sandboxId);
  if (!clock) return empty;
  const { n, remainderMs } = ticksFor(clock, plan);
  const nowMs = plan.kind === 'due' ? plan.nowMs : (clock.lastAdvanceRealMs ?? 0);
  if (n <= 0) {
    return { ...empty, locked: true, tickIndex: clock.tickIndex, clock };
  }

  const loaded = defaultParams();
  const world = await loadWorlds(tx, clock, loaded);
  const states = await loadStates(
    tx,
    sandboxId,
    world.worlds.map((w) => w.advertiserId),
    clock.tickIndex,
  );
  let rows = 0;
  let ticks = 0;
  let tick = clock.tickIndex;
  const raised: string[] = [];
  let stoppedBy: string | undefined;

  for (let i = 0; i < n; i++) {
    if (i > 0 && options.outOfTime?.()) break;
    const startedMs = Date.now();
    const simHourMs = clock.simStartMs + tick * MS_HOUR;
    const fresh = await claimTick(tx, sandboxId, tick, simHourMs);
    if (!fresh) {
      // Already applied (ledger): write nothing, only move on.
      tick++;
      ticks++;
      continue;
    }
    let tickRows = 0;
    const tickRaised: string[] = [];
    let simDate = new Date(simHourMs).toISOString().slice(0, 10);
    for (const w of world.worlds) {
      const state = states.get(w.advertiserId);
      if (!state) continue;
      const r = runTick(w.world, state, loaded, tick);
      states.set(w.advertiserId, r.state);
      simDate = r.output.date;
      const p = await persistTick(
        tx,
        { sandboxId, classroomId: clock.classroomId, adv: w },
        r.output,
      );
      tickRows += p.rows;
      tickRaised.push(...p.raised);
    }
    tickRows += await syncCreativeReviews(
      tx,
      { sandboxId, classroomId: clock.classroomId },
      simHourMs,
    );
    const yt = await syncYoutube(tx, { sandboxId, classroomId: clock.classroomId }, simHourMs);
    tickRows += yt.decided + yt.raised.length;
    tickRaised.push(...yt.raised);
    await finishTickLog(tx, sandboxId, tick, {
      durationMs: Date.now() - startedMs,
      lineItemsProcessed: world.worlds.reduce((s, w) => s + w.world.lineItems.length, 0),
      rowsWritten: tickRows,
    });
    rows += tickRows;
    raised.push(...tickRaised);
    tick++;
    ticks++;
    const stop = options.stopAfterTick?.({ tick: tick - 1, simDate, raised: tickRaised });
    if (stop) {
      stoppedBy = stop;
      break;
    }
  }

  await saveStates(tx, sandboxId, states);
  // Account for real time. Ticks not run (cap, deadline) stay owed through the remainder.
  const per = (clock.minutesPerSimDay * 60_000) / 24;
  const unrun = plan.kind === 'due' ? n - ticks : 0;
  await tx.simClock.update({
    where: { sandboxId },
    data: {
      tickIndex: BigInt(tick),
      paramsVersion: loaded.hash,
      ...(plan.kind === 'due'
        ? {
            lastAdvanceRealAt: new Date(nowMs),
            remainderMs: Math.min(2_000_000_000, Math.round(remainderMs + unrun * per)),
          }
        : {}),
    },
  });
  // scheduled reports whose occurrence the clock has now passed (module 16 4.5)
  if (ticks > 0) {
    await runDueReports(tx, sandboxId, new Date(clock.simStartMs + tick * MS_HOUR)).catch((e) =>
      console.error('runDueReports failed', e),
    );
  }
  // nightly retention: when the batch crossed a sim midnight
  if (Math.floor(tick / 24) > Math.floor(clock.tickIndex / 24)) {
    await trimHourly(tx, sandboxId, clock.simStartMs + tick * MS_HOUR);
  }
  return {
    locked: true,
    ticks,
    rows,
    tickIndex: tick,
    raised,
    ...(stoppedBy ? { stoppedBy } : {}),
    clock: { ...clock, tickIndex: tick },
  };
}
