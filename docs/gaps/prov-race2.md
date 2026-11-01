# PROV-RACE2: remaining ways an overlapping provisioning step ends a build wrong

Follow-up to docs/gaps/fix-prov-flake.md (PR 53 fixed the `ensureStudentGrant` race). A second rare failure was seen once
(`tests/sandbox/provision.db.test.ts` "timer > starts students who have an account but no sandbox", sandbox FAILED
instead of READY, `provisionError` not kept). This pass lists every write of the build that is not idempotent under
concurrency, proves the ones that are real with a stress test, and fixes them.

## The stress test

`tests/sandbox/prov-stress.db.test.ts`: 12 students in two cohorts, each driven by 3 to 5 simultaneous callers looping
over `runProvisionStep` (twice as likely: welcome page, account page, `after()` step), `advanceProvisioning` (timer),
`maybeAdvance` (page load, slot interval 0) and `retryProvisionSandbox`, with random budgets and 0 to 60 ms delays. The
random stream is seeded (`STRESS_SEED`, printed). Afterwards every sandbox must be READY, with one access grant, one
clock at tick 2160 RUNNING, exactly one DONE history job, `resetCount` 0, and the same row count as a quiet single
caller build in every table that has a `sandboxId` column (entity tables exactly; metric tables within 3 %, they differ a
little between sandboxes of one seed). Any FAILED seen at any moment is collected with its `provisionError`, and the
assertion message carries every problem and the seed.

Before the fix (seed random and seed 1, current main), every one of the 12 sandboxes was wrong:

```
history jobs [RUNNING, RUNNING, DONE, RUNNING, RUNNING]      (a quiet build has one DONE job)
clock at tick 2208, not 2160                                  (a second history job ran past "today")
Experiment 12 rows (quiet 4), Plan 132 (44), Report 42 (14), LiftResult 876 (292), ...   (post-history seeds ran 3 times)
SimJob 5 rows (1), SimTickLog 168 (72), SimDailyMetric 9770 (5053)
```

No FAILED was seen on main in those runs: the damage was silent (duplicated reports, plans, experiments and metrics, a
clock past today), which is worse than a FAILED build the student can see.

## Hypotheses

| # | Hypothesis | Measured | Result |
| - | --- | --- | --- |
| H1 | `finishBackfill` runs more than once: it read BACKFILLING, then ran the post-history seeds and set READY in separate steps. The job runner (job DONE) and a step that finds the job DONE (`resumeBackfill`) both reach it | Reports 3x, Plans 3x, Experiments 3x, LiftResult 3x in the stress run | **Real.** Fixed: one transaction that locks the Sandbox row (`FOR NO KEY UPDATE`), re-checks BACKFILLING, seeds, grants and sets READY. The second caller waits and finds READY |
| H2 | Two history jobs: a step sees BACKFILLING before the claimant has created the job (`provisionSandbox` sets BACKFILLING, then `fastForward` creates the job), finds no job and `resumeBackfill` creates one; both then run | 2 to 7 FAST_FORWARD jobs per sandbox, clock 2184/2208 | **Real.** Fixed: `createHistoryJobOnce` (advisory lock per sandbox, reuses an open or DONE history job) |
| H3 | Two runners of one job use a stale copy of `progress` (the copy they were handed) and run past `simHours`; a stale runner also wrote `RUNNING` over a `DONE` job | Clock past 2160, leftover RUNNING jobs next to DONE ones | **Real.** Fixed: each batch locks the job row (`FOR UPDATE SKIP LOCKED`), reads the stored progress, runs the ticks and writes progress, and the DONE transition, in the same transaction |
| H4 | READY visible before the student's grant exists (grant created after `provisionSandbox`, which can finish READY) | not seen in 100 builds (window of milliseconds) | Closed anyway: the grant is created in the same transaction as READY in `finishBackfill` (PR 53's `createMany skipDuplicates` stays for the other paths) |
| H5 | Transient database errors end the build FAILED: any error of a step marks the sandbox FAILED, and `provisionSandbox` / `runJob` marked it FAILED themselves before the caller could retry | Stress run on the fixed H1 to H3 code: `Timed out fetching a new connection from the connection pool (connection limit 9)` ended two sandboxes FAILED, with every caller seeing FAILED | **Real.** Fixed: bounded retry (4 tries, growing pause) of transient errors (unique violation, serialization, deadlock, connection reset, pool timeout, closed transaction): per engine batch, per seed, per grant, per BACKFILLING step. `provisionSandbox` and `runJob` no longer write FAILED for a transient error, so nobody sees FAILED while a retry runs. Real errors still end FAILED with the message at once |
| H6 | Stale claim retake (60 s) races the step budget (40 s) | Heartbeat every 10 s keeps `updatedAt` fresh; retake needs 60 s of silence; no double claim in any run (the claim is one conditional UPDATE) | Not a cause |
| H7 | Two enqueues for one user | Unique `(classroomId, ownerUserId)`; the loser reads the winner's row | Idempotent already |
| H8 | `startSandboxClock` (SimClock RUNNING) twice, admin pause marker, resume markers | `updateMany where state = PAUSED` is atomic and conditional; markers are upserts/deleteMany | Idempotent already; the stress run ends with exactly one RUNNING clock |
| H9 | `claimSlot` (AppMeta) | One `INSERT ... ON CONFLICT DO UPDATE ... WHERE` statement | Idempotent already |
| H10 | Super admin or student Retry while a step runs | `retryProvisionSandbox` only restarts FAILED or SEEDING with a heartbeat older than 20 s | Not a cause; included as a caller in the stress test |

## The single failure of the FLAKE-DB run (honest status)

Read from the code, that test has one caller and `after()` throws outside a request, so there is no overlapping step in
it; H1 to H3 need two callers. What its history shows is a FAILED build with no kept `provisionError`. The only FAILED
cause I could produce that does not need a second caller is H5 (a transient database error: connection pool timeout,
transaction start timeout under a loaded machine, in a run of 4 full db runs one after the other). That is a hypothesis
from measurement, not proof for that one event. What is guaranteed now: a transient error no longer fails the build,
and any other FAILED names its cause in the stress assertion (every `provisionError` and the seed are in the message).
`provision.db.test.ts` is not touched here (FLAKE-DB, PR 63, owns its diagnostic edit).

## Changed

- `lib/db/transient.ts` (new): `isTransientError`, `withTransientRetry` (+ `tests/engine/transient.test.ts`).
- `lib/engine/io/jobs.ts`: `createHistoryJobOnce`. `lib/engine/server.ts`: `fastForward` uses it for history jobs;
  `runJobChunks` locks the job row per batch and keeps progress and DONE in the batch transaction; batches retry
  transient errors; `runJob` leaves the job and sandbox alone on a transient error.
- `lib/seed/after-history.ts`: `finishBackfill` is one locked transaction (seeds, grant, READY). `lib/seed/sandbox.ts`:
  no FAILED for a transient error. (These three are outside the listed ownership but are where the races are; the diffs
  are small.)
- `lib/sandbox/provision.ts`: seed, grant and BACKFILLING step retry transient errors; the step's catch marks FAILED
  only after the retries are spent or for a real error.
- `components/sim/ProvisionProgress.tsx`: the student's FAILED card keeps the message and offers **Retry** (disabled
  while the call runs). It existed as "Try again"; the driver still stops at FAILED (no automatic retry of real errors).
  `tests/components/provision-progress.test.tsx`.
- Tests: `tests/sandbox/prov-stress.db.test.ts`, `tests/sandbox/prov-transient.db.test.ts` (transient retried, bounded,
  real error FAILED at once, finish runs once).

## Known limit

A stale step from an old build can still mark a rebuilt sandbox SEEDING FAILED if its own (real) error arrives after the
rebuild started; needs a rebuild during a running step plus a real error. Not changed.

## Gate results (measured)

- Stress test on the fixed code: 21 of 21 passes on the final test code (16 loop runs with seeds 1007 to 1022, the last
  ten with `CI=1 TZ=UTC`, plus 5 extra with `CI=1 TZ=UTC`), `SANDBOX_ENGINE_DAYS=3`. One earlier run failed because a
  caller of the test itself got a pool timeout (9 connections, ~48 callers); the test now tolerates a transient error
  of a caller and retries its own polling. On main the same test failed in every sandbox (see above).
- `npm run check` green; `npm run test:db` green twice in a row (75 files, 837 tests); a first full run failed once
  in `history-mode.db.test.ts` (my first dedupe reused a finished history job; it is now opt-in for provisioning) and
  once in the stress test's own polling (pool timeout, fixed). Playwright chromium 239 passed; prod-like crawler 3 passed.
