# ENG-FF engine fast-forward history mode and sandbox provisioning (M18-05): what is not done

Branch `eng-fast-forward`. Closes `docs/gaps/p3.md` A3 (the engine took about 0.3 s per tick, so a sandbox history took minutes) and builds the sandbox provisioning job M18-05 that nobody had built (`lib/sandbox/provision.ts` was the P3-02b stub, so no student had a sandbox). One migration was not needed: `ProvisionState.BACKFILLING` and every other column already existed.

## Decision: how the history is built (measured)

Measured on a seeded `starter-agency` sandbox (2 advertisers, 24 live line items), local Postgres 17, one process.

| Option | Result |
|---|---|
| Per-tick `fastForward` as it was | 0.32 to 0.37 s per tick with all line items live. 336 ticks (14 days) 105.8 s. 2,160 ticks (the full 90 days) 364 s (6.1 min). About 80% of a tick is persistence (statements and round trips), about 15% the pure core (50 ms) |
| Daily-only mode inside the core (one coarse tick per sim day) | Not built. The core is an hourly state machine: pacing allowance by hours left, frequency windows by local tick, learning, throttle, day parting, hour-of-day curves and conversion lags are all per tick. A day-step would need a second implementation of most of `tick.ts` and a new calibration. The CPU profile is flat (no hot spot above 5%), so no cheap 10x exists in the core either |
| Cached template history (build one history per template, copy it per sandbox) | Not built. `plan.ts` seeds names, budgets, bids and planted problems from `seedValue`, one value per student, so no two students share a world and the copy would not match the sandbox's own entities. A cache keyed by seed only helps a reset of the same sandbox, and there the rebuild now takes the same time as the first build |
| **History mode** (built) | The same hourly core, but a batch of 24 ticks is merged in memory and written with one set of statements per advertiser (`lib/engine/io/mergeOutputs.ts`, `BatchOptions.history`). Hourly rows only for the last 14 sim days, daily slices only for the last `sliceDays`, state rows only the latest value. Side effects that ran every tick (audience, experiment, lift, custom bidding, creative review sync) run once per batch |

Result of history mode (same sandbox, same seed):

| Case | Before | After |
|---|---|---|
| 336 ticks (14 days) | 105.8 s | about 30 s (provision with 14 engine days: 36.4 s in total, of which seed 5.5 s) |
| 2,160 ticks (90 days) | 364 s | about 58 s engine plus 6 s seed = 64.6 s per sandbox, in two steps of at most 40 s |
| 30 engine days plus 60 stub days | n/a | 51.8 s |
| Stub only (what `main` does) | 5.5 s | 5.5 s (unchanged, still the default of `provisionSandbox`) |

Cost for a class: 25 students x 65 s is about 27 worker-minutes; with the timer's 4 workers and 45 s budget that is 7 timer minutes if everyone is created at once. Each student's own build takes 2 steps (the welcome page drives them even when no timer runs).

Same numbers as the per-tick path. `tests/engine-io/history-mode.db.test.ts` runs 72 ticks both ways and compares every table the engine writes (hourly, daily with slices, diagnostics, pacing, reach, state): equal to the last digit. The merge rounds each conversion delta to the column scale (Decimal(20,4), revenue (20,6)) before adding, like the database does per tick. It also checks that the result does not depend on how the ticks are chunked, and that rebuilding a sandbox from the same seed gives identical rows.

## What was built

- `lib/engine/io/mergeOutputs.ts`, `runBatch` history option, `claimTicks` (one statement for the tick ledger), `FastForwardParams.history`, `fastForward(..., { history })`, `advanceSandboxJobs`. A failing job ends FAILED (it used to stay RUNNING and be retried by every timer call). A history job finishes on a FROZEN sandbox.
- `runTick(..., { sliceKinds })`: the only change in the core; default behaviour and the golden hashes are unchanged.
- Seed: knob `engineDays` (0 to 180, default 0 = the closed-form stub for everything). With `engineDays > 0` the stub stops before the engine days, the clock starts at the first engine day and `provisionSandbox` runs the history job. Reports, plans, bulk history and experiments read the history, so they moved to `lib/seed/after-history.ts` and run after it (inline when `engineDays` is 0, so nothing changes for the existing tests). `clearSandboxData` now also removes pacing, reach, conversion, state, tick log and job rows, so a rebuild starts clean.
- M18-05, `lib/sandbox/provision.ts`: `enqueueProvisionSandbox` (idempotent, one PENDING row), `runProvisionStep` (atomic claim, seed, access grant, history job in 24-tick chunks, post-history seeds, READY), `retryProvisionSandbox`, `advanceProvisioning` (called by the tick route: starts students who have an account but no sandbox, builds queued ones), `getProvisionView`. States QUEUED, BUILDING, READY, FAILED over `ProvisionState` PENDING, SEEDING/BACKFILLING, READY, FAILED. Student sandboxes use 90 engine days (`SANDBOX_ENGINE_DAYS`, 0 to 90, overrides it).
- UI: `/sim/welcome` shows the progress bar and drives the job (`POST /api/sim/provision`), "Try again" on failure; the account page (`/manage/accounts/[userId]`) shows the state and has "Create sandbox" / "Retry provisioning".
- Tests: `tests/engine/merge-outputs.test.ts`, `tests/engine-io/history-mode.db.test.ts`, `tests/sandbox/provision.db.test.ts`, `tests/e2e/provision.spec.ts`.

## Not done

| # | Gap | Reason / where it goes |
|---|---|---|
| 1 | The engine delivers far less than the closed-form stub: on the same sandbox the stub shows about 480k impressions and 38k spend per day across the line items, the engine about 50k and 11k. With 90 engine days there is no seam, but the history now has the engine's volume, not the stub's. With a mixed history (`engineDays` 14) the chart drops on day 14 | Engine calibration (supply volume, pacing, learning), not provisioning. Either raise the engine's volume or lower the stub's plan numbers |
| 2 | The sandbox starts the history with fresh `SimState`: learning phase, budget-segment spend (`segSpent`) and frequency start at the first engine day. With 90 engine days that is the start of the flights, so it is consistent; with fewer engine days the IO pacing percentage ignores the stub's earlier spend | Use `engineDays` 90 for students (the default), or seed `SimState` from the stub totals |
| 3 | Alerts in history mode: only the latest decision of each alert per 24-tick batch is written, so an alert raised and resolved inside one batch leaves no row, and `firstSeenAt` is the end of the batch | Accepted for a backfill; live ticks keep the per-tick behaviour |
| 4 | Storage (RC-057, free tier 500 MB), data bytes per sandbox from `pg_column_size`, 90 engine days: slices kept 14 days: daily 12.5 MB + hourly 3.2 MB + diagnostics 4.2 MB = about 20 MB (25 students 500 MB, too much); 7 days about 14 MB; 3 days about 10.5 MB (25 students about 260 MB plus indexes). Student sandboxes therefore use `STUDENT_SLICE_DAYS = 3`. The stub alone is 7 MB. Diagnostics are written for all 90 days (31k rows) although engine.md 1.4 keeps 30 days; the live engine adds about 1.4k slice rows a day per sandbox | Trim diagnostics older than 30 sim days in history mode and in `runRetention`; recheck with the P6-03 load test |
| 5 | `resetSandbox` (engine.md 10.2, `lib/engine/server.ts`) still only deletes simulation rows and sets tick 0. The rebuild with history is `provisionSandbox(..., { force: true })` / `retryProvisionSandbox`; the instructor console reset (M18-09, P5-01) should call `runProvisionStep` after marking the sandbox PENDING | P5-01 owns the reset UI. `clearSandboxData` and the claim are ready for it |
| 6 | Existing student accounts without a sandbox (for example "test manual") are started by the timer (`advanceProvisioning`, 3 per call) and when the student opens `/sim/welcome`. There is no bulk "create missing sandboxes" button | The timer is not enabled in production until the owner sets the secrets (ADR-048); the welcome page covers it meanwhile |
| 7 | `after()` starts the first step right after `createAccount` responds; on Vercel Hobby that step is cut at 60 s. Anything unfinished is continued by the next step, so this only costs time | None needed |
| 8 | The demo class bootstrap (`prisma/bootstrap/20-demo-class.bootstrap.ts`) and `/sim/admin/seed` still build the stub-only sandbox (`engineDays` 0) | Fast and deterministic for tests; switch with `knobs: { engineDays }` if wanted |
| 9 | No Playwright run of the full 90 engine days (about a minute); the e2e server uses `SANDBOX_ENGINE_DAYS=3` (`playwright.config.ts`) | Keeps the suite fast; the 90 day build is measured in `tests/engine-io/history-mode.db.test.ts` style runs, see the numbers above |
| 10 | `E2E-INS-04` (instructor "Create sandbox" and reset, `tests/e2e/instructor.spec.ts`) is racy: it waits for the roster to show READY, but the job builds in steps and the roster does not refresh while a row is BUILDING. A reload-based wait failed in CI (a reload aborts the request that is building), and a wait that re-clicked "Create sandbox" or called the tick endpoint did not help: the tick endpoint's access-window tick freezes the new sandbox of a closed class (the roster then shows FROZEN, not READY), and with five parallel workers a row stayed SEEDING for the whole wait. The spec is restored to the version that passed CI (8cf2484). Follow-up: wait on the database state, nudge the job without the window tick, and look at why a claimed row can stay SEEDING under load (a claim is only taken over after `STALE_MS`, 5 minutes) | Follow-up PR; the production paths (welcome page, timer, account page retry) are covered by `tests/sandbox/provision.db.test.ts` |
