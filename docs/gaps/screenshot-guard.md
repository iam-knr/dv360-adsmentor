# Screenshot guard

Owner request (31 Oct): if someone takes a screenshot, the student is kicked out directly and the Super admin is notified; the Super admin can release access again, and can allow or disallow screenshots for individual students.

## What this is, and what it is not

**A browser has no API to detect or block a screenshot.** What is built is a *tripwire and a deterrent for the common keyboard routes*, not prevention. It recognises:

| Method (stored value) | What is recognised |
|---|---|
| `PRINT_SCREEN` | `PrintScreen`, with or without Alt / Ctrl / Shift, on key down **or** key up (Windows often delivers only the key up) |
| `WIN_SHIFT_S` | Meta+Shift+S (Windows snipping tool; on a Mac this is also Cmd+Shift+S, "Save as") |
| `MAC_SHORTCUT` | Meta+Shift+3 / 4 / 5 / 6 (macOS screenshot shortcuts, also with Ctrl) |
| `PRINT_SHORTCUT` | Ctrl+P / Cmd+P |
| `PRINT_EVENT` | the browser's `beforeprint` event (File > Print, the menu, `window.print()`) |

**Not detected, and it cannot be:** phone cameras, screen recorders, remote desktop and screen sharing, OS tools started from a menu or an icon, browser extensions, a second device, the Windows Win+Shift+S chord on browsers/OSes that do not deliver the `S` key to the page (the OS swallows it), a student who disables JavaScript or blocks the report request. A student who knows this can get around it. Say so to students and staff plainly; the UI copy on the Security page and the account page does.

Printed output of a guarded student is blank (`@media print { html, body { display: none } }`).

Not built (skipped as risky, as the request allowed): hiding the page when the document goes hidden right after a recognised chord. A hidden/blur heuristic would fire on the Windows key opening the Start menu and on every alt-tab.

## Privacy: no keystroke logging

* The guard does **not** log keystrokes. Each key event is compared with the list above in one pure function (`lib/security/screenshot-detect.ts`) and dropped. Letters, digits, Shift+3, Shift+S and typing in inputs never match and never leave the page.
* Only a **recognised event** is sent and stored: the **method** (one of five fixed values), the **page path** (path only; no query string or fragment, control characters removed, at most 200 characters) and the **time**. The signed in person comes from the session, never from the request body.
* Stored in: `SecurityEvent` (id, user, kind, method, path, occurredAt, seenAt, restoredAt, restoredById), the suspension columns on `User` (below) and `AuditLog` rows (`SCREENSHOT_DETECTED`, `ACCOUNT_SUSPENDED`, `SCREENSHOTS_ALLOWED`, `SCREENSHOTS_DISALLOWED`, `ACCOUNT_RESTORED` with `reason: SCREENSHOT_SUSPENSION`). Audit retention is the usual 365 days.
* No screenshot, image or clipboard content is ever read or stored.

## How it works

**Client** (`components/security/ScreenshotGuard.tsx`, pure detector in `lib/security/screenshot-detect.ts`). Mounted by the `(dv)` and `/sim` layouts only for a signed-in student whose `screenshotsAllowed` is false (`lib/security/guard-policy.ts`); never for the Super admin, also not while the Super admin views a student (view-as). On the first recognised event it reports (`navigator.sendBeacon`, falling back to `fetch` with `keepalive`) and goes to `/sim/suspended` at once. Key down and key up of one press are one report. If the report cannot be sent (offline, request blocked) the student is still sent away, but the server does not know about it; the server is authoritative only for what it receives.

**Server** (authoritative, independent of the client). `POST /api/security/screenshot-event`: same origin only (Origin must equal the host, else 403), body capped at 2 KB, method must be one of the five values, signed-in session required, rate limited to 20 per minute per account (`AuthThrottle`, shared across serverless instances), idempotent. A Super admin, a student with `screenshotsAllowed = true` and a view-as session are ignored (200 `ignored`). For a guarded student `recordScreenshotEvent` (`lib/accounts/screenshot-guard.ts`) does, in one transaction: set `User.accessSuspendedAt / Reason (SCREENSHOT) / Method / Path / ById (null = automatic)`, bump `sessionVersion` and clear `activeSessionId` (the same mechanism as "Sign out everywhere"), create the `SecurityEvent` (the Super admin alert) and write the two audit rows. The conditional `updateMany` is the idempotency gate: concurrent or repeated events create exactly one suspension, one event and one pair of audit rows.

**Every request of a suspended student is refused.** The check is part of session resolution (`evaluateSession` in `lib/auth/session-check.ts`, reason `suspended`, checked before the session version so the reason is kept): pages redirect to `/sim/suspended`, route handlers answer 401, server actions fail like any signed-out call. Sign in is refused with the same message *after the right password* (`authenticate`, code `suspended`); a wrong password still says "Incorrect email or password". `/sim/suspended` is public (no session needed) and shows only: "Access suspended. A screenshot attempt was detected. Contact your administrator." The Super admin is immune (`appRole` is checked in the rule, the service and the endpoint).

**Super admin.**
* Account page > Screenshots: Allow / Disallow (confirm, audited, default *not allowed* for students); when suspended, a red banner with reason, time, method, page and **Restore access** (confirm, audited as `ACCOUNT_RESTORED`). Restore clears the suspension and closes the alert; the student signs in again (old cookies stay dead); the screenshots switch stays as it was.
* Accounts list: chip "Suspended (screenshot)", a "Suspended only" filter (`?suspended=1`), bulk **Allow screenshots / Disallow screenshots / Restore access** (each id in its own transaction; skipped rows carry their reason), an unread-events link.
* `/manage/security`: when, who, method, page, status (Open / Restored), restored by. Opening it marks the events seen. A red banner on every `/manage` page while any student is suspended, an unread badge on the Security navigation link, and a 30 second poll (`GET /api/manage/security`, like the student bell) that shows a toast when a new suspension arrives while the Super admin is online.
* There is **no email service**: the in-app alert (page, badge, banner, toast) plus the audit log is the delivery. Email is a follow-up.

## Data

One migration, `0014_screenshot_guard`: five columns on `User` (`screenshotsAllowed` default false, `accessSuspendedAt/Reason/Method/Path/ById`) and the global table `SecurityEvent`. Additive only. Existing students become "not allowed" on deploy, as requested.

Row level security: `SecurityEvent` and `User` are global tables read and written only through the owner connection (the same as `AuditLog` and `User`); the `app_tenant` student role never touches them (`prisma/sql/50-grants-and-defaults.sql`), so no policy is needed and none was added. The prod-like crawler (RLS enabled on every table, owner exempt) is the real check.

## Tests

* Unit: `tests/accounts/screenshot-detect.test.ts` (every combination, non-matching keys, typing, path normalisation, guard policy, same-origin), `tests/auth/session-check.test.ts`, `tests/auth/guard.test.ts`.
* Component: `tests/components/screenshot-guard.test.tsx`.
* DB: `tests/accounts/screenshot-guard.db.test.ts` (suspend, session invalidation, login refused, restore, switch, bulk, idempotency incl. concurrent events, Super admin and allowed student immune, rate limit, list, summary).
* E2E: `tests/e2e/screenshot-guard.spec.ts` (PrintScreen -> suspended page, later request refused, Super admin sees event / badge / banner / toast, restore, student signs in again; allowed student not suspended; typing `s`, digits, Shift+3, Shift+S does nothing).
* Prod-like crawler: the crawler's student stays guarded and presses no keys, which also proves the guard mount does not break any crawled page.

## Follow-ups

* Email the Super admin on a suspension (needs an email provider).
* Optional per-cohort default for the switch; cohort page bulk actions (not built: the cohort page has no member selection to hang them on).
* A visible hint to students that screenshots are not allowed (left out so as not to advertise the exact list).

## Update 1 Nov 2026: shortcuts the page cannot see

Owner test: Print Screen is caught; Win+Shift+S, Ctrl+Shift+S and the Mac shortcuts were not.

- **Why:** the operating system handles Win+Shift+S and macOS Cmd+Shift+3/4/5 itself and keeps the last key, so the page never receives the `S` or the digit. Matching `Meta+Shift+KeyS` (the first version) only works if the browser happens to see it.
- **Ctrl+Shift+S** (Edge Web Capture, Firefox screenshot tool) is a browser shortcut that the page does see: now a direct match, method `BROWSER_CAPTURE`.
- **Win/Cmd+Shift plus focus loss** (`SnipChordTracker`, method `SNIP_CHORD`): the page tracks only whether the Meta and Shift keys are down. When both are held, no other key is delivered, and the window then loses focus within 2 seconds (the snipping overlay takes focus), it counts as a probable snip. Nothing about typed keys is recorded or sent.
- **Known false positives:** Win+Shift+Tab and Cmd+Shift+Tab (the switcher also takes focus and the OS keeps the Tab). Accepted for now; the Super admin can Restore access.
- **Still not detectable:** snipping tools started from the Start menu or a taskbar icon, browser or OS extensions, screen recorders, remote desktop, phone cameras. A visible watermark with the student's email is the stronger deterrent for those and is a possible follow-up.
- **Not tested on real hardware:** the CI browser is Linux Chromium. The owner's Windows machine is the real test of `SNIP_CHORD` (does the snipping overlay blur the page in Edge/Chrome on Windows 10 and 11?). If it does not blur, the next step is a Super admin "capture lab" page that shows which events the browser delivers for each shortcut, so the rule can be tuned from real data.
