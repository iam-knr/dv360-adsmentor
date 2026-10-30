# PROV-DRIVE: provisioning and the engine without the GitHub cron

## Problem

The engine-tick workflow (`.github/workflows/engine-tick.yml`, `*/5 * * * *`) is throttled by GitHub on this account and
fires only every few hours. Sandbox provisioning (`lib/sandbox/provision.ts`) only moved when something called
`runProvisionStep`: the timer, the student's `/sim/welcome` page, or "Create / Retry sandbox". The Super admin's account
page did not poll, so a build sat at BUILDING 61% until the next timer run. The simulated world moved only on the tick.

## What drives a build now (no timer needed)

| Driver | When | Code |
| --- | --- | --- |
| Super admin account page | While the sandbox is QUEUED or BUILDING the Sandbox section POSTs one step at a time and shows state and percentage; stops at READY or FAILED, then refreshes the page | `components/manage/SandboxSection.tsx`, `POST /api/manage/accounts/[userId]/provision`, `driveSandbox` in `lib/accounts/service.ts` |
| Student `/sim/welcome` (also where `/` sends a student with no READY sandbox) | Same loop, against `POST /api/sim/provision` | `components/sim/ProvisionProgress.tsx` |
| Any page load | Rate limited "maybe advance" after the response (see below) | `lib/sandbox/maybe-advance.ts` |
| Engine timer | Still works, no longer required | `app/api/sim/engine/tick/route.ts` |

Both browser loops share `components/sim/useProvisionDriver.ts`: one call at a time (a step takes up to the 40 s step
budget, under the 45 s limit; the "Restart provisioning" button is disabled while a step is in flight), 2 s between calls,
doubling up to 30 s after errors, paused while the tab is hidden and resumed when it is visible again, stopped on READY,
FAILED, NOT_CREATED or a 401/403/404.

A student who closes the tab is covered by "maybe advance" and by the admin's page.

## Maybe advance

`scheduleMaybeAdvance()` runs `maybeAdvance()` with `after()`, so it is off the critical path. It is called from the
`(dv)` layout (every sandbox page), the `/manage` layout and `/sim/welcome`.

- **Own sandbox:** a student's sandbox runs `ensureCaughtUp` (engine.md 1.4) at most every 15 s per sandbox.
- **Global:** at most once per 60 s, one caller runs `advanceProvisioning` (moves PENDING, stale SEEDING and
  abandoned BACKFILLING builds, 2 per call; it does not start students who have no sandbox: that stays with the timer, the
  welcome page and "Create sandbox", so a page load never starts a pile of builds) and then `runDueTicks` for up to 5
  sandboxes with what is left of a 30 s budget, under the 60 s Hobby limit.
- **Rate limit without memory:** `claimSlot` is one `INSERT ... ON CONFLICT DO UPDATE ... WHERE value <= now - interval`
  on the existing `AppMeta` table (keys `prov-drive:global`, `prov-drive:own:<sandboxId>`). Concurrent callers queue on the
  row lock, so exactly one wins; the rest return at once. No migration.
- A build step itself is already safe to run twice at once: the claim is one conditional UPDATE and the history job is
  locked through the clock row.
- `advanceProvisioning` now also picks BACKFILLING builds whose heartbeat is older than 20 s (a step that ended on its
  budget or a function that died). Before, those waited for the engine's job loop, which ran in the timer.

Limits: the layout hook runs on a full page load; soft navigations inside the app do not re-run a layout. That is
enough to unstick builds (the Super admin and the student pages drive them directly) but the world of an idle student
who never loads a page still waits for the next page load by anyone, or the timer.

## Recommended: an external pinger as a second driver (not implemented)

Point a free external scheduler (cron-job.org, UptimeRobot, a Cloudflare Worker cron) at the tick endpoint every 1 to
5 minutes:

```
POST https://<host>/api/sim/engine/tick
Authorization: Bearer $CRON_SECRET
```

It is independent of GitHub's throttling, needs no code change, and with "maybe advance" in place a duplicate call is
harmless (the engine claims sandboxes atomically). Keep the GitHub workflow as a third driver or retire it.

## Tests

- `tests/sandbox/prov-drive.db.test.ts`: slot rate limit and race (12 concurrent callers, one wins), two simultaneous
  `maybeAdvance` calls start a queued build once, two steps on one sandbox seed once, an abandoned BACKFILLING build is
  continued, a build reaches READY by repeated steps alone.
- `tests/e2e/provision.spec.ts` E2E-ADM-03: the Super admin adds a student, the account page reaches `State: READY`
  without a reload, the student signs in and reaches the sandbox home.
