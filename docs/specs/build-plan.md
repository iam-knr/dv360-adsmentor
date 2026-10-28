# Build plan (P2-07)

Executable plan for Phase 3 (foundation build), with an outline for Phases 4 and 5. Written 2026-10-28 by session P2-07. Inputs: `PROJECT.md`, `docs/PROJECT-LOG.md`, `docs/decisions.md`, `docs/specs/*.md`, `docs/specs/modules/*.md`, `docs/specs/conflicts.md`.

Contents
1. Owner prerequisites checklist
2. Repo skeleton, conventions, CI (what session P3-01 creates)
3. Parallelisation waves, file ownership, merge order
4. Ready-to-paste cloud-session prompts (16 sessions)
5. Risks, fallbacks and scope cuts

## 0. Summary and dates

| Item | Value |
|---|---|
| Credit | $100 Claude Code cloud credit, expires 5 Nov 2026, 1:29 PM IST (Thursday) |
| Build window | Sunday 1 Nov to Thursday 5 Nov 2026 |
| Merge freeze | Thursday 5 Nov, 9:00 AM IST. Anything not merged by then waits for normal plan limits |
| Last session start | Wednesday 4 Nov, 8:00 PM IST |
| Sessions | 16 sessions in 6 waves (section 3). Peak parallelism: 5 sessions |
| Minimum viable classroom demo | Instructor and student login, app shell, campaign then IO then line item create with validation, seed data, engine v1 delivering metrics in list columns. Defined in section 5.2 |
| Hard rule | No session pushes to `main`. Every session opens one PR from its own branch |
| Hard rule (repo is public, ADR-044) | Never commit secrets, `.env*` files (only `.env.example` with safe local values), keys, database URLs or student data. Production values live only in Vercel Environment Variables |

Where this file and a spec disagree, the order is: `conflicts.md` rows, then this file (for process and ownership), then the spec.

---

## 1. Owner prerequisites checklist

Owner decisions of 2026-10-28 are recorded below (ADR-039 to ADR-046): P-01, P-05, P-10 and P-13 are done, P-09 is partly done. The rest is still open. Tick each box in a PR to this file or tell the Cowork session; the Cowork session then updates PROJECT.md. Items marked **BLOCKS** stop a Phase 3 session from starting. Items marked **DEFAULT** have a default, so work starts without an answer.

### 1.1 Checklist

| # | Done | Item | Due | Effect if late |
|---|---|---|---|---|
| P-01 | [x] | Approve PROJECT.md and the stack (P0-02, RC-060). **Done 2026-10-28, Kailas:** stack as in PROJECT.md section 7.1 and ADR-006 to ADR-010 approved; plan approved as the project plan and action plan (Phases 0 to 2 done). ADR-039 | Sat 31 Oct | was **BLOCKS** P3-01; no longer blocks |
| P-02 | [ ] | Prepare the Claude Code cloud environment `dv360-build` (steps in 1.2). **Open** | Sat 31 Oct | **BLOCKS** P3-01 |
| P-03 | [ ] | Import the repo into Vercel (team "BIGSEO's projects", Hobby today) and **upgrade to Pro** (steps in 1.3). **Open** | Sun 1 Nov, 10:00 IST | Preview deploys and the "preview green" part of the definition of done wait. Sessions still run. Pro is required before any paying student uses the app |
| P-04 | [ ] | Copy the two Supabase connection strings into Vercel Environment Variables (steps in 1.4). The Supabase project already exists (ref `bwqzdhyatvhpssxtwjza`, eu-west-1). **Open** | Sun 1 Nov, 10:00 IST | Same as P-03. Sessions use a local Postgres, so they do not wait |
| P-05 | [x] | Cron plan (RC-056). **Done 2026-10-28, Kailas:** Vercel Cron is the default engine trigger, which needs Vercel Pro (see P-03). The GitHub Actions timer stays as an optional fallback. ADR-041 | Mon 2 Nov | Closed. Vercel Pro (P-03) must be active before the cron entry deploys |
| P-06 | [ ] | GitHub settings and Actions secrets (steps in 1.6). **Open** | Sun 1 Nov | Branch protection can wait until P3-01 is merged |
| P-07 | [ ] | Generate `AUTH_SECRET` and `CRON_SECRET` and put them in Vercel (steps in 1.7). **Open** | Sun 1 Nov | Preview login fails without `AUTH_SECRET` |
| P-08 | [ ] | Create the Vercel Blob store (steps in 1.8) | before Phase 4 | Not needed for Phase 3 |
| P-09 | [~] | Adsmetor logo and reference screenshots (RC-058). **Partly done 2026-10-28:** logo committed at `docs/brand/adsmentor-logo-horizontal.png` (see 1.9). Reference screenshots are still not in the repo (`docs/screenshots/` is empty); design-system open question Q1 stays open. ADR-043 | before P3-04 merges | Logo: closed. Screenshots: fidelity checks wait |
| P-10 | [x] | Vendor-name decision (RC-055). **Done 2026-10-28, Kailas:** keep real exchange, verifier and vendor names as reference data with invented prices, also for the Advertiser settings checkboxes. ADR-042 | before P3-05b starts | Closed |
| P-11 | [ ] | Answer the other owner questions in 1.9 | before the row's wave | **DEFAULT** for each |
| P-12 | [ ] | Turn off "usage credits" in Claude settings (P0-06). Confirm the $100 balance, its expiry, and how many cloud sessions can run at once. **Open** | Sat 31 Oct | A surprise charge or a lower session limit changes the wave plan |
| P-13 | [x] | Merge authority. **Done 2026-10-28, Kailas:** the Cowork assistant session may merge Phase 3+ build PRs on the owner's behalf under the conditions in 3.6. ADR-046 | Sun 1 Nov | Closed |

### 1.2 Claude Code cloud environment (P-02)

Open the cloud environment menu in the session title bar, then Edit. Create one environment named `dv360-build` for the repo `iam-knr/dv360-adsmentor`.

1. Network access: choose Limited and tick "Allow package managers". Under Allowed domains add:
   - `registry.npmjs.org` (usually covered by the package-manager box)
   - `binaries.prisma.sh` (Prisma engine download; without it `prisma generate` fails)
   - `github.com`, `objects.githubusercontent.com` (usually covered)
   Do not add the production database host. Sessions never connect to Supabase.
2. Setup script: leave empty. Session P3-01 adds `npm run db:local`, which starts a real PostgreSQL 17 from the `embedded-postgres` npm package, so no apt step is needed. (If you prefer apt, use `apt-get update && apt-get install -y postgresql postgresql-contrib && service postgresql start`, then set `DATABASE_URL_TEST` below.)
3. Environment variables (not secrets; these are local test values):

| Name | Value |
|---|---|
| `DATABASE_URL` | `postgresql://postgres:postgres@127.0.0.1:54329/dv360_dev` |
| `DIRECT_URL` | `postgresql://postgres:postgres@127.0.0.1:54329/dv360_dev` |
| `DATABASE_URL_TEST` | `postgresql://postgres:postgres@127.0.0.1:54329/dv360_test` |
| `AUTH_SECRET` | any 32+ character random string (test only) |
| `AUTH_TRUST_HOST` | `true` |
| `CRON_SECRET` | `dev-cron-secret` |
| `SEED_ADMIN_EMAIL` | `admin@example.test` |
| `SEED_ADMIN_PASSWORD` | `dev-admin-password-change-me` |

4. Do not put production secrets in this environment. Playwright and Chromium are already installed in the cloud image (path `/opt/pw-browsers/chromium`); no browser download is needed.
5. Done when: a new session in this environment can run `node -v` (22 or later) and `npm view next version` without a network error.

### 1.3 Vercel project (P-03)

1. vercel.com, team "BIGSEO's projects" (Hobby today), Add New, Project, import `iam-knr/dv360-adsmentor`. Install the Vercel GitHub app on that repo if asked.
2. Framework Next.js (auto), Root Directory `./`, Node.js version 22.x (Project Settings, General), Install Command `npm ci`, Build Command `npm run vercel-build`.
3. Production Branch `main`. Leave "Preview deployments for all branches" on: each session branch gets its own preview URL.
4. Region: set the Function Region to Dublin, Ireland (`dub1`), the nearest to the database in eu-west-1 (Project Settings, Functions). Do not use `bom1` or `sin1`.
5. Plan: **Vercel Pro is required** (owner decision 2026-10-28, ADR-041). The simulator is used with paying Ads Mentor students and Hobby is for non-commercial use only. Upgrade in Vercel, Settings, Billing, before any production use with students. With Pro, cron can run every minute. Hobby allows cron jobs only once a day (a deploy with a faster cron fails on Hobby) and limits deployments per day, which many session pushes can hit (see section 5). Until the upgrade is done, keep the cron entry out of `vercel.json` (R-05).
6. Environment variables: add the table in 1.10, each one scoped to Production and Preview separately where the table says so.
7. Settings, Git: tick "Ignored Build Step" later if the deployment limit becomes a problem (command `git diff --quiet HEAD^ HEAD -- . ':!docs' ':!*.md'` skips docs-only commits).
8. Settings, Deployment Protection: keep Vercel Authentication on for previews. Copy the "Protection Bypass for Automation" secret and save it for 1.6 (`VERCEL_AUTOMATION_BYPASS_SECRET`).
9. Done when: the Vercel project shows a first deployment of the repo (it may fail until P3-01 merges, which is expected).

### 1.4 Postgres on Supabase (P-04)

Owner decision 2026-10-28 (ADR-040): the database is **Supabase**, not Neon. The Supabase project already exists. It is used as plain Postgres only: no Supabase client library, Supabase Auth or Supabase Storage is needed.

| Item | Value |
|---|---|
| Project ref (not a secret) | `bwqzdhyatvhpssxtwjza` |
| Region | eu-west-1 (Ireland) |
| Tier | Free, Nano compute |
| Used for | Postgres only (Prisma). Auth is Auth.js, files are Vercel Blob |

1. Open the Supabase dashboard, project `bwqzdhyatvhpssxtwjza`, then Connect (top bar), then the ORM tab, then Prisma. The dashboard shows two connection strings there.
2. `DATABASE_URL` (runtime): the Supavisor transaction pooler string, port **6543**. Make sure the query part is `?pgbouncer=true&connection_limit=1`.
3. `DIRECT_URL` (Prisma migrations): the direct or session connection string, port **5432**.
4. Paste both values **only** into Vercel, Project Settings, Environment Variables (see 1.10). Never paste them in chat, a PR, an issue or any file in the repo. The database password is set in Supabase (Project Settings, Database); keep it in your password manager.
5. One database for now. Production and Preview can share it at first (use separate Vercel scopes so you can split later). If Preview data must stay apart from Production, create a second Supabase project, or a separate schema, before the pilot.
6. The database role in the URL must be allowed to create roles and enable row level security (the default `postgres` role in Supabase can). The migration in P3-05a creates the role `app_engine` for the engine bypass.
7. Free-tier caveats:
   - 500 MB database size. Use the reduced hourly retention and slice caps from engine.md 1.4 (ADR-045).
   - A project is paused after 7 days of inactivity. Open or ping the app before each class; restore from the dashboard if it is paused.
   - About 60 pooled client connections on the free tier. Keep `connection_limit=1` per function instance.
   - If the class grows beyond 25 or storage nears 500 MB, move to the Pro tier of Supabase.
8. Done when: both strings are saved in Vercel Environment Variables (Production and Preview) and in your password manager, and not anywhere else.

### 1.5 Cron plan (P-05, RC-056)

Decided 2026-10-28 (ADR-041): **Vercel Cron is the default trigger** for the engine tick. It needs Vercel Pro (1.3). With Pro, the cron entry may run every minute, which the engine needs while a class runs. The GitHub Actions timer stays as an optional fallback.

| Option | What you do | Trade-off |
|---|---|---|
| A. Vercel Cron on Pro (default) | Upgrade to Pro (1.3). Set the Vercel env var `CRON_MODE=vercel`. Session P3-08b adds the cron entry (every minute) to `vercel.json` only when that variable is set | Most reliable. Costs $20 per month, which is already required for paying students |
| B. GitHub Actions (optional fallback) | Add the two values in 1.6. The workflow `engine-tick.yml` calls the tick URL every 5 minutes. Lazy catch-up runs on page loads and at login. Use it while the project is still on Hobby, or if Vercel Cron misses ticks | Free. GitHub may delay or skip a run |
| C. Manual | Nothing. The instructor presses Step or Catch up during class | Zero cost, weakest realism |

Lazy `ensureCaughtUp` on page loads stays on in every option.

### 1.6 GitHub settings and Actions secrets (P-06)

Repo, Settings:
1. Actions, General: allow all actions. Workflow permissions: Read and write.
2. Secrets and variables, Actions, Secrets: add `CRON_SECRET` (same value as in Vercel). Add `VERCEL_AUTOMATION_BYPASS_SECRET` (from 1.3 step 8). Add `DIRECT_URL_PREVIEW` only if you want CI to run migrations on the preview database (optional).
3. Secrets and variables, Actions, Variables: add `ENGINE_TICK_URL` = `https://<your-production-domain>/api/sim/engine/tick` and `E2E_BASE_URL` = your production or preview domain (used by the optional post-deploy smoke test).
4. Branches: after P3-01 is merged, add a rule for `main`: require a pull request, require status checks `check`, `db-tests` and `e2e`, block force pushes, require branches to be up to date. Do not add this rule before P3-01, because P3-01 creates the checks. Allow squash merging only.
5. General: tick "Automatically delete head branches".
6. Code security: turn on secret scanning and push protection. The repo is public (ADR-044), so this is mandatory, not optional.
7. Claude GitHub app: confirm it has Contents, Pull requests, Workflows and Actions write access to the repo (needed for sessions to open PRs and edit `.github/workflows`).

### 1.7 Secrets to generate (P-07)

On your own computer or any terminal, generate, and store only in Vercel and your password manager:

```bash
openssl rand -base64 32
```

```bash
openssl rand -hex 24
```

Use the first for `AUTH_SECRET` and the second for `CRON_SECRET`. Choose `SEED_ADMIN_EMAIL` (your real email) and a long `SEED_ADMIN_PASSWORD` (changed at first login). Never put them in a prompt, an issue, a PR or a file.

### 1.8 Blob store (P-08)

Vercel project, Storage, Create, Blob. Connect it to the project. Vercel adds `BLOB_READ_WRITE_TOKEN` to the project. Needed for creatives, SDF, reports (Phase 4). Skip it for Phase 3.

### 1.9 Other owner questions (P-09 to P-11)

| RC | Question | Default used until you answer | Needed by |
|---|---|---|---|
| RC-054 | AI-looking features (Ask Advisor, search, report generation): canned answers or real model calls? | Canned, labelled "Tutor", no model calls | Phase 4 |
| RC-055 | **Decided 2026-10-28:** real exchange, verifier and vendor names are kept as reference data with invented prices, also for the Advertiser settings checkboxes (ADR-042) | Closed | n/a |
| RC-057 | **Decided 2026-10-28:** up to 25 concurrent students. Size sandboxes, seed and the load test for 25. The free Supabase tier is accepted for the pilot with reduced hourly retention and slice caps (engine.md 1.4). Revisit if a class exceeds 25 (ADR-045) | Closed | n/a |
| RC-058 | **Decided 2026-10-28:** logo committed at `docs/brand/adsmentor-logo-horizontal.png` (836 x 257 PNG, black "ADS", blue "MENTOR", tagline "LEARN. APPLY. SCALE.", arrow mark). P3-03 and P3-04 use it in the app bar and the login page. P3-03 derives a square icon crop from the arrow mark (task note). Reference screenshots are still missing (`docs/screenshots/` is empty); design-system Q1 stays open (ADR-043) | Logo: closed. Screenshots: open | n/a |
| RC-059 | **Decided 2026-10-28:** the repo **stays public**. Hard rule: never commit secrets, `.env*` files, keys, database URLs or student data. A secret-scanning step is part of the P3-01 CI list (ADR-044) | Closed | n/a |
| RC-061 | One sandbox per student, or shared sandboxes for pairs | One per student | before P3-02 |
| RC-062 | Billing, invoices, partner-level lists deferred past Phase 4 | Deferred | before Phase 4 |
| RC-063 | Student accounts: instructor-created with a temporary password and no email | As stated | before Phase 5 |
| RC-064 | Allow students to upload their own files | Allowed with size caps, no scanning | before Phase 4 |
| RC-065 | Student data retention after a course | Archive after 90 days, delete on request | before the pilot |
| PROJECT.md 11 | Exercises you already teach (students per class is decided: up to 25, RC-057) | the 10 starters in module 18 | before Phase 5 |

### 1.10 Environment variables, complete list

Names are final. `.env.example` (created by P3-01) lists all of them with safe local values. Production values go only into Vercel Environment Variables (Project Settings, Environment Variables), never into chat, a PR, an issue or the repo. The function region is `dub1` (1.3).

| Name | Scope in Vercel | Where it comes from | Used by |
|---|---|---|---|
| `DATABASE_URL` | Production and Preview, different values | Supabase transaction pooler string, port 6543, `?pgbouncer=true&connection_limit=1` (1.4). Pasted only into Vercel | Prisma client at runtime |
| `DIRECT_URL` | Production and Preview, different values | Supabase direct or session string, port 5432 (1.4). Pasted only into Vercel | `prisma migrate deploy` |
| `AUTH_SECRET` | Production and Preview | `openssl rand -base64 32` | Auth.js |
| `AUTH_TRUST_HOST` | Production and Preview | `true` | Auth.js behind the Vercel proxy |
| `CRON_SECRET` | Production and Preview | `openssl rand -hex 24` | `POST /api/sim/engine/tick` |
| `SEED_ADMIN_EMAIL` | Production and Preview | your email | `npm run db:bootstrap` creates the first admin |
| `SEED_ADMIN_PASSWORD` | Production and Preview | strong temporary password | same |
| `CRON_MODE` | Production | `vercel` (default, needs Pro) or `github` or `manual` | P3-08b (cron entry on or off) |
| `ENABLE_GALLERY` | Preview only | `1` | component gallery page (never in Production) |
| `BLOB_READ_WRITE_TOKEN` | Production and Preview | added by Vercel (1.8) | uploads (Phase 4) |
| `DATABASE_URL_TEST` | none (CI and cloud env only) | local Postgres | Vitest `db` project |
| `AUTH_DEV_BYPASS` | local only, never in Vercel | `1` | dev login bypass, ignored when `NODE_ENV=production` |
| `ENGINE_TICK_URL`, `E2E_BASE_URL` | GitHub Actions variables | your domain | tick workflow, optional smoke test |
| `VERCEL_AUTOMATION_BYPASS_SECRET` | GitHub Actions secret | Vercel (1.3) | Playwright against protected previews |

---


## 2. Repo skeleton, conventions and CI (created by session P3-01)

Everything in this section is the spec for P3-01. Later sessions follow it.

### 2.1 Folder tree

Based on PROJECT.md section 3, routes.md 5.1, validation.md 6.2 and engine.md 1.5. Each folder that has an owner (section 3.2) gets a `README.md` of three lines naming the owner session and the spec.

```
dv360-adsmentor/
├─ PROJECT.md  README.md  .env.example  .gitignore  .nvmrc (22)
├─ package.json  package-lock.json  tsconfig.json  next.config.ts  vercel.json
├─ eslint.config.mjs  .prettierrc  .dependency-cruiser.cjs
├─ vitest.config.ts  vitest.setup.ts  playwright.config.ts
├─ .github/
│  ├─ workflows/ci.yml  engine-tick.yml (added by P3-08b)
│  └─ pull_request_template.md
├─ docs/                      existing; sessions do not edit docs/explore or docs/specs
├─ engine/params.json         engine parameters (P3-08a)
├─ app/                       Next.js App Router, layout exactly as routes.md 5.1
│  ├─ layout.tsx page.tsx not-found.tsx error.tsx global-error.tsx
│  ├─ (dv)/(app)/ (dv)/(full)/ (dev)/components/
│  ├─ sim/                    simulator pages (routes.md 7)
│  └─ api/{auth,dv,sim,health}/
├─ components/
│  ├─ dv/                     shared UI kit (P3-04)
│  ├─ shell/                  chrome (P3-03)
│  ├─ sim/                    login and access pages (P3-02)
│  ├─ icons/  campaigns/  insertion-orders/  line-items/  targeting/
├─ lib/
│  ├─ db/{client.ts,index.ts,tenant.ts}   prisma singleton, withSandbox (P3-05a)
│  ├─ auth/ rbac/ access/                 (P3-02)
│  ├─ changelog/                          withChangeLog and registries (P3-05a, entity registries by module sessions)
│  ├─ validation/                         exactly validation.md 6.2 (P3-06a)
│  ├─ engine/                             exactly engine.md 1.5 (P3-08a; io/ by P3-08b)
│  ├─ metrics/                            grid and chart feeds (P3-09)
│  ├─ nav/ scope/ routes/ hooks/          (P3-03)
│  ├─ theme/                              tokens and MUI theme (P3-04)
│  ├─ campaigns/ insertion-orders/ line-items/ targeting/   services (module sessions)
│  ├─ seed/                               seed generator (P3-05b)
│  ├─ money.ts env.ts
├─ prisma/
│  ├─ schema/                 multi-file schema (see 2.5)
│  ├─ migrations/  sql/       SQL that Prisma cannot express (RLS, roles)
│  ├─ seed/  bootstrap/
├─ scripts/{dev-db.ts,bootstrap.ts,vercel-build.sh}
├─ data/reference/            static JSON for reference catalogues
├─ public/brand/              logo (copied from docs/brand/adsmentor-logo-horizontal.png) and the square icon crop (P3-03)
└─ tests/{unit,components,db,validation,engine,engine-io,auth,shell,seed,metrics,targeting,changelog,e2e}/
```

Decision (ADR-022): `components/<module>` holds UI and `lib/<module>` holds server services, matching PROJECT.md section 3. There is no `features/` folder.

### 2.2 Package versions

Use these major versions. P3-01 runs `npm view <pkg> version` for each, pins the exact resolved version (no `^` or `~` on the packages marked "exact"), and lists the resolved versions in the PR. If a major below does not exist or is incompatible with another, choose the nearest working one and write the substitution under "Deviations".

| Package | Version target | Pin | Note |
|---|---|---|---|
| node | 22 LTS (`engines.node >=22.12`) | `.nvmrc` | Vercel project also set to 22 |
| next | 15.5.x | exact | params and searchParams are Promises (routes.md R8) |
| react, react-dom | 19.x | exact | |
| typescript | 5.9.x | exact | `strict`, `noUncheckedIndexedAccess` |
| @mui/material, @mui/icons-material not used | 7.x | exact | icons come from Material Symbols |
| @mui/material-nextjs, @emotion/react, @emotion/styled | 7.x, 11.x | exact | App Router emotion cache |
| material-symbols | latest 0.x | exact | self-hosted icon font, no network fetch |
| @fontsource-variable/figtree, @fontsource/roboto | latest | exact | self-hosted fonts, no Google Fonts fetch at build |
| @tanstack/react-table, @tanstack/react-virtual | 8.x, 3.x | exact | DvGrid (design-system 2.4, Q5) |
| recharts | 2.15.x | exact | charts |
| prisma, @prisma/client | latest 6.x (6.7 or later) | exact, same version | multi-file schema folder is GA from 6.7 |
| next-auth | 5.0.0-beta (Auth.js v5), latest beta | exact | credentials provider |
| @node-rs/argon2 | 2.x | exact | password hashing, prebuilt binaries |
| zod | 3.25.x | exact | |
| react-hook-form, @hookform/resolvers | 7.x, 5.x | exact | validation.md 6.2 `client/` |
| date-fns, @date-fns/tz | 4.x | exact | sim-time maths |
| @vercel/blob | 1.x | exact | uploads (used from Phase 4) |
| vitest, @vitest/coverage-v8 | 3.x | exact | |
| @testing-library/react, @testing-library/user-event, @testing-library/jest-dom, jsdom | 16.x, 14.x, 6.x, latest | exact | |
| vitest-axe | latest | exact | accessibility assertions |
| fast-check | 4.x | exact | engine property tests |
| @playwright/test | the version of the preinstalled Playwright in the cloud image (run `npx playwright --version`) | exact | |
| embedded-postgres | 17.x | exact | local real Postgres, no Docker |
| eslint, typescript-eslint, eslint-config-next, eslint-plugin-import | 9.x, 8.x, 15.x, latest | exact | |
| prettier | 3.x | exact | |
| dependency-cruiser | 16.x or latest | exact | layering rules |
| tsx | 4.x | exact | scripts |
| papaparse, fflate | latest | exact | CSV and zip (used from Phase 4; install now so only P3-01 touches `package.json`) |

Rule: only P3-01 edits `package.json` and `package-lock.json` in wave 1. Later sessions may add a dependency their scope needs. If the lockfile conflicts when rebasing, take main's lockfile, re-run `npm install`, and commit the result. Never hand-edit the lockfile.

### 2.3 npm scripts

| Script | Command | Note |
|---|---|---|
| `dev` | `next dev` | |
| `build` | `prisma generate && next build` | |
| `vercel-build` | `bash scripts/vercel-build.sh` | `prisma generate`, `prisma migrate deploy`, `tsx scripts/bootstrap.ts` (idempotent), `next build` |
| `start` | `next start` | |
| `lint` | `eslint . --max-warnings 0` | |
| `typecheck` | `tsc --noEmit` | |
| `format` | `prettier --write .` | |
| `depcruise` | `depcruise lib components app --config .dependency-cruiser.cjs` | |
| `test` | `vitest run --project unit --project components` | no database needed |
| `test:db` | `vitest run --project db` | needs `DATABASE_URL_TEST` |
| `test:watch` | `vitest` | |
| `e2e` | `playwright test` | |
| `check` | `npm run lint && npm run typecheck && npm run depcruise && npm run test` | the pre-PR gate |
| `db:local` | `tsx scripts/dev-db.ts` | starts embedded Postgres on port 54329 and creates `dv360_dev` and `dv360_test` |
| `db:generate` | `prisma generate` | |
| `db:migrate:dev` | `prisma migrate dev` | |
| `db:migrate:deploy` | `prisma migrate deploy` | |
| `db:reset` | `prisma migrate reset --force --skip-seed` | |
| `db:seed` | `tsx prisma/seed/index.ts` | globs `prisma/seed/**/*.seed.ts` in name order |
| `db:bootstrap` | `tsx scripts/bootstrap.ts` | globs `prisma/bootstrap/*.bootstrap.ts` in name order |

### 2.4 TypeScript, lint and layering rules

- `tsconfig`: `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes` off, path alias `@/*` to the repo root.
- ESLint: `next/core-web-vitals`, `typescript-eslint` recommended-type-checked, `import/no-cycle`, no default exports outside Next special files, no `console.log` outside `scripts/`.
- ESLint `no-restricted-globals`/`no-restricted-properties` inside `lib/engine/**` except `lib/engine/io/**`: `Math.random`, `Date.now`, `new Date()` without an argument, `performance.now` (engine.md 1.3).
- ESLint override for `lib/validation/**` except `client/` and `server/`: may not import `react`, `next/*`, `@prisma/client`, `node:*` (validation.md 6.2).
- `.dependency-cruiser.cjs` encodes engine.md 1.5 dependency direction, forbids `components/**` importing `lib/db/**` or `@prisma/client`, forbids `lib/**` importing `components/**` or `app/**`, and forbids any import of `lib/engine/io/**` outside `app/api/**`, `lib/engine/server.ts` and `scripts/**`. A test fixture proves the rule fails on a violation.
- Server-only modules start with `import 'server-only'`.

### 2.5 Prisma setup

- Multi-file schema folder `prisma/schema/` (set `"prisma": { "schema": "prisma/schema" }` in `package.json`). File ranges are owned (section 3.2): `00-base` P3-01; `10..69` P3-05a; `70..89` P3-05c; `90..99` additive files by other sessions, one per session, named `9x-<session>-extra.prisma`.
- `00-base.prisma`: generator `prisma-client-js`, datasource `postgresql` with `url = env("DATABASE_URL")` and `directUrl = env("DIRECT_URL")`, and `model AppMeta { key String @id  value String }` (used by the health check).
- Migrations: one folder per session, named `NNNN_<session>_<topic>`. P3-05a creates `0001_core`. Rebase conflicts in `prisma/migrations` mean "regenerate": delete your migration folder, rebase, run `prisma migrate dev` again.
- Roles and RLS live in SQL files under `prisma/sql/` and are applied by a migration (P3-05a). `app_engine` is the bypass role (data-model.md 2.2, 8 Q21).
- Pooled URLs need `pgbouncer=true` (Prisma then avoids prepared statements). Interactive transactions with `SET LOCAL` work in transaction pooling mode.

### 2.6 Vitest, Playwright, CI

`vitest.config.ts` defines three projects:
- `unit`: environment `node`, includes `tests/{unit,validation,engine,seed,metrics,changelog,auth,targeting}/**/*.test.ts` that do not need a database.
- `components`: environment `jsdom`, includes `tests/{components,shell}/**/*.test.tsx`, setup file loads `@testing-library/jest-dom` and `vitest-axe`.
- `db`: environment `node`, includes `tests/{db,engine-io,services}/**/*.test.ts`, `pool: forks`, `fileParallelism: false`, global setup creates a fresh database from `DATABASE_URL_TEST` and runs `prisma migrate deploy`.

A test file that needs the database lives under a `db` folder or is named `*.db.test.ts` (matched by the `db` project and excluded from `unit`).

`playwright.config.ts`: `testDir: tests/e2e`, `use.baseURL = process.env.E2E_BASE_URL ?? 'http://127.0.0.1:3100'`, `webServer` runs `npm run build && npm run start -- -p 3100` against `DATABASE_URL_TEST` when `E2E_BASE_URL` is unset, `projects: [{ name: 'chromium' }]`, `retries: 1` on CI, `trace: 'retain-on-failure'`. If the preinstalled browser is used, set `launchOptions.executablePath` from `PLAYWRIGHT_CHROMIUM_PATH` (default unset). Extra HTTP header `x-vercel-protection-bypass` is sent when `VERCEL_AUTOMATION_BYPASS_SECRET` is set.

`.github/workflows/ci.yml` (jobs):

```yaml
name: ci
on:
  pull_request:
  push:
    branches: [main]
jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version-file: .nvmrc, cache: npm }
      - run: npm ci
      - run: npx prisma generate
      - run: npm run lint
      - run: npm run typecheck
      - run: npm run depcruise
      - uses: gitleaks/gitleaks-action@v2   # secret scan (ADR-044); fails the check on any finding
      # (or rely on GitHub secret scanning with push protection, 1.6; keep at least one active)
      - run: npm test
  db-tests:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:17
        env: { POSTGRES_PASSWORD: postgres, POSTGRES_DB: dv360_test }
        ports: ['5432:5432']
        options: >-
          --health-cmd "pg_isready -U postgres" --health-interval 5s --health-retries 10
    env:
      DATABASE_URL: postgresql://postgres:postgres@127.0.0.1:5432/dv360_test
      DIRECT_URL: postgresql://postgres:postgres@127.0.0.1:5432/dv360_test
      DATABASE_URL_TEST: postgresql://postgres:postgres@127.0.0.1:5432/dv360_test
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version-file: .nvmrc, cache: npm }
      - run: npm ci
      - run: npx prisma generate
      - run: npm run test:db
  e2e:
    needs: [check, db-tests]
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:17
        env: { POSTGRES_PASSWORD: postgres, POSTGRES_DB: dv360_test }
        ports: ['5432:5432']
        options: >-
          --health-cmd "pg_isready -U postgres" --health-interval 5s --health-retries 10
    env:
      DATABASE_URL: postgresql://postgres:postgres@127.0.0.1:5432/dv360_test
      DIRECT_URL: postgresql://postgres:postgres@127.0.0.1:5432/dv360_test
      DATABASE_URL_TEST: postgresql://postgres:postgres@127.0.0.1:5432/dv360_test
      AUTH_SECRET: ci-only-secret-ci-only-secret-ci-only
      AUTH_TRUST_HOST: 'true'
      CRON_SECRET: ci-cron-secret
      SEED_ADMIN_EMAIL: admin@example.test
      SEED_ADMIN_PASSWORD: ci-admin-password
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version-file: .nvmrc, cache: npm }
      - run: npm ci
      - run: npx playwright install --with-deps chromium
      - run: npx prisma migrate deploy
      - run: npm run db:bootstrap
      - run: npm run db:seed
      - run: npm run e2e
      - uses: actions/upload-artifact@v4
        if: failure()
        with: { name: playwright-report, path: playwright-report }
```

The three job names `check`, `db-tests` and `e2e` are the required status checks (1.6). The secret scan runs inside `check`, so it is covered by the same required check. P3-01 also adds `.env*` (except `.env.example`) to `.gitignore`.

### 2.7 Stub contracts created by P3-01

These files let parallel sessions compile against each other. The owner named in the right column replaces the body and keeps every exported name and type.

| File | Exports (stub behaviour) | Replaced by |
|---|---|---|
| `lib/db/client.ts`, `lib/db/index.ts` | `prisma` (singleton), re-export | P3-05a extends `index.ts` (adds `withSandbox`) |
| `lib/auth/types.ts` | `SessionUser { id; email; name; appRole: 'student'\|'instructor'\|'admin'; classroomId?; sandboxId?; partnerId?; dvRole: 'ADMIN'\|'STANDARD'\|'READ_ONLY'\|'REPORTING_ONLY'\|'PARTNER_CLIENT'\|'CREATIVE'; viewAs?: { userId; actAs: boolean } }` | P3-02 may add optional fields only |
| `lib/auth/session.ts` | `getSessionUser()`, `requireUser()`; returns a fixed dev user when `AUTH_DEV_BYPASS=1` and `NODE_ENV!=='production'`, else `null` | P3-02 |
| `lib/rbac/can.ts` | `can(user, action, scope): boolean`, `assertAccess(...)` (allow all in the stub) | P3-02 |
| `lib/access/windows.ts` | `isClassOpen(classroomId, now): Promise<boolean>` (always true), `getWindowBanner(user)` (null), `tickAccessWindows(now)` (no-op) | P3-02 |
| `lib/metrics/grid-metrics.ts` | `getGridMetrics({ level, ids, range, sandboxId }): Promise<Record<string, MetricRow>>` returning zeros; `MetricRow` has the columns of engine.md 9.4 | P3-09 |
| `lib/targeting/index.ts` | `TargetingState`, `emptyTargetingState(type)`, `loadTargetingState(db, liId)`, `persistTargeting(tx, liId, state)` (no-op) | P3-07a |
| `components/targeting/index.ts` | `TargetingCard` props `{ lineItemType; value: TargetingState; onChange; locked?: string[]; inherited?: string[]; readOnly?: boolean }`, renders a grey box "Targeting editors are not built yet" | P3-07a |
| `components/dv/index.ts` | empty barrel | P3-04 |
| `lib/theme/provider.tsx` | `ThemeRegistry` wrapping default MUI theme and emotion cache | P3-04 |
| `lib/money.ts` | `toMinor`, `fromMinor`, `format(amount, currency)` | P3-01 final (tested) |
| `lib/env.ts` | zod-validated env access (`env.DATABASE_URL`, ...) | P3-01 final |

### 2.8 Other files P3-01 writes

- `.env.example` with every variable of 1.10 and safe local values. `.gitignore` covers `.env*` (except `.env.example`), `.next`, `node_modules`, `playwright-report`, `test-results`, `coverage`, `*.log`.
- `.github/pull_request_template.md` (2.9).
- `README.md`: five-line quickstart (`nvm use`, `npm ci`, `npm run db:local`, `npm run db:migrate:dev`, `npm run dev`), the scripts table, and a link to this file.
- `app/api/health/route.ts`: returns `{ ok: true, db: true|false, version }` after `select 1` (and a read of `AppMeta`).
- `app/page.tsx`: placeholder page with the product name "DV360 Simulator by Adsmetor". The shell session (P3-03) replaces it with the role redirect.
- `tests/unit/sanity.test.ts`, `tests/db/health.db.test.ts`, `tests/e2e/smoke.spec.ts` (home 200, health 200).
- Branch protection is not code. The owner sets it (1.6).

### 2.9 Conventions

Commits and PRs
- Branch `p3-<id>-<name>` exactly as in the prompt. One session, one branch, one PR to `main`. Never push to `main` or to another session's branch.
- Commit messages: `<type>(<session>): <subject>` with type `feat`, `fix`, `test`, `refactor`, `chore`, `docs`; for example `feat(p3-06b): campaign create form`. Subject in the imperative, under 72 characters. The attribution trailer is added by the harness.
- Push at checkpoints, not after every commit: first push within 30 minutes of starting (so work survives a reclaimed container), then at most every 20 minutes. Each push may trigger a Vercel preview, and the free plan limits deployments per day.
- Final steps: `git fetch origin main && git rebase origin/main` (or merge main if the rebase is messy), re-run `npm run check` and the tests you own, push, open or update the PR.
- The last commit on the branch is `docs: status <session>`. It changes PROJECT.md only: tick or mark your line in section 6 (use 🟨 for a split task until the integration session completes it) and append one row at the end of the section 10 table (`| date | <session> | result | next |`). If this conflicts on rebase, keep both rows.
- PR title: `<SESSION>: <short name>`. PR body uses `.github/pull_request_template.md`: Summary; Specs read; Acceptance criteria table (id, status Done/Partly/Not done, evidence test name); Tests added; Files outside my ownership list touched (should be none); Deviations from specs; Not done; Migration or env var notes; Preview URL; Suggested merge order note.
- PR size: aim under 2,500 changed lines excluding lockfile, migrations, generated files and fixtures. If the session will exceed it, stop at a clean boundary and put the rest under "Not done".

Code
- Files `kebab-case.ts`, React components `PascalCase.tsx`, named exports only.
- Server code in `lib/**`; components never import `lib/db` or Prisma. Data reaches components through server components, route handlers or server actions that call services.
- Every write goes through `withChangeLog` (module 05 4.1). Every service function checks `can()` and validates with `lib/validation` before writing.
- Time: store UTC; sim time is a separate value; use `date-fns` with the advertiser time zone. Never call `new Date()` without an argument inside `lib/engine`.
- Money: `Decimal` in the database, major units on the wire, minor units into validation rules (`lib/money.ts`, RC-019).
- Copy: UI strings follow `validation.md` 1.2 and the module specs verbatim. No Google logos, names or assets (PROJECT.md R1, R2).
- Synthetic data only (PROJECT.md R5).
- Tests are deterministic: seed any randomness, fake the clock, no network.
- Deviations from a spec go in the PR body. Do not edit `docs/specs/**` or `docs/explore/**`.

### 2.10 Global stop conditions (apply to every prompt)

Stop, push the branch, open the PR as a draft, and write the reason at the top of the PR if any of these happen:
1. A file you need is owned by another session (section 3.2) and the change is not a one-line additive export.
2. A required stub, schema table or earlier session's PR is missing or does not match this plan.
3. The same test or CI failure survives three honest fix attempts. Do not skip, disable or loosen the test to get green.
4. A spec conflict is not covered by `conflicts.md`. Pick the simplest option, note it under Deviations, and continue only if it cannot change another session's files.
5. You are about to exceed the PR size limit.
6. A command needs a secret, a production database or a network host that is not allowed. Never ask for secrets in chat.

When all acceptance criteria are met or listed under "Not done", mark the PR ready for review and stop. Do not start extra features.

---


## 3. Parallelisation waves, file ownership, merge order

### 3.1 Wave table (Phase 3)

Sizes use the module specs' scale: S under half a day, M about a day, L two days or more of cloud-session work. "Share" is the planned part of the $100 credit (90 in total, 10 in reserve for re-runs and fixes). Measure the real cost after P3-01 and after each wave, then adjust (section 5.1).

"Prerequisites" are merged PRs by merge number (column "Merge"), plus owner items from section 1. A session starts only when its prerequisites are merged and `main` CI is green.

| Wave | Session | Tasks (PROJECT.md section 6 mapped to specs) | Owns (details in 3.2) | Prerequisites | Merge | Size, share | Definition of done (all also need: `npm run check`, CI green, PR template filled, last commit `docs: status <id>`) |
|---|---|---|---|---|---|---|---|
| 1 | **P3-01** | P3-01 scaffold, Vercel deploy. build-plan 2; routes.md 5.1, 9; validation.md 6.2; engine.md 1.5 | root configs, `package*.json`, `.github/**`, `scripts/**`, stubs (2.7), `app/api/health`, root layout | P-01, P-02. P-03 and P-04 for the deploy check | 1 | M, 3 | Fresh clone: `npm ci`, `npm run check`, `npm run db:local`, `npm run build` pass. `/api/health` returns 200 on the preview (or "not done: needs P-03/P-04"). Tick P3-01 |
| 2 | **P3-04** | P3-04 shared components. design-system.md 1 to 5 | `lib/theme`, `components/dv`, `components/icons`, `app/(dev)/components`, `tests/components` | 1 | 3 | L, 9 | Every Tier A component has variants in the gallery, RTL tests and no serious axe violations. Gallery preview loads. Tick P3-04 |
| 2 | **P3-05a** | P3-05 data model, part a: core hierarchy, training layer, simulation and history tables, RLS, `withChangeLog`. data-model.md App. A, 2, 4, 5.1 to 5.8, 5.18, 5.19, 6; module 05 T1, T2 | `prisma/schema/10..69`, `prisma/migrations/0001_*`, `prisma/sql`, `lib/db/**` (not `client.ts`), `lib/changelog/**`, `tests/db`, `tests/changelog` | 1 | 2 | L, 7 | `prisma validate` and `migrate deploy` pass on empty DB. RLS isolation, composite FK and `withChangeLog` tests green. Mark P3-05 🟨 |
| 2 | **P3-06a** | P3-06 validation core. validation.md 0 to 4, 6, 7; module 06 T02, 07 T02, 08 T02 | `lib/validation/**`, `tests/validation/**` | 1 | 4 | L, 6 | Catalogue, coverage and docs-sync tests green for GEN, CMP, IO, LI domains and MX-01 to MX-06, MX-08, MX-10, MX-17. Mark P3-06 🟨 |
| 2 | **P3-08a** | P3-08 engine core (pure). engine.md 1, 2, 3, 4, 5, 6, 7, 8, 9.1 to 9.4, 11 | `lib/engine/**` except `io/`, `engine/params.json`, `tests/engine` | 1 | 5 | L, 10 | Determinism, property and calibration tests (11.1 to 11.3 subset in the prompt) green. `dependency-cruiser` clean. Mark P3-08 🟨 |
| 3 | **P3-02** | P3-02 auth, roles, access windows. modules 18 (M18-01 to M18-04), 02 T1; routes.md 2, 7.1, 7.4 | `lib/auth`, `lib/rbac`, `lib/access`, `middleware.ts`, `app/sim/**`, `app/api/auth`, `components/sim`, `prisma/bootstrap/10-*`, `tests/auth` | 1, 2 | 6 | M, 6 | Login, lockout, forced password change, closed window redirect, role guards pass in unit and e2e tests. Tick P3-02 |
| 3 | **P3-05b** | P3-05 seed generator. data-model.md 3; module 02 T2; 06, 07, 08 section 3.4; 10 section 3.4 | `prisma/seed/**`, `prisma/bootstrap/20-*`, `lib/seed`, `data/reference`, `tests/seed` | 1, 2 | 7 | L, 6 | `npm run db:seed` builds the `starter-agency`, `healthy` and `troubleshooting-lab` sandboxes deterministically with every LI type and planted delivery story. Determinism and integrity tests green. Mark P3-05 🟨 |
| 3 | **P3-05c** | P3-05 data model, part c: remaining tables. data-model.md 5.9 to 5.17, App. C; module deltas | `prisma/schema/70..89`, `prisma/migrations/0002_*`, `tests/db/extended*` | 2 | 8 | M, 3 | Introspection tests: every tenant table has `sandboxId`, RLS and composite FKs; enum values match data-model.md 4. Tick P3-05 if 05a and 05b are merged |
| 3 | **P3-03** | P3-03 app shell. module 01 T1 to T6; routes.md 3 to 6, 9 | `app/(dv)/**`, `app/404`, `app/[...unmatched]`, `components/shell`, `lib/nav`, `lib/scope`, `lib/routes`, `lib/hooks`, `tests/shell` | 1, 2, 3. P3-02 (6) recommended | 9 | M, 5 | Shell tour e2e, nav tree tests, 404 and chain-check tests pass. Every route row of routes.md 3 renders in the right frame (stub pages). Tick P3-03 |
| 4 | **P3-07a** | P3-07 targeting, part a: card, state, simple editors, keywords, day and time. module 10 T01, T03 to T06, part of T08 | `components/targeting/**` (not advanced editors), `lib/targeting/**` (not `geo.ts`, `audience.ts`), targeting rules in `lib/validation`, `tests/targeting` | 2, 3, 4, 6, 9 | 10 | L, 6 | Acceptance criteria listed in the prompt pass. Round trip test lossless. Mark P3-07 🟨 |
| 4 | **P3-06b** | P3-06 campaigns and IO. module 06 T03 to T05, T07; module 07 T03 to T08 | `lib/campaigns`, `lib/insertion-orders`, `components/campaigns`, `components/insertion-orders`, route files of campaigns and IOs, `app/api/dv/{campaigns,insertion-orders}` | 2, 3, 4, 6, 7, 9 | 11 | L, 7 | Create, edit, status, list with validation and change log work on seeded data. Listed e2e specs pass. Mark P3-06 🟨 |
| 4 | **P3-06c** | P3-06 line items. module 08 T03 to T06, T09 (no bulk), T10 | `lib/line-items`, `components/line-items`, route files of line items and every `explorerlis` page, `app/api/dv/line-items` | 2, 3, 4, 6, 7, 9 | 12 | L, 7 | Create all non-YouTube types, edit, status, list; validation per VAL; targeting card mounted through the stub. Listed e2e specs pass. Tick P3-06 when 06a to 06c are merged |
| 4 | **P3-08b** | P3-08 engine runtime. engine.md 1.2 to 1.4, 1.7, 3.5, 3.7, 10.2, 10.3 | `lib/engine/io/**`, `lib/engine/server.ts`, `app/api/sim/engine`, `.github/workflows/engine-tick.yml`, `tests/engine-io` | 2, 5, 6, 7 | 13 | M, 5 | A tick writes funnel, hourly and daily rows for seeded LIs. Idempotent and lock-safe in DB tests. Fast-forward 7 days finishes. Tick endpoint rejects a wrong secret. Tick P3-08 |
| 4 | **P3-09** | P3-09 performance columns. engine.md 9.2 to 9.4; modules 06, 07, 08 section 2.1 | `lib/metrics/**`, `app/api/dv/metrics`, `tests/metrics`, `tests/e2e/performance-columns.spec.ts` | 2, 7 to start; 11 and 12 merged before its e2e spec runs | 14 | S, 3 | Campaign, IO and LI lists show real numbers and totals on seeded data; totals reconcile with raw rows in tests. Tick P3-09 |
| 5 | **P3-07b** | P3-07 targeting, part b: geography with map, apps and URLs, brand suitability, audience builder. module 10 T07, T08 (apps), T09, T10 | `components/targeting/editors/{geography,apps-urls,brand,audience}/**`, `lib/targeting/{geo,audience}.ts` | 10 | 15 | M, 5 | Acceptance criteria listed in the prompt pass. Tick P3-07 |
| 5 | **P3-INT** | Integration and hardening. Not a PROJECT.md task | any file, small fixes only, one commit per fix with the owning session id | all merged | 16 | M, 4 | Full CI green on `main`, demo script passes on the production preview, gaps listed in `docs/gaps/p3.md`. Tick remaining P3 lines |

Merge numbers are the order in 3.5. Wave 4 sessions can run in parallel because their file sets do not overlap. P3-06c and P3-07a talk to each other only through the stub in 2.7. P3-09 and P3-06b/c talk through `getGridMetrics`.

### 3.2 File and directory ownership

No two sessions that run at the same time own the same path. "Owner" is the only session allowed to create or edit the path while it is open. After the owner's PR is merged, a later session may touch it only if the table says so.

| Path | Owner | After merge |
|---|---|---|
| Root configs, `package*.json`, `.github/workflows/ci.yml`, `.github/pull_request_template.md`, `scripts/**`, `.env.example`, `lib/env.ts`, `lib/money.ts`, `app/api/health` | P3-01 | Any session may add a dependency or env var it needs (rebase rule in 2.2). `vercel.json`: P3-08b may add the cron entry |
| `lib/theme/**`, `components/dv/**`, `components/icons/**`, `app/(dev)/components/**`, `tests/components/**` | P3-04 | Other sessions import only. Bugs found later: fix in a one-line PR by the session that found it, noted in its PR |
| `prisma/schema/00-base.prisma` | P3-01 | frozen |
| `prisma/schema/10..69-*.prisma`, `prisma/migrations/0001_*`, `prisma/sql/**`, `lib/db/**` except `client.ts`, `lib/changelog/{index,diff,registry-types,actors,scan}.ts`, `tests/db/{rls,tenant}*`, `tests/changelog/**` | P3-05a | A later session needing a column adds `prisma/schema/9x-<session>-extra.prisma` and its own migration |
| `lib/changelog/registries/<entity>.ts` | the session that owns the entity: campaign, budget, IO, segment, partner cost by P3-06b; line item and children by P3-06c; the rest in Phase 4 | |
| `prisma/schema/70..89-*.prisma`, `prisma/migrations/0002_*` and later, `tests/db/extended*` | P3-05c | frozen |
| `prisma/seed/**` except `auth.seed.ts`, `prisma/bootstrap/20-*`, `lib/seed/**`, `data/reference/**`, `tests/seed/**` | P3-05b | Module sessions in Phase 4 add their own `*.seed.ts` files |
| `prisma/seed/auth.seed.ts`, `prisma/bootstrap/10-*` | P3-02 | |
| `lib/validation/**` (except targeting and template rules), `tests/validation/**` (except `cases.targeting.ts`) | P3-06a | Phase 4 sessions add their domain files (`rules/<domain>.ts`) |
| `lib/validation/rules/{targeting,template}.ts`, `tests/validation/cases.targeting.ts` | P3-07a | |
| `lib/validation/constants/targeting-availability.ts` | P3-06a (MX-10 data) | P3-07a may extend the mapping |
| `lib/engine/**` except `io/` and `server.ts`, `engine/params.json`, `tests/engine/**` | P3-08a | P3-08b may add exports to `lib/engine/index.ts` only for runtime types |
| `lib/engine/io/**`, `lib/engine/server.ts`, `app/api/sim/engine/**`, `.github/workflows/engine-tick.yml`, `tests/engine-io/**` | P3-08b | |
| `lib/auth/**`, `lib/rbac/**`, `lib/access/**`, `middleware.ts`, `app/sim/**`, `app/api/auth/**`, `app/api/sim/access/**`, `components/sim/**`, `tests/auth/**`, `tests/e2e/auth.spec.ts` | P3-02 | Phase 5 sessions extend `app/sim/instructor/**` and `app/sim/admin/**` |
| `app/(dv)/**` layouts, `app/not-found.tsx`, `app/error.tsx`, `app/global-error.tsx`, `app/404/**`, `app/[...unmatched]/**`, `app/page.tsx`, `components/shell/**`, `lib/nav/**`, `lib/scope/**`, `lib/routes/**`, `lib/hooks/**`, `tests/shell/**`, `tests/e2e/shell.spec.ts` | P3-03 | |
| Stub route pages under `app/(dv)/**` | P3-03 | Replaced by the module owner, see the next rows. Until then they render "Not built yet" |
| Route files for `cs`, `cs/new`, `c/[campaignId]/**` (except `explorerlis`), `ios/new`, `io/[ioId]/layout`, `io/[ioId]/details`, `io/[ioId]/history`, `explorerios` pages | P3-06b | |
| `lib/campaigns/**`, `lib/insertion-orders/**`, `components/campaigns/**`, `components/insertion-orders/**`, `app/api/dv/campaigns/**`, `app/api/dv/insertion-orders/**`, `tests/services/{campaigns,insertion-orders}/**`, `tests/e2e/{campaigns,insertion-orders}.spec.ts` | P3-06b | |
| Route files for `lis/new`, `li/[liId]/**`, every `explorerlis` page | P3-06c | |
| `lib/line-items/**`, `components/line-items/**`, `app/api/dv/line-items/**`, `tests/services/line-items/**`, `tests/e2e/line-items.spec.ts` | P3-06c | |
| `lib/targeting/**` except `geo.ts`, `audience.ts`; `components/targeting/**` except `editors/{geography,apps-urls,brand,audience}/`; `app/api/dv/targeting/**`; `tests/targeting/**`; `tests/e2e/targeting.spec.ts` | P3-07a | |
| `lib/targeting/{geo,audience}.ts`, `components/targeting/editors/{geography,apps-urls,brand,audience}/**`, `app/api/dv/audiences/estimate/**` | P3-07b | |
| `lib/metrics/**`, `app/api/dv/metrics/**`, `tests/metrics/**`, `tests/e2e/performance-columns.spec.ts` | P3-09 | |
| `PROJECT.md` | nobody, except the last commit of each PR (2.9) | |
| `docs/specs/**`, `docs/explore/**`, `docs/decisions.md` | the Cowork planning sessions | Sessions report deviations in the PR body |

### 3.3 Why this split is safe

- The only file every session touches is `PROJECT.md` (two lines each), and `package-lock.json`. Both have a stated conflict rule (2.2, 2.9).
- Sessions that need the database schema wait for P3-05a (merge 2). Sessions that are pure TypeScript (P3-04, P3-06a, P3-08a) run in wave 2 beside it.
- Cross-session calls go through the stubs of 2.7, which exist from merge 1.

### 3.4 Timeline (IST)

| When | What |
|---|---|
| Fri 30 and Sat 31 Oct | Owner items P-02, P-03, P-04, P-06, P-07, P-12 (P-01 and RC-059 decided 2026-10-28). Planning sessions fix any spec question that comes up |
| Sun 1 Nov, morning | Wave 1: P3-01. Merge 1 |
| Sun 1 Nov, afternoon to night | Wave 2 (4 sessions in parallel). Merge 2 to 5 as each finishes |
| Mon 2 Nov | Wave 3 (4 sessions). Merge 6 to 9 |
| Tue 3 Nov | Wave 4 (5 sessions). Merge 10 to 14 |
| Wed 4 Nov | Wave 5: P3-07b and P3-INT. Fix round. Last session starts by 8:00 PM |
| Thu 5 Nov | Fixes only. Merge freeze 9:00 AM. Credit expires 1:29 PM |

If fewer than 5 sessions can run at once (P-12), run each wave in the merge order of 3.5 and let the schedule slip by one wave, then apply the cuts in 5.2.

### 3.5 Merge order

| Merge | PR | Why here |
|---|---|---|
| 1 | P3-01 | everything depends on it |
| 2 | P3-05a | schema and `withChangeLog` unblock wave 3 and 4 |
| 3 | P3-04 | shell and forms need the kit |
| 4 | P3-06a | CRUD sessions need validation |
| 5 | P3-08a | runtime and metrics need the core |
| 6 | P3-02 | auth before the shell is wired to real sessions |
| 7 | P3-05b | CRUD, metrics and engine runtime test against seeds |
| 8 | P3-05c | additive, nothing depends on it in Phase 3 |
| 9 | P3-03 | shell, scope loaders and stub routes |
| 10 | P3-07a | targeting card replaces the stub |
| 11 | P3-06b | campaigns and IOs |
| 12 | P3-06c | line items (after IO frames exist) |
| 13 | P3-08b | engine runtime and tick endpoint |
| 14 | P3-09 | metrics replace the zero stub |
| 15 | P3-07b | advanced editors |
| 16 | P3-INT | last |

### 3.6 Merge cheat sheet (for whoever merges)

**Merge authority (P-13, ADR-046, 2026-10-28).** The Cowork assistant session may merge Phase 3+ build PRs into `main` on the owner's behalf, only when all of these hold:
1. Required checks are green: lint, typecheck, unit tests, Playwright and the secret scan (the `check`, `db-tests` and `e2e` jobs).
2. The Vercel preview deployment is green.
3. Merge order follows 3.5.
4. There are no unresolved review comments.

Always squash-merge. Never force-push. Never delete other branches. Never merge a docs-only PR that touches specs without reading the diff. The assistant reports every merge to the owner (PR, squash commit, checks, preview).

For each PR in order:
1. Open the PR. Check the three CI checks are green and the Vercel preview is green (or the PR says why not).
2. Read "Files outside my ownership list touched". It should say none. If it lists files, check 3.2.
3. Read "Not done". If a "must" item from the prompt is missing, ask the session to finish it before merging.
4. Squash merge. Delete the PR's own head branch only (the "Automatically delete head branches" setting does this); never delete other branches.
5. In the next waiting PR, if there is a conflict only in `PROJECT.md` or `package-lock.json`, apply the rules in 2.2 and 2.9 (a session can do it: comment "rebase on main and resolve per build-plan 2.2 and 2.9").
6. Start the next session whose prerequisites are now merged.

### 3.7 Phase 4 outline (after the credit window, normal plan limits)

Run 2 to 3 sessions in parallel per wave. Prompts for these are written by a planning session once Phase 3 is merged, using the same template as section 4. Each module's build tasks come from section 7 of its module file. Every session gets a branch `p4-xx-name`, an ownership list, acceptance criteria copied from its module and the same definition of done.

| Wave | Sessions (PROJECT.md task: module tasks) | Parallel because | Prerequisites |
|---|---|---|---|
| 6 | P4-01 creatives: module 12 M12-01 to M12-14. P4-04 resources: module 15 M15-01 to M15-07, M15-09. P4-09 settings and users: module 02 T3 to T13, module 03 T1 to T10 | disjoint folders (`lib/creatives`, `lib/resources`, `lib/settings`) | Phase 3 merged; Blob store (P-08) |
| 7 | P4-03 audiences: module 14 M14-01 to M14-11. P4-02 inventory: module 13 M13-01 to M13-13. P4-06 YouTube: module 09 T09-01 to T09-12. P4-05 custom bidding: module 15 M15-08 | audiences need Floodlight (P4-04); YouTube needs targeting and creatives | wave 6 merged |
| 8 | P4-07 reporting: module 16 M16-01 to M16-12. P4-08 planning: module 04 T1 to T12. P4-10 bulk, SDF, experiments: module 11 T11-01 to T11-13, module 17 M17-01 to M17-11 | reporting needs Floodlight and creatives; planning needs inventory | wave 7 merged |
| 9 | P4-11 optimisation, alerts, Troubleshooter: module 11 T11-14 to T11-16, module 08 T08-11, T08-12, module 06 T06-08, T06-09, module 01 T07 to T14, T16, module 03 T06. P4-12 history and notifications UI: module 05 T3 to T10 | both read finished entities | wave 8 merged |

### 3.8 Phase 5 outline

| Wave | Sessions | Notes |
|---|---|---|
| 10 | P5-01 instructor console: module 18 M18-07, M18-08, M18-09, M18-16, M18-17 (stretch), module 03 T09 console part. P5-03 time controls: M18-10 | `app/sim/instructor/**`, disjoint |
| 11 | P5-02 scenario engine and 10 starter exercises: M18-11 to M18-14 (needs modules 12 to 17 landed). P5-04 progress dashboard: M18-15 | needs P5-01 and Phase 4 |
| 12 | Phase 6 per PROJECT.md: SOP-3 fidelity per module, Playwright core flows, load test (25 students, 60 as stretch), pilot class | planning sessions |

---


## 4. Ready-to-paste cloud-session prompts

One fenced block per session. Paste the block as the first message of a new Claude Code cloud session on the repo `iam-knr/dv360-adsmentor` (environment `dv360-build`). Start a session only when its "Merged before you start" list is merged (section 3.1). Every block follows the same layout: read list, scope, out of scope, file ownership, acceptance criteria copied from the specs, tests, definition of done, stop conditions.

The prompts quote acceptance criteria verbatim from the module files, so a change in a module file after this date does not update them. If they differ, the module file wins, unless a conflicts.md row says otherwise.

### 4.1 P3-01 (Scaffold)

```text
Read PROJECT.md, docs/specs/build-plan.md and the listed specs. Implement the repository skeleton of build-plan section 2: Next.js, TypeScript, MUI, Prisma, Vitest, Playwright, CI, scripts, stubs and a health check. Write tests. Open a PR to `main` from branch `p3-01-scaffold`; do not push to main. Update nothing in PROJECT.md except via the PR's last commit `docs: status P3-01`.

SESSION: P3-01 (scaffold and deploy). Wave 1. Merged before you start: nothing (owner items P-01 and P-02 done).

READ FIRST, in this order
- docs/specs/conflicts.md (rows RC-nnn override every spec; read section 1.1)
- docs/specs/build-plan.md sections 2 (conventions, stubs, global stop conditions in 2.10) and 3.2 (file ownership)
- PROJECT.md sections 2 (rules R1 to R8), 3, 7.1
- docs/specs/build-plan.md section 2 in full (this is the spec for this session) and section 1.10 (environment variables)
- docs/specs/routes.md sections 1 (decisions R1 to R10) and 5.1 (folder tree) and 9 (build notes)
- docs/specs/validation.md section 6.2 (folder structure and the purity lint rule)
- docs/specs/engine.md section 1.5 (module boundaries and dependency direction) and 1.3 (determinism rules that become lint rules)
- docs/specs/data-model.md header, Appendix A first 20 lines (generator and datasource) and Appendix B
- docs/specs/design-system.md section 1.8 (MUI theme) only to know what P3-04 will replace
- docs/decisions.md (ADR-006 to ADR-010, ADR-022 to ADR-024)

BUILD EXACTLY THIS
1. Create every file and folder of build-plan 2.1 to 2.8 with the package versions of 2.2 (verify with `npm view`, pin exact, list resolved versions in the PR).
2. Create `package.json` scripts exactly as in 2.3, including `db:local` (embedded Postgres on port 54329, creates `dv360_dev` and `dv360_test`) and `vercel-build`.
3. Create `tsconfig.json`, `eslint.config.mjs` (rules in 2.4), `.dependency-cruiser.cjs` (rules in 2.4, with a fixture test proving a violation fails), `.prettierrc`, `.nvmrc`, `.gitignore`, `.env.example` (all variables of build-plan 1.10).
4. Create `prisma/schema/00-base.prisma` (generator, datasource with `url` and `directUrl`, model `AppMeta`) and set the Prisma schema folder in `package.json`. Create the first migration `0000_base`.
5. Create `vitest.config.ts` with the three projects of 2.6, `vitest.setup.ts`, `playwright.config.ts`, and one test of each kind (`tests/unit/sanity.test.ts`, `tests/db/health.db.test.ts`, `tests/e2e/smoke.spec.ts`).
6. Create `.github/workflows/ci.yml` (the YAML in 2.6, including the secret-scanning step with gitleaks or GitHub secret scanning, ADR-044) and `.github/pull_request_template.md` (sections listed in 2.9). Make sure `.gitignore` excludes every `.env*` file except `.env.example`. The repo is public: never commit secrets, keys, database URLs or student data.
7. Create the stub contracts of 2.7 with the listed exports and behaviour. Add a 3-line `README.md` to each owned folder naming the owner session and the spec.
8. Create `app/layout.tsx` (ThemeRegistry from `lib/theme/provider.tsx`, self-hosted Figtree and Roboto via @fontsource, no network fonts), `app/page.tsx` placeholder, `app/api/health/route.ts`, `lib/env.ts` (zod), `lib/money.ts` with unit tests (RC-019).
9. Create `scripts/bootstrap.ts` (runs `prisma/bootstrap/*.bootstrap.ts` in name order, each idempotent) and `scripts/vercel-build.sh`.
10. Write `README.md` quickstart.
11. Run the full gate locally (`npm ci`, `npm run check`, `npm run db:local` in the background, `npm run db:migrate:dev`, `npm run test:db`, `npm run build`, `npm run e2e`). Push, open the PR, wait for CI.

OUT OF SCOPE (do not build, even if easy)
- any application feature, page content beyond the placeholder, domain tables, seed data, auth, UI kit components, engine code
- branch protection and Vercel settings (owner items in build-plan section 1)
- editing `docs/specs/**` or `docs/explore/**`

FILES YOU OWN (create or edit)
- everything in build-plan 3.2 row "Root configs", plus `.github/**`, `scripts/**`, `prisma/schema/00-base.prisma`, `prisma/migrations/0000_base`, the stub files of 2.7, `app/layout.tsx`, `app/page.tsx`, `app/api/health/**`, `tests/unit/sanity.test.ts`, `tests/db/health.db.test.ts`, `tests/e2e/smoke.spec.ts`, folder README files
EXCEPTIONS (you may also touch)
- `PROJECT.md` (last commit only)
Everything else belongs to another session. Do not edit it. If you must, follow stop condition 1 of build-plan 2.10.

ACCEPTANCE CRITERIA (copied from the specs; list each one in the PR as Done, Partly or Not done with the test that proves it)
- F1: A fresh clone runs `npm ci` and `npm run check` with no errors.
- F2: `npm run db:local` starts Postgres 17 and `npm run test:db` passes against it.
- F3: `GET /api/health` returns `{ ok: true, db: true }` locally and in CI.
- F4: CI runs the three jobs `check`, `db-tests`, `e2e` and all pass on the PR.
- F5: `npm run depcruise` fails on the deliberate violation fixture and passes on the repo.
- F6: ESLint rejects `Math.random()` in a file under `lib/engine/` (fixture) and accepts it elsewhere.
- F7: `.env.example` lists every variable of build-plan 1.10. No secret value is committed.
- F8: Every stub of 2.7 exists with the exported names and types listed.
- F9: The Vercel preview for the PR builds with `npm run vercel-build` and `/api/health` returns 200 (only if owner items P-03 and P-04 are done).
- F10: Playwright smoke passes against `npm run start` and uses the preinstalled Chromium if `PLAYWRIGHT_CHROMIUM_PATH` is set.
- F11: CI runs a secret scan (gitleaks or GitHub secret scanning) inside the `check` job and it passes; `.gitignore` excludes `.env*` except `.env.example` (ADR-044).

TESTS TO WRITE
- unit: `lib/money.ts` (minor/major conversion, rounding, INR and SGD formatting), `lib/env.ts` (missing variable fails with a clear message)
- db: health route query, `AppMeta` read and write
- lint fixtures for F5 and F6 (a test that runs ESLint and dependency-cruiser on fixture files and expects failures)
- e2e: home page and health

DONE WHEN
- all commands of "Run the full gate" succeed on a clean checkout
- `npm run check` passes, plus `npm run test:db` if you touched database code and `npm run e2e` for the e2e specs you wrote
- CI is green on the PR and the Vercel preview is green (if the preview is not available because owner items P-03 or P-04 are open, say so in the PR)
- the PR body follows .github/pull_request_template.md, with the acceptance table, deviations and a Not done list
- the last commit is `docs: status P3-01`

STOP CONDITIONS (in addition to build-plan 2.10)
- If a pinned package does not resolve or breaks the build, choose the nearest working version, record it under Deviations and continue.
- If `prisma generate` cannot download engines (network policy), stop and tell the owner to add `binaries.prisma.sh` to allowed domains (build-plan 1.2).
- Do not create domain code. If you feel the need, it belongs to a later session.
```

### 4.2 P3-04 (Design system components)

```text
Read PROJECT.md, docs/specs/build-plan.md and the listed specs. Implement the design tokens, MUI theme, icon set and shared component kit of design-system.md (PROJECT.md P3-04). Write tests. Open a PR to `main` from branch `p3-04-components`; do not push to main. Update nothing in PROJECT.md except via the PR's last commit `docs: status P3-04`.

SESSION: P3-04 (shared components and theme). Wave 2. Merged before you start: P3-01.

READ FIRST, in this order
- docs/specs/conflicts.md (rows RC-nnn override every spec; read section 1.1)
- docs/specs/build-plan.md sections 2 (conventions, stubs, global stop conditions in 2.10) and 3.2 (file ownership)
- docs/specs/design-system.md sections 0 to 5 and 7 in full; section 6 is the fidelity checklist you will use for acceptance
- docs/specs/routes.md sections 4.1 (top bar), 5 (frames A, C, IO, LI, F), 6.2 (list params `d`, `q`, `f.*`, `sort`, `rows`, `page`, `cv`, `seg`)
- docs/specs/validation.md section 5 (Unsaved Changes and confirm dialogs) and the message catalogue 1.2
- docs/specs/modules/01-global-shell.md sections 2.10 (chrome), 4.10 (keyboard); modules/06 section 2.1 (grid columns), modules/07 section 2.1, modules/08 section 2.1 (what the grids must support)
- docs/specs/conflicts.md rows RC-051

BUILD EXACTLY THIS
1. Tokens and theme: `lib/theme/tokens.ts` from design-system 1.1 to 1.7 and the MUI theme of 1.8, `ThemeRegistry` (replace the stub), self-hosted fonts already set by P3-01.
2. Icons: `components/icons/DvIcon.tsx` wrapping Material Symbols Outlined (weight 400, grade 0) with the name map of design-system section 3.
3. Tier A components in `components/dv/` (build all, with the props and behaviour of design-system 2.x): DvAppBar and DvBreadcrumbs (2.1), DvNav (2.2), DvRightRail and DvPanel with `exercise` (2.3), DvGrid (2.4: TanStack Table, two header rows with group toggles, sticky header and columns, selection, sort, column groups, totals row, pager, empty/loading/error states, cell renderers for status dot, alert bell, name plus id, number, currency, percent), DvBulkBar (2.5), DvFilterBar (2.6), DvDateRange (2.7, preset sets `grid` and `history`, sim-clock aware `today` prop), form kit (2.8: DvTextField, DvSelect, DvRadioGroup, DvCheckboxGroup, DvSectionCard, DvFormPage, DvFormFooter, field error/warning/hint, counters, unit adornments), DvStatusDot, DvStatusChip, DvStatusSelect (2.9), DvSlideOver (2.10), DvModal with the Unsaved Changes preset (2.11), DvBanner (2.12), DvToast and SnackbarHost (2.13), DvEmptyState (2.14), DvSpinner and DvSkeleton (2.15), DvTabs (2.17), DvStepper (2.18), DvTooltip and DvHelp (2.19), DvPageHeader, DvEntityHeader, DvKbd (2.20).
4. Tier B (build if Tier A is green): DvChartCard and DvChartStrip with Recharts (2.16), DvKpiTile, DvPickerDialog, DvCardCarousel.
5. Hooks used by the kit: `useUnsavedChanges`-compatible dirty prop API only (the hook itself is in lib/validation/client, P3-06a). Keyboard and focus rules of design-system 5.
6. Gallery page `app/(dev)/components/page.tsx` showing every component with all variants. It returns 404 unless `NODE_ENV !== "production"` or `ENABLE_GALLERY === "1"`.
7. Export everything from `components/dv/index.ts` (replace the stub barrel).
8. `DvAppBar` renders the logo `public/brand/adsmentor-logo-horizontal.png` (28 px high; the login page uses 48 px, RC-058). Do not use a text wordmark. The square icon crop is derived in P3-03.

OUT OF SCOPE (do not build, even if easy)
- Tier C patterns: DvSankey, DvAudienceBuilder, DvDayTimeGrid, DvRuleRow, DvDayCard, report builder panels, DvTreeSelect, DvSellerCard (built by the module sessions that need them)
- any page, route, data fetching, business logic or copy beyond what the component specs list
- dark mode (design-system Q7)

FILES YOU OWN (create or edit)
- `lib/theme/**`
- `components/dv/**`
- `components/icons/**`
- `app/(dev)/components/**`
- `tests/components/**`
- `tests/e2e/gallery.spec.ts`
- `public/brand/**` (copy `docs/brand/adsmentor-logo-horizontal.png` to `public/brand/` as the logo source; no other brand assets)
EXCEPTIONS (you may also touch)
- `package.json` and lockfile only to add a missing dependency (rebase rule in build-plan 2.2)
- `PROJECT.md` (last commit only)
Everything else belongs to another session. Do not edit it. If you must, follow stop condition 1 of build-plan 2.10.

ACCEPTANCE CRITERIA (copied from the specs; list each one in the PR as Done, Partly or Not done with the test that proves it)
- Global: App bar height, icon order, tooltip texts (Search (/), etc.), badge dot on bell
- Global: Two-line breadcrumb (label above name), separators, truncation tooltip
- Global: Left nav items, order, dividers, carets, "new" dot, active pill colour and shape, collapsed rail tooltips
- Global: Right rail icons, order, selected state, panel width and push/overlay behaviour
- Global: Page background vs card colour; card border and radius
- Global: Fonts: title face, body face, sizes from 1.2 table
- Global: Banner under app bar (paused advertiser) wording, colour, icon, link
- Global: Focus ring visible and not clipped
- Global: No Google logo, text or asset anywhere (Section 7)
- Data grid: Two header rows: group labels, ‹› toggles, collapsed stub look
- Data grid: Column order and default widths per view (Performance, Summary, Pacing, Optimization)
- Data grid: Sticky columns and shadow edge on scroll; sticky header
- Data grid: Select-all checkbox state (empty, indeterminate, checked)
- Data grid: Alert bell column, status dot column, hover ▾ with Activate / Pause
- Data grid: Name wrap to 2 lines with grey ID below; link colour
- Data grid: Number alignment, tabular figures, "-" for empty, currency format, compact format in cards
- Data grid: Row hover, selected, focus visuals; inline icons on hover (info, edit, budget edit)
- Data grid: Total row text ("Total: Display") and weight
- Data grid: Pager: "Show rows", range text, icons, page size options
- Data grid: Empty and loading states
- Bulk Action bar: Bar turns blue, text "{n} row(s) selected", Action ▾, close ×
- Bulk Action bar: Menu groups, item names, shortcut hints, disabled items
- Bulk Action bar: Toast / Bulk status entry after the action
- Filter bar: Funnel with count badge; popover listing filters
- Filter bar: Chip text format ("Status: Active", "Status: 5 selected"), × behaviour, editor popover (title, "Matches:", options, Apply)
- Filter bar: Placeholder "Enter a search term or select filters"; typing popover ("Search for Name/ID containing:", "Filter on:")
- Filter bar: Clear-all
- Date-range picker: Preset list and order for the page, selected preset highlight
- Date-range picker: Start/End inputs, month selector, two calendars, selected day circle, greyed future days
- Date-range picker: Trigger label formats ("Yesterday", "Oct 21 - 27, 2026", "90 days to today")
- Forms: Field order, labels, helper text, placeholder and counter ("0 / 240")
- Forms: Status chip default (Draft for IO/LI, Active for campaign)
- Forms: Required marks and error texts: "Enter a value", "Enter a number greater than 0", "Please select at least one creative type."
- Forms: Error styling (red border, red text), first-error scroll, no navigation on error
- Forms: Warning banner for not-recommended KPI, amber
- Forms: Dropdown groups and disabled-until-dependency behaviour
- Forms: Radio/checkbox layout, inline inputs inside radios
- Forms: Section cards, gear notes, expanders default open/closed
- Forms: Left label column on settings pages; locked fields with lock icon
- Forms: Sticky footer buttons by mode (Create/Cancel, Save/Reset), change-note input
- Forms: Unsaved Changes modal text and buttons
- Every Tier A component renders in the gallery with each variant its spec lists, is keyboard operable, and has no serious or critical axe violation (design-system section 5).
- Colours, type and spacing come from tokens only. No hard-coded hex values outside `lib/theme/tokens.ts`.
- No Google logo, name or asset anywhere (design-system section 7).

TESTS TO WRITE
- RTL tests per component: render, variants, keyboard (Tab, Enter, Esc, arrow keys where the spec says), controlled and uncontrolled use, disabled and read-only states
- DvGrid: select all (empty, indeterminate, checked), group collapse, sticky header class, totals row text "Total: Display", empty/loading/error, sort, pager text
- DvDateRange: preset lists and labels for a fixed `today` ("Yesterday", "Oct 21 - 27, 2026", "90 days to today"), `grid` vs `history` sets
- DvModal: Unsaved Changes title, body and buttons "Discard changes" and "Continue editing" exactly as validation.md 5
- DvFilterBar: chip text formats ("Status: Active", "Status: 5 selected"), clear all
- vitest-axe on every gallery entry; `tests/e2e/gallery.spec.ts` loads the gallery with no console errors

DONE WHEN
- all Tier A components are exported from `components/dv/index.ts` and appear in the gallery on the Vercel preview (set `ENABLE_GALLERY=1` in Preview scope)
- the fidelity checklist items above are ticked in the PR body (visual items you cannot verify without screenshots go under Not done with the reason)
- `npm run check` passes, plus `npm run test:db` if you touched database code and `npm run e2e` for the e2e specs you wrote
- CI is green on the PR and the Vercel preview is green (if the preview is not available because owner items P-03 or P-04 are open, say so in the PR)
- the PR body follows .github/pull_request_template.md, with the acceptance table, deviations and a Not done list
- the last commit is `docs: status P3-04`

STOP CONDITIONS (in addition to build-plan 2.10)
- Do not guess a pixel value that is not in the spec: use the nearest token and list it under Deviations (design-system Q1 says values are unmeasured).
- Do not build any Tier C component. If a Tier A component is not finished, finish it before touching Tier B.
```

### 4.3 P3-05a (Schema core and data layer)

```text
Read PROJECT.md, docs/specs/build-plan.md and the listed specs. Implement the core Prisma schema (data-model Appendix A with the resolved conflicts), the multi-tenant data layer with row level security, and the `withChangeLog` write pipeline. Write tests. Open a PR to `main` from branch `p3-05a-schema-core`; do not push to main. Update nothing in PROJECT.md except via the PR's last commit `docs: status P3-05a`.

SESSION: P3-05a (schema core, tenancy and change log). Wave 2. Merged before you start: P3-01.

READ FIRST, in this order
- docs/specs/conflicts.md (rows RC-nnn override every spec; read section 1.1)
- docs/specs/build-plan.md sections 2 (conventions, stubs, global stop conditions in 2.10) and 3.2 (file ownership)
- docs/specs/data-model.md: header conventions, sections 1 (ER), 2 (multi-tenancy, RLS), 4 (all enumerations), 5.1 to 5.8, 5.18, 5.19, 6 (change-log design), 7.1 to 7.4, Appendix A (the Prisma text), Appendix B (SQL)
- docs/specs/modules/05-history-notifications.md sections 3.2 (deltas), 4.1 (write pipeline), 4.2, 6 (acceptance criteria AC-05-1 to AC-05-9, AC-05-29)
- docs/specs/modules/06-campaigns.md 3.3, 07-insertion-orders.md 3.3, 08-line-items.md 3.3 (spec deltas), 18 section 3.2 (deltas Δ18-1 to Δ18-4, Δ18-13, Δ18-14)
- docs/specs/conflicts.md rows RC-001 to RC-006, RC-013, RC-019 to RC-025, RC-028, RC-031, RC-032 (already applied to data-model.md; read them to know what changed)
- docs/specs/engine.md 1.7 and 3.5 (stored shape of DeliveryDiagnostic), 9.1 and 9.2 (metric columns)

BUILD EXACTLY THIS
1. Extract the prisma code block of data-model.md Appendix A into `prisma/schema/` as multi-file schema: `10-training.prisma`, `20-tenant-root.prisma`, `30-hierarchy.prisma`, `40-creative-targeting-audience.prisma`, `50-sim.prisma`, `60-history-alerts.prisma`, `69-enums.prisma`. Keep model and enum names. Fix only what `prisma validate` forces, and list each fix in the PR.
2. Apply the data-model changes already listed in conflicts.md (version column on every editable entity, `AppMeta` untouched, `YT_ON_CTV`, `Alert.diagnosticCode`, `SimDailyMetric.sliceKind` with the new unique key, `DeliveryDiagnostic` in the ENG 3.5 shape, SimClock engine columns, AccessWindow `repeatRule/seriesId/note`, `Notification.learnMoreRoute`, `InventorySourceDeal.allAdvertisers`) and the schema-level module deltas of modules 05, 06, 07, 08 and 18 listed in the read list.
3. Create migration `0001_core` with `prisma migrate dev`. Add SQL under `prisma/sql/` and apply it from a migration: RLS policies on every tenant table using `current_setting('app.sandbox_id')`, role `app_engine` with bypass, `NULLS NOT DISTINCT` unique constraints (data-model Appendix B and 8 Q22), the `entity_public_id_seq` default for PID tables. Do not create partitions (ADR-027). RLS enforcement is behind env `RLS_ENABLED` (default on).
4. `lib/db/tenant.ts`: `withSandbox(sandboxId, fn)` (interactive transaction with `SET LOCAL app.sandbox_id`), `withBypass(fn)` for the engine, `lib/db/ids.ts` (public id helpers). Extend `lib/db/index.ts`.
5. `lib/changelog/`: `withChangeLog(ctx, entityRef, mutate)`, `diff.ts` (before/after through a field registry), `registry-types.ts`, `actors.ts` (system actor constants of data-model 6.3), idempotency key support, `UI_STATE_TABLES` allow-list, summary text rules (module 05 4.3). Entity registries for Campaign, IO and LI are written by their module sessions; here ship the registry type, a registry for `Advertiser` as the worked example, and the scan test.
6. Scan test `tests/changelog/scan.test.ts`: fails when a service file writes a tenant model outside `withChangeLog` (AC-05-7). Wire it into `npm test` through the `unit` project.
7. DB tests: sandbox isolation (a session set to sandbox A reads zero rows of sandbox B for every tenant table), composite FK rejects a child pointing to a parent of another sandbox, `publicId` sequence is global and unique, cascade delete of a sandbox, `NULLS NOT DISTINCT` on `UserAccessGrant`.

OUT OF SCOPE (do not build, even if easy)
- Appendix C tables (P3-05c), seed data (P3-05b), auth logic (P3-02), partitions (ADR-027), any UI, any module service
- Entity registries other than the Advertiser example

FILES YOU OWN (create or edit)
- `prisma/schema/10..69-*.prisma`
- `prisma/migrations/0001_core/**`
- `prisma/sql/**`
- `lib/db/**` except `client.ts`
- `lib/changelog/**` except `registries/` entity files
- `tests/db/**`
- `tests/changelog/**`
EXCEPTIONS (you may also touch)
- `lib/db/index.ts` (extend exports)
- `PROJECT.md` (last commit only)
Everything else belongs to another session. Do not edit it. If you must, follow stop condition 1 of build-plan 2.10.

ACCEPTANCE CRITERIA (copied from the specs; list each one in the PR as Done, Partly or Not done with the test that proves it)
- AC-05-1 (V) Editing one scalar field of an IO with `withChangeLog` creates one group with `summary = "1 change to insertion order"`, one `UPDATE` entry with canonical old/new values, the full parent chain ids and the user label.
- AC-05-2 (V) A save with no real change (same values, different object identity) writes no group.
- AC-05-3 (V) Creating an entity writes one `CREATE` entry per non-null registered field in registry order, capped at 60, summary "N changes made.".
- AC-05-5 (V) A status change writes a `STATUS_CHANGE` entry with label "Status" and line `Status changed from "Active" to "Paused"`.
- AC-05-6 (V) `ignore` fields (`updatedAt`, `version`) never appear in entries.
- AC-05-7 (V) The scan test fails when a service writes a tenant table outside `withChangeLog` and passes for every table in `UI_STATE_TABLES`.
- AC-05-9 (V) A partner exchange change writes 1 partner group and 1 `PARTNER_FANOUT` group per advertiser with `systemActor = PARTNER_SETTING_UPDATER`; fan-out groups are hidden unless "Include system changes" is on.
- AC-05-29 (V) Registry completeness: every `EntityType` has a registry file, every Prisma column of those entities is either registered or marked `ignore` (test enumerates the schema).
- M18-AC25: A student cannot read another sandbox through scenario selectors or API IDs (RLS tests); instructors only see classes they teach; admin actions create `AuditLog` rows.
- RC-020: every editable entity has `version`; RC-022: daily metric key includes `sliceKind`; RC-021: DeliveryDiagnostic has the ENG 3.5 columns.
- Prisma validate, generate and `migrate deploy` pass on an empty database in CI.

TESTS TO WRITE
- db: RLS isolation per tenant table (generated from the schema), composite FK rejection, public id uniqueness, unique constraints with nulls
- db: `withChangeLog` cases AC-05-1, 2, 3, 5, 6, 9 against a real database (the group, entries, parent chain ids, user label, no-op save, create cap of 60, ignore fields, partner fan-out groups)
- unit: diff engine and summary text; scan test with a passing and a failing fixture; `UI_STATE_TABLES` exemption
- registry completeness test for `Advertiser` (every column registered or ignored) as the pattern for AC-05-29

DONE WHEN
- `npx prisma validate`, `npx prisma migrate deploy` on an empty database and `npm run test:db` pass
- the schema has a model or enum for every entry of data-model Appendix A, checked by a test that parses the document
- `npm run check` passes, plus `npm run test:db` if you touched database code and `npm run e2e` for the e2e specs you wrote
- CI is green on the PR and the Vercel preview is green (if the preview is not available because owner items P-03 or P-04 are open, say so in the PR)
- the PR body follows .github/pull_request_template.md, with the acceptance table, deviations and a Not done list
- the last commit is `docs: status P3-05a`

STOP CONDITIONS (in addition to build-plan 2.10)
- If Appendix A needs more than syntax fixes to validate, stop and list the problems in the PR.
- Do not add tables from Appendix C. Do not edit data-model.md.
```

### 4.4 P3-06a (Validation core)

```text
Read PROJECT.md, docs/specs/build-plan.md and the listed specs. Implement the `lib/validation` library for the Campaign, Insertion order and Line item domains (PROJECT.md P3-06, first part). Write tests. Open a PR to `main` from branch `p3-06a-validation`; do not push to main. Update nothing in PROJECT.md except via the PR's last commit `docs: status P3-06a`.

SESSION: P3-06a (validation library). Wave 2. Merged before you start: P3-01.

READ FIRST, in this order
- docs/specs/conflicts.md (rows RC-nnn override every spec; read section 1.1)
- docs/specs/build-plan.md sections 2 (conventions, stubs, global stop conditions in 2.10) and 3.2 (file ownership)
- docs/specs/validation.md sections 0 to 4, 6 and 7 in full (rules, matrices MX-01 to MX-18, state machines, TypeScript design and Vitest case tables)
- docs/specs/modules/06-campaigns.md section 4.2 (status and cascade), 6.3; modules/07-insertion-orders.md 4.2, 6.3; modules/08-line-items.md 4.2, 4.3, 6.3
- docs/specs/data-model.md section 4 (enumerations, after conflict resolution)
- docs/specs/conflicts.md rows RC-001 to RC-006, RC-011, RC-018, RC-019, RC-039 to RC-042, RC-053

BUILD EXACTLY THIS
1. Create `lib/validation/` exactly as in validation.md 6.2: `index.ts`, `types.ts`, `engine.ts`, `registry.ts`, `messages.ts` (catalogue 1.2 verbatim), `primitives.ts`, `dialogs.ts` (DLG-01 to DLG-12), `constants/*`, `rules/*`, `state/*`, `client/*`, `server/*`, `testing/fixtures.ts`.
2. Implement all rules of domains GEN, CMP, IO and LI (shared) and the type files li-display, li-video, li-ctv, li-audio, li-app, li-dooh, li-demand-gen. Include the rule IDs adopted in conflicts.md RC-053 for these domains. Rules are pure and synchronous (6.1).
3. Implement the constants MX-01 (goals and KPIs), MX-02 (IO matrix), MX-03 (LI type compatibility), MX-04 (bid strategies), MX-05 (pacing and automation, RC-039), MX-06 (frequency), MX-08 (conversions), MX-10 (targeting availability, labels mapped to DM keys per RC-011), MX-17 (fee types). Use the enum keys of conflicts.md (RC-001 to RC-005).
4. Implement the state machines for Campaign, IO and LI (validation 4.1 to 4.3), `effectiveStatus`, and bulk applicability `isApplicable` (4.10).
5. Implement `client/useValidatedForm.ts`, `client/useUnsavedChanges.ts`, `client/issues.ts` (react-hook-form resolver, dirty tracking, route guard, focus first error) and `server/context.ts`, `server/withValidation.ts` for the three entity kinds.
6. Create empty exported rule arrays for the other domains so the registry compiles (AG, AD, TGT, TPL, CRE, AUD, INV, CH, KW, LOC, FL, CB, AB, LS, BLK, PLN, RPT, USR, SHL, HIS, SIM). TGT and TPL rule files are written by P3-07a; leave the files with `export const targetingRules = []` and a comment naming P3-07a.
7. Write the test suites of validation.md 6.7: `catalogue.test.ts`, `coverage.test.ts` (every non-alias rule ID of the implemented domains has at least one case), `docs-sync.test.ts` (parses validation.md and the module files, compares IDs, severities and verbatim messages), `state.test.ts`, `dirty.test.ts`.

OUT OF SCOPE (do not build, even if easy)
- rules for YouTube, ad groups, ads, targeting, templates, creatives, audiences, inventory, resources, experiments, bulk, planning, reports, users (later sessions)
- any React component or page
- any database access outside `server/`

FILES YOU OWN (create or edit)
- `lib/validation/**` except `rules/targeting.ts` and `rules/template.ts`
- `tests/validation/**` except `cases.targeting.ts`
EXCEPTIONS (you may also touch)
- `PROJECT.md` (last commit only)
Everything else belongs to another session. Do not edit it. If you must, follow stop condition 1 of build-plan 2.10.

ACCEPTANCE CRITERIA (copied from the specs; list each one in the PR as Done, Partly or Not done with the test that proves it)
- Rule ids and messages in validation.md for GEN, CMP, IO, LI and LI-type domains are implemented with the exact severity and verbatim text (proved by docs-sync).
- Lint rule: `lib/validation` outside `client/` and `server/` imports nothing from `react`, `next/*`, `@prisma/client`, `node:*` (build-plan 2.4).
- Every matrix test below passes.
- V-06-01: name "" => `CMP-001:error`
- V-06-02: goal AWARENESS + KPI CPA 500 => `CMP-013:warning`, no errors
- V-06-03: KPI CTR 120 => `CMP-015:error`
- V-06-04: KPI value -1 => `CMP-014:error`
- V-06-05: creativeTypes [] => `CMP-020:error`
- V-06-06: freq LIMITED, maxExposures empty => `CMP-040:error`
- V-06-07: endDate < startDate => `CMP-032:error`
- V-06-08: startDate before today on create => `CMP-034:error`; on edit of started campaign changed start: `CMP-033:error`
- V-06-09: budget row with only name => `CMP-050:error`
- V-06-10: 6 keywords => `CMP-061:warning`
- V-06-11: MX-01 table test: every goal x every KPI returns warning iff not recommended => exact
- V-06-12: `isApplicable('ACTIVATE', rows)` with all ACTIVE => false; with one PAUSED | true

TESTS TO WRITE
- Vitest case tables, copied from the module specs (put them in `tests/validation/cases.campaign.ts`, `cases.io.ts`, `cases.li.ts`):
  - V-06-01: name "" => `CMP-001:error`
  - V-06-02: goal AWARENESS + KPI CPA 500 => `CMP-013:warning`, no errors
  - V-06-03: KPI CTR 120 => `CMP-015:error`
  - V-06-04: KPI value -1 => `CMP-014:error`
  - V-06-05: creativeTypes [] => `CMP-020:error`
  - V-06-06: freq LIMITED, maxExposures empty => `CMP-040:error`
  - V-06-07: endDate < startDate => `CMP-032:error`
  - V-06-08: startDate before today on create => `CMP-034:error`; on edit of started campaign changed start: `CMP-033:error`
  - V-06-09: budget row with only name => `CMP-050:error`
  - V-06-10: 6 keywords => `CMP-061:warning`
  - V-06-11: MX-01 table test: every goal x every KPI returns warning iff not recommended => exact
  - V-06-12: `isApplicable('ACTIVATE', rows)` with all ACTIVE => false; with one PAUSED | true
  - V-07-01: name "" => IO-010
  - V-07-02: type CTV_OTT + CLICKS => IO-003
  - V-07-03: type DOOH + BRAND_AWARENESS => IO-004
  - V-07-04: edit objective CLICKS → CONVERSIONS => IO-005
  - V-07-05: segment amount 0 / empty / impressions fractional => IO-022 / IO-021 / IO-023
  - V-07-06: segment end before start => IO-024
  - V-07-07: two overlapping segments => IO-027
  - V-07-08: edit segment amount below spent => IO-026
  - V-07-09: FLIGHT + ASAP => IO-031
  - V-07-10: DAILY with no amount => IO-032
  - V-07-11: KPI not in objective list => IO-040
  - V-07-12: VTR 120 => IO-042
  - V-07-13: automate + YT LI present => IO-052
  - V-07-14: auto allocation ticked while automated => IO-055
  - V-07-15: 6 CPM fees => IO-074
  - V-07-16: fee amount set without type => IO-072
  - V-07-17: activate with all segments ended => IO-092
  - V-07-18: cross-entity: LI budgets sum > IO budget => IO-093 warning
  - V-07-19: matrix snapshot test: all 5 objectives x 3 types equals MX-02 => exact
  - V-07-22: `isApplicable` table for IO grid (Pause on Draft false) => exact
  - V-07-23: `looserThan` frequency cap helper (campaign 3/week vs IO 10/day) => info IO-063
  - V-08-01: name empty => LI-001
  - V-08-02: type CTV in Clicks IO => LI-006
  - V-08-03: DOOH type in Standard IO => LI-007
  - V-08-04: Demand Gen with Floodlight off => LI-DG-001
  - V-08-05: no exchange, deal or group => LI-011
  - V-08-06: custom flight outside IO flight => LI-022
  - V-08-07: budget `0` => LI-031
  - V-08-08: IO automated + pacing EVEN => LI-035
  - V-08-09: strategy MAX_CONVERSIONS without activities => LI-046
  - V-08-10: custom value strategy with suspended algorithm => LI-047
  - V-08-11: freq looser than higher cap => LI-053 info
  - V-08-12: creative type not allowed => LI-060 (and per type rule)
  - V-08-13: activation with no creative => LI-063 warning only
  - V-08-14: EU political ads blank => LI-080
  - V-08-15: CTV device without Connected TV => LI-CTV-004
  - V-08-16: DOOH bid AUTOMATED => LI-DOOH-002
  - V-08-17: Audio default bid FIXED => LI-AUD-004 info
  - V-08-18: Ads in apps removes locked Environment => LI-APP-005
  - V-08-19: MX-03 table test (all types x objectives) => exact
  - V-08-20: MX-04 table test => exact
  - V-08-21: MX-10 table test for the targeting dimension x type => exact
- MX table tests: every goal x KPI of MX-01; every IO type x objective of MX-02; every LI type x objective of MX-03; every (objective, type) bid list of MX-04
- docs-sync, coverage, state and dirty tests as in validation.md 6.7

DONE WHEN
- all suites above pass in `npm test` (no database needed)
- `npm run check` passes, plus `npm run test:db` if you touched database code and `npm run e2e` for the e2e specs you wrote
- CI is green on the PR and the Vercel preview is green (if the preview is not available because owner items P-03 or P-04 are open, say so in the PR)
- the PR body follows .github/pull_request_template.md, with the acceptance table, deviations and a Not done list
- the last commit is `docs: status P3-06a`

STOP CONDITIONS (in addition to build-plan 2.10)
- If a message differs between validation.md and a module file, validation.md wins; note it in the PR.
- If a rule needs data not in `ValidationContext`, extend the context type (validation.md 6.3) and say so in the PR; do not read the database from a rule.
```

### 4.5 P3-08a (Engine core)

```text
Read PROJECT.md, docs/specs/build-plan.md and the listed specs. Implement the pure TypeScript simulation engine: parameters, deterministic randomness, supply, eligibility funnel, bidding, auction, outcomes, pacing, costs, diagnostics and aggregation (PROJECT.md P3-08, first part). Write tests. Open a PR to `main` from branch `p3-08a-engine-core`; do not push to main. Update nothing in PROJECT.md except via the PR's last commit `docs: status P3-08a`.

SESSION: P3-08a (simulation engine, pure core). Wave 2. Merged before you start: P3-01.

READ FIRST, in this order
- docs/specs/conflicts.md (rows RC-nnn override every spec; read section 1.1)
- docs/specs/build-plan.md sections 2 (conventions, stubs, global stop conditions in 2.10) and 3.2 (file ownership)
- docs/specs/engine.md sections 1 (architecture), 2 (supply and `params.json`), 3 (eligibility and diagnostics), 4.1 to 4.4 and 4.6, 5.1 to 5.4 and 5.6, 6.1 to 6.5, 7 (pacing), 8 (costs), 9.1 to 9.4 (aggregation), 11 (testing), 12 (open questions)
- docs/specs/data-model.md sections 5.5, 5.6 (IO and LI fields the engine reads), 5.18 (simulation tables), 7.2
- docs/specs/validation.md MX-04 (bid strategies) and MX-05 (pacing) to know which strategies exist
- docs/specs/modules/08-line-items.md section 5 (engine outputs shown by the LI module) and modules/06 section 5, modules/07 section 5
- docs/specs/conflicts.md rows RC-013, RC-014, RC-021 to RC-027, RC-029, RC-033, RC-038, RC-039

BUILD EXACTLY THIS
1. Create `lib/engine/` (all folders of engine.md 1.5 except `io/`), `engine/params.json` with the benchmark table of 2.5 and the market multipliers of 2.6, `lib/engine/params/schema.ts` (zod), `load.ts` (merge-patch), `hash.ts`.
2. RNG: xoshiro streams keyed by `(seed, module, entity, tick)` (1.3). No `Math.random`, `Date.now` or `new Date()` without argument in this folder (lint rule from P3-01).
3. World types: `World` (read-only snapshot of partner, advertiser, campaigns, IOs, LIs, creatives, targeting, deals stub, clocks) and `TickOutput` (funnel rows, outcomes, hourly totals, daily slices, alert decisions). The `io/` layer (P3-08b) will fill `World` from the database.
4. `runTick(world, tickIndex, params): TickOutput` covering: supply cells (2.1 to 2.4), eligibility funnel stages and reason codes with conservation (3.1 to 3.4), frequency model (3.9), bidding for FIXED, MAX_CLICKS, MAX_CONVERSIONS, TARGET_CPA, MAX_VIEWABLE_IMPRESSIONS, TARGET_CPM, MAX_REACH (other automated goals map to the nearest of these; note the mapping in a table in `lib/engine/bidding/README.md`), value model and learning phase (4.3), solving lambda (4.4), IO-level simple budget allocation (7.5), internal and external auction (5.1 to 5.4), IVT losses (5.6), outcomes: viewability, clicks, video and audio quartiles, Floodlight conversions with lag and the three counting methods Standard, Unique, Per session (6.1 to 6.5; multi-touch as the two-touch approximation), pacing (7.1 to 7.4, 7.6, 7.7), costs, fees, revenue (8.1 to 8.7 with currency derived at read time, RC-025), aggregation to hourly totals and daily slices (9.1 to 9.4 with `sliceKind`, RC-022).
5. `forecast(world, liDraft, window)` and `estimateAudienceSize(world, targeting)` (1.6).
6. Diagnostics recorder in the ENG 3.5 shape (`reasonCode` rows and `M.*` milestones) and live status (3.6). Alert decisions from 3.7 as data (the `io/` layer persists them), including `UNDERPERFORMING_IO` and `RESTRICTED_AUDIENCE_LIST_LI` (RC-013).
7. `lib/engine/testing/fixtures.ts` (benchmark advertiser, small LIs), goldens under `lib/engine/testing/goldens/`, script `engine:golden` (npm, not pnpm) to regenerate goldens with a visible diff.
8. Add the engine tests of section 11.1 to 11.3 listed below.

OUT OF SCOPE (do not build, even if easy)
- database access, Prisma, cron, API routes (P3-08b)
- A/B tests, lift studies, YouTube ad groups, deals and negotiations, custom bidding scripts, faults and scenarios, reach reports beyond a simple formula, reprocessing (9.7)
- any UI

FILES YOU OWN (create or edit)
- `lib/engine/**` except `io/` and `server.ts`
- `engine/**`
- `tests/engine/**`
- `package.json` scripts: add `engine:golden` only
EXCEPTIONS (you may also touch)
- `PROJECT.md` (last commit only)
Everything else belongs to another session. Do not edit it. If you must, follow stop condition 1 of build-plan 2.10.

ACCEPTANCE CRITERIA (copied from the specs; list each one in the PR as Done, Partly or Not done with the test that proves it)
- 11.1 Determinism: replay of 7 sim days twice gives identical hashes; chunk independence (168 ticks as 1, 7x24, 168x1); order independence; cross-sandbox isolation; stream independence; idempotent tick; catch-up equals live; params hash changes the golden.
- 11.2 Funnel conservation: for every LI, tick and exchange `A = sum(T.*) + sum(C.*) + sum(F.*) + sum(B.*) + sum(P.*) + sum(A.*) + sum(E.*) + W`; all counts are non-negative integers.
- 11.2 Stage ordering: `A >= E >= S >= R >= W`.
- 11.2 Win monotonicity: for fixed supply and seed, raising the fixed bid never lowers `W/R` nor raises the average price per win above the bid.
- 11.2 Price bound: average winning price <= bid CPM in every cell; no win below the cell floor.
- 11.2 Budget safety: segment spend <= segment budget (+ at most one-hour allowance rounding, never > 1.15 hourly overshoot); LI daily spend <= daily cap x 1.15.
- 11.2 Pacing convergence: with ample supply, Flight-Even spend ends within 98% to 102% of budget; Ahead is >= Even at all times and still <= budget.
- 11.2 No spend when not live: paused, draft, out-of-flight, parent-paused entities have zero funnel rows and zero spend.
- 11.2 Frequency cap: simulated average exposures per reached user in the window <= cap (+ rounding).
- 11.2 Targeting monotonicity: adding an include dimension never raises the passing share; adding an exclude never raises it; removing all targeting passes 100% of format supply.
- 11.2 Currency reconciliation and dimension allocation: sums over slices equal the `total` row; derived dimensions sum to their parent.
- 11.3 Calibration (benchmark advertiser, 7 sim days): average media CPM per format inside the p10 to p90 of table 2.5; CTR display 0.0008 to 0.0035; win rate 40 to 55% at `bid = clear.median`, 8 to 22% at 0.6x, above 75% at 1.5x; funnel plausibility (targeting-filtered share 55 to 95% for a single-region LI, `A.LOST_INTERNAL` 3 to 15%, `E.OTHER` 1 to 6%); Flight Even reaches 97 to 103% of a 30-day segment budget.

TESTS TO WRITE
- property tests with fast-check (200 runs, seeds logged) for each 11.2 line above
- determinism goldens for 11.1 (hash of daily rows, 7 sim days)
- calibration tests reading bands from `params.json.calibration` (11.3)
- unit tests per module: rng streams, clock due-ticks, supply cell generation, funnel reasons, strategies, auction closed forms, pacing allowance, fee maths

DONE WHEN
- `npm test` passes (engine tests run in the `unit` project) in under 90 seconds
- `npm run depcruise` passes with the layering of engine.md 1.5
- no import of Prisma, React or Next in `lib/engine` outside `io/`
- `npm run check` passes, plus `npm run test:db` if you touched database code and `npm run e2e` for the e2e specs you wrote
- CI is green on the PR and the Vercel preview is green (if the preview is not available because owner items P-03 or P-04 are open, say so in the PR)
- the PR body follows .github/pull_request_template.md, with the acceptance table, deviations and a Not done list
- the last commit is `docs: status P3-08a`

STOP CONDITIONS (in addition to build-plan 2.10)
- If a calibration band cannot be met after tuning `params.json`, keep the engine honest: widen the band in `params.json.calibration` only with a written reason in the PR, never skip the test.
- If the engine passes the tests but takes more than 200 ms per sandbox-tick for the benchmark fixture, stop and report the profile instead of optimising blindly.
```

### 4.6 P3-02 (Auth, roles, access windows)

```text
Read PROJECT.md, docs/specs/build-plan.md and the listed specs. Implement Adsmetor authentication, roles, DV360 access levels and classroom access windows (PROJECT.md P3-02). Write tests. Open a PR to `main` from branch `p3-02-auth`; do not push to main. Update nothing in PROJECT.md except via the PR's last commit `docs: status P3-02`.

SESSION: P3-02 (authentication, roles and classroom access windows). Wave 3. Merged before you start: P3-01, P3-05a.

READ FIRST, in this order
- docs/specs/conflicts.md (rows RC-nnn override every spec; read section 1.1)
- docs/specs/build-plan.md sections 2 (conventions, stubs, global stop conditions in 2.10) and 3.2 (file ownership)
- docs/specs/modules/18-instructor-training-layer.md sections 1, 2.1, 2.4, 3.1 to 3.3, 4.1 to 4.3, 4.10 (SIM rules), 4.11, 6.1 (acceptance), 6.3 (Vitest cases), 7 (tasks M18-01 to M18-04)
- docs/specs/modules/02-partner-level.md sections 4 (roles and `assertAccess`) and 7 task 02-T1
- docs/specs/routes.md sections 2 (roles and access model), 5.1 (guards), 7.1 and 7.4 (simulator routes), 8.19 (types)
- docs/specs/data-model.md sections 2.2 to 2.4 and 5.1 (User, Classroom, ClassroomMember, AccessWindow, Sandbox, SimClock, UserAccessGrant, Role, Permission, RolePermission)
- docs/specs/validation.md SIM rules as defined in module 18 4.10; DLG texts for the closed-window banner
- docs/specs/conflicts.md rows RC-016, RC-028, RC-047, RC-048, RC-061, RC-063

BUILD EXACTLY THIS
1. Auth.js v5 credentials provider with argon2id hashing (`@node-rs/argon2`), JWT session with `sessionVersion`, email and password sign-in at `/sim/login` (plain Adsmetor header with the logo from `public/brand/adsmentor-logo-horizontal.png`, RC-058), sign-out at `/sim/logout`.
2. Failed-login counter and lockout (5th failure locks for 15 minutes, same message for unknown email and wrong password; SIM-002), `mustChangePassword` flow at `/sim/me/password` that bumps `sessionVersion`.
3. Pages: `/sim/closed` (next window and instructor contact), `/sim/session-expired`, `/sim/forbidden`, `/sim/me`.
4. Replace the stubs in 2.7: `lib/auth/session.ts` (`getSessionUser`, `requireUser`, view-as resolver for `?sim_as=`, read-only unless "Act as student"), `lib/rbac/can.ts` (DV360 levels ADMIN, STANDARD, READ_ONLY, REPORTING_ONLY, PARTNER_CLIENT, CREATIVE per routes.md 2 and RC-047/048; `assertAccess`), `lib/access/windows.ts` (`isClassOpen`, `getWindowBanner` with the 5-minute warning, `assertWindowOpen` returning `ACCESS_WINDOW_CLOSED`, `tickAccessWindows(now)` which flips SCHEDULED/OPEN/CLOSED, freezes and unfreezes the sandbox and its clock state without advancing sim time).
5. `middleware.ts`: session required, role guard for `/sim/instructor/**` and `/sim/admin/**` (to `/sim/forbidden`), class window guard (student to `/sim/closed`; instructors and admins bypass), `/ng_nav/**` 308 redirect (routes.md R1).
6. Sandbox resolution rule (RC-061): the class with an OPEN window, else the most recent membership; `?sim_class=` override for instructors.
7. Role and permission seeds: RolePermission rows from data-model 5.1 in `prisma/seed/auth.seed.ts`; bootstrap `prisma/bootstrap/10-admin.bootstrap.ts` that creates the first admin from `SEED_ADMIN_EMAIL` and `SEED_ADMIN_PASSWORD` (idempotent, `mustChangePassword = true`).
8. Keep `AUTH_DEV_BYPASS` working only outside production.
9. A tiny helper `provisionStudent(db, classroomId, input)` that creates a user, membership and a temporary password (returned once). Its callers (roster UI) are Phase 5.

OUT OF SCOPE (do not build, even if easy)
- instructor console, roster UI, access window UI (P5-01), clock page, scenarios, sandbox provisioning job, password reset by email, self-registration
- any DV360 page

FILES YOU OWN (create or edit)
- `lib/auth/**`
- `lib/rbac/**`
- `lib/access/**`
- `middleware.ts`
- `app/sim/**`
- `app/api/auth/**`
- `app/api/sim/access/**`
- `components/sim/**`
- `prisma/seed/auth.seed.ts`
- `prisma/bootstrap/10-admin.bootstrap.ts`
- `tests/auth/**`
- `tests/e2e/auth.spec.ts`
EXCEPTIONS (you may also touch)
- `prisma/schema/95-p3-02-extra.prisma` plus its migration, only if a column you need is missing from P3-05a (say so in the PR)
- `package.json` for missing auth dependencies
- `PROJECT.md` (last commit only)
Everything else belongs to another session. Do not edit it. If you must, follow stop condition 1 of build-plan 2.10.

ACCEPTANCE CRITERIA (copied from the specs; list each one in the PR as Done, Partly or Not done with the test that proves it)
- M18-AC1: A student with correct credentials during an open window lands on their Overview; with the class closed lands on `/sim/closed` showing the next window and cannot reach DV360 routes (any DV360 URL redirects).
- M18-AC2: Wrong password shows the same message for unknown emails and wrong passwords; the 5th failure locks for 15 minutes (SIM-002).
- M18-AC3: `mustChangePassword` forces `/sim/me/password` first; after change, `sessionVersion` increments and old sessions stop working.
- M18-AC4: Instructor routes return `/sim/forbidden` for students; admin routes for instructors.
- M18-AC5: A window closing while a student is mid-edit: a banner appears 5 minutes before; after close, a Save returns `ACCESS_WINDOW_CLOSED` and the UI shows SIM-010; the next navigation goes to `/sim/closed`; the sandbox is FROZEN and the clock PAUSED.
- M18-AC6: Reopening unfreezes the sandbox and restores the previous clock state; no sim time passed while closed.
- M18-AC7: Weekly repeat creates the right number of occurrences; editing "this" vs "series" behaves; open windows cannot be deleted (SIM-007).
- M18-AC8: Open now creates a 2 hour window by default; Close now closes immediately.
- M18-AC13: View-as shows the banner and blocks writes unless "Act as student" is on; writes in that mode appear with `source = INSTRUCTOR`.
- M18-AC25: A student cannot read another sandbox through scenario selectors or API IDs (RLS tests); instructors only see classes they teach; admin actions create `AuditLog` rows.
- AC-01-25 (E) A `REPORTING_ONLY` user sees only Reports in the nav and gets the 404 page on `[P]/home_v3`.
- AC-01-26 (E) A `READ_ONLY` user sees a grey "Limited Access" chip next to page titles, can open Overview and Bulk status, and cannot see enabled create buttons anywhere in the shell.

TESTS TO WRITE
- unit (fake timers): window state transitions SCHEDULED to OPEN to CLOSED across time zones, 5-minute banner, lockout counter, session version invalidation, `assertAccess` table test for every DV360 level x action class (view, write, user admin, report build), sandbox resolution rule
- db: freeze and unfreeze keeps `simNow` unchanged and restores the previous clock state; instructor sees only own classes; RLS still isolates sandboxes when a student session is used
- e2e `tests/e2e/auth.spec.ts`: login success lands on the overview placeholder; wrong password message identical for unknown email; 5th failure locks; forced password change; closed class redirects to `/sim/closed` for DV360 URLs; student on `/sim/instructor` gets `/sim/forbidden`; instructor view-as shows the banner and blocks writes

DONE WHEN
- the login and closed-window flows work on the Vercel preview with the bootstrapped admin (if P-03/P-04/P-07 are done)
- `npm run check` passes, plus `npm run test:db` if you touched database code and `npm run e2e` for the e2e specs you wrote
- CI is green on the PR and the Vercel preview is green (if the preview is not available because owner items P-03 or P-04 are open, say so in the PR)
- the PR body follows .github/pull_request_template.md, with the acceptance table, deviations and a Not done list
- the last commit is `docs: status P3-02`

STOP CONDITIONS (in addition to build-plan 2.10)
- If P3-05a lacks a table you need (for example `Role`), stop and say which one. Do not create it under `prisma/schema/10..69`.
- Never log or return a password, hash or session secret.
```

### 4.7 P3-05b (Seed generator)

```text
Read PROJECT.md, docs/specs/build-plan.md and the listed specs. Implement the deterministic seed generator, reference data and demo class bootstrap (PROJECT.md P3-05, second part). Write tests. Open a PR to `main` from branch `p3-05b-seed`; do not push to main. Update nothing in PROJECT.md except via the PR's last commit `docs: status P3-05b`.

SESSION: P3-05b (seed generator and reference data). Wave 3. Merged before you start: P3-01, P3-05a.

READ FIRST, in this order
- docs/specs/conflicts.md (rows RC-nnn override every spec; read section 1.1)
- docs/specs/build-plan.md sections 2 (conventions, stubs, global stop conditions in 2.10) and 3.2 (file ownership)
- docs/specs/data-model.md sections 3 (seeding strategy: 3.1 pipeline, 3.2 templates, 3.3 naming and ids, 3.4 size knobs), 4 (enumerations), 5 (tables you fill), 7.1
- docs/specs/modules/02-partner-level.md sections 3 and 7 task 02-T2 (partner, 70 exchanges, flags, 3 advertisers, users, rate cards, brand-control mix)
- docs/specs/modules/06-campaigns.md 3.4, modules/07-insertion-orders.md 3.4, modules/08-line-items.md 3.4 (seed requirements and the delivery stories), modules/10-targeting.md 3.4 (reference catalogues), modules/01-global-shell.md 3.3, modules/18 3.3 (demo class, admin)
- docs/specs/engine.md 2.7 (exchange keys, `simClass`), 3.2 (reason codes used to plant problems), 9.2 (metric columns for the history stub)
- docs/specs/conflicts.md rows RC-029, RC-055, RC-061, RC-024

BUILD EXACTLY THIS
1. Reference data (global rows, idempotent): about 70 `Exchange` rows with `simClass` and `simSupplyShare` (engine keys from ENG 2.7), `FxRate`, targeting catalogues of module 10 3.4 at reduced size (countries, India states and top cities, 30 languages, category tree, device and browser lists, ISP and carriers), `GoogleAudience` subset of 60 rows, data from `data/reference/*.json`.
2. Generator in `lib/seed/` with a seeded PRNG (`mulberry32`) and the three templates `starter-agency`, `healthy`, `troubleshooting-lab` (data-model 3.2) producing: one partner, advertisers (one INR, one SGD), campaigns, IOs of every type (Standard, CTV, DOOH) with budget segments and partner costs, line items of every non-YouTube type in valid parents, minimal creatives with per-exchange reviews, targeting assignments and templates, alert preferences, planted delivery stories (module 08 3.4 list), `Alert` rows, `ChangeGroup` rows from `SIM_SEED` (hidden), `SimClock` at "today".
3. History stub `lib/seed/history-stub.ts`: closed-form, deterministic 90 days of `SimDailyMetric` (`sliceKind = total` plus device and exchange slices) and 14 days of hourly totals for every active LI, with plausible CPM, CTR, conversion rates by format from `engine/params.json` constants copied into the stub (do not import the engine). It lets the UI and P3-09 work before the engine is wired. P3-INT replaces it with `engine.fastForward` if time allows.
4. `npm run db:seed` runs global seeds then a demo sandbox; `prisma/seed/index.ts` globs `prisma/seed/**/*.seed.ts` in name order (it must tolerate the absence of `auth.seed.ts`).
5. `prisma/bootstrap/20-demo-class.bootstrap.ts`: creates classroom "Demo class", one instructor, three students (`student1@example.test` to `student3@example.test`) with temporary passwords from `SEED_STUDENT_PASSWORD` or a random value printed once in the logs, sandboxes from `starter-agency`, and an always-open window for 30 days. Idempotent. Skipped when `NODE_ENV=production` unless `SEED_DEMO=1`.
6. Size knobs `advertisers`, `campaignsPerAdvertiser`, `iosPerCampaign`, `lineItemsPerIo`, `creativesPerAdvertiser`, `historyDays`, `plantedProblems[]` (data-model 3.4). One sandbox builds in under 60 seconds locally, ten in under 3 minutes.
7. All names synthetic (PROJECT.md R5). Real exchange and verifier names are allowed only from the allow-list in `data/reference/vendors.json` (RC-055).

OUT OF SCOPE (do not build, even if easy)
- full creative library variety, audiences, deals, Floodlight, reports, plans, experiments (Phase 4 sessions add `*.seed.ts` files)
- engine-based backfill
- auth seeds (`auth.seed.ts` is P3-02)

FILES YOU OWN (create or edit)
- `prisma/seed/**` except `auth.seed.ts`
- `prisma/bootstrap/20-*`
- `lib/seed/**`
- `data/reference/**`
- `tests/seed/**`
EXCEPTIONS (you may also touch)
- `PROJECT.md` (last commit only)
Everything else belongs to another session. Do not edit it. If you must, follow stop condition 1 of build-plan 2.10.

ACCEPTANCE CRITERIA (copied from the specs; list each one in the PR as Done, Partly or Not done with the test that proves it)
- Module 06 3.4, 07 3.4 and 08 3.4 seed requirement lists are met: every LI type appears in a parent that allows it; statuses Draft, Active, Paused, Archived and Completed are present; the delivery stories exist (healthy, bid too low, targeting too narrow, creative disapproved on an exchange, creative size mismatch, budget exhausted, frequency cap too tight, paused LI, LI under a paused IO, LI with no creatives, LI with a future custom flight); targeting variety (2 to 8 rows per LI, include and exclude, audience groups, day parting, one template, one optimized targeting, one DoubleVerify verifier); conversions with each counting mode; EU political ads set on all seeded LIs.
- Determinism: the same template, seed and knobs produce byte-identical rows (hash test). Different sandbox seeds differ.
- Integrity: every row has the right `sandboxId`, every foreign key resolves, public ids are unique, flight dates are inside parent flights, budgets sum sensibly, no real client names.
- Performance: one sandbox under 60 seconds on the local database.

TESTS TO WRITE
- unit: PRNG and name generator determinism; knob handling; vendor allow-list check (fails on a name not in the list)
- db: seed a sandbox and assert counts per template, LI types present, statuses present, planted problems present with the right tags, idempotent re-run, FK integrity, RLS read as the sandbox role returns the same rows
- db: history stub totals reconcile (daily total equals sum of slices; hourly sums equal daily)

DONE WHEN
- `npm run db:seed` and `npm run db:bootstrap` succeed on a clean database in CI (the e2e job uses them)
- `npm run check` passes, plus `npm run test:db` if you touched database code and `npm run e2e` for the e2e specs you wrote
- CI is green on the PR and the Vercel preview is green (if the preview is not available because owner items P-03 or P-04 are open, say so in the PR)
- the PR body follows .github/pull_request_template.md, with the acceptance table, deviations and a Not done list
- the last commit is `docs: status P3-05b`

STOP CONDITIONS (in addition to build-plan 2.10)
- If the schema from P3-05a lacks a column the seed needs, stop and list it. Do not edit `prisma/schema/**`.
- If one sandbox takes more than 3 minutes, reduce knobs for `healthy` and report; do not skip the stories.
```

### 4.8 P3-05c (Schema extended)

```text
Read PROJECT.md, docs/specs/build-plan.md and the listed specs. Implement the Prisma models for every table that has no model yet (PROJECT.md P3-05, third part). Write tests. Open a PR to `main` from branch `p3-05c-schema-extended`; do not push to main. Update nothing in PROJECT.md except via the PR's last commit `docs: status P3-05c`.

SESSION: P3-05c (remaining tables of the data model). Wave 3. Merged before you start: P3-01, P3-05a.

READ FIRST, in this order
- docs/specs/conflicts.md (rows RC-nnn override every spec; read section 1.1)
- docs/specs/build-plan.md sections 2 (conventions, stubs, global stop conditions in 2.10) and 3.2 (file ownership)
- docs/specs/data-model.md sections 5.9 to 5.17, Appendix B, Appendix C (list of tables without a Prisma model), section 4 (enums)
- spec delta sections of modules 01 (3.2), 02 (3), 03 (3.2), 04 (3, task T1), 09 (3.3), 10 (3.3), 11 (task T11-01), 12 (3.x), 13, 14, 15, 16 (3.x), 17 (3.x), 18 (3.2) for fields and tables not already added by P3-05a
- docs/specs/conflicts.md rows RC-007 to RC-012, RC-034 to RC-037, RC-045, RC-046, RC-052

BUILD EXACTLY THIS
1. Add Prisma models and enums for every table named in Appendix C and in the module deltas listed above, following the pattern of Appendix A (`sandboxId`, composite foreign keys to the parent, indexes listed in the field tables, `version` where RC-020 says).
2. Create migration `0002_extended` (and `0003_...` if it helps review). Extend the RLS SQL to the new tables.
3. Write the introspection tests below. Do not write services, seeds or UI.

OUT OF SCOPE (do not build, even if easy)
- services, seeds, UI, validation rules, any table that already exists

FILES YOU OWN (create or edit)
- `prisma/schema/70..89-*.prisma`
- `prisma/migrations/0002_*` and later numbers you create
- `prisma/sql/` files you add (new filenames only)
- `tests/db/extended*.db.test.ts`
EXCEPTIONS (you may also touch)
- `PROJECT.md` (last commit only)
Everything else belongs to another session. Do not edit it. If you must, follow stop condition 1 of build-plan 2.10.

ACCEPTANCE CRITERIA (copied from the specs; list each one in the PR as Done, Partly or Not done with the test that proves it)
- Every tenant table has `sandboxId`, RLS enabled with the standard policy, and composite foreign keys to tenant parents (introspection test over `information_schema`, with a short allow-list of global tables).
- Every enum value listed in data-model.md section 4 exists in the schema (test parses the document).
- Every table named in Appendix C exists.
- `prisma validate` and `prisma migrate deploy` pass; applying `0002` on top of `0001` works on a database that already holds P3-05b seed data.

TESTS TO WRITE
- the three introspection tests above

DONE WHEN
- `npm run test:db` passes
- `npm run check` passes, plus `npm run test:db` if you touched database code and `npm run e2e` for the e2e specs you wrote
- CI is green on the PR and the Vercel preview is green (if the preview is not available because owner items P-03 or P-04 are open, say so in the PR)
- the PR body follows .github/pull_request_template.md, with the acceptance table, deviations and a Not done list
- the last commit is `docs: status P3-05c`

STOP CONDITIONS (in addition to build-plan 2.10)
- If a table from Appendix C conflicts with a column added by P3-05a, stop and describe it.
- This session is the first to cut if credit is short (build-plan 5.2): finish what compiles, list the rest under Not done.
```

### 4.9 P3-03 (App shell)

```text
Read PROJECT.md, docs/specs/build-plan.md and the listed specs. Implement the DV360-style application shell: top bar, left navigation, breadcrumbs, banners, right-rail frame, layouts for every frame, scope loaders, 404 and stub pages for every route (PROJECT.md P3-03). Write tests. Open a PR to `main` from branch `p3-03-shell`; do not push to main. Update nothing in PROJECT.md except via the PR's last commit `docs: status P3-03`.

SESSION: P3-03 (application shell, navigation and route frames). Wave 3. Merged before you start: P3-01, P3-05a, P3-04 (and P3-02 recommended).

READ FIRST, in this order
- docs/specs/conflicts.md (rows RC-nnn override every spec; read section 1.1)
- docs/specs/build-plan.md sections 2 (conventions, stubs, global stop conditions in 2.10) and 3.2 (file ownership)
- docs/specs/modules/01-global-shell.md sections 1, 2.10 (chrome, 404, banners), 3.2 (deltas for tasks T5 and T6), 4.1 (scope and prefs), 4.2 (recently opened), 4.10 (keyboard), 6 (acceptance), 7 (tasks 01-T1 to 01-T6)
- docs/specs/routes.md sections 3 (route table, every row), 4 (navigation trees 4.1 to 4.7), 5 (layout hierarchy and frames), 6 (URL conventions, redirects 6.3), 9 (build notes)
- docs/specs/design-system.md sections 2.1 to 2.3, 4 (layout rules) and the kit exported by `components/dv`
- docs/specs/validation.md DLG-01 and the message catalogue
- docs/specs/conflicts.md rows RC-047 to RC-049, RC-051, RC-052

BUILD EXACTLY THIS
0. Logo (RC-058, ADR-043): use `public/brand/adsmentor-logo-horizontal.png` (copy of `docs/brand/adsmentor-logo-horizontal.png`, 836 x 257, black "ADS", blue "MENTOR", tagline "LEARN. APPLY. SCALE.", arrow mark) in the app bar. **Task note:** derive a square icon crop from the arrow mark of that logo and save it as `public/brand/adsmentor-icon.png` (and use it as the favicon and where the compact mark is needed). P3-04 and the login page use the same logo.
1. `lib/nav/trees.ts` typed data for the partner, advertiser and campaign trees exactly as routes.md 4.2 to 4.4, with `minLevel`, role filter and active matcher (01-T1).
2. `app/(dv)/layout.tsx` guard, `(app)/layout.tsx` with DvAppBar (top bar items in routes.md 4.1 order; bell, search, help and user menu are present but their panels are stubs), BreadcrumbBar, BannerStack (paused advertiser banner text from validation 1.2, access window banner from `getWindowBanner`, view-as banner), RailHost with empty Ask Advisor, Quick help and Intelligence panels, `DialogHost`, `SnackbarHost` (01-T2).
3. `(full)/layout.tsx`, `not-found.tsx`, `error.tsx`, `global-error.tsx`, `404/page.tsx`, `[...unmatched]` redirect to `/404?url=`, `/sim/closed` guard integration (01-T3).
4. `lib/scope/*` resolvers (`PartnerScope`, `AdvertiserScope`, `CampaignScope`, `IoScope`, `LiScope`) with the entity chain check; a foreign or invalid id returns the 404 page in place (routes.md R10).
5. `lib/routes/*` path builders and the `AppLink` that keeps `sim_*` params; `lib/hooks/useListParams`, `useUnsavedGuard`, `useHotkeys` (shortcuts dialog with the rows of routes.md 4.7) (01-T4).
6. `UserPreference` read and write (`savePrefs`, nav collapsed state, rail panel, pinned campaign tab) and `RecentlyViewed` logging hook in scope layouts (01-T5, 01-T6).
7. A stub page for EVERY row of routes.md section 3 inside the correct frame, each rendering `<ComingSoon module="..." />` with the module number. Page files must be thin so owners can replace them (routes.md 9 step 5).
8. Minimal real pages: `[P]/home_v3` (welcome card, links to advertisers) and `[P]/advertisers` (table of advertisers: name, id, status, currency, link to its campaigns) reading seeded data. The full versions are module 02 and module 01 Phase 4 work.
9. Sim clock chip and class window banner wiring (read-only; values from P3-02 helpers).

OUT OF SCOPE (do not build, even if easy)
- Overview cards, workspaces, pins, notifications bell content, search overlay, Ask Advisor, Quick help and Intelligence content, Bulk status content (stubs only)
- campaign, IO and line item pages beyond stubs (P3-06b, P3-06c)

FILES YOU OWN (create or edit)
- `app/(dv)/**`
- `app/not-found.tsx`
- `app/error.tsx`
- `app/global-error.tsx`
- `app/404/**`
- `app/[...unmatched]/**`
- `app/page.tsx`
- `components/shell/**`
- `public/brand/adsmentor-icon.png` (the square crop; the horizontal logo copy belongs to P3-01)
- `lib/nav/**`
- `lib/scope/**`
- `lib/routes/**`
- `lib/hooks/**`
- `tests/shell/**`
- `tests/e2e/shell.spec.ts`
EXCEPTIONS (you may also touch)
- `components/dv` (bug fixes of one line only, listed in the PR)
- `PROJECT.md` (last commit only)
Everything else belongs to another session. Do not edit it. If you must, follow stop condition 1 of build-plan 2.10.

ACCEPTANCE CRITERIA (copied from the specs; list each one in the PR as Done, Partly or Not done with the test that proves it)
- AC-01-1 (E) A student signed in to their sandbox lands on `[P]/home_v3` from `/`. Top bar shows hamburger, product name "DV360 Simulator by Adsmetor", home icon, partner crumb, and the 8 right-hand icons in RT 4.1 order.
- AC-01-2 (E) The hamburger toggles between the labelled nav (256 px) and the icon-only rail (72 px). State survives reload (`sim.nav.collapsed`).
- AC-01-3 (V) `lib/nav/trees.ts` produces exactly the items and order of RT 4.2 (partner), RT 4.3 (advertiser) and RT 4.4 (campaign) for `STANDARD`, and only the Reports group for `REPORTING_ONLY`.
- AC-01-14 (E) `?` opens the shortcuts dialog with the 8 rows of RT 4.7. It does not open while typing in the search box.
- AC-01-15 (E) `Shift+N` on the Campaigns list opens `cs/new`; on the Overview it does nothing.
- AC-01-16 (E) Opening Ask Advisor then Quick help replaces the panel; clicking the active icon closes it; the choice persists across navigation inside `(app)` and is lost entering a `(full)` page.
- AC-01-24 (E) A paused advertiser shows the banner "This advertiser is currently paused. None of its campaigns or deals are serving." on every advertiser-level page, not dismissible, and not on partner pages.
- AC-01-25 (E) A `REPORTING_ONLY` user sees only Reports in the nav and gets the 404 page on `[P]/home_v3`.
- AC-01-26 (E) A `READ_ONLY` user sees a grey "Limited Access" chip next to page titles, can open Overview and Bulk status, and cannot see enabled create buttons anywhere in the shell.
- AC-01-27 (E) An unknown path redirects to `/404?url=...`; a valid-looking id from another sandbox returns HTTP 404 in place without a redirect.
- AC-01-30 (E) Closing the class access window sends the student to `/sim/closed` on the next navigation (RT 5.3), and a 5-minute warning banner appears before it.
- RT 9 smoke: every row of routes.md section 3 returns 200 for a `STANDARD` student, 404 for another student's sandbox ids and 404 for `REPORTING_ONLY` on non-reporting routes; redirects in routes.md 6.3 land on the targets.

TESTS TO WRITE
- unit: `trees.ts` output for STANDARD, READ_ONLY and REPORTING_ONLY against the lists in routes.md 4.2 to 4.4 (AC-01-3); active matcher; `useListParams` parse and serialise round trip for `d`, `q`, `f.*`, `sort`, `rows`, `page`, `cv`, `seg`; path builders
- db: scope resolver chain check returns not-found for ids of another sandbox and for mismatched parents
- components: shortcuts dialog does not open while typing in a text field (AC-01-14)
- e2e `tests/e2e/shell.spec.ts`: PW-01-1 shell tour (top bar items, collapse and expand nav, open each nav group, active pill and breadcrumbs), the RT 9 smoke over all routes, paused banner, read-only chip, 404 behaviour

DONE WHEN
- all stub routes render inside the correct frame on the preview; navigation between them works with the keyboard
- `npm run check` passes, plus `npm run test:db` if you touched database code and `npm run e2e` for the e2e specs you wrote
- CI is green on the PR and the Vercel preview is green (if the preview is not available because owner items P-03 or P-04 are open, say so in the PR)
- the PR body follows .github/pull_request_template.md, with the acceptance table, deviations and a Not done list
- the last commit is `docs: status P3-03`

STOP CONDITIONS (in addition to build-plan 2.10)
- If a component you need is missing from `components/dv`, build a local version under `components/shell/` and record it under Deviations. Do not edit another session's files.
```

### 4.10 P3-07a (Targeting core)

```text
Read PROJECT.md, docs/specs/build-plan.md and the listed specs. Implement the shared targeting card, state converters, targeting validation and the simple editors (PROJECT.md P3-07, first part). Write tests. Open a PR to `main` from branch `p3-07a-targeting-core`; do not push to main. Update nothing in PROJECT.md except via the PR's last commit `docs: status P3-07a`.

SESSION: P3-07a (targeting card, state and basic editors). Wave 4. Merged before you start: P3-01, P3-05a, P3-04, P3-02, P3-03, P3-06a.

READ FIRST, in this order
- docs/specs/conflicts.md (rows RC-nnn override every spec; read section 1.1)
- docs/specs/build-plan.md sections 2 (conventions, stubs, global stop conditions in 2.10) and 3.2 (file ownership)
- docs/specs/modules/10-targeting.md sections 1, 2.1 to 2.3, 3 (state to rows, deltas Δ-10-1 to Δ-10-3, Δ-10-6 to Δ-10-8), 4 (actions, validation map, rules), 6 (acceptance and tests), 7 (tasks T10-01, T10-03 to T10-06, part of T10-08)
- docs/specs/validation.md domain TGT and TPL, matrix MX-10, MX-16
- docs/specs/data-model.md sections 4.6 and 5.8 (TargetingOption, TargetingAssignment, TargetingTemplate) and the explore file docs/explore/07-targeting.md for option lists (verbatim)
- docs/specs/design-system.md 2.10 (DvSlideOver), 2.8 (forms)
- docs/specs/conflicts.md rows RC-011, RC-030, RC-044

BUILD EXACTLY THIS
1. `lib/targeting/` state model: `TargetingState`, `emptyTargetingState(type)`, `stateToRows` and `rowsToState` (lossless for every dimension), `loadTargetingState`, `persistTargeting` (replace the stubs of 2.7; keep exported names), summary text per dimension.
2. Rules: `lib/validation/rules/targeting.ts` and `rules/template.ts` (TGT-001 to TGT-130 range and TPL-*), merge and apply functions (locked rows, advertiser targeting rules, type change cleanup with toast text).
3. `components/targeting/TargetingCard.tsx` (replace the stub; same props), Add targeting menu per LI type (MX-10), row summaries, "Added" marks, locked rows without trash icon and with tooltip, inherited rows with link icon, type-change cleanup.
4. Editors as right slide-overs (`DvSlideOver`) with Apply, Cancel and trash: Environment, Position (on screen and in content), Viewability (Open Measurement locked, predicted viewability), Language, Categories tree, Browser, Device (type, make and model), Connection speed, Carrier and ISP, Demographics (gender, age slider 18 to 65+ and Unknown, parental status, household income), Keywords (include and exclude, comma and new line parsing, counter, 5,000 limit), Day and time (grid with presets, merge of overlapping segments, time zone).
5. Targeting editors do not change the URL (RC-044). Read-only roles open editors in view mode without Apply.
6. API: `app/api/dv/targeting/*` for reference catalogue lookups used by the editors (categories, languages, devices, browsers, ISPs).

OUT OF SCOPE (do not build, even if easy)
- Geography with map, Apps and URLs, Brand suitability and verification, Audience builder (P3-07b)
- targeting templates pages and carousel (Phase 4)
- video, audio, DOOH-only editors and YouTube ad group editors
- engine hookup of `T.*` chips

FILES YOU OWN (create or edit)
- `lib/targeting/**` except `geo.ts` and `audience.ts`
- `components/targeting/**` except `editors/{geography,apps-urls,brand,audience}/`
- `lib/validation/rules/targeting.ts`, `lib/validation/rules/template.ts`
- `tests/validation/cases.targeting.ts`
- `app/api/dv/targeting/**`
- `tests/targeting/**`
- `tests/e2e/targeting.spec.ts`
EXCEPTIONS (you may also touch)
- `lib/validation/constants/targeting-availability.ts` (extend the mapping only)
- `PROJECT.md` (last commit only)
Everything else belongs to another session. Do not edit it. If you must, follow stop condition 1 of build-plan 2.10.

ACCEPTANCE CRITERIA (copied from the specs; list each one in the PR as Done, Partly or Not done with the test that proves it)
- AC-10-01: The Add targeting menu groups and items match 2.1 per LI type (MX-10 test for every type); added items show "Added".
- AC-10-02: Each of the 16 editors opens as a right slide-over with Apply / Cancel / trash, with the controls of 2.3 and the option lists verbatim from explore 07.
- AC-10-03: Include/exclude toggles are exclusive; Summary section shows Included / Excluded with ⓧ and Clear.
- AC-10-06: Keywords: Include/Exclude, parsing by comma and new line, counter, 5,000 limit (TGT-033), suggestions generated.
- AC-10-08: Position needs both on-screen and in-content for Display; Video shows in-stream and player size.
- AC-10-09: Viewability: Open Measurement locked and non-removable (Display); predicted dropdown default "All impressions".
- AC-10-12: Demographics age slider supports 18 to 65+ and Unknown; all-unchecked option raises TGT-111.
- AC-10-13: Day & time: presets fill segments; overlapping segments are merged with TGT-122; grid shades correctly; time zone choice saved.
- AC-10-14: Device default "4 items included; 0 items excluded"; excluding all four raises TGT-130.
- AC-10-15: Connection speed default "All connection speeds"; Carrier & ISP filter works.
- AC-10-16: Locked rows have no trash and show tooltip; forged removal rejected with LI-100.
- AC-10-17: Pre-added rows per type match MX-10 (Display, Video, CTV, Audio, Ads in mobile apps, YouTube LI).
- AC-10-18: Changing LI type removes unsupported dimensions and shows a toast.
- AC-10-23: Read-only roles can open editors in view mode without Apply.
- AC-10-24: Round trip `stateToRows`/`rowsToState` is lossless for every dimension.

TESTS TO WRITE
- Vitest cases copied from module 10 section 6.3 (use the rows relevant to the editors you build):
  - V-10-01: `MX10` availability table: every (dimension, type) cell => exact
  - V-10-02: `stateToRows` / `rowsToState` round trip, property test over generated states => identity
  - V-10-03: `mergeTargeting` order: partner < template < LI < locked => exact
  - V-10-04: `applyTemplateToTargeting` keeps locked rows => exact
  - V-10-05: TGT-001 same item both modes => error
  - V-10-06: TGT-011 address vs lat/lng parser; "19.07,72.87" ok; "foo" bad => exact
  - V-10-07: TGT-012 distance 0 / 501 => error; 1 / 500 ok
  - V-10-08: TGT-031 keyword normalisation => trimmed, lowercase, unique
  - V-10-09: TGT-033 5,001 keywords => error
  - V-10-10: TGT-091 ABS with brand safety => error
  - V-10-11: TGT-093 cost sum => 20.95 + 12.38 = 33.33
  - V-10-12: TGT-110 min > max => error
  - V-10-13: TGT-120 start >= end; TGT-122 overlap merge => error / merged
  - V-10-14: TGT-130 four excluded => error
  - V-10-15: TGT-101 audience not eligible; TGT-103 younger than 4 h; TGT-105 lookalike in Display => errors
  - V-10-16: Audience logic evaluator: examples of groups (A∪B)∩(C) ∪ Google ∖ excluded => set results
  - V-10-17: `summarizeTargeting` strings for each dimension => golden
  - V-10-18: `estimateAudienceSize` returns Δ-10-4 shape; included ≤ overall; excluded reduces => invariants
  - V-10-19: Impressions number formatter (K/M/B/T) => 7.31T for 7.31e12
  - V-10-20: Template create validation TPL-001..006 => rule IDs
  - V-10-21: Dimensions dropped on type change => list
  - V-10-22: `parse-points` partial success returns valid points and errors => exact
- Playwright (module 10 6.2) PW-10-01, PW-10-04, PW-10-06, PW-10-07, PW-10-08, PW-10-09, PW-10-10, PW-10-11, PW-10-16 in `tests/e2e/targeting.spec.ts`
- round trip test `stateToRows`/`rowsToState` for every dimension with fast-check

DONE WHEN
- the LI form of P3-06c (once merged) shows the real card; until then the card is verified on a dev-only page `app/(dev)/targeting/page.tsx` owned by you
- `npm run check` passes, plus `npm run test:db` if you touched database code and `npm run e2e` for the e2e specs you wrote
- CI is green on the PR and the Vercel preview is green (if the preview is not available because owner items P-03 or P-04 are open, say so in the PR)
- the PR body follows .github/pull_request_template.md, with the acceptance table, deviations and a Not done list
- the last commit is `docs: status P3-07a`

STOP CONDITIONS (in addition to build-plan 2.10)
- If two dimensions need the same editor chrome, build it once as `components/targeting/editors/ListEditor.tsx` and reuse it.
- Option lists come from `docs/explore/07-targeting.md` verbatim. Do not invent options.
```

### 4.11 P3-06b (Campaigns and insertion orders)

```text
Read PROJECT.md, docs/specs/build-plan.md and the listed specs. Implement Campaigns and Insertion orders: services, forms, grids and page shells with full validation and change log (PROJECT.md P3-06, second part). Write tests. Open a PR to `main` from branch `p3-06b-campaigns-io`; do not push to main. Update nothing in PROJECT.md except via the PR's last commit `docs: status P3-06b`.

SESSION: P3-06b (campaign and insertion order create, edit, list and pages). Wave 4. Merged before you start: P3-01, P3-05a, P3-04, P3-06a, P3-02, P3-05b, P3-03.

READ FIRST, in this order
- docs/specs/conflicts.md (rows RC-nnn override every spec; read section 1.1)
- docs/specs/build-plan.md sections 2 (conventions, stubs, global stop conditions in 2.10) and 3.2 (file ownership)
- docs/specs/modules/06-campaigns.md sections 1 to 6 and 7 (tasks T06-03, T06-04, T06-05, T06-07)
- docs/specs/modules/07-insertion-orders.md sections 1 to 6 and 7 (tasks T07-03 to T07-08)
- docs/specs/modules/05-history-notifications.md section 4.1 (how to call `withChangeLog`)
- docs/specs/routes.md 3.3 (route rows), 6.3 (post-create redirects), 8.4 and 8.5 (wire types, with RC-001, RC-002, RC-018, RC-040 applied)
- docs/specs/validation.md rules CMP-*, IO-*, matrices MX-01, MX-02, MX-05, MX-06, MX-17 (use `lib/validation`, do not re-implement)
- docs/specs/design-system.md 2.4, 2.8, 2.9, 2.16 (grid, forms, status, chart cards) and the kit in `components/dv`
- docs/specs/engine.md 4.6 (KPI Actual) and 9.4 (list columns), only to know the column definitions
- docs/specs/conflicts.md rows RC-001, RC-002, RC-018 to RC-020, RC-038 to RC-041, RC-052

BUILD EXACTLY THIS
1. Services (`lib/campaigns`, `lib/insertion-orders`): list queries (two scopes for IOs), detail, create, update, status (`setCampaignStatus`, `setIoStatus`), inline budget edit, IO-053 automation propagation, archive with cascade, all through `withChangeLog` and `lib/validation`, permission checks with `can()`, optimistic `expectedVersion`. Field registries in `lib/changelog/registries/` for Campaign, CampaignBudget, InsertionOrder, BudgetSegment, PartnerCost.
2. API handlers: `app/api/dv/campaigns/*`, `app/api/dv/insertion-orders/*` (list with `ListQuery` params, detail, matrix endpoint `io-objective-matrix`).
3. Campaign UI: `CampaignForm` (create and edit: cards, KPI logic and goal table, budget grid with Add Budgets, frequency card, details card, unsaved guard, DLG-10 copy settings dialog), Campaigns list page (columns of module 06 2.1, filter chip Status Active, row hover menu, empty/loading/error/read-only states, performance columns read through `getGridMetrics`), campaign page shell (tabs Combined, Insertion orders, Line items; pin stored per user; redirect), chart strip with the five built-in cards in their empty state.
4. IO UI: step 1 page (`ObjectivePreview`, matrix), `IoForm` for create and edit (budget segments grid, pacing, KPI, optimisation, frequency cap, partner costs, integration code, unsaved guard), `IoGrid` (columns, group collapse, inline status, inline budget edit, states), IO page shell (header, tabs `explorerlis`, `details`, `history` with the History tab left as a stub, Intelligence panel left as a stub).
5. Replace the stub pages of P3-03 that you own (build-plan 3.2). After Create, navigate as in routes.md 6.3 (campaign page; IO `explorerlis`).
6. All numbers in the lists come from `getGridMetrics` (a zero stub until P3-09 merges). Do not compute metrics yourself.

OUT OF SCOPE (do not build, even if easy)
- bulk bar actions and bulk jobs, duplicate, SDF (module 11), Alerts page, History tab mount, Combined tab content, saved column views, Intelligence content, chart card data (module 06 T06-06, T06-08 to T06-10; module 07 T07-09)
- line item pages (P3-06c)

FILES YOU OWN (create or edit)
- `lib/campaigns/**`
- `lib/insertion-orders/**`
- `components/campaigns/**`
- `components/insertion-orders/**`
- `lib/changelog/registries/{campaign,campaign-budget,insertion-order,budget-segment,partner-cost}.ts`
- `app/api/dv/campaigns/**`
- `app/api/dv/insertion-orders/**`
- route files listed for P3-06b in build-plan 3.2
- `tests/services/campaigns/**`
- `tests/services/insertion-orders/**`
- `tests/e2e/campaigns.spec.ts`
- `tests/e2e/insertion-orders.spec.ts`
EXCEPTIONS (you may also touch)
- `PROJECT.md` (last commit only)
Everything else belongs to another session. Do not edit it. If you must, follow stop condition 1 of build-plan 2.10.

ACCEPTANCE CRITERIA (copied from the specs; list each one in the PR as Done, Partly or Not done with the test that proves it)
- AC-06-01: Campaigns list shows columns exactly as listed in 2.1 with group headers Campaign and Delivery; default filter chip is `Status: Active`.
- AC-06-02: A campaign with no budget rows shows Budget "Unknown"; empty metrics show "-".
- AC-06-03: Row hover shows ▾; Activate is disabled on an active row and Pause on a paused row. Selecting one changes the status dot immediately and writes a ChangeGroup with `STATUS_CHANGE`.
- AC-06-07: New campaign form has the fields, defaults and order in 2.2; KPI dropdown is disabled until a goal is chosen.
- AC-06-08: For every row of MX-01, choosing the goal and a Not recommended KPI shows the amber `KPI_NOT_RECOMMENDED` message and does not block Create.
- AC-06-09: Create with empty name, no creative type, or Limit frequency with empty n shows red field errors (`Enter a value`, `Please select at least one creative type.`) and does not navigate (CMP-001, CMP-020, CMP-040).
- AC-06-10: KPI value unit shows currency for CPM/CPA/CPC/CPV/CPIAVC and "%" for CTR / Viewable %; value 0 gives `Enter a number greater than 0`; percentage above 100 gives CMP-015.
- AC-06-11: "Add Budgets" appends 5 rows each click; fully empty rows are ignored; a row with only a name gives CMP-050.
- AC-06-12: ✕ with edits opens DLG-01; Discard closes without a write; Continue editing keeps the form.
- AC-06-13: Copy settings dialog: Copy Settings is disabled until a campaign and one setting are ticked; copying only ticked settings changes only those fields in the draft.
- AC-06-14: Settings page is prefilled; start date is locked after the campaign started (CMP-033); Save is disabled while clean; Reset restores saved values; change note is stored on the ChangeGroup.
- AC-06-15: Stale save (version mismatch) shows DLG-11.
- AC-06-16: Campaign page shows tabs Combined, Insertion orders, Line items; pin stores the default; `/c/{id}` redirects to the pinned tab.
- AC-06-17: Chart strip shows 5 cards with the empty states of explore 03 when no selection is made (Impressions lost, Added reach, Explore budget options).
- AC-06-20: READ_ONLY user sees "Limited Access", disabled New campaign, disabled edit items; a forged POST to `updateCampaign` returns 403 `FORBIDDEN`.
- AC-06-21: REPORTING_ONLY user opening `/cs` sees the 404 page.
- AC-06-22: Every create / update / status change writes ChangeLog rows visible on `[C]/history` with the entries format "{Field} is {value}" or "{field} changed from {old} to {new}" (DM 6.3).
- AC-07-01: Advertiser tab shows no New Insertion Order button; campaign tab does.
- AC-07-02: Step 1 matches the matrix: for each type x objective the preview pane lists KPIs, bid strategies, LI types from `io-objective-matrix`; CTV disables Clicks; DOOH enables only "without objective".
- AC-07-03: Next stays disabled until type and objective are chosen; URL carries `?type=&objective=` after Next; reload restores step 2 empty.
- AC-07-04: New IO defaults: status Draft, pacing Flight + Ahead, optimization Automate (when objective allows), KPI = first KPI of objective (VCPM for Brand awareness), segment start today and end last day of month, frequency Unlimited up to the campaign cap.
- AC-07-05: Create with empty name or budget shows `Enter a value`, stays on page, focuses the first invalid field; KPI value 0 shows `Enter a number greater than 0`.
- AC-07-06: Changing pacing period to Daily shows daily amount input and offers Even and ASAP only; Flight offers Ahead and Even.
- AC-07-07: Frequency "Unlimited" shows "The campaign's frequency cap is set to {n} exposures per {period}" with the campaign's real value.
- AC-07-08: Partner costs: media fee 1 is locked and invoiced; Add fee menu adds CPM fee or Media fee up to 5 each; fee type list equals MX-17.
- AC-07-09: Details page: budget type disabled; segment start date locked once started; Spent and Remaining columns visible; Show actualized toggles values.
- AC-07-10: Objective dropdown on details offers only {current} and "Insertion order without objective"; saving the latter unlocks other KPIs and is irreversible.
- AC-07-11: Switching to Automate at IO level while a non-Display/Video/CTV LI exists shows IO-052.
- AC-07-12: After switching to Automate, LI details show pacing locked to ASAP and bid strategy from the IO (module 08 AC).
- AC-07-13: Inline budget edit validates and updates the Budget cell; value below spent gives IO-026.
- AC-07-18: IO page tabs route correctly (`explorerlis`, `details`, `history`) and Overview › returns to the campaign.
- AC-07-21: Read-only role cannot save; forged `updateInsertionOrder` returns `FORBIDDEN`.

TESTS TO WRITE
- Vitest service tests: V-06-14 archive cascade writes N change groups; V-06-15 `copySource` returns only requested settings; V-06-16 KPI Actual formula; V-07-19 matrix snapshot (served to the client); V-07-21 automation propagation; create/update/status services write exactly the change entries of AC-06-22; forged `updateCampaign` and `updateInsertionOrder` return `FORBIDDEN` for READ_ONLY
- Playwright, module 06 6.2: PW-06-01 create happy path, PW-06-02 validation, PW-06-03 not recommended KPI, PW-06-04 unsaved changes, PW-06-05 inline status, PW-06-09 read-only, PW-06-11 locked start date, PW-06-12 copy settings
- Playwright, module 07 6.2: PW-07-01 to PW-07-07, PW-07-09, PW-07-13, PW-07-15
- AC-06-22 is proved through the `ChangeGroup` and `ChangeEntry` rows in the database (the History tab is a stub in this session)

DONE WHEN
- create a campaign, then an IO in it, from the UI on seeded data, with validation messages verbatim, on the preview
- `npm run check` passes, plus `npm run test:db` if you touched database code and `npm run e2e` for the e2e specs you wrote
- CI is green on the PR and the Vercel preview is green (if the preview is not available because owner items P-03 or P-04 are open, say so in the PR)
- the PR body follows .github/pull_request_template.md, with the acceptance table, deviations and a Not done list
- the last commit is `docs: status P3-06b`

STOP CONDITIONS (in addition to build-plan 2.10)
- If a `lib/validation` rule is wrong or missing, do not patch it here: write the failing case in your PR, work around in the form only if safe, and report it for P3-06a's owner (open a comment on the PR).
- Stop at the end of the listed scope. Bulk and duplicate are Phase 4.
```

### 4.12 P3-06c (Line items)

```text
Read PROJECT.md, docs/specs/build-plan.md and the listed specs. Implement Line items of types Display, Video, Connected TV, Audio, Mobile app install, Ads in mobile apps, DOOH and the Demand Gen shell: service, type picker, form, grid and page (PROJECT.md P3-06, third part). Write tests. Open a PR to `main` from branch `p3-06c-line-items`; do not push to main. Update nothing in PROJECT.md except via the PR's last commit `docs: status P3-06c`.

SESSION: P3-06c (line item create, edit, list and page). Wave 4. Merged before you start: P3-01, P3-05a, P3-04, P3-06a, P3-02, P3-05b, P3-03.

READ FIRST, in this order
- docs/specs/conflicts.md (rows RC-nnn override every spec; read section 1.1)
- docs/specs/build-plan.md sections 2 (conventions, stubs, global stop conditions in 2.10) and 3.2 (file ownership)
- docs/specs/modules/08-line-items.md sections 1 to 4, 5.2, 6 and 7 (tasks T08-03, T08-04, T08-05, T08-06, T08-09 without bulk, T08-10)
- docs/specs/modules/05-history-notifications.md 4.1 (`withChangeLog`)
- docs/specs/routes.md 3.6 (line item routes), 6.3, 8.6 (wire types with RC-003, RC-006, RC-018, RC-040 applied)
- docs/specs/validation.md rules LI-*, LI-DSP/VID/CTV/AUD/APP/DOOH/DG, matrices MX-03, MX-04, MX-05, MX-08, MX-10 (use `lib/validation`)
- docs/specs/design-system.md 2.4, 2.8, 2.9, 2.10, 2.12 and `components/dv`
- docs/explore/05-line-items.md for labels, defaults and section order (verbatim)
- docs/specs/conflicts.md rows RC-003, RC-004, RC-006, RC-018 to RC-020, RC-039 to RC-041, RC-052

BUILD EXACTLY THIS
1. Service `lib/line-items`: list (four scopes: IO, campaign, advertiser, audience stub), detail, create, update, `setLineItemStatus`, copy source ("Copy settings from"), `assignCreatives(liId, { add, remove })` using seeded creatives, field registry for LineItem and its child tables, conversions panel data, permission and version checks. Persist targeting through `persistTargeting` from `lib/targeting` (stub until P3-07a is merged).
2. API: `app/api/dv/line-items/*` (list, detail, create, update, creative candidates per IO).
3. UI: type picker page (`LiTypeCard`, IO switcher, cards disabled per MX-03 with `LI_TYPE_INCOMPAT` tooltip, Demand Gen toast without Floodlight optimisation, app pre-step with the seeded app catalogue), `LiForm` sections 0 to 11 for Display, Video, CTV and Audio with the defaults and locks of module 08 2.3 and 2.4, bid and pacing logic including IO automation locks (RC-039), creatives panel (tabs All, Eligible, Assigned), conversions panel, `TargetingCard` mounted from `components/targeting` (the stub until P3-07a), type variants Mobile app install, Ads in mobile apps, DOOH and the Demand Gen shell (T08-06).
4. `LiGrid` (columns and totals, status dot with hover menu Activate/Pause, alert bell, performance columns through `getGridMetrics`) mounted at IO, campaign and advertiser level (`explorerlis` pages), Archived list reachable from the IO menu.
5. LI page shell: header, tabs by type (`details`; YouTube redirect to `adgroups` is Phase 4), Troubleshooter and History tabs as stubs.
6. Right-rail forecast panels are stubs showing the `INV_AVAIL_UNKNOWN` text.

OUT OF SCOPE (do not build, even if easy)
- YouTube line items, ad groups and ads, Troubleshooter, forecast, template carousel, bulk bar, duplicate, SDF
- creative library pages (the creatives panel uses seeded rows only)

FILES YOU OWN (create or edit)
- `lib/line-items/**`
- `components/line-items/**`
- `lib/changelog/registries/{line-item,line-item-child}*.ts`
- `app/api/dv/line-items/**`
- route files listed for P3-06c in build-plan 3.2
- `tests/services/line-items/**`
- `tests/e2e/line-items.spec.ts`
EXCEPTIONS (you may also touch)
- `PROJECT.md` (last commit only)
Everything else belongs to another session. Do not edit it. If you must, follow stop condition 1 of build-plan 2.10.

ACCEPTANCE CRITERIA (copied from the specs; list each one in the PR as Done, Partly or Not done with the test that proves it)
- AC-08-01: Picker shows the 9 cards in a Standard IO (DOOH and CTV IO show their sets); cards disabled exactly per MX-03 with tooltip text `LI_TYPE_INCOMPAT`.
- AC-08-02: Switching the IO on the picker re-evaluates cards.
- AC-08-03: Demand Gen click without Floodlight optimization shows the yellow toast and stays; with it enabled opens the DG shell.
- AC-08-04: Display form shows sections 0 to 11 in order with defaults of explore 05 (Quality = Authorized Direct Sellers And Resellers, "45 Exchanges and 0 Subexchanges", Draft, Same dates as IO, Unlimited budget, Frequency unlimited, Open Measurement locked).
- AC-08-05: Video shows 46 exchanges and the curated CTV checkbox and no Open Measurement row; CTV adds Position In-stream, Player size Large + HD, Device CTV; Audio shows 11 exchanges, the audio note, default Fixed bid.
- AC-08-06: Mobile app install requires platform and app before Next; Ads in mobile apps requires a name; the latter locks Environment App and Device Smartphone + Tablet.
- AC-08-07: DOOH forms offer only fixed bid and DOOH exchanges; no template carousel.
- AC-08-08: Create with empty name, no EU answer, missing fixed bid or empty custom budget shows errors from LI-001, LI-080, LI-041, LI-030 and stays on page.
- AC-08-09: Bid dropdown options equal MX-04 for each (objective, type) combination tested (Clicks+Display: Maximize clicks / Maximize custom value / cost).
- AC-08-10: Under IO automation, pacing and bid are locked and show the IO values.
- AC-08-11: Creative panel tabs All / Eligible / Assigned filter correctly; ineligible creative type cannot be assigned (LI-060).
- AC-08-12: Conversion panel lists active activities; selecting none with a conversion strategy shows LI-046.
- AC-08-14: Copy settings from another LI of the same type copies settings except name and status.
- AC-08-16: LI list shows columns and totals; YouTube rows add TrueView Views.
- AC-08-18: LI page tabs and redirects: YouTube goes to `adgroups`, others to `details`.
- AC-08-25: Read-only role: form fields disabled, no Save; Troubleshooter still viewable; forged `updateLineItem` returns `FORBIDDEN`.
- AC-08-27: Edit after campaign start: LI start date locked (LI-023); LI type, app, YouTube subtype read-only (LI-004, LI-APP-008, LI-YT-004).

TESTS TO WRITE
- Vitest: copy-settings service (AC-08-14), creative assignment rules LI-060 to LI-064, field registry completeness for LineItem, forged `updateLineItem` returns `FORBIDDEN` for READ_ONLY (AC-08-25)
- Playwright, module 08 6.2: PW-08-01, PW-08-02, PW-08-03, PW-08-04, PW-08-06, PW-08-07, PW-08-08, PW-08-09, PW-08-17 in `tests/e2e/line-items.spec.ts`

DONE WHEN
- create a Display line item in a seeded IO from the UI with validation, assign a seeded creative, activate it, and see it in the lists on the preview
- `npm run check` passes, plus `npm run test:db` if you touched database code and `npm run e2e` for the e2e specs you wrote
- CI is green on the PR and the Vercel preview is green (if the preview is not available because owner items P-03 or P-04 are open, say so in the PR)
- the PR body follows .github/pull_request_template.md, with the acceptance table, deviations and a Not done list
- the last commit is `docs: status P3-06c`

STOP CONDITIONS (in addition to build-plan 2.10)
- If P3-07a is not merged, leave the stub card and note it. Do not build editors.
- If a type variant from T08-06 cannot be finished, finish Display, Video, CTV and Audio first and list the rest under Not done.
```

### 4.13 P3-08b (Engine runtime)

```text
Read PROJECT.md, docs/specs/build-plan.md and the listed specs. Implement the database layer of the engine: loading the world, persisting ticks, locks, the tick endpoint, catch-up, fast-forward and alert persistence (PROJECT.md P3-08, second part). Write tests. Open a PR to `main` from branch `p3-08b-engine-runtime`; do not push to main. Update nothing in PROJECT.md except via the PR's last commit `docs: status P3-08b`.

SESSION: P3-08b (engine runtime, tick endpoint and fast-forward). Wave 4. Merged before you start: P3-01, P3-05a, P3-08a, P3-02, P3-05b.

READ FIRST, in this order
- docs/specs/conflicts.md (rows RC-nnn override every spec; read section 1.1)
- docs/specs/build-plan.md sections 2 (conventions, stubs, global stop conditions in 2.10) and 3.2 (file ownership)
- docs/specs/engine.md sections 1.2 to 1.4 (clock, determinism, tick scheduler), 1.7 (tables, as reconciled), 3.5 and 3.7 (what is recorded, alerts), 9.1 (grains), 10.2 and 10.3 (reset, fast-forward), 11.4
- docs/specs/data-model.md 5.18, 5.19, 6.3 (system actors through `withChangeLog`), Appendix B (roles)
- docs/specs/routes.md 8.20 (tick endpoint) and modules/18 4.3 (window ticks)
- docs/specs/modules/05-history-notifications.md 4.1 (engine writers)
- docs/specs/conflicts.md rows RC-013, RC-021, RC-022, RC-024, RC-025, RC-027, RC-028, RC-056

BUILD EXACTLY THIS
1. `lib/engine/io/loadWorld.ts` (database to `World`), `persistTick.ts` (additive upserts of `DeliveryDiagnostic`, `SimHourlyMetric`, `SimDailyMetric`, pacing snapshots, `Alert` open and resolve after 2 clear ticks), `locks.ts` (`SELECT ... FOR UPDATE SKIP LOCKED` on `SimClock`, idempotency through `SimTickLog`), `jobs.ts` (`SimJob`: fast-forward, reset). Use `withBypass` (role `app_engine`).
2. `lib/engine/server.ts`: `ensureCaughtUp(sandboxId)`, `runDueTicks(deadline)`, `fastForward(sandboxId, simHours)` with progress, `resetSandbox(sandboxId)` minimal (delete sim rows, reset clock), clock controls `setSpeed`, `pause`, `resume`, `stepTicks`.
3. `POST /api/sim/engine/tick`: auth by `Authorization: Bearer $CRON_SECRET` or `x-cron-secret`; calls `tickAccessWindows(now)` from P3-02 then advances every due RUNNING sandbox within a time budget (default 50 seconds); returns counts. `maxDuration` set.
4. Alert persistence for the rules available in the engine core, using the `Alert` table with `type` and `diagnosticCode` (RC-013) and the campaign alert groups feed; disabled alert preferences suppress creation.
5. Structural engine edits (flight end status flip, creative review sync) go through `withChangeLog` with `source = ENGINE` and the system actor constants.
6. Retention job: trim hourly rows older than 14 sim days nightly (RC-024).
7. `.github/workflows/engine-tick.yml` (optional fallback, ADR-041): schedule every 5 minutes, runs only when the repository variable `ENGINE_TICK_URL` is set, sends the bearer secret `CRON_SECRET`, fails the job on non-2xx. Vercel Cron is the default trigger on Pro: add the every-minute cron entry to `vercel.json` only when `CRON_MODE=vercel` is set and the owner confirms the project is on Pro (a Hobby deploy fails with a per-minute cron); otherwise put the JSON snippet in the PR body for the owner.

OUT OF SCOPE (do not build, even if easy)
- A/B tests, lift, YouTube, deals, faults and scenarios, reprocessing, report runs, audience and negotiation steps
- any page

FILES YOU OWN (create or edit)
- `lib/engine/io/**`
- `lib/engine/server.ts`
- `app/api/sim/engine/**`
- `.github/workflows/engine-tick.yml`
- `tests/engine-io/**`
EXCEPTIONS (you may also touch)
- `vercel.json` only if the owner chose Vercel cron (build-plan 1.5)
- `lib/engine/index.ts` to export runtime types only
- `PROJECT.md` (last commit only)
Everything else belongs to another session. Do not edit it. If you must, follow stop condition 1 of build-plan 2.10.

ACCEPTANCE CRITERIA (copied from the specs; list each one in the PR as Done, Partly or Not done with the test that proves it)
- 11.1 Idempotent tick: re-running an applied tick writes nothing (row counts and checksum unchanged), proved against the database.
- 11.1 Catch-up equals live: 30 ticks one per call equals 30 ticks in one catch-up call.
- 11.1 Cross-sandbox isolation holds in the database run.
- Lock safety: two concurrent `runDueTicks` calls never process the same sandbox tick twice.
- Fast-forward of 7 sim days for one seeded sandbox finishes and reports progress; a stop condition `NO_SPEND_LI` stops it early when that alert opens.
- A frozen sandbox (closed window) receives no ticks and its sim time does not move; unfreezing resumes without a jump.
- Alert opens and resolves after 2 clear ticks; a disabled alert type is never created.
- The tick endpoint returns 401 for a wrong or missing secret.
- Money columns are stored once in the advertiser currency (RC-025).

TESTS TO WRITE
- db tests for every criterion above using the seeded `starter-agency` sandbox
- unit: tick endpoint auth variants (Bearer and `x-cron-secret`); time budget handling
- one e2e check: after a tick against the CI database, the Campaigns list shows non-zero Impr. for an active line item (needs P3-09; mark Not done if P3-09 is unmerged)

DONE WHEN
- `curl -X POST $URL/api/sim/engine/tick -H "Authorization: Bearer $CRON_SECRET"` works against the preview (if secrets exist) and the workflow file passes `actionlint`
- `npm run check` passes, plus `npm run test:db` if you touched database code and `npm run e2e` for the e2e specs you wrote
- CI is green on the PR and the Vercel preview is green (if the preview is not available because owner items P-03 or P-04 are open, say so in the PR)
- the PR body follows .github/pull_request_template.md, with the acceptance table, deviations and a Not done list
- the last commit is `docs: status P3-08b`

STOP CONDITIONS (in addition to build-plan 2.10)
- If the engine core (P3-08a) exposes an API that does not fit the database layer, fix it with a one-line additive export and tell the owner in the PR; do not rewrite the core.
- Do not run any command against a production database.
```

### 4.14 P3-09 (Performance columns)

```text
Read PROJECT.md, docs/specs/build-plan.md and the listed specs. Implement the metric aggregation layer behind the Performance columns, totals row and chart feeds of the list pages (PROJECT.md P3-09). Write tests. Open a PR to `main` from branch `p3-09-metrics`; do not push to main. Update nothing in PROJECT.md except via the PR's last commit `docs: status P3-09`.

SESSION: P3-09 (performance metrics for list pages). Wave 4. Merged before you start: P3-01, P3-05a, P3-05b (start); P3-06b and P3-06c merged before the e2e spec runs.

READ FIRST, in this order
- docs/specs/conflicts.md (rows RC-nnn override every spec; read section 1.1)
- docs/specs/build-plan.md sections 2 (conventions, stubs, global stop conditions in 2.10) and 3.2 (file ownership)
- docs/specs/engine.md sections 9.2 (metric columns), 9.3 (dimensions), 9.4 (list-page columns and chart cards, exact feed), 4.6 (KPI Actual)
- docs/specs/modules/06-campaigns.md 2.1, modules/07-insertion-orders.md 2.1, modules/08-line-items.md 2.1 (column definitions per list)
- docs/specs/data-model.md 5.18, 7.1 (computed at read time) and header (money, time)
- docs/specs/design-system.md 2.4 (number formats) and 2.16 (chart card data)
- docs/specs/conflicts.md rows RC-022, RC-023, RC-025, RC-038

BUILD EXACTLY THIS
1. `lib/metrics/` implementing `getGridMetrics({ level, ids, range, sandboxId })` (replace the stub, same signature) for campaign, IO, line item, ad group and advertiser levels: aggregate `SimDailyMetric` (`sliceKind = total`) over the date range in the advertiser time zone, derived ratios (CTR, CPM, CPC, CPA, eCPM, viewability %, VTR, conv rates), KPI Actual per KPI, "Spent" = revenue (RC-038), currency conversion at read time from `FxRate`, null vs zero rules ("-" for empty).
2. `getTotals` for the totals row ("Total: Display" text is a UI matter) and `getChartCardData` for the built-in cards Total cost, Avg. performance and Impressions; the other cards return the empty-state marker.
3. Date range parsing for `d` params using the sim clock for `today` and `yesterday` (RT R9), preset resolution shared with `DvDateRange`.
4. Batch queries: one query per level per request (no N+1), indexes verified with `EXPLAIN` in a test.
5. API: `GET /api/dv/metrics/grid` and `/api/dv/metrics/cards` (used by client refresh and by tests).
6. End-to-end check `tests/e2e/performance-columns.spec.ts`: the Campaigns, IO and LI lists on seeded data show non-zero Impr., Clicks, Spent and CPM in the right columns, totals reconcile with the sum of rows.

OUT OF SCOPE (do not build, even if easy)
- column views and the Modify columns dialog (module 11), report queries, reach metrics, dimension breakdowns beyond the slices needed by the lists

FILES YOU OWN (create or edit)
- `lib/metrics/**`
- `app/api/dv/metrics/**`
- `tests/metrics/**`
- `tests/e2e/performance-columns.spec.ts`
EXCEPTIONS (you may also touch)
- `PROJECT.md` (last commit only)
Everything else belongs to another session. Do not edit it. If you must, follow stop condition 1 of build-plan 2.10.

ACCEPTANCE CRITERIA (copied from the specs; list each one in the PR as Done, Partly or Not done with the test that proves it)
- The Performance columns of module 06 2.1, 07 2.1 and 08 2.1 (Impr., Clicks, CTR, Spent, CPM, CPC, Conv., CPA, KPI Actual where listed) are filled from `SimDailyMetric` on seeded data.
- A campaign with no budget rows shows Budget "Unknown"; empty metrics show "-" (AC-06-02).
- Money for an advertiser in another currency than the partner converts with `FxRate` and totals equal the sum of rows after conversion (AC-01-5 logic).
- KPI Actual formulas match engine.md 4.6 for CPM, CTR and CPA fixtures (V-06-16).
- Metric names are the engine 9.2 names (RC-023).

TESTS TO WRITE
- db: aggregation equals a raw SQL sum for random ranges (fast-check over dates), time zone day boundaries (IST advertiser vs UTC), currency conversion, null vs zero, KPI Actual, batch size 500 ids in one query
- EXPLAIN test: the grid query uses the `(lineItemId, simDate, ...)` index
- e2e performance columns spec

DONE WHEN
- the list pages on the preview show numbers (needs P3-05b seeds and P3-06b/c merged)
- `npm run check` passes, plus `npm run test:db` if you touched database code and `npm run e2e` for the e2e specs you wrote
- CI is green on the PR and the Vercel preview is green (if the preview is not available because owner items P-03 or P-04 are open, say so in the PR)
- the PR body follows .github/pull_request_template.md, with the acceptance table, deviations and a Not done list
- the last commit is `docs: status P3-09`

STOP CONDITIONS (in addition to build-plan 2.10)
- If a list page still shows zeros after your layer is correct, the cause is the page binding: report it for the page owner instead of editing their files.
```

### 4.15 P3-07b (Targeting advanced editors)

```text
Read PROJECT.md, docs/specs/build-plan.md and the listed specs. Implement the advanced targeting editors (PROJECT.md P3-07, second part). Write tests. Open a PR to `main` from branch `p3-07b-targeting-advanced`; do not push to main. Update nothing in PROJECT.md except via the PR's last commit `docs: status P3-07b`.

SESSION: P3-07b (geography, apps and URLs, brand suitability and audience builder editors). Wave 5. Merged before you start: P3-07a merged (and P3-08a for the audience size estimate).

READ FIRST, in this order
- docs/specs/conflicts.md (rows RC-nnn override every spec; read section 1.1)
- docs/specs/build-plan.md sections 2 (conventions, stubs, global stop conditions in 2.10) and 3.2 (file ownership)
- docs/specs/modules/10-targeting.md sections 2.3 (editor catalogue rows for Geography, Apps and URLs, Brand suitability, Audience lists), 2.4, 2.5, 2.6, 4 (rules and actions for these dimensions), 6 (acceptance), 7 (tasks T10-07, T10-08 apps part, T10-09, T10-10)
- docs/specs/validation.md TGT-010 to TGT-013, TGT-040 to TGT-047, TGT-090 to TGT-102, MX-10
- docs/explore/07-targeting.md (geography, apps and URLs, brand suitability, audience lists builder: labels and option lists verbatim) and docs/explore/10-audiences.md for the picker
- docs/specs/engine.md 1.6 `estimateAudienceSize` and 2.3 (audience shares), conflicts RC-030
- docs/specs/conflicts.md rows RC-030, RC-044, RC-055

BUILD EXACTLY THIS
1. Geography editor: region search over the seeded catalogue, radius mode, bulk POI paste with per-line validation, SVG map with selection shading (static SVG, design-system Q19), "All locations" as the empty state, location lists picker stub.
2. Apps and URLs editor: four categories, add multiple, "Download composite list" CSV, URL suggestions card only when the campaign has landing URLs.
3. Brand suitability editor and third-party verification options with running cost total, exclusivity rules (TGT-091), provider disabled by advertiser settings (TGT-092) with the vendor mapping of RC-055.
4. Audience lists editor `DvAudienceBuilder` (add to `components/targeting/editors/audience`): sections, groups (OR inside, AND between include groups of the first-party section), exclude lists, picker filtered by eligibility, Impressions summary pane calling `estimateAudienceSize` through `app/api/dv/audiences/estimate`, update within 1 second.
5. Register the four editors in the card registry by adding one line each to `components/targeting/editors/registry.ts` (the only shared file you may edit).

OUT OF SCOPE (do not build, even if easy)
- templates, video/audio/DOOH-only editors, YouTube ad group editors, audience data creation (module 14)

FILES YOU OWN (create or edit)
- `components/targeting/editors/geography/**`
- `components/targeting/editors/apps-urls/**`
- `components/targeting/editors/brand/**`
- `components/targeting/editors/audience/**`
- `lib/targeting/geo.ts`
- `lib/targeting/audience.ts`
- `app/api/dv/audiences/estimate/**`
EXCEPTIONS (you may also touch)
- `components/targeting/editors/registry.ts` (add four entries)
- `tests/targeting/advanced/**`
- `tests/e2e/targeting-advanced.spec.ts`
- `PROJECT.md` (last commit only)
Everything else belongs to another session. Do not edit it. If you must, follow stop condition 1 of build-plan 2.10.

ACCEPTANCE CRITERIA (copied from the specs; list each one in the PR as Done, Partly or Not done with the test that proves it)
- AC-10-04: Geography: Region search, Radius mode, bulk POI with valid and invalid lines, map selection shading, "All locations" default row, TGT-010..013 messages.
- AC-10-05: Apps & URLs: four categories, "Add multiple apps and URLs at once", "Download composite list" returns CSV; URL suggestions card shows only when the campaign has landing URLs or keywords.
- AC-10-10: Brand suitability row locked; DV option exclusivity (TGT-091); running total equals the sum of options; provider disabled by advertiser settings shows TGT-092.
- AC-10-11: Audience builder implements sections, groups and exclude per 2.5; picker filters by eligibility; Impressions summary updates after each change within 1 s and shows the labelled parts.

TESTS TO WRITE
- Playwright module 10 6.2: PW-10-02, PW-10-03, PW-10-05 in `tests/e2e/targeting-advanced.spec.ts`
- Vitest: POI parser (valid and invalid lines), composite list CSV, running total of verification cost equals sum of options, audience expression evaluation (OR, AND, exclude) against ENG 2.3 fixtures, TGT-100 include/exclude same list
- round trip for the four dimensions through `stateToRows`/`rowsToState`

DONE WHEN
- editors open from the real LI form on the preview
- `npm run check` passes, plus `npm run test:db` if you touched database code and `npm run e2e` for the e2e specs you wrote
- CI is green on the PR and the Vercel preview is green (if the preview is not available because owner items P-03 or P-04 are open, say so in the PR)
- the PR body follows .github/pull_request_template.md, with the acceptance table, deviations and a Not done list
- the last commit is `docs: status P3-07b`

STOP CONDITIONS (in addition to build-plan 2.10)
- Cut order inside this session if credit is short: audience builder estimate pane first, then the SVG map (fall back to the search list), then composite download.
```

### 4.16 P3-INT (Integration and hardening)

```text
Read PROJECT.md, docs/specs/build-plan.md and the listed specs. Implement the integration pass: make the minimum viable classroom demo work end to end on `main`, fix cross-session breakage, and list what is left. Write tests. Open a PR to `main` from branch `p3-int-hardening`; do not push to main. Update nothing in PROJECT.md except via the PR's last commit `docs: status P3-INT`.

SESSION: P3-INT (integration, demo path and gap list). Wave 5. Merged before you start: all other Phase 3 PRs.

READ FIRST, in this order
- docs/specs/conflicts.md (rows RC-nnn override every spec; read section 1.1)
- docs/specs/build-plan.md sections 2 (conventions, stubs, global stop conditions in 2.10) and 3.2 (file ownership)
- docs/specs/build-plan.md sections 3 and 5.2 (minimum viable demo and cut order)
- PROJECT.md section 6 and 10 (what each session reported), every merged PR description (Not done and Deviations lists)
- docs/specs/design-system.md section 6 (fidelity checklist: Global, Data grid, Forms)
- docs/specs/conflicts.md (check that nothing built contradicts an RC row)

BUILD EXACTLY THIS
1. Run the demo script (write it in `docs/demo-script.md` as you go): instructor logs in, class window open, student logs in, lands on Overview, opens advertiser, creates a campaign, an IO with validation errors then success, a Display line item with a creative, activates it, runs `fastForward` or waits for ticks, sees metrics in the Performance columns. Fix every break with a small commit (message `fix(p3-xx): ...` naming the session that owns the file).
2. Replace the history stub in sandbox provisioning with `engine.fastForward` (14 days hourly plus 90 days daily) only if the full demo path already works and the run time per sandbox is under 2 minutes; otherwise leave the stub and say so.
3. Add `/sim/admin/seed` (admin only) that creates the demo class and sandboxes by calling the bootstrap functions, so the owner can reseed the production database without shell access.
4. Write `docs/gaps/p3.md`: a table of every "Not done" and "Deviation" from the Phase 3 PRs, each with the module task id, size and suggested phase. Update the Phase 4 outline in `docs/specs/build-plan.md` section 3.7 if the gaps change it (this is the only edit to build-plan.md you may make).
5. Quick fidelity pass with the Global items of design-system section 6 on the preview; log misses in `docs/gaps/p3.md`.
6. Final status commit ticks every remaining P3 line in PROJECT.md section 6 that is truly done and appends one summary row to section 10.

OUT OF SCOPE (do not build, even if easy)
- new features, new modules, refactors without a failing test or a demo break

FILES YOU OWN (create or edit)
- Any file, for fixes only, one commit per fix
- `docs/demo-script.md`, `docs/gaps/p3.md`
- `app/sim/admin/seed/**`
EXCEPTIONS (you may also touch)
- `PROJECT.md` (last commit only)
Everything else belongs to another session. Do not edit it. If you must, follow stop condition 1 of build-plan 2.10.

ACCEPTANCE CRITERIA (copied from the specs; list each one in the PR as Done, Partly or Not done with the test that proves it)
- The demo script passes on the production preview (or on a local build if the preview is unavailable, stated in the PR).
- CI is green on `main` after your PR.
- The minimum viable demo of build-plan 5.2 works: instructor and student login, shell, campaign to IO to line item creation with validation, seed data, engine metrics visible in list columns.
- No secret is present in the repository (run the secret scan tool or `git grep` for the patterns in `.env.example`).

TESTS TO WRITE
- one Playwright spec `tests/e2e/demo-path.spec.ts` that runs the demo script steps against the seeded CI database

DONE WHEN
- `npm run check`, `npm run test:db` and `npm run e2e` pass on your branch rebased on the latest `main`
- `npm run check` passes, plus `npm run test:db` if you touched database code and `npm run e2e` for the e2e specs you wrote
- CI is green on the PR and the Vercel preview is green (if the preview is not available because owner items P-03 or P-04 are open, say so in the PR)
- the PR body follows .github/pull_request_template.md, with the acceptance table, deviations and a Not done list
- the last commit is `docs: status P3-INT`

STOP CONDITIONS (in addition to build-plan 2.10)
- Do not start a fix that needs more than about 200 changed lines; log it in `docs/gaps/p3.md` instead.
- Stop at 6:00 PM IST on Wednesday 4 Nov even if the demo is not complete, push, and list what remains.
```

---

## 5. Risks, fallbacks and scope cuts

### 5.1 Credit control

The $100 credit expires on 5 Nov 2026 at 1:29 PM IST. The plan spends about 90 of it on 16 sessions and keeps about 10 for re-runs.

1. After P3-01 merges, the owner records the credit spent. Multiply by the session sizes (S 1, M 2, L 3 units; P3-01 is M) to get a cost per unit. Total units in the plan: 1 S, 7 M, 8 L, so about 39 units.
2. If the projected total is more than 90, apply the cut order in 5.2 before starting wave 3.
3. Re-check after every wave. Nothing is started if the remaining credit is below the planned share of that session.
4. A session that is cut short still pushes its branch (stop condition 3 in build-plan 2.10). Drafts are kept; nothing is thrown away.
5. Work in progress at 1:29 PM IST on 5 Nov may stop. Merge freeze is 9:00 AM IST for that reason.
6. After the credit expires, work continues on the normal plan limits (PROJECT.md R7). The Phase 4 outline in 3.7 is written for that.

### 5.2 Minimum viable classroom demo and cut order

Minimum viable demo (MVP): an instructor and a student can sign in during an open class window; the student lands in the DV360-style shell; creates a campaign, then an insertion order, then a line item with validation messages as in DV360; the seeded account has realistic data; the engine has produced metrics that show in the list columns.

The sessions needed for the MVP are, in order: P3-01, P3-05a, P3-04 (Tier A only), P3-06a, P3-02, P3-05b, P3-03, P3-06b, P3-06c, P3-08a, P3-08b, P3-09, P3-INT.

If credit or time is short, cut from the top of this list first. Each cut names what is lost and what stays.

| Order | Cut | Effect | What still works |
|---|---|---|---|
| 1 | P3-05c (remaining tables) | None for the MVP. Phase 4 modules add their own tables | everything in the MVP |
| 2 | P3-07b (advanced targeting editors) | No map, no audience builder, no apps and URLs, no brand suitability | basic targeting card from P3-07a |
| 3 | Tier B of P3-04 (chart cards, KPI tiles, picker dialog, carousel) | Chart strip shows a placeholder | all grids, forms, dialogs |
| 4 | P3-07a reduced to Geography list, Device, Language and Day and time | Fewer editors | line items still carry targeting |
| 5 | P3-06c type variants (Mobile app, Ads in apps, DOOH, Demand Gen shell) | Display, Video, CTV and Audio only | the demo path |
| 6 | Campaign copy settings, IO inline budget edit, automation propagation | Minor features | create and edit |
| 7 | P3-08b alert persistence and fast-forward job (keep the tick endpoint) | No alerts. Metrics come from lazy ticks and the history stub | list columns |
| 8 | P3-08a: keep Fixed bid, Max clicks and Max conversions only; drop IO-level allocation and frequency modelling | Less realism | non-zero, plausible metrics |
| 9 | P3-09 reduced to campaign and IO lists | LI list shows zeros | the demo story |
| 10 | P3-02 reduced to credentials login plus window guard; drop lockout, forced password change, view-as | Less security polish | login and class windows |

Not cuttable: P3-01, P3-05a, P3-06a, P3-05b, P3-03, P3-06b, P3-06c, a minimal P3-08a and P3-08b. If even these do not fit, see fallback F-2.

### 5.3 Risk list

| # | Risk | Likelihood, impact | Early signal | Mitigation and fallback |
|---|---|---|---|---|
| R-01 | Credit runs out before the MVP is merged | Medium, high | Cost per unit above plan after P3-01 or wave 2 | Cut order 5.2. Run the MVP sessions first and the optional ones last. Keep 10 % reserve |
| R-02 | Credit expires while a session is mid-work | Medium, medium | Sessions still open on the morning of 5 Nov | Freeze 9:00 AM IST. Last start 8:00 PM on 4 Nov. Sessions push every 20 minutes |
| R-03 | Fewer parallel cloud sessions allowed than the plan uses (5 at peak) | Medium, medium | P-12 shows a limit | Run waves with fewer sessions in merge order (3.5). Drop the cuts of 5.2 earlier |
| R-04 | Owner prerequisites late (Vercel, Postgres, secrets) | Medium, medium | Items open on 1 Nov | Sessions use a local Postgres and need no cloud database. Only "preview green" waits. See F-3 |
| R-05 | Vercel Hobby limits: cron once per day; a deploy with a faster cron fails; limited deployments per day; function time limits; non-commercial use only | High if Hobby, medium | Deploy error mentioning cron; deployment limit message | Pro is required for the classes (1.3, ADR-041). Until the upgrade is done keep cron out of `vercel.json` (P3-08b rule) and use the GitHub Actions fallback every 5 minutes plus lazy catch-up. Sessions push at checkpoints only (2.9). Add the Ignored Build Step for docs-only commits. Long jobs (fast-forward) run in chunks that fit the function time limit |
| R-06 | Supabase free-tier limits (Nano): 500 MB storage, project paused after 7 days of inactivity, about 60 pooled connections, cold starts | Medium, medium | Slow first request; storage near the limit; compute hours used up early in the month | Lower sim speed and hourly retention (RC-057, ADR-045); open the app before each class so a paused project is restored. The tick workflow runs only inside class hours (edit the cron expression of `engine-tick.yml` to class hours). Move to Supabase Pro if a class exceeds 25 students |
| R-07 | Prisma with a transaction pooler: prepared statements, `SET LOCAL` and interactive transactions | Medium, high | Errors like "prepared statement already exists" or lost `app.sandbox_id` | Use `pgbouncer=true` on `DATABASE_URL`, `DIRECT_URL` for migrations, and run every request inside `withSandbox` (one interactive transaction). Fallback F-4 |
| R-08 | RLS and composite foreign keys slow the schema work or break Prisma features | Medium, medium | P3-05a tests need long fixes | `RLS_ENABLED=false` switch keeps the service-layer sandbox filter (every query already carries `sandboxId`). Record the gap and move on |
| R-09 | Merge conflicts between parallel sessions | Medium, low | PRs show conflicts | Ownership map 3.2, merge order 3.5, conflict rules for `package-lock.json`, `PROJECT.md`, `prisma/migrations` (2.2, 2.9, 2.5) |
| R-10 | A session ignores `conflicts.md` and builds a superseded name | Medium, medium | Old enum spelling in a PR | PR template item "Specs read and RC rows applied". Merger greps for the retired names listed in conflicts.md section 5 |
| R-11 | Spec errors found during the build (the specs were written without running code) | High, medium | Sessions list Deviations | Deviations go to P3-INT's `docs/gaps/p3.md`. The planning sessions update the specs and `conflicts.md` after Phase 3 |
| R-12 | Container reclaimed after inactivity, losing local work | Low, medium | Session ends without a push | Push within 30 minutes of starting and at checkpoints |
| R-13 | Engine too slow or too complex for the window | Medium, high | P3-08a past its planned share | Fallback F-1 (engine lite). Property tests are the quality bar; do not drop them |
| R-14 | Playwright or Chromium not available in a session | Low, medium | Browser launch error | The image has Chromium at `/opt/pw-browsers/chromium`; set `PLAYWRIGHT_CHROMIUM_PATH`. Do not run `playwright install` |
| R-15 | Secrets leak in a public repo | Low, high | Secret scanning alert | Secret scanning and push protection on (1.6). Sessions never receive production secrets. P3-INT runs a scan. Rotate any leaked value at once |
| R-16 | Public repo exposes DV360-derived notes | Known, low | n/a | Decided: repo stays public (RC-059, ADR-044) |
| R-17 | Student data privacy and uploads | Low now, medium at the pilot | n/a | RC-063 to RC-065 decided before the pilot; Phase 3 stores only demo users |
| R-18 | Fidelity drift: the UI looks close but not equal | High, medium | n/a | Expected. The SOP-3 fidelity pass is Phase 6. P3-INT logs gaps. DS Q1 asks for reference screenshots (P-09) |
| R-19 | Auth.js v5 is still a beta package and may change | Medium, low | Type or API break on install | Pin the exact beta version. Keep all Auth.js code behind `lib/auth/session.ts` |
| R-20 | Next.js and MUI version mismatch with emotion cache in App Router | Low, medium | Hydration warnings in P3-01 | Use `@mui/material-nextjs` registry (2.2). The smoke test fails on console errors |
| R-21 | Tick endpoint hits the function time limit when many sandboxes are due | Medium, medium | 504 from the tick endpoint | Time budget inside the handler (default 50 seconds), `claimDueSandboxes(limit)`, lazy catch-up on page load |
| R-22 | Spec gaps in DV360 areas that were blocked in the demo (DOOH, Demand Gen, SDF layouts, plan editor) | Known | n/a | Built from public docs and marked `[SIM]` or `(from public docs)`. Re-check with a full-access account before the fidelity review |

### 5.4 Fallbacks

| # | Fallback | When | What changes |
|---|---|---|---|
| F-1 | Engine lite | R-13, or P3-08a past 150 % of its share | P3-08a delivers only: params, RNG, supply cells, funnel with conservation, Fixed bid, auction with price bound, hourly and daily totals. Bidding strategies other than Fixed use the "Max clicks" approximation. Pacing is Flight Even only. All other engine.md sections move to Phase 4 |
| F-2 | Seed-only metrics | P3-08a or P3-08b not usable by 4 Nov noon | The history stub of P3-05b (90 days of daily metrics) feeds the list columns. The tick endpoint exists but writes nothing. The demo shows delivery history, not live delivery |
| F-3 | Local-only review | Vercel not ready | Owner reviews through PR screenshots that sessions attach (Playwright traces and images from CI artifacts). Production deploy happens in P3-INT or after |
| F-4 | Service-layer isolation | R-07 or R-08 | Turn `RLS_ENABLED` off; `withSandbox` still sets the setting but queries filter by `sandboxId` explicitly through a Prisma extension. Isolation tests move from DB-level to service-level |
| F-5 | Single shared login | P3-02 fails | One instructor account and one student account created by bootstrap, class window always open. Not for a real class; acceptable for a demo |
| F-6 | Manual ticks | cron decision unresolved | Instructor presses Step or Catch up; `ensureCaughtUp` runs on page load |

### 5.5 Review of the plan itself

- The plan assumes a cloud session can run `npm ci`, a local Postgres (embedded) and Chromium. P3-01 proves it. If it cannot, the owner should know on 1 Nov in the first hour; the fallback is a smaller wave 2 that does not need a database (P3-04, P3-06a, P3-08a are pure TypeScript).
- Sizes are estimates. The first measured cost (P3-01) and the first L session (any wave 2 session) calibrate the rest.
- The owner is asked to decide several things (section 1). Only P-02 still blocks the start (P-01 and RC-059 were decided on 2026-10-28).
