# ADM-FIX (two account levels, provisioning robustness, console fixes): what is not done

Branch `adm-fix`. Product decision (owner, 2026-10-30): one Super admin and students (USER). No Admin/instructor level, no classes, no exercises or progress, no time controls. No migration was needed.

## What changed (short)

- **Admin level removed.** `/sim/instructor/**`, `/sim/admin/**`, the instructor console (P5-01) and its tests are deleted. `AppRole` (session) is `'user' | 'super_admin'`. The DB enum value `ADMIN` stays (dropping an enum value needs a table rewrite); nothing creates it (`createAccount` refuses it with ACC-020), the account list hides it, sign in treats it as an unknown account, an old cookie of one is refused (`resolveSessionUser`), and every permission table is empty for it. Role guards: `/manage/**` is Super admin only (students get `/sim/forbidden`); the removed routes are plain 404s.
- **No time controls.** Class windows are not enforced anywhere (middleware gate, `/sim/closed`, `/api/sim/access/*`, the `(dv)` guard, the window banner and watcher are gone). Access periods on accounts are ignored at sign in. Sandboxes that a window froze are thawed by the engine timer (`lib/sandbox/thaw.ts`).
- **Cohorts are optional.** A student added without a cohort joins the hidden default cohort (`code = 'students'`, owned by the oldest Super admin, capacity 100,000), because `Sandbox.classroomId` is NOT NULL. The sandbox is found by its owner (`resolveClassContext`), so moving a student between cohorts keeps it. New: cohort detail page with members, edit and archive (archiving moves the students to the default cohort).
- **Where Super admin pages live:** `/manage` (accounts, cohorts, audit log, `/manage/seed` (was `/sim/admin/seed`), `/manage/engine` (was `/sim/admin/engine`)). Landing for a Super admin is `/manage`; for a student `/sim/welcome`, which shows the build and opens the sandbox home when it is ready.

## Not done / decisions to know

| # | Item | Why |
|---|---|---|
| 1 | The `ADMIN` enum value, `AccessWindow`, `ClassroomMember` rows and the other class tables stay in the schema (and the `idleMinutesAdmin`, `absoluteHoursAdmin`, `singleSessionAdmin` policy columns) | Removing them is a risky migration with no user-visible gain. A later cleanup migration can drop them once production has no ADMIN rows |
| 2 | Existing ADMIN accounts in a database are not converted or deleted; they are hidden and cannot sign in. Classes they own stay as cohorts (their owner column is no longer shown) | Owner asked for no risky migration; promote or archive them by hand if wanted |
| 3 | The root cause of a row staying SEEDING 150 s+ under parallel workers (docs/gaps/eng-ff.md gap 10) was not reproduced. The seed runs in one transaction that also upserts shared global rows (app catalogue, YouTube videos), so parallel builds may queue behind each other; that is the likely cause but is unproven | Recovery is now robust whatever the cause: a heartbeat every 10 s, a 60 s stale window (was 5 min), and "Restart provisioning" takes over any build whose heartbeat is older than 20 s. Moving the shared-row upserts out of the seed transaction is the next step if it still shows up |
| 4 | "Restart provisioning" does not interrupt a build that is alive (heartbeat younger than 20 s); it returns the current state | Two builders on one sandbox would corrupt it |
| 5 | A student with no cohort and no sandbox who opens `/sim/welcome` sees the 404 page (accounts made through the service always get a cohort; only very old rows can lack one). The account page's "Create sandbox" fixes it (it assigns the default cohort) | Edge case of pre-P3-02b data |
| 6 | CSV import of students does not exist (only the CSV export), so there is no import to update. Students are added one by one with the form | Out of scope; `lib/accounts/csv.ts` is the export writer |
| 7 | `?sim_class=` is still accepted by the URL plumbing (sticky params, headers) but has no effect | Left in `lib/routes/sim-params.ts` and `lib/auth/view-as-headers.ts` to avoid touching shared route code |
| 8 | Super admin "view as student" is kept (it was Admin and Super admin; now Super admin only) | It is the only way to look into a student's sandbox |
| 9 | Announcements (`lib/history/notifications.ts`) still have audiences `STUDENT` and `INSTRUCTOR`; a Super admin gets the second. There is no UI to create them any more (the console page was deleted) | Table and reader kept; a Super admin page for them is not requested |
| 10 | The accounts table hides Cohort and Last sign in below 1380 px (Name, Email, Level, Status, Sandbox always show) instead of scrolling | Item 7 of the brief; full columns return on a wide screen |
