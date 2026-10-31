# ADMIN-POLISH (Super admin console polish after the 31 Oct production exploration): what is not done

Branch `admin-polish`. Product reality: one Super admin and students. No migration was needed (the new audit action `SANDBOX_REBUILT` is a string in `AuditLog.action`).

## What changed (short)

| Item | Change |
| --- | --- |
| S1 | A FAILED sandbox shows "The sandbox could not be built. Try Retry; if it fails again check the Engine page / logs." The raw error is in a collapsed "Details" (`SandboxSection`). |
| S3 | The logo is a link (`/manage/accounts` for a Super admin, `/` for a student). `/sim/me` and `/sim/me/password` have "Back to accounts" / "Back to home" (`components/sim/BackLink.tsx`, `lib/auth/home-href.ts`). Hidden on the forced password change page. |
| S4 | One map of action codes to words: `lib/accounts/audit-labels.ts`, used by the summary, the Action filter and the new `/api/manage/audit.csv`. Archive reads "Archived account" (no "active to archived"). |
| S5 | A placeholder address (`*.invalid`) is never shown: the target is the person's name, or "Former account" when the row is gone. |
| S6 | New "Target" column; accounts and cohorts link to their pages. |
| S7 | "Rebuild sandbox" on a READY sandbox, with a confirmation that the student's work is deleted, audited as `SANDBOX_REBUILT`. It flips READY to PENDING (counted as a reset) through the new thin `rebuildProvisionSandbox` and the normal provisioning job runs. A queued or building sandbox is never restarted by it. |
| S8 | `lib/sandbox/labels.ts`: Queued, Building, Ready, Failed (Not created) in the list, the cohort members table, the account page and the engine page. Database enum names are unchanged. |
| S9 | `BuildProgress`: an indeterminate (always moving) bar, the current step name, the percentage and the elapsed time. |
| S10 to S12 | "Seats used"; the cohort page link above the name reads "Back to cohorts" and the name is the heading; the Engine page has a summary, sandbox counts by state, a parameter table and the raw JSON behind "Show raw configuration". |
| S13 | The email is the second line under the name in the accounts list (the separate Email column is gone). |
| Wording | Seed page: "Seed demo data"; the demo cohort is now named "Demo cohort" (it is renamed on the next seed). |

## Not done / decisions to know

| # | Item | Why |
| --- | --- | --- |
| 1 | Elapsed time on the build bar counts from when the page first saw the build running, not from the real start | The server has no start time column; adding one needs a migration. A reload restarts the counter |
| 2 | Engine "Last run" and "Simulated clock" are the latest across all sandbox clocks. "Tick cadence" is text (60 simulated minutes per tick; run by the timer and on page loads) because the real cadence depends on the external timer | There is no engine heartbeat table |
| 3 | The audit CSV exports the current page (50 rows) of the filtered log | Same page size as the screen; a full export needs a streaming route |
| 4 | Old audit rows keep their stored payload; only the display changed. A row whose target account was purged shows "Former account" | Nothing is rewritten |
| 5 | The Seed page still builds the Demo cohort (three demo students) and the template sandboxes. It is labelled for demo or test databases | It is the only way to get demo data; remove the page if it is never wanted |
| 6 | Rebuild keeps the same sandbox row and ids; users who had the sandbox open see the new data after a reload | Reuses the provisioning job as asked |
| 7 | `ADMIN` enum value, access windows and the class tables remain (see `docs/gaps/adm-fix.md`) | No cleanup migration |
