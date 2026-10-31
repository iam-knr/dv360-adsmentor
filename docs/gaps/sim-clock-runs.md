# SIM-CLOCK-RUNS: student sandboxes run (what is not done)

Branch `sim-clock-runs`. Owner decision of 31 Oct 2026: student sandboxes run at a fixed speed so that what students build
delivers and reports and alerts move. No migration.

## What was wrong

1. Every sandbox ended provisioning with `SimClock.state = PAUSED`. Only the (dropped) instructor time controls resumed a
   clock, so in production the sim clock stood at the end of the 90 day history (`Sim Oct 30, 2026 · Paused`), the external
   timer (cron-job.org, every 5 minutes) advanced nothing, and nothing a student created ever served.
2. **A second bug hid behind the first** (found by the end to end test, item 5 of the task): once ticks ran, a *new* line item
   in an `IO_AUTOMATED` insertion order still never delivered, for either advertiser (impressions 0, `lostPacing` = all eligible
   requests). Cause in `lib/engine/tick.ts`: the allocation caps a line item's share of the IO allowance by
   `lastCapacity * allocationHeadroom`. A new student creative is still in review for its first ticks, so the first tick has no
   supply, `sFull = 0`, the recorded capacity is 0, the next allocation gives the line item no allowance, its bids shrink with the
   allowance (`planBids` takes the allowance) and the capacity stays at ~1e-187 for ever. Seeded line items never hit it (they
   start with supply). Fix: a line item that has never delivered (`spentFlight === 0`) keeps a probe share (`PROBE_SHARE = 10%`) of
   the IO's hourly allowance, so it bids, wins, and the recorded capacity becomes real. Existing goldens and engine tests are
   unchanged (2,848 unit tests pass). The 10% is a judgement call; it only applies until the first delivery.
3. "The engine persist loads only the first advertiser's world in some paths" (docs mention): checked, `runBatch` loads one
   World per advertiser (`loadWorlds`) and the new line items of **both** advertisers deliver in the db test below. No fix needed.

## What was built

| Item | Where |
|---|---|
| Clock RUNNING at the end of provisioning, speed setting (AppMeta `sandbox:minutes-per-sim-day` > env `SANDBOX_SIM_MINUTES_PER_DAY` > 10, validated) | `lib/sandbox/clock-run.ts`, hooks in `lib/seed/after-history.ts` (`finishBackfill`) and `runProvisionStep` (engineDays 0) |
| Existing PAUSED sandboxes resumed once (marker `sandbox-clock:resumed-existing:v1`), admin pause respected, speed re-applied | `prisma/bootstrap/30-sandbox-clocks.bootstrap.ts` (production or `SANDBOX_RESUME_EXISTING=1`) |
| Load protection: timer and `maybeAdvance` only for owners seen in 7 days; chunked catch-up; debt cap 7 sim days | `listDueSandboxes/countDueSandboxes` (`activeWithinMs`), `runDueTicks`, `forgiveStaleDebt`, `app/api/sim/engine/tick/route.ts`, `lib/sandbox/maybe-advance.ts` |
| Super admin Pause / Resume with confirm and audit, state and speed on the account page | `components/manage/SandboxClockControl.tsx`, `setSandboxClockRunning`, `SANDBOX_PAUSED/RESUMED` |
| `/manage/engine`: sandbox clocks running vs paused (and paused by a Super admin), speed and its source, timer scope | `lib/manage/engine.ts` `readClockSummary` |
| Engine fix: probe share for a line item that has never delivered | `lib/engine/tick.ts` |
| Test | `tests/sandbox/sim-clock-runs.db.test.ts` (9 tests); `tests/sandbox/provision.db.test.ts` now expects RUNNING |

"Recently active" uses the existing `User.lastSeenAt` (written at most every 5 minutes on any signed in request and on sign in).
Sandboxes without an owner (demo, instructor) are never advanced by the timer.

## Measured (local Postgres 17, one process, a student sandbox from `starter-agency`: 2 advertisers, 24 live line items)

| Measure | Value |
|---|---|
| Live tick, one sandbox | about 0.35 s (168 ticks in about 59 s over two catch-up calls of 96 and 72 ticks), i.e. **about 2.8 ticks per second per sandbox** |
| Catch up one simulated day (24 ticks) | about 8.5 s |
| Compute a running sandbox owes | 6 ticks per real minute at 10 min/day = about 2.1 s per minute, about 10.5 s per 5 minute cron slot |
| One cron call | `DEFAULT_BUDGET_MS` 45 s x 4 workers = about 180 s of compute = **about 17 sandboxes** caught up per 5 minutes; `maybeAdvance` adds up to 5 sandboxes per minute (30 s budget) when students browse. So about 17 to 25 simultaneously active students keep up; more fall behind and are caught up lazily (their own page load, 6 ticks) and by later calls (`stillDue` in the tick response shows the backlog) |
| Debt of a sandbox idle for 20 days | forgiven down to 7 days (168 ticks): two calls of 96 and 72 ticks |

Numbers are from a laptop-class container with a local database; Supabase free tier adds latency to every statement (about 80%
of a tick is persistence, see `eng-ff.md`), so expect a tick to be slower there. If the cron keeps a backlog the knobs are the
speed (`SANDBOX_SIM_MINUTES_PER_DAY=30` makes 2 ticks per minute), the active window (`SANDBOX_ACTIVE_WINDOW_DAYS`) and the
batch size (the 12 ticks per minute cap in `clock.ts`).

## Not done / follow-ups

| # | Gap | Note |
|---|---|---|
| 1 | The speed setting has no editing UI; `/manage/engine` shows it read only. Change it with the env var (applied at the next deploy by the bootstrap step) or the `AppMeta` row | Owner asked for a readable summary only |
| 2 | Student-facing time controls: not built (owner dropped them). The header chip popover keeps "The clock runs on its own; you cannot change it." | |
| 3 | Seeded demo and e2e sandboxes (`provisionSandbox` direct, `engineDays` 0) still end PAUSED, so stable clocks keep working in tests; the bootstrap resume is off outside production. `SANDBOX_CLOCK_AUTOSTART=0` also keeps the provisioning job from starting clocks | The production path (`runProvisionStep`, `finishBackfill`) is covered by the db tests |
| 4 | Alerts react only when the engine's own conditions fire (planted problems, pacing, no delivery); the db test asserts delivery, list columns, Troubleshooter diagnostics and History entries, not a specific alert | |
| 5 | `forgiveStaleDebt` skips simulated time for a sandbox nobody used for more than 7 days (like paused time). If the owner wants every day simulated, raise `MAX_OWED_TICKS` and accept a longer catch-up | |
| 6 | The probe share is the minimum fix for the capacity death spiral; the allocation could instead ignore capacity for a line item in its first N ticks, or compute capacity independently of the allowance. Not calibrated beyond "delivers" | Engine owner |
