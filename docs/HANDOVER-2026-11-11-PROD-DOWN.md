# Handover, 11 Nov 2026: production is down, database is over its free limits

Paste or point the new chat at this file. It holds everything from the previous chat. The new chat should have a browser (Claude in Chrome in Edge, or the built-in browser). The previous chat had none, so nothing below was seen in a dashboard except the Supabase usage page the owner screenshotted.

Owner: Kailas (kautilyaroshan@gmail.com account). Repo: `iam-knr/dv360-adsmentor` (PRIVATE since 3 Nov, decision D24). Product: DV360 Simulator by Adsmetor. The owner says the project was completed and live; it stopped working.

## 1. The problem

The site stopped working. The owner's Vercel project is https://vercel.com/kailasnathr/dv360-adsmentor and the latest deployment failed.

What the previous chat found (from GitHub only, no dashboard access):
- Code is not the cause. On the failing commit `ee26b06` (11 Nov 08:31 UTC) the GitHub checks `check`, `db-tests` and `prod-like` passed. `e2e` was still running.
- Vercel moved. Until 3 Nov every deploy went to the Vercel team `bigseo-s-projects` (project `dv360-adsmentor`) and succeeded; the last good one was 3 Nov 07:25 UTC, six minutes after the repo was made private. From 10 Nov deploys go to a different account, `kailasnathr/dv360-adsmentor`.
- The first deploy there (10 Nov 17:06 UTC, commit `558d1d7`) was skipped: "Canceled by Ignored Build Step" (`scripts/vercel-ignore.sh`). So that project may never have had a successful build.
- Today's deploy failed after about 45 seconds: https://vercel.com/kailasnathr/dv360-adsmentor/7FXRgwLv8JtU3s5J2PSmQ5P6aPzC (CLI: `npx vercel inspect dpl_7FXRgwLv8JtU3s5J2PSmQ5P6aPzC --logs`). The reason is NOT known yet.
- Commit `ee26b06` (by an earlier cloud session) pinned Node to `22.x` in `package.json` and the lockfile. Its message says production ran on Node 26 and sign-in failed with an Auth.js `CallbackRouteError`.
- A duplicate Vercel project `dv360-adsmentor-feoh` in `bigseo-s-projects` always fails; the log says to delete it and ignore it.
- The old production address `https://dv360-adsmentor.vercel.app` probably still belongs to the old `bigseo-s-projects` project. The cron-job.org timer (every 5 minutes, POST to `/api/sim/engine/tick` with the `CRON_SECRET` bearer) points at that address.

The build script `scripts/vercel-build.sh` does: `prisma generate`, then, in production only, `prisma migrate deploy` and `tsx scripts/bootstrap.ts`, then `next build`. A 45 second failure fits a database problem at the migrate step.

## 2. Supabase (screenshot from the owner, 11 Nov, 2:24 PM)

Organization "Ads Mentor", Free plan, billing cycle 28 Oct to 28 Nov 2026. Org id in the URL: `opkroypdsfwzekznabfb`. Project ref from the docs: `bwqzdhyatvhpssxtwjza`, region eu-west-1.
- Database size: 1.503 GB of 0.5 GB allowed (301%).
- Egress: 5.936 GB of 5 GB allowed (119%).
- Banner: grace period started; it ends 11 Dec 2026. After that restrictions apply and requests to the projects return HTTP 402.
- Not shown as paused. The previous chat's "paused project" guess was wrong.

Working theory (UNCONFIRMED): a free Supabase database over its size limit can go read-only. A read-only database would make `prisma migrate deploy` and the bootstrap fail, and make sign-in fail (login writes rows). This fits both symptoms. Confirm in the Supabase dashboard (project status, database settings, logs) before acting on it.

Table sizes (owner ran a read-only query):
| Table | Size |
|---|---|
| SimDailyMetric | 718 MB |
| DeliveryDiagnostic | 496 MB |
| SimHourlyMetric | 102 MB |
| SimTickLog | 30 MB |
| everything else | under 7 MB each |

Why it grew: `lib/engine/io/retention.ts` trims hourly rows to 14 sim days, but "daily rows stay for the life of the sandbox". Student sandboxes run on a sim clock at 144x (1 sim day per 10 real minutes, RUNNING by default, ticked every 5 minutes by cron-job.org), so daily rows and `DeliveryDiagnostic` rows grow without a limit. Egress is high because each tick loads the sandbox world from the database. Details: `docs/gaps/sim-clock-runs.md`, `docs/gaps/prod-crash.md`, `docs/gaps/prov-drive.md`.

## 3. Owner decisions in the previous chat

1. "Do NOT clean up or shrink the DB here" (on Supabase). Nothing was deleted or changed. Do not delete, truncate, vacuum or reseed anything on Supabase without the owner's explicit OK.
2. Wants a free fix, hosting anywhere is fine. Said: "lets shift it somewhere, open oracle cloud".
3. Earlier: the project must not depend on the old $100 cloud credit (it no longer exists).

So the chosen direction is to MOVE the database to a free host with room, keeping all data. Not yet decided: whether to also host the app outside Vercel (not needed so far; the limit is the database).

## 4. Free hosting research (web search, 11 Nov 2026; numbers conflict, verify on the pricing pages)

- Neon free: 0.5 GB per project (one source says raised to 1 GB on 2 Oct 2026, unconfirmed). Too small for 1.5 GB.
- Aiven free: 1 GB. Too small.
- CockroachDB: 10 GiB free, but one source says closed to new users, and it is not plain Postgres (this app uses Postgres roles and row level security). Avoid.
- Xata: said to have the most free storage, no figure found. Check its pricing page.
- Oracle Cloud Always Free: 200 GB block storage in total (50 GB boot volume included), so about 150 GB attachable. Arm compute allowance reportedly cut in 2026 (conflicting sources; check Oracle's own "Always Free Resources" page). Needs self-managed Postgres, TLS, firewall, backups. Some posts mention idle instance reclamation, unverified.
- Not free but simplest: Supabase Pro, about $25 a month, no migration. Mentioned only as a comparison.

Sources: https://codewithsql.com/cloud-databases/postgresql/free-postgresql-hosting , https://getvoroa.com/blog/free-postgres-database/ , https://selfhost.dev/blog/best-free-postgresql-hosting/ , https://docs.oracle.com/en-us/iaas/Content/FreeTier/resourceref.htm , https://braindetox.kr/en/posts/oracle_always_free_tier_reduced_2026.html

## 5. Plan: move the database to an Oracle Cloud free server

What the browser session can do vs what only the owner can do:
- Owner only: Oracle account signup (email, phone and credit card verification), any payment screen, entering passwords or card details. The assistant must never enter card details or type secrets into chat.
- Browser session can help: click through the Oracle console (create a compute instance and block volume), Vercel settings, Supabase dashboard reads.

Steps:
1. Read the Vercel build log of the failed deployment (first red line). Confirm or reject the read-only theory in Supabase. Do this first; it decides what else is wrong.
2. Check Oracle's current Always Free limits. Create the account (owner). Create an instance in an Ireland, Frankfurt or London region (Vercel functions run in `dub1`, Dublin). Attach a block volume of about 100 GB.
3. Install Postgres on it. Match the Supabase major version (run `select version();` on Supabase first). Enable TLS, set a firewall that only allows needed sources, create a strong password. Consider PgBouncer because the app opens many short connections.
4. Copy the data. From the Supabase direct connection (port 5432, not the pooler 6543) run `pg_dump` for the `public` schema only; skip Supabase internal schemas (auth, storage, etc.). The app's migrations create the roles `app_tenant` and `app_engine` and row level security policies, so create the roles before the restore or restore through the migrations, then check grants and RLS. VERIFY this in a test restore first. The dump counts as Supabase egress, which is fine inside the grace period.
5. Prove it before switching: point a local run or a Vercel preview at the new database; check `/api/health` shows `db: true`, sign in works, a sandbox opens.
6. Switch Vercel environment variables `DATABASE_URL` and `DIRECT_URL` to the new database; redeploy. Keep Supabase untouched as a fallback until the new one is proven.
7. Set up a nightly `pg_dump` to a second place (off the Oracle server).
8. Fix the timer: cron-job.org must POST `https://<production address>/api/sim/engine/tick` with the `Authorization: Bearer <CRON_SECRET>` header.
9. Later, separately: add retention for `SimDailyMetric` and `DeliveryDiagnostic` in code so the data cannot grow without a limit. Needs an owner decision, because lifetime totals may read these rows (check `lib/metrics/query.ts` first). Not started.

## 6. Vercel project checklist (the project in the `kailasnathr` account)

A new Vercel project does not inherit anything from the old one. Check in Project Settings:
- Environment variables (Production): `DATABASE_URL`, `DIRECT_URL`, `AUTH_SECRET`, `CRON_SECRET`, `SEED_SUPER_ADMIN_EMAIL`, `SEED_SUPER_ADMIN_PASSWORD`. Values are NOT in the repo. They may be copied from the old project in `bigseo-s-projects` (Settings, Environment Variables), or created again. If `AUTH_SECRET` changes, current sessions are signed out.
- General: Node.js Version = 22.x; framework Next.js; build command `npm run vercel-build` (comes from `vercel.json`); region `dub1`.
- Git: connected to `iam-knr/dv360-adsmentor`, production branch `main`. Hobby plan and a private repo only work if the Vercel account is linked to the GitHub account that owns the repo.
- Domains: which project owns `dv360-adsmentor.vercel.app`. Students use that address. Either free it from the old project and add it to the new one, or move the old project's link back.
- Ignored Build Step: `scripts/vercel-ignore.sh` skips builds when only docs changed. The first deploy of a new project was skipped by it. If needed, trigger a manual redeploy.
- Option: it may be simpler to reconnect the old project in `bigseo-s-projects` than to fix the new one.

## 7. Where things are in the repo

- `docs/PROJECT-LOG.md`: section 0 is the state on 2 Nov (what is live, engine and clock, screenshot guard, working agreements). Part B holds the original master plan. `PROJECT.md` was folded into it.
- `docs/gaps/*.md`: per-slice leftovers. `docs/decisions.md`: ADR log.
- `scripts/vercel-build.sh`, `scripts/vercel-ignore.sh`, `vercel.json`, `.env.example` (names of environment variables, no values).
- `docs/HANDOVER-2026-10-29-P4.md` exists on branch `docs/handover-p4-wave` and is STALE (written 29 Oct; the Phase 4 sessions it lists have since finished and merged; the $100 credit is gone).
- Recent history: after 29 Oct the team merged many PRs (up to #75, plus direct commit `ee26b06`): fidelity passes, screenshot guard, student sandboxes, CI changes for the private repo.

## 8. Rules for whoever continues

- Do not merge PRs or delete anything without the owner's OK. GitHub GraphQL is blocked from cloud sessions; use `gh api` REST.
- Never put secrets (database passwords, `AUTH_SECRET`, `CRON_SECRET`, tokens) in chat or in the repo. Environment variables go only into Vercel's settings.
- Do not change anything on Supabase (no deletes, no truncate, no vacuum) until the owner says so.
- Do not enter payment or identity details for the owner. Stop and ask when a page asks for them.
- Keep two cloud sessions at most, if any are started.

## 9. What is still unknown

- The exact error in the Vercel build log.
- Whether the Supabase database is actually read-only.
- Whether the old Vercel project in `bigseo-s-projects` still exists and still serves the site.
- Whether cron-job.org is still running and which address it calls.
- Oracle's current Always Free allowance and whether the owner's account signup works.
- Which Postgres major version Supabase runs and which extensions the app needs (check the migrations in `prisma/migrations`).

## 10. First three things to do in the new chat

1. Open the failed deployment log and copy the first red error line.
2. In Supabase, open the project and read its status (running, paused, read-only), and the database size.
3. Ask the owner to start the Oracle signup, while the browser session reads the Oracle "Always Free Resources" page.
