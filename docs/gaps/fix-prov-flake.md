# FIX-PROV-FLAKE: a sandbox build that never reaches READY

## Symptom

- `tests/e2e/provision.spec.ts` E2E-ADM-01 timed out after 6 min at `/sim/welcome` (`toHaveURL /p/.../home_v3`). It
  passed alone and failed after `demo-path.spec.ts`; it also failed on clean `65a83ad`.
- The `prod-like` crawler job (two students built by the real job) failed on roughly every second CI run.
- Possibly a production bug: a student stuck at `/sim/welcome` with 25 students at once.

## Root cause (measured, not assumed)

The build did not starve and did not hang. **It ended FAILED five seconds after it started**, and FAILED is final for the
welcome page (`useProvisionDriver` stops on `FAILED`), so the page showed the error card until the test gave up.

Reproduced locally (Postgres 17 on :54329, production build, `SANDBOX_ENGINE_DAYS=3`, `demo-path` then `provision`,
`--workers=1`): the failing run, with a monitor on the `Sandbox` table:

```
12:16:29  sandbox created           SEEDING
12:16:35  last update               FAILED
provisionError: Invalid `prisma.userAccessGrant.create()` invocation:
                Unique constraint failed on the fields: (`userId`,`sandboxId`,`partnerId`,`advertiserId`)
SimJob: one FAST_FORWARD job, DONE, 72/72 ticks  (the history itself was fine)
```

`ensureStudentGrant` (`lib/sandbox/provision.ts`) was check-then-create. Build steps overlap by design
(docs/gaps/prov-drive.md): the `after()` step that `enqueueProvisionSandbox` starts, the welcome page's
`POST /api/sim/provision`, the account page, `maybeAdvance`. A step that loses the SEEDING claim re-reads the row, sees
BACKFILLING (the winner has just set it) and runs the BACKFILLING branch, which also calls `ensureStudentGrant`. Both look
for the grant, both find none, both create; the unique index
`(userId, sandboxId, partnerId, advertiserId) NULLS NOT DISTINCT` rejects the second, and the BACKFILLING branch's
`catch` marks the **whole sandbox FAILED** although the other step was doing fine.

That is why it looked order and timing dependent: it needs two steps in the 100 ms or so between "seeded" and "grant
created", which depends on how busy the server and database are (after `demo-path`, with the Super admin's page and the
student's page both calling at once). It is a real production bug: any student whose first two calls overlap (a slow
network, two tabs, the after-hook plus the first POST, which is the normal case) can end FAILED and has to press "Try
again". The prod-like job builds two students through the real path, which is the same overlap.

## Hypotheses tested

| Hypothesis | Result |
| --- | --- |
| Leftover QUEUED/BUILDING sandboxes from other specs fill the global advancer's `limit: 2` | **Not the cause here.** The fixtures create `READY` sandboxes; at the failure no other sandbox was unfinished. Still covered by a test: three older queued builds in another cohort, the new student reaches READY with their own steps and the older ones stay untouched (they are never needed) |
| Stale claim retake (60 s) races the step budget (40 s) | **Not the cause.** The heartbeat (10 s) keeps a live build far from `STALE_MS`; the failing build never went stale, it was FAILED |
| `claimSlot` intervals (OWN 15 s, GLOBAL 60 s) never granted to the student | **Not the cause.** They only gate the lazy page-load path; the welcome page drives its own build through `POST /api/sim/provision`, which does not use them |
| Engine history chunk stuck | **No.** The job was DONE, 72/72 ticks |
| `SANDBOX_ENGINE_DAYS=3` path | **No.** Same code as 90 days, just shorter |
| Four builds with the global run only (2 per run, first come first served) | All finish; covered by a test |

## Changed

1. `lib/sandbox/provision.ts` `ensureStudentGrant`: `createMany({ skipDuplicates: true })` (`INSERT ... ON CONFLICT DO
   NOTHING`). The duplicate is no longer an error, so overlapping steps cannot fail the build over it. Build time is
   unchanged.
2. `tests/e2e/provision.spec.ts`: the wait for the sandbox home now polls the database state as well and fails **at once**
   with the stored `provisionError` when the build is FAILED, instead of waiting 6 minutes on the URL. The 360 s bound
   stays; it is not raised.
3. `tests/sandbox/prov-concurrency.db.test.ts` (new):
   - 10 overlapping steps on a BACKFILLING sandbox whose grant is missing, four rounds: none ends FAILED, exactly one
     grant. **Failed before the fix** (`FAILED` with the unique constraint message), passes after.
   - three callers at once until READY: never FAILED, one history job, the clock ends at tick 2160 (a second history job
     would run past today), one grant.
   - three older queued builds in another cohort plus a new student: the new student reaches READY within 120 s by their
     own steps.
   - four builds moved only by the global `advanceProvisioning` (limit 2): all reach READY.

## Not changed / follow-up

- `tests/e2e/prod-like-crawler.spec.ts` has the same 360 s URL wait; it is not in this branch's file ownership. The same
  poll-on-state change can be applied there.
- The BACKFILLING `catch` still marks the sandbox FAILED for any error of a step. After this fix a concurrent loser has
  no known error to report, but the principle (a step that is not the owner should not end the build) deserves a look if
  another overlap error ever shows up; the message now lands in the test failure, so it would be found.
