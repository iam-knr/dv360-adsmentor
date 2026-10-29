# Classroom demo script (Phase 3 minimum viable demo)

Written by P3-INT. The same steps run automatically in `tests/e2e/demo-path.spec.ts` (a synthetic instructor and student
in the test database) and `tests/e2e/admin-seed.spec.ts` (reseeding). Run them with `npm run e2e` (see
`docs/PROJECT-LOG.md` 9.4 for the local setup).

## Before the class

1. Sign in as a Super admin (the account `SEED_SUPER_ADMIN_EMAIL` creates on deploy).
2. Open `/sim/admin/seed`, type a password of at least 10 characters for the demo accounts and press
   **Seed demo class and templates**. It takes about 15 seconds. It creates the Demo class (instructor
   `instructor@example.test`, students `student1..3@example.test`, window open for 30 days, one `starter-agency`
   sandbox each) and the three template sandboxes. Running it again changes no password.

## The demo

| # | Who | Step | You should see |
|---|---|---|---|
| 1 | Instructor | Sign in at `/sim/login` | Instructor home (`/sim/instructor`); the class window is open |
| 2 | Student | Sign in with the student email and the password from the seed step | `/sim/welcome`, then **Open Overview** opens the Overview (`/p/{partner}/home_v3`) |
| 3 | Student | Open the advertiser, **Campaigns**, **New campaign**. Name it, goal *Raise awareness*, KPI *CPM* = 50, creative type *Display*, **Create** | The campaign opens on its Insertion orders tab |
| 4 | Student | **New Insertion Order**, *Standard*, *Brand awareness*, **Next**. Press **Create** with an empty name | Red "Enter a value", the page stays |
| 5 | Student | Fill the name, Segment 1 budget and KPI value, **Create** | The IO opens on its Line items tab |
| 6 | Student | **New line item**, *Display*, name it, tick a creative, *Does not contain EU political ads*, **Create** | Details page, status *Draft* |
| 7 | Student | Activate the campaign and the IO from their lists (hover the status dot, **Activate**), then set the line item to *Active* and **Save** | Status *Active* |
| 8 | Timer | The 5-minute timer (`POST /api/sim/engine/tick`) advances the sandbox clock. For a quick demo the instructor can fast-forward from the engine controls once they exist (P5-03); until then wait for ticks | Hourly rows appear for the line item |
| 9 | Student | Open the line item list with date range *Yesterday* | Impr., Clicks and Revenue are non-zero, and the Total row matches the sum of the rows |

## Known differences from the intended demo

See `docs/gaps/p3.md`. The ones a presenter will notice: students pass through `/sim/welcome` before the Overview,
there is no creative upload yet (use a seeded creative), the timer only runs once the owner adds the Actions secret
`ENGINE_CRON_URL`, and new sandboxes still show the closed-form 90-day history stub until the engine can fast-forward in
under two minutes.
