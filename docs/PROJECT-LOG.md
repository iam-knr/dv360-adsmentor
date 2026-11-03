# DV360 Simulator by Adsmetor — Project Log (single source of truth)
Last updated: 2026-11-02 · This file replaces the former `PROJECT.md` (its full text is Part B at the end; older entries that say "PROJECT.md section N" mean Part B section N) · Findings: `docs/explore/` · Specs: `docs/specs/` · Decisions: `docs/decisions.md` · Build plan: `docs/specs/build-plan.md` · Gap lists per slice: `docs/gaps/` · Fidelity audit: `docs/fidelity/`

**How to read this file:** Part A is the running log. Start with section 0 (state on 2 Nov 2026), then sections 1 to 9 (history, handover notes of 29 Oct). Part B is the original master plan (goals, rules, SOPs, module map, architecture, risks, decision and status logs).

---

## 0. Current state (2026-11-02) — read this first

### 0.1 What is live
- Production: https://dv360-adsmentor.vercel.app (Vercel Hobby, team "BIGSEO's projects", main deploys automatically; Supabase Postgres, eu-west-1). Repo `iam-knr/dv360-adsmentor` was public until 2026-11-03 and is now PRIVATE (owner decision D24, supersedes D19/ADR-044): still never commit secrets or student data. Vercel deploys from it (check Project > Settings > Git if a deploy ever stops), cloud sessions reach it through the GitHub connector.
- Stack as built: Next.js 15.5 (App Router), React 19, TypeScript 5.9, MUI 7, Prisma 6.19 (154 models, 190 enums, migrations 0000 to 0014), Auth.js v5 beta, Zod, Recharts, Vitest, Playwright. Postgres row level security isolates sandboxes (roles `app_tenant`, `app_engine`, owner; setting `app.sandbox_id`).
- Everything in the module map is built to some depth: shell, partner level, campaigns, IOs, line items (all types), targeting, creatives, inventory, audiences, resources, reporting, planning, advertiser settings, bulk/SDF, experiments, optimisation and Troubleshooter, history and notifications, account management. Per-slice leftovers are in `docs/gaps/*.md`.
- Two account levels only: Super admin (`/manage`) and students (ADM-FIX). The DB enum value `ADMIN` remains but nothing uses it.

### 0.2 Engine and clock
- Deterministic simulation engine; student sandboxes run on the sim clock at 1 sim day per 10 real minutes (144x), RUNNING by default. Super admin can pause and resume (`/manage`). Load protection: only sandboxes active in the last 7 days tick, at most 96 ticks per catch-up, tick debt older than 7 days is forgiven (`docs/gaps/sim-clock-runs.md`).
- Timer: an external cron (cron-job.org) POSTs `/api/sim/engine/tick` every 5 minutes with the `CRON_SECRET` bearer. The secret is unchanged by the owner's choice. Lazy catch-up covers gaps. No GitHub Actions timer is needed (`docs/gaps/prov-drive.md`).
- Sandbox provisioning: a new student's build runs about 3 minutes (history backfill). Concurrency races fixed in #53 and #65 (single finish transaction, `createMany skipDuplicates`, bounded retry of transient DB errors, student Retry button).
- Capacity estimate from the load test: about 17 to 25 simultaneously active students on the free tier; 60 is not feasible without paid tiers. A load test is not wanted right now.

### 0.3 Screenshot guard (owner request, built 31 Oct to 1 Nov)
- For students whose `screenshotsAllowed` is false (default) a recognised capture shortcut suspends the account at once: all sessions invalidated, sign in refused, audit entry and a Super admin alert (`/manage/security`, banner, badge, toast poll). Super admin restores access and allows or disallows screenshots per student, also in bulk.
- Methods detected: Print Screen, Win+Shift+S (key up of S and the chord-then-blur pattern), Win/Cmd+Shift+Tab, macOS Cmd+Shift+3/4/5/6, print shortcuts and beforeprint, browser capture Ctrl+Shift+S (Edge Web Capture; Edge sends only Ctrl and Shift down with no blur, caught by the chord tracker). Code: `lib/security/screenshot-detect.ts`, `components/security/ScreenshotGuard.tsx`.
- Capture lab for the owner: `/manage/security/lab` logs raw key, blur and focus events with the guard's verdict and has a "Copy report" button.
- Honest scope: browsers cannot see screenshots; this is a tripwire for keyboard routes, not prevention. Keystrokes are never logged. A visible per-student watermark is an optional follow-up. Details: `docs/gaps/screenshot-guard.md`.

### 0.4 Fidelity pass (owner goal: UI matches real DV360 exactly)
Driven by the owner's audit (`docs/fidelity/audit-1-campaigns-reports.md`, transcribed from the 20-page PDF). Round 1 is merged:
| PR | Slice | Result |
|---|---|---|
| #69 | Foundation | Typography, nav pill, table and button styles, Western money grouping (12,000.00), "-" for zero, tab title "Display & Video 360" in app pages, favicon from the DV360 mark, quiet sim clock chip |
| #70 | Reports | Instant report list (checkbox and type columns, Created by as email, Last modified descending, Files "View"), seven template cards, instant builder layout, offline list and classic offline form |
| #72 | Audiences | Stacked custom list create panel, slide-over pickers, audience lists panel layout (12 known gaps in `docs/gaps/fid-audiences.md`) |
| #71 | Campaigns | List tabs, toolbar, fixed column set, grey campaign ID, New campaign form, campaign detail (gaps in `docs/gaps/fid-campaigns.md`: chart card data, more filter fields than Status/Goal/Budget/Type, own wording for the paused-advertiser banner) |
Font rule: Google Sans only if open-licensed, otherwise the closest open font; no Google proprietary font files are bundled. Brand: DV360 logo lockup (cropped mark, divider, "Simulator", small "by Adsmetor"), used in TopBar, app bar, sign-in and 404.
Audit areas still to run by the owner in Claude in Chrome (use browser zoom on the real DV360 window so CSS widths match the simulator): Insertion orders, Line items, Targeting, Creatives, Audiences, report run results and charts. Each result becomes a fix session (max 3 concurrent).

### 0.5 Working agreements
- CI on a private repo (2,000 free Actions minutes a month): `check` and `db-tests` run on every PR push; the heavy `e2e` and `prod-like` jobs run on pushes to main, on manual runs (workflow_dispatch) and on PRs carrying the label `full-ci` (add the label before merging anything that touches app code; docs-only PRs do not need it). A new push cancels the older run of the same PR.
- At most 3 cloud sessions at the same time. Prompts carry file ownership, the gates to run in the foreground (`npm run check`, `npm run test:db`, full Playwright incl. crawler), "push once", "never merge".
- The owner authorised merging ready PRs ("merge whats ready"): squash, sha pinned, only with all four checks green (`check`, `db-tests`, `e2e`, `prod-like`), branch containing main. Rerun a failed job once for infrastructure flakes (the e2e web server sometimes times out after 240 s). GraphQL is blocked from cloud sessions, use REST.
- The Vercel project "dv360-adsmentor-feoh" is a duplicate that always fails its status; it is to be deleted by the owner and is ignored meanwhile.

### 0.6 Open items
Owner:
- Retest the screenshot guard on Windows/Edge with a guarded test student (Ctrl+Shift+S, Win+Shift+S, Print Screen suspend; Alt+Tab, Ctrl+Shift+T, typing and input-language switch must not) and paste a new capture lab report if something does not suspend. Test data cleanup is done by the owner.
- Run the next fidelity audit areas listed in 0.4.
- Delete the duplicate Vercel project "-feoh".
Engineering backlog (none is blocking):
- Gap files in `docs/gaps/`, newest first: `fid-campaigns.md`, `fid-audiences.md`, `fid-reports.md`, `fid-foundation.md`.
- Flaky Playwright cases seen under load that pass alone: history PW-05-1, nav-wire-a "Create advertiser" focus, planning PW-04-10 "Plan saved" duplicate.
- Optional: visible watermark for screenshot deterrence; email notifications for Super admin alerts; scoping a move to Oracle Cloud if the team decides (brief given in chat, not committed).
- Not started from the original plan: Phase 5 scenarios, snapshots, progress tracking (M18-17), Phase 6 QA and launch tasks (see Part B section 6 and the gap files).

---

# Part A — Running log


---

## 1. What we are building
A classroom-only training simulator for FREE students (paying Ads Mentor students use the real DV360, ADR-048) that replicates Google Display & Video 360 (DV360) screen-for-screen and is fully functional (forms validate, campaigns "run" via a simulated ad-serving engine, reports reflect simulated delivery), so students learn real programmatic workflows without real money or real client data.

## 2. Discussion & decisions
| # | Topic | Decision / outcome | By |
|---|---|---|---|
| D1 | Product | Name "DV360 Simulator by Adsmetor"; full fidelity — every DV360 section in scope | Kailas |
| D2 | Branding / IP | No Google logos or sign-in screens; own Adsmetor login; code written from scratch; Material Symbols icons; synthetic names/IDs/metrics only | Kailas + Claude |
| D3 | Access | Classroom-only; instructor opens/closes access windows; legal handled by Adsmetor | Kailas |
| D4 | Reference account | Demo account, no real spend. Exploration done read-only (open forms, cancel/discard; never Save/Activate) | Kailas + Claude |
| D5 | Browser | Claude in Chrome (the Chrome profile where DV360 is signed in) | Kailas |
| D6 | Storage | Nothing stored on the local PC; all docs/code live only in this GitHub repo | Kailas |
| D7 | Repo visibility | Repo made public so cloud sessions can reach it; revisit before code lands | Kailas |
| D8 | Workflow | Local session explores DV360 → writes `docs/explore/NN-*.md` content → a Claude Code cloud session commits it to `main` (`docs: status P1-NN`) → verified on GitHub | Claude |
| D9 | Stack | Approved 2026-10-28 as proposed: Next.js App Router + TypeScript + MUI + Prisma/PostgreSQL + Vercel; Recharts; Auth.js; Vitest + Playwright (ADR-039) | Kailas |
| D10 | Build budget | Build in Claude Code cloud sessions using the $100 cloud credit (expires 5 Nov 2026) | Kailas + Claude |
| D11 | Spec conflicts | 67 conflict rows in `docs/specs/conflicts.md`: 55 resolved and applied to the specs, 12 owner decisions with defaults | Claude |
| D12 | Phase 3 plan | 16 cloud sessions in 5 waves, one PR each, disjoint file ownership, fixed merge order, cut order if credit runs short (`docs/specs/build-plan.md`) | Claude |
| D13 | Decision records | ADR-001 to ADR-046 in `docs/decisions.md`; ADR-039 to ADR-046 record the owner decisions of 2026-10-28 | Claude |
| D14 | Approvals (2026-10-28) | Stack and plan approved; PROJECT.md is the project plan and action plan. Closes P-01, P0-02, RC-060 (ADR-039) | Kailas |
| D15 | Database | Supabase (existing project, ref `bwqzdhyatvhpssxtwjza`, eu-west-1, free Nano), Postgres only. Pooler port 6543 for `DATABASE_URL`, direct port 5432 for `DIRECT_URL`; values pasted only into Vercel env vars. Not Neon (ADR-040) | Kailas |
| D16 | Hosting and cron | Vercel team "BIGSEO's projects"; stays on Hobby for now; the simulator is for free students only (paying students use the real DV360); GitHub Actions timer every 5 minutes is the default tick trigger plus lazy catch-up; function region `dub1`. Closes P-05, RC-056 (ADR-048, supersedes ADR-041) | Kailas |
| D17 | Vendor names | Real exchange, verifier and vendor names with invented prices, also in Advertiser settings. Closes P-10, RC-055 (ADR-042) | Kailas |
| D18 | Logo | `docs/brand/adsmentor-logo-horizontal.png` committed; used in app bar and login; P3-03 derives a square icon. Screenshots still missing. Closes RC-058, P-09 partly (ADR-043) | Kailas |
| D19 | Repo visibility | Stays public. Never commit secrets, `.env*`, keys, DB URLs or student data; secret scan in P3-01 CI. Closes RC-059 (ADR-044) | Kailas |
| D20 | Class size | Default up to 25 concurrent students; free cohorts may be larger; RC-057 is an open owner question (cohort size, public self-signup; default 25, no self-signup). Free Supabase tier for the pilot with reduced retention; P6-03 target 25, 60 stretch (ADR-045, ADR-048) | Kailas |
| D22 | Gap-finish writes | Owner approved creating test entities in the paused second demo advertiser: 6 campaigns (Paused), 6 IOs (Draft), 1 YouTube LI (Draft); DV360 also auto-saved 1 empty plan. Listed in `19-gap-finish.md` section 6; archive later | Kailas |
| D24 | Repo private (2026-11-03) | Owner does not want the code base taken; repo switched to private. CI minutes protected by running e2e and prod-like only on main or with the `full-ci` label. Supersedes D19 | Kailas |
| D23 | Demand Gen | Skipped in exploration by owner decision; build from public docs | Kailas |
| D21 | Merge authority | Cowork assistant may merge Phase 3+ build PRs after green checks and preview, in merge order, with no open comments; squash only; reports every merge. Closes P-13 (ADR-046) | Kailas |

## 3. Environment notes
- Reference login has limited partner-level access (create advertiser, partner channels/custom bidding, billing, role picker unavailable) — fill those from public docs.
- Reference data contains real-looking names → never copied; docs use placeholders.
- Creative forms render in a cross-origin frame (read via screenshots); reporting app is a same-origin frame.
- Commits are made by cloud sessions (no local git auth by design).

## 4. Task tracker
Status: ✅ done · 🟨 partly done · ⬜ not started

### Phase 0 — Planning & setup
| ID | Task | Status | Notes |
|---|---|---|---|
| P0-01 | Draft PROJECT.md | ✅ | Goals, rules, SOPs, module map, phases, architecture, risks |
| P0-02 | Review & approve PROJECT.md | ✅ | Approved 2026-10-28 with the stack (build-plan P-01, ADR-039) |
| P0-03 | Repo + PROJECT.md committed | ✅ | |
| P0-04 | Repo connected to Claude Code on the web | ✅ | Cloud sessions commit successfully |
| P0-05 | Vercel + Postgres | 🟨 | Supabase project exists (ref `bwqzdhyatvhpssxtwjza`); pending: Vercel import (Hobby, no upgrade needed now), env vars, secrets, cloud environment (build-plan 1.2 to 1.10, P-02, P-03, P-04, P-06, P-07) |
| P0-06 | Turn off usage-credits toggle | ⬜ | Kailas (build-plan P-12) |
| P0-07 | Browser + DV360 sign-in | ✅ | Claude in Chrome |

### Phase 1 — DV360 exploration (`docs/explore/`)
| ID | Section | Status | File | Key findings |
|---|---|---|---|---|
| P1-01 | Global shell | ✅ | `01-global-shell.md` | URL scheme; top bar (AI search, notifications, user mgmt, bulk status, reports, shortcuts, product switcher); partner/advertiser nav; right rail (Ask Advisor, Quick help, Intelligence); Partner Overview; Bulk status; shortcuts |
| P1-02 | Partner level | ✅ | `02-partner-level.md` | Advertisers list; date picker presets; basic details (SDF versions); exchanges list; targeting defaults; advertiser configurations; brand controls; users & roles |
| P1-03 | Campaigns | ✅ | `03-campaigns.md` | List + actions; New campaign form; goal→KPI table; validation; campaign page; alerts |
| P1-04 | Insertion orders | ✅ | `04-insertion-orders.md` | Type + objective matrix; full form (budget segments, pacing, KPIs, optimisation, freq cap, partner costs); IO page |
| P1-05 | Line items | ✅ | `05-line-items.md`, `19-gap-finish.md` | Type picker; full Display form; type differences; LI page; Troubleshooter funnel; CTV, Video, Display DOOH, App install (2 steps), YouTube (2 steps, geography modal). Demand Gen skipped (owner) |
| P1-06 | YouTube | ✅ | `06-youtube.md` | YT LI subtypes/ad formats; details; ad groups; create ad + preview |
| P1-07 | Targeting | ✅ | `07-targeting.md` | All 16 Display targeting editors |
| P1-08 | Creatives | ✅ | `08-creatives.md`, `19-gap-finish.md` | Library; New menu; all create forms (HTML5/image, YouTube, video file, VAST video, VAST audio, audio file, bulk native site) with routes and validation messages; status & exchange review; format gallery; appeals |
| P1-09 | Inventory & Marketplace | ✅ | `09-inventory.md` | Orders/deals, packages, groups; deal page; instant deals; Featured & Discover; plans & negotiations lists |
| P1-10 | Audiences | ✅ | `10-audiences.md` | Tabs; create types; tag-based, combined, lookalike, custom affinity forms; analysis |
| P1-11 | Resources | ✅ | `11-resources.md` | Brand controls; channels; negative keywords; Floodlight; YouTube assets; location lists; custom bidding wizard |
| P1-12 | Reporting | ✅ | `12-reporting.md` | Hub, templates, instant builder, ~700-field catalogue, offline builder |
| P1-13 | Planning & reach planner | ✅ | `13-planning.md`, `19-gap-finish.md` | Plans list; New plan wizard (channels, location, dates, demographics, sub-location); editable plan (Adjust your plan panel, Add ad formats, Additional Settings); forecast page; Cross-media reach. Not seen: charts with data, plan → campaign |
| P1-14 | Advertiser settings | ✅ | `14-advertiser-settings.md` | Basic details (SDF, ad server, authorizations, EU political, Demand Gen Floodlight switch, 3P services); targeting rules; data manager; alert preferences (10 alerts); policy center certificates |
| P1-15 | Bulk, SDF, rules, experiments, optimisation | ✅ | `15-bulk-sdf-experiments.md`, `19-gap-finish.md` | SDF download/upload; bulk Action bar; custom charts; Intelligence (live alerts and suggestions); lift study; A/B create; targeting templates. Not seen: bulk edit side panels |
| P1-16 | Change history, notifications | ✅ | `16-history-notifications.md` | History page at advertiser/IO level (toggles, date range, day cards, old → new), notes panel, notifications, right rail |
| P1-17 | Gap sweep | ✅ | `17-gap-sweep.md` | Filled: image creative page, creative History, audience detail, Google tag tab, channel/keyword list editors, report runs, 404. Remaining gaps blocked by demo access — see file |
| P1-18 | Experiments (A/B + lift) | ✅ | `18-experiments.md` | A/B create/report/settings; lift study create (eligibility, required media cost, survey), report slices, review & fix |
| P1-19 | Gap finish (create access) | ✅ | `19-gap-finish.md` | Campaign → IO → LI chain for YouTube (+ ad group, ad), CTV, DOOH, App install, Video, Display; IO type/objective gating; LI picker rules; creatives; New plan; A/B create. Build requirements table in section 5 |

### Phase 2 — Specs and architecture (`docs/specs/`)
| ID | Task | Status | File | Notes |
|---|---|---|---|---|
| P2-01 | Data model | ✅ | `specs/data-model.md` | Entities, enums, RLS, change log, Prisma appendix |
| P2-02 | Route map | ✅ | `specs/routes.md` | Routes, navigation, layouts, API map |
| P2-03 | Design system | ✅ | `specs/design-system.md` | Tokens, MUI theme, 20 components, icons, fidelity checklist |
| P2-04 | Validation catalogue | ✅ | `specs/validation.md` | About 480 rules, matrices, state machines, TypeScript design |
| P2-05 | Simulation engine | ✅ | `specs/engine.md` | Tick, supply, funnel, bidding, auction, pacing, aggregation, tests |
| P2-06 | Module specs | ✅ | `specs/modules/` (18 files + README) | 231 build tasks |
| P2-07 | Build order, conflicts, prompts | ✅ | `specs/conflicts.md`, `specs/build-plan.md`, `decisions.md` | 67 conflict rows; 16 session prompts |

### Phase 3 — Foundation build (cloud sessions, `docs/specs/build-plan.md` section 3)
Production `https://dv360-adsmentor.vercel.app` (`/api/health` → ok, db true, version = main). Every PR gets a Vercel preview.
| Merge | Session | Status | PR | What |
|---|---|---|---|---|
| 1 | P3-01 | ✅ | #1 | Scaffold, CI (lint, typecheck, unit, db, e2e, secret scan), Vercel deploy, health route |
| 2 | P3-05a | ✅ | #2 | Core schema, RLS, `withChangeLog` |
| 3 | P3-04 | ✅ | #4 | UI kit (Tier A and B), gallery |
| 4 | P3-06a | ✅ | #3 | Validation core |
| 5 | P3-08a | ✅ | #8 | Engine core (pure) |
| 6 | P3-02 | ✅ | #7 | Auth, roles, access windows, `/sim` pages |
| 7 | P3-05b | ✅ | #6 | Seed generator |
| 8 | P3-05c | ✅ | #5 | Remaining 112 tables |
| 9 | P3-03 | ✅ | #9 | App shell |
| 10 | P3-07a | ✅ | #11 | Targeting card, state, 13 editors (flat category list), catalogue API, dev page `/targeting` |
| 10b | P3-07a follow-up | ✅ | #16 | Category tree, device OS and make/model, locked-row tooltip, targeting tests, `tests/e2e/targeting.spec.ts` |
| 11 | P3-06b | ✅ | #12 | Campaign and IO services, forms, lists, step 1 matrix, details pages, list and matrix API, `campaigns.spec.ts` |
| 11b | P3-06b leftovers | 🟨 | #18 (open) | Campaign page tabs/pin/chart strip, DLG-10 copy settings, DLG-11 stale save, inline budget editor, IO header, fee menu, `insertion-orders.spec.ts`. Built by a cloud session on the old branch after #12 merged, re-applied onto `main` as `p3-06b-leftovers`; 29 e2e and 2,580 unit tests pass locally |
| 12 | P3-06c | ✅ | #13 | Line item picker, form, grids, details page, API, service tests, archived list, e2e |
| 13 | P3-08b | ✅ | #15 | Engine runtime, tick endpoint, fast-forward, 5-minute timer |
| 14 | P3-09 | ✅ | #10 | Metrics layer behind the performance columns (merged before #15; list-page e2e cases were enabled by the line-item and campaign PRs) |
| 15 | P3-07b | ⬜ | | Geography, apps and URLs, brand suitability, audience builder editors |
| 15b | P3-02b | 🟨 | #14 (open) | `/manage` dashboard, REDUCED scope (cut 11): accounts, cohorts, audit |
| 16 | P3-INT | ⬜ | | Integration, demo path, gap list (last) |

### Known gaps to revisit
Filled by `19-gap-finish.md`: DOOH, app-install step 2, CTV and Video LI forms, YouTube ad group and ad, all creative forms, New plan and editable plan, A/B create. Still open (build from public docs):
- LI: Demand Gen (skipped by owner), Video DOOH form, YouTube audio, YouTube non-skippable / target frequency / TrueView / ad sequence step-2 variants.
- Targeting: video-only options; Apps & URLs sub-pages; IAS/Scope3 options.
- Partner: create advertiser, billing, role picker.
- Inventory: negotiation/RFP flow; deal group create.
- Audiences: custom intent; YouTube users.
- Resources: channel/keyword list create; app & CTV Floodlight forms; custom bidding Test step.
- Reporting: full Date/Fees/Conversions/YouTube lists; Inventory Availability builder; downloaded file layout.
- Planning: forecast charts with data; plan → campaign conversion; Copy dialog.
- Advertiser settings: other ad server options; Google tag Manage page; Link new account flows; Schedule for deletion dialog; targeting rules editors.
- Bulk/SDF/experiments: bulk edit Settings/Creative assignment panels; SDF Download step 2; Download metadata/QA outputs; A/B View report.
- History: Download file format.

## 5. Build details

### 5.1 Architecture
Authoritative: `docs/decisions.md` (ADR-006 to ADR-010 for the stack) and `docs/specs/build-plan.md` section 2 (repo skeleton, versions, CI).
| Layer | Choice |
|---|---|
| Framework | Next.js App Router + TypeScript; routes mirror DV360 (`/p/[partnerId]/a/[advertiserId]/cs`, `/c/[cid]/io/[ioId]/li/[liId]/details` …) |
| UI | MUI with DV360-like Material theme; Material Symbols |
| Tables | MUI X Data Grid / TanStack Table (column views, filter chips, bulk Action bar) |
| Charts | Recharts |
| Data | PostgreSQL + Prisma; synthetic seed generator |
| Jobs | GitHub Actions timer + lazy catch-up + server actions for simulation ticks (Vercel Hobby, ADR-048) |
| Auth | Auth.js; roles student / instructor / admin + DV360-style Standard / Read only / Reporting only |
| Tests | Vitest + Playwright |

### 5.2 Core data model
Authoritative: `docs/specs/data-model.md` (Appendix A is the Prisma schema) with the conflict rows of `docs/specs/conflicts.md` applied.
Partner · Advertiser · Campaign · InsertionOrder · BudgetSegment · LineItem · AdGroup · Ad · Creative · CreativeReview · CreativeAssignment · TargetingAssignment · Audience · Channel · KeywordList · LocationList · Exchange · Deal · Package · Order · InventorySource · FloodlightGroup · FloodlightActivity · CustomBiddingAlgorithm · Report · ReportRun · Plan · Experiment · BulkJob · ChangeLog · Alert · User · Role · Classroom · AccessWindow · Scenario · ScenarioAttempt · SimDailyMetric · DeliveryDiagnostic.

### 5.3 Business rules captured (examples)
Authoritative: `docs/specs/validation.md` (rule ids, matrices, state machines) and the module files in `docs/specs/modules/`.
- Campaign goal → recommended KPIs; non-recommended KPI = warning only.
- IO type + objective gate KPIs, bid strategies and LI types (CTV disables Clicks; DOOH only "no objective" + fixed bid).
- New IO/LI default Draft; required: name ("Enter a value"), budget > 0, KPI value > 0 ("Enter a number greater than 0"), creative type, EU political ads answer.
- Pacing Flight (Ahead/Even) or Daily (Even/ASAP); IO automated bid & budget forces LI ASAP.
- Frequency caps nest campaign → IO → LI.
- Creatives serve only on exchanges where approved; geo restrictions block matching LIs.
- Audiences available after 4 h (combined immediately); lookalike seed ≥ 1,000 users.
- Floodlight counting: Standard / Unique / Per session / Transactions / Items sold.

### 5.4 Simulation engine
Authoritative: `docs/specs/engine.md`.
1. Tick = 1 simulated hour; speed set by instructor.
2. Bid opportunities per exchange × geo × device × environment × audience from synthetic supply.
3. Each active LI passes the Troubleshooter funnel: Targeting → Creatives → Frequency → Budget → Pacing → Min bid → Internal auction → External (bid too low / creatives / other) → Won.
4. Bid from strategy (fixed CPM, maximise clicks/conversions/reach, target CPA/CPM, custom bidding score × multipliers).
5. Wins → impressions, viewability, clicks, video quartiles, Floodlight conversions (lag, counting, attribution window), costs incl. fees.
6. Write SimDailyMetric + DeliveryDiagnostic → list columns, chart cards, alerts, Troubleshooter, reports.

### 5.5 Build order
Authoritative: `docs/specs/build-plan.md` (waves, ownership, merge order, session prompts, risks). The table below is the summary.
| Phase | Tasks |
|---|---|
| P2 Specs | data model, routes, design system, validation catalogue, engine spec, module specs, cloud-session prompts |
| P3 Foundation | scaffold + Vercel; auth/roles/access windows; app shell; shared components; data model + seed; Campaign→IO→LI CRUD + validation; targeting panel; engine v1; performance columns |
| P4 Modules | creatives; inventory/marketplace; audiences; resources; custom bidding; YouTube; reporting; planning; settings/users; bulk/SDF/experiments; optimisation & alerts; change history |
| P5 Training | instructor console; scenarios + auto-checks; time acceleration; progress dashboard |
| P6 QA & launch | fidelity review; E2E tests; load test; pilot; launch |

### 5.6 Spec index
| File | Covers |
|---|---|
| `specs/data-model.md` | Entities, enums, multi-tenancy, seeding, change log, Prisma schema |
| `specs/routes.md` | URL map, navigation trees, layouts, API and server action map |
| `specs/design-system.md` | Tokens, theme, components, icons, accessibility, fidelity checklist |
| `specs/validation.md` | Rules, messages, matrices, state machines, validation library design |
| `specs/engine.md` | Simulation engine design and tests |
| `specs/modules/01..18` | One build spec per product area (screens, data, behaviour, acceptance, tasks) |
| `specs/conflicts.md` | Conflicts between specs and how they were resolved; owner decisions |
| `specs/build-plan.md` | Owner prerequisites, repo skeleton, waves, ownership, prompts, risks |

## 6. SOPs in use
- Explore: open section → record path → capture views, tables, forms, actions → write explore file → tick checklist.
- Safety: read-only exploration; forms discarded; no real names/emails copied.
- Status: each task → checklist tick + status row + commit `docs: status <task-id>`.

## 7. Open questions
Full list with defaults: `PROJECT.md` section 11 and `docs/specs/conflicts.md` section 3 (owner decisions). Answered on 2026-10-28: stack and plan, database (Supabase), cron and Vercel plan, vendor names, logo, repo visibility, class size, merge authority (D14 to D21).
1. Cloud environment `dv360-build`, usage-credits toggle, $100 balance, parallel session limit (P-02, P-12). Blocks P3-01.
2. Vercel project import into Hobby, no upgrade needed now (P-03); Supabase URLs into Vercel env vars (P-04); GitHub Actions secrets (P-06); `AUTH_SECRET` and `CRON_SECRET` into Vercel (P-07). Preview deploys wait for these.
3. Reference screenshots are not in the repo (`docs/screenshots/` is empty); design-system Q1 stays open (P-09 partly done).
4. One sandbox per student (assumed, RC-061); canned Tutor (RC-054); billing deferred (RC-062); student accounts, uploads and retention (RC-063 to RC-065).
5. Existing exercises to turn into scenarios (default: the 10 starters in module 18).
6. Access to an IO without objective and a Floodlight-optimised advertiser to finish the LI gaps (still open from Phase 1).

## 8. Next steps
See section 9 (handover). Short version: merge the open PRs in order, run P3-07b, P3-INT, then the visual fidelity pass in the browser (SOP-3), then Phase 4.

## 9. Handover (2026-10-29)

Written when the previous colleague's machine crashed and the work was picked up in a Claude Code cloud session (session `session_015aSPDgNBbTZ9vGkZzju7g3`). Owner is Kailas (Adsmetor). Whoever continues: read this section first, then `PROJECT.md` section 6 and 10.

### 9.1 Where the code stands
- `main` holds Phases 0 to 2 (all exploration and specs) and Phase 3 through P3-06c: scaffold, auth and roles, app shell, UI kit, full schema and seed, validation library, engine core, targeting card (basic editors), campaigns, insertion orders and line items (UI plus services).
- A user can sign in, open an advertiser, create a campaign, then an insertion order, then a Display line item, see them in the lists and change status. This path is covered by Playwright (`tests/e2e/campaigns.spec.ts`, `tests/e2e/line-items.spec.ts`) and passes locally.
- Performance columns show zeros until PR #10 (P3-09) merges. Campaigns do not "run" until PR #15 (engine runtime) merges and a timer or the fast-forward calls the tick endpoint.

### 9.2 Open pull requests and merge order
Merge each with Squash and merge after green checks and a ready Vercel preview. After each merge the next PR usually conflicts in `PROJECT.md` (the status table); resolve by keeping both sides' rows (merge `main` into the branch, keep every row, push).
1. #19 fix for a flaky db test (see 9.3b); `main` db-tests have been red since #15 without it
2. #14 P3-02b `/manage` (reduced scope)
3. #18 P3-06b follow-up
4. #17 this log
After #19 is merged, the `db-tests` check on #14, #18 and #17 fails or passes on stale code: click "Re-run all jobs" (Actions tab) or push an empty commit to re-trigger.
(Already merged: #10 P3-09, #15 P3-08b, #16 P3-07a follow-up. After #15 the engine code is on `main` but the 5-minute timer needs the owner secrets, see 9.5.)
Note: the assistant's attempt to merge by API was blocked by the permission classifier; merges were done by the owner in the browser. ADR-046 allows an assistant to merge, but only if the session is allowed to.

### 9.3 What is done and what is not, by area
Done and merged: see the merge table in section 4. Not done (each is also in the relevant PR body under "Not done"):
- **Targeting (P3-07):** editors for geography (map, radius, location lists), apps and URLs, brand suitability and third-party verification, audience builder are P3-07b. Video-only, audio, DOOH and YouTube ad group editors are Phase 4. The targeting card exists, but `toLiTargetingInput` is not yet wired into every validation call.
- **Campaigns and IOs (P3-06b):** leftovers in row 11b. Still missing after that: bulk bar, duplicate, SDF, Alerts page, History tab content, Combined tab content, saved column views, chart card data (all Phase 4 / modules 05, 06, 11).
- **Line items (P3-06c):** Demand Gen is a shell. Conversions panel and copy-settings UI exist but are untested. YouTube line items, ad groups, Troubleshooter, forecast, bulk are Phase 4. Inventory shows a count only (no exchange picker).
- **Account management (P3-02b):** reduced scope only. CSV import, access-period page, settings page and the audit viewer are not built.
- **Engine (P3-08b):** runtime exists in PR #15. The history stub in the seed (closed-form 90 days) is still what the lists show until `engine.fastForward` replaces it in P3-INT.
- **Phase 4 (P4-01 to P4-12), Phase 5, Phase 6:** not started.
- **Owner prerequisites still open:** P-02 cloud environment `dv360-build`, P-12 usage-credits toggle off and $100 balance, P-03 Vercel import, P-04 Supabase URLs in Vercel, P-06 GitHub Actions secrets, P-07 `AUTH_SECRET` and `CRON_SECRET` in Vercel. Check https://dv360-adsmentor.vercel.app/api/health: `db: true` means P-03/P-04 are done. Nobody can sign in on production until the first Super admin is bootstrapped (`npm run db:bootstrap`, needs the production URLs; run it only with the owner).
- **Reference screenshots** are still not in `docs/screenshots/`.

### 9.3b Test failures reported but not confirmed
- Two cloud sessions (P3-08b, P3-07a leftovers) reported "two pre-existing component gallery axe failures" in `npm run check`. They did NOT reproduce: on `main` after #10 (commit `26cfe31`) a clean `npm ci` and `npm test` gave 79 files, 2,575 tests passed, all component gallery axe checks green. Likely causes: a flaky timeout under load (the slowest gallery entries take 2 to 4 seconds) or a stale generated Prisma client in that container. If they show up in CI, run `npx vitest run --project components tests/components/gallery.test.tsx` and read the first failing entry.
- PR #14 (P3-02b) e2e failure: RESOLVED. Cause: `tests/e2e/auth.spec.ts` "a super admin opens everything" still expected the Super admin landing at `/sim/admin`; module 19 sends Super admins to `/manage/accounts`. The test was updated in #14 (commit `test(p3-02b): super admin now lands on /manage/accounts`). The full Playwright suite (72 tests) passed locally apart from that one.
- `db-tests` red on `main` after #15 (and so on #14, #18): `tests/engine-io/alerts.db.test.ts` was flaky (about 1 run in 3). It picked a random line item or IO (cuid order) from any advertiser of the sandbox, but `persist()` loads only the first advertiser world, so for the other advertiser the alert got null campaign and IO ids. Fixed in #19 (test only, 8 of 8 local runs pass). If other engine-io tests fail intermittently, look for the same pattern: entities not taken from `worlds[0]`.
- ESLint reports "unnecessary type assertion" in several earlier files only in some installs; `eslint --fix` is safe (it removes casts that do not change the type).

### 9.4 Run it locally (verified in the cloud container)
```bash
npm ci
npm run db:local          # embedded Postgres on 54329, creates dv360_dev and dv360_test; leave it running
export DATABASE_URL_TEST="postgresql://postgres:postgres@127.0.0.1:54329/dv360_test"
export NODE_OPTIONS=--max-old-space-size=8192   # eslint runs out of memory otherwise
npm run check             # lint, typecheck, depcruise, unit and component tests
npm run test:db           # needs DATABASE_URL_TEST
export AUTH_TRUST_HOST=true AUTH_SECRET=anylongrandomstring PLAYWRIGHT_CHROMIUM_PATH=<path to chrome>
npx playwright test tests/e2e/campaigns.spec.ts   # builds and starts the app on 3100
```
Notes: e2e specs create synthetic students with `createShellWorld` (`tests/shell/e2e-world.ts`); a bare sandbox has no exchanges (line item create needs one, see `line-items.spec.ts`). The repo is cloned single-branch in cloud sessions; fetch other branches with an explicit refspec.

### 9.5 Gotchas learned
- Lint errors "unnecessary type assertion" appear in some earlier files in a fresh install; `eslint --fix` is safe.
- PROJECT.md conflicts on every merge (see 9.2).
- Squash merge makes `git rev-list main..branch` look ahead even when the content is merged; compare with `git diff --shortstat main branch`.
- Cloud sessions that keep pushing to a branch after its PR is merged create orphan work; always open a new PR for it.
- Do not enable the engine timer (`.github/workflows` tick) before `CRON_SECRET` and the production URL secret exist (ADR-048).
- Auth.js needs `AUTH_TRUST_HOST=true` on any non-Vercel host.

### 9.6 Cloud sessions run on 2026-10-29 (for reference)
P3-08b `session_015aSPDgTzqhaFz9Hw7J7hJm`, P3-02b `session_015aSPDiDmdiB1GXwZ7Yumyf`, P3-06c leftovers `session_015aSPDjpp4jtMW9oDYffHqf`, P3-06b leftovers `session_015aSPDk42JgrUnio2uaw3LY`, P3-07a leftovers `session_015aSPDhhdQYGo8MF8842gx5`. Each follows the prompt of its id in `docs/specs/build-plan.md` section 4.

### 9.7 State at the end of the 2026-10-29 shift (read this first)
Merged on `main`: everything in the section 4 merge table through P3-06c, plus P3-02b (#14, reduced scope), P3-07a follow-up (#16), P3-06b follow-up (#18), P3-08b engine runtime (#15), P3-09 metrics (#10), the flaky-test fix (#19) and this log (#17). No PR from the cloud sessions of this shift is waiting for merge except the two below, which are still running and have not opened PRs yet.

Cloud sessions still running when the shift ended (check them at claude.ai/code, they open their own PR when done; they were told not to merge anything):
- **P3-07b** `session_015aSPDm2QM2GFY9PtGmWxE2`, branch `p3-07b-targeting-advanced`: geography, apps and URLs, brand suitability, audience builder editors.
- **P3-INT** `session_015aSPDiYiutbKwmJ1j3Nii1`, branch `p3-int-integration`: demo path, `docs/demo-script.md`, `docs/gaps/p3.md`, `tests/e2e/demo-path.spec.ts`, `/sim/admin/seed`, engine fast-forward in provisioning, cross-session fixes. It was started before 07b merged and was told to merge `main` again before finishing.
If either session stopped without a PR, look at its branch on GitHub: `git log origin/<branch>` shows what it pushed; open a PR from it after merging `main` into it (resolve `PROJECT.md` by keeping both sides' rows).

### 9.8 Next steps in order
1. Check the two sessions above; review and merge their PRs (Squash and merge after green checks; if `main` moved, merge it into the PR branch first). If `db-tests` fail intermittently see 9.3b.
2. Owner items (Kailas): P-02, P-12 (usage credits off, $100 balance, expires 5 Nov 2026 1:29 PM IST), P-03 Vercel import, P-04 Supabase URLs into Vercel, P-06 GitHub Actions secrets, P-07 `AUTH_SECRET` and `CRON_SECRET`. Then check https://dv360-adsmentor.vercel.app/api/health and create the first Super admin (`npm run db:bootstrap`, with the owner). Do not enable the engine timer before the secrets exist (9.5).
3. Visual fidelity pass in the browser (Claude in Chrome, Edge): demo DV360 account next to the simulator; SOP-3, `docs/explore/`; screens: Campaigns list, New campaign, New insertion order, New line item, targeting card. Turn each difference into a task for a cloud session. This cannot be done from a cloud session.
4. Phase 4 waves (build-plan 3.7), starting from `docs/gaps/p3.md` once P3-INT has written it.
5. Deadlines: merge freeze 5 Nov 9:00 AM IST, credit expiry 5 Nov 1:29 PM IST (PROJECT.md section 8).

### 9.9 Midway handover (2026-10-29, later the same day)

Written because the owner's machine was about to die again. Read this before 9.7 and 9.8; it supersedes them where they differ.

**State of the two "still running" sessions from 9.7:** they were not reachable from the new orchestrating session (session ids not found) and never pushed branches `p3-07b-targeting-advanced` or `p3-int-integration`. No PR was open. They were restarted.

**Cloud sessions started 2026-10-29 by the orchestrating session `session_01U5x4qd6PdBx1h6JDoh6p6w` (all running at 10:56 UTC, none has a PR yet; they were told not to merge):**

| Session | Branch | Scope | Session id |
|---|---|---|---|
| P3-07b | `p3-07b-targeting-advanced` | prompt = build-plan 4.15 | `session_01U5x4qbsbfEduWBEhD1yXVF` |
| P4-01 | `p4-01-creatives` | module 12, M12-01..14, storage behind an interface (Blob not set up) | `session_01U5x4qgEFiy9vvVV3Rgqq96` |
| P4-04 | `p4-04-resources` | module 15, M15-01..07 and 09 (not custom bidding M15-08) | `session_01U5x4qdxh3ujTsufSWCckkR` |
| P4-09 | `p4-09-settings` | modules 02 T3..13 and 03 T1..10, no duplication of /manage | `session_01U5x4qdvsuNHU8hSti5Y44S` |

P4 sessions had no ready prompts; each writes its own scope from its module file (build-plan 3.7).

**Next steps for whoever continues, in order**
1. Find the PRs of the four sessions above (`gh api repos/iam-knr/dv360-adsmentor/pulls?state=open`; GraphQL is blocked, use REST). If a session stopped without a PR, open one from its branch after merging `main` into it. Squash and merge once checks are green; `PROJECT.md` conflicts: keep both sides' rows.
2. Start **P3-INT** (build-plan 4.16) only after P3-07b is merged. It was NOT restarted yet.
3. After wave 6 merges, start wave 7 (build-plan 3.7): P4-03 audiences (module 14), P4-02 inventory (module 13), P4-06 YouTube (module 09), P4-05 custom bidding (M15-08). Then wave 8 and 9.
4. Owner checklist (Claude Doc "DV360 Simulator: owner setup checklist", https://claude.ai/artifact/AGiitpnrLq1PpHWPtY7Na5): credits toggle off (do first), Vercel import, Supabase strings, `AUTH_SECRET`/`CRON_SECRET`, GitHub Actions secrets, Blob store, health check, fidelity check in Edge. None of it is confirmed done as of this entry.

**Corrections to earlier notes**
- `CRON_SECRET` is generated with `openssl rand -hex 24`; `AUTH_SECRET` with `openssl rand -base64 32`.
- The tick endpoint is `/api/sim/engine/tick` (code and `.github/workflows/engine-tick.yml`); build-plan 1.5/1.6 still say `/api/engine/cron`, which is wrong.
- `scripts/vercel-build.sh` runs `prisma migrate deploy` and the idempotent bootstrap on every Vercel build, so with `SEED_SUPER_ADMIN_EMAIL`/`SEED_SUPER_ADMIN_PASSWORD` set in Vercel a redeploy creates the first Super admin; `npm run db:bootstrap` by hand is only a fallback.
- The engine timer switches on when the Actions secret `ENGINE_CRON_URL` exists (the workflow skips quietly without it). Add that secret last, after `/api/health` shows `db: true`.

**Environment notes:** cloud sessions cannot merge via GraphQL; use REST. `add_repo` with `access: push` is needed to push from a new orchestrating session. Deadlines unchanged: merge freeze 5 Nov 9:00 AM IST, credit expiry 5 Nov 1:29 PM IST.

### 9.10 State after the second crash (2026-10-29, evening)

Checked on `main` at commit `93cd27b` by the assistant that took over: CI green; local `npm run check` (3,032 unit and component tests), `npm run test:db` (505) and the full Playwright suite (113) all pass. Merged since 9.9: P3-07b (#22), P3-INT (#25: demo path, `/sim/admin/seed`, gap list `docs/gaps/p3.md`), P4-01 creatives (#23), P4-09 settings (#24), P4-04 resources (#27). The live site could not be reached from the cloud container (no network to vercel.app); check https://dv360-adsmentor.vercel.app/api/health in a browser.

Unfinished branches left by the crash (their sessions died; none had a PR): `p4-02-inventory` (services, rules, seed; no UI), `p4-06-youtube` (rules, constants, migration 0005; no UI), `p4-07-reporting` (empty). Note two migrations share the prefix 0004 on `main` (`0004_creatives_ext`, `0004_settings_contacts`); they apply in name order and CI passes, but check that `0005_youtube_ad_groups` still applies after merging `main`.

Cloud sessions started by the assistant (all running at 13:46 UTC, none with a PR yet; told not to merge):
| Session | Branch | Scope | Session id |
|---|---|---|---|
| P4-02 | `p4-02-inventory` | UI on the existing services (module 13) | `session_015aSPDhDx1nyQJRZjsWiM14` |
| P4-06 | `p4-06-youtube` | YouTube LI, ad groups, ads UI (module 09) | `session_015aSPDjCoNNHz4iu92kjD8P` |
| P4-07 | `p4-07-reporting` | reporting (module 16) | `session_015aSPDjmCma4XJnZ3GxkE25` |
| P4-03 | `p4-03-audiences` | audiences (module 14) | `session_015aSPDiUfaiMEJSmJFP4XnF` |

Still not started: P4-05 custom bidding, P4-08 planning, P4-10 bulk/SDF/experiments, P4-11 optimisation/alerts, P4-12 history/notifications, all of Phase 5 and 6. Owner items unchanged (9.8 step 2 and the owner checklist in 9.9). The PROJECT.md Phase 4 checklist was corrected (P4-01, P4-04, P4-09 done).

---

# Part B — Master plan (formerly PROJECT.md)

## DV360 Simulator by Adsmetor — Master Project Plan

> Single source of truth for the project: goals, rules, SOPs, full module scope, architecture, phase-by-phase action plan, checklist, decisions and status.
> **Update this file after every completed task** (see §10 Status Log).

| Field | Value |
|---|---|
| Product name | DV360 Simulator by Adsmetor |
| Purpose | Training simulator that replicates Display & Video 360 so FREE students practise real programmatic workflows (a lead-gen and training funnel; paying Ads Mentor students use the real DV360, owner decision 2026-10-28, ADR-048) |
| Reference source | Vendor-provided **demo** DV360 account (no live spend; full create/edit/activate allowed for exploration) |
| Target fidelity | 100% — every section, screen, option and workflow of DV360 |
| Doc owner | Kailas Nath R (Adsmetor) |
| Created | 2026-10-28 |
| Current phase | **Phase 3 ready (owner prerequisites P-02/P-03/P-04/P-06/P-07/P-12 open)** |

---

### 1. Goals

1. Students experience DV360 exactly as they would on the job: same navigation, screens, forms, options, validations and workflows.
2. Everything is **functional**, not just visual: creating a line item validates like DV360, targeting changes affect delivery, reports reflect what the simulated campaigns did.
3. A **simulated ad-serving engine** makes campaigns "run" (impressions, clicks, conversions, spend, pacing) so students can optimise and troubleshoot.
4. Instructors control **when** students have access (classroom sessions only) and can run guided exercises.

#### Non-goals
- No connection to real Google systems, real exchanges or real money.
- No real client or advertiser data — all data is synthetic.

---

### 2. Agreed Rules (from discussion, 2026-10-28)

| # | Rule |
|---|---|
| R1 | Branding is **"DV360 Simulator by Adsmetor"**. Google Account sign-in screens are not reproduced; the simulator uses its own Adsmetor login. **Owner decision 31 Oct 2026:** the header uses the DV360 product mark (`public/brand/dv360-logo.png`, supplied by the owner) with the word "Simulator" next to it and a small "by Adsmetor" byline below (`components/brand/BrandLogo.tsx`); legal clearance for the mark stays with Adsmetor (R3). |
| R2 | UI/UX, layout, navigation, fields and workflows replicate DV360 as closely as possible. The code is written from scratch (no copying Google's source code, scripts or image assets). Icons come from the open-source Material Symbols set. |
| R3 | Access is **classroom-only**: instructor opens/closes access per session; no take-home access. Legal clearance is handled by Adsmetor. |
| R4 | The demo account may be freely explored, including create / edit / save / activate / pause, to observe real behaviour. |
| R5 | No real-looking client data is copied. Names, IDs, budgets and metrics in the simulator are generated. |
| R6 | Every exploration finding goes into `docs/explore/*.md` before it is built. Nothing is built from memory alone. |
| R7 | Exploration and planning run in Cowork (normal plan limits). The **build runs in Claude Code cloud sessions** (uses the $100 cloud credit, expires **5 Nov 2026, 1:29 PM IST**). |
| R8 | **No project files are stored on the local PC.** Everything (docs, explore notes, screenshots, code) lives only in the GitHub repo `iam-knr/dv360-adsmentor`. Local exploration sessions hand content to cloud sessions, which commit it. |

---

### 3. Tooling & Workflow

| Need | Tool |
|---|---|
| Explore DV360 demo account | Claude in Chrome (account signed in there) |
| Store docs + code | GitHub repo `iam-knr/dv360-adsmentor` (public) |
| Commit files | Claude Code cloud sessions on that repo (GitHub connector) |
| Build | Claude Code cloud sessions on that repo (claude.ai/code) |
| Hosting | Vercel (preview deploy per branch, production on `main`) |
| Database | Supabase PostgreSQL (existing project, eu-west-1, free tier; Postgres only; ADR-040) |

#### Repo layout
```
dv360-adsmentor/
├─ PROJECT.md                 ← this file
├─ docs/
│  ├─ brand/                  ← Adsmetor logo: docs/brand/adsmentor-logo-horizontal.png (836×257 PNG; copied to public/brand/ by P3-01)
│  ├─ explore/                ← one file per DV360 section (screen inventory)
│  ├─ specs/                  ← build spec per module (derived from explore/)
│  ├─ screenshots/            ← reference captures (synthetic/demo data only)
│  └─ decisions.md            ← architecture & design decisions (ADR log)
├─ app/                       ← Next.js routes (mirrors DV360 URL structure)
├─ components/                ← shared UI (tables, forms, side panels, dialogs)
├─ lib/
│  ├─ engine/                 ← simulated auction / delivery / pacing engine
│  ├─ validation/             ← DV360 business rules
│  └─ reporting/              ← metrics aggregation, report builder
├─ prisma/                    ← DB schema + seed data
└─ tests/                     ← unit + Playwright end-to-end tests
```

---

### 4. SOPs

#### SOP-1: Exploring a DV360 section
1. Open the section in the demo account. Record the navigation path (e.g. *Advertiser → Campaigns → Line items*).
2. Capture every **view**: list/table, detail page, side panel, dialog, empty state, error state.
3. For each table: all columns, default columns, column picker options, filters, sort, bulk actions, row actions, pagination, download.
4. For each form: every field, type, default, allowed values, dependencies (field X appears when Y), validation messages, save/cancel behaviour.
5. Perform the main actions (create, edit, duplicate, activate, pause, archive, delete) and record what changes and where.
6. Note status values, badges, warnings, tooltips (paraphrase; don't copy long help text verbatim).
7. Save as `docs/explore/<NN>-<section>.md` using the template below. Mark the section ✅ in §6.

**Exploration file template**
```md
# <Section name>
Path: <navigation path>   Level: Partner | Advertiser | Campaign | IO | LI
## Views
## Tables (columns / filters / actions)
## Forms (field | type | default | options | rules)
## Actions & state changes
## Dependencies on other modules
## Open questions
```

#### SOP-2: Building a module
1. Write `docs/specs/<module>.md` from the explore file (data model, routes, components, rules, test cases).
2. Start a cloud session on the repo with prompt: *"Read PROJECT.md and docs/specs/<module>.md. Implement it. Write tests. Update PROJECT.md checklist and status log."*
3. Review the Vercel preview link side-by-side with DV360.
4. Log differences as tasks; fix; merge to `main`.
5. Update §6 checklist and §10 status log.

#### SOP-3: Fidelity review (per module)
- Side-by-side check: layout, labels, field order, defaults, validation messages, table columns, empty states.
- Functional check: same inputs → same outcome as DV360.
- Pass = ≥ 95% items match; remaining gaps logged.

#### SOP-4: Status updates
After every task: tick the checklist item, add one line to §10 (date, task ID, result, next step), commit with message `docs: status <task-id>`.

---

### 5. Complete Module Map (scope)

> Built from current knowledge of DV360. **Every item is verified (and gaps added) during Phase 1 exploration.** Nothing is out of scope.

#### 5.1 Global shell
- Top bar: product name, Partner/Advertiser switcher with search, global search, notifications/alerts, help, settings, user menu
- Left navigation (changes by level: Partner / Advertiser)
- Breadcrumbs, entity status chips, date-range picker, "Compare" toggle
- Change history panel, notes/comments, recently viewed
- Ask Advisor (AI chat assistant panel), Quick help panel, Intelligence panel (advertiser health + optimisation suggestions)
- Partner Overview home page with workspaces, tutorials, pinned items, recently opened
- Bulk status page (history of bulk jobs)
- Keyboard shortcuts dialog

#### 5.2 Partner level
- Advertisers list (create, edit, archive, columns, filters)
- Partner settings: basic details, currency, time zone, ad-serving defaults, exchange settings (enable/disable exchanges, seat IDs), default targeting, brand safety defaults
- Users & access (global page /users): roles seen Standard, Read only, Partner client, Reporting only (Admin, Creative per Google docs); per-partner/advertiser role assignment
- Partner-level channels, inventory lists, location lists, negative keyword lists
- Partner-level audiences, combined audiences, custom lists
- Billing: billing profiles, invoices
- Partner costs & revenue models
- Partner reporting
- Partner brand controls (Display & video / YouTube tabs, per-advertiser coverage bars)
- Advertiser configurations (Enhanced automation, Product improvement, Google & partner inventory, YouTube guaranteed instant deals, Auto-tagging, Advanced ad serving)
- Cross-media reach reports (partner + advertiser)
- Email preferences: Alerts; News, announcements and offers

> Scope note (RC-062, RC-066): the demo partner nav has no pages for billing, invoices, partner costs and revenue models, or for partner-level audiences, combined audiences, custom lists, location lists and negative keyword lists, and routes.md has no routes for them. They are not built in Phases 3 and 4. Billing is deferred past Phase 4 (task 02-T14); the owner confirms this scope cut (build-plan 1.9).

#### 5.3 Advertiser level — Campaigns
- **Campaigns**: list, create/edit (name, goal, KPI, planned spend, flight dates, frequency cap, creative types, inventory source types, demographics/geo defaults), statuses
  - Campaign page: own nav (Campaign, Inventory ▸ My inventory/Marketplace/Negotiations, Campaign settings, Alerts, History), tabs Combined / Insertion orders / Line items, chart cards, saved column views, Alerts page (Critical / Needs attention)
- **Insertion Orders**: 2-step create (type Standard / CTV & OTT / DOOH → objective Brand awareness / Clicks / Conversions / Custom / without objective, which gates KPIs, bid strategies and LI types), then name/status (Draft/Active), budget type + segments, pacing (Flight/Daily × Even/Ahead/ASAP), KPI, optimisation (automate bid & budget at IO level vs control at LI level, auto budget allocation), frequency cap, partner costs (CPM / media fees), integration code; IO page tabs Line items / Insertion order details / History; bulk edit, duplicate, archive
- **Line Items** — all types:
  - Display, Video, Audio, YouTube & partners (incl. Video reach / action / view / Demand Gen variants), Connected TV, Over-the-top, Mobile app install, Mobile app engagement
  - Tabs/sections: basic details, flight & budget, pacing, bid strategy (fixed CPM, maximise conversions/clicks, target CPA, target ROAS/custom bidding, viewable CPM), creatives assignment, frequency cap, conversion tracking (Floodlight), partner costs, revenue model, optimised targeting
  - Line item page tabs: Line item details / Troubleshooter (delivery funnel: available requests → filtered → eligible → bids → auction → won) / History
- **Ad groups / ads** (YouTube line items)
- Bulk tools: bulk edit, duplicate, upload/download **Structured Data Files (SDF)**, rules/automation
- **Experiments**: A/B tests (2–n arms of IOs or LIs, audience split, control arm, measurement goal, 90/95% confidence, exclude unidentified users, optional brand lift) and Lift studies (Brand lift / Search lift, eligibility + required media cost, survey metrics ≤3, competitors, object type, intended action, study strength, report with absolute/relative/headroom lift and slices)
- **Optimisation**: recommendations, optimisation score, alerts & troubleshooting (e.g. "line item not spending" diagnostics)

> Scope note (RC-066): there is no separate Over-the-top line item type (OTT is Connected TV plus device targeting). YouTube subtypes are Reach, Target frequency, TrueView views and Ad sequence (explore 06), not Reach/action/view. There is no Rules page (explore 15). Experiments are module 17, bulk and SDF are module 11.

#### 5.4 Targeting (shared panel used at IO / LI / ad group)
Geography (incl. radius, location lists, postal codes) · Language · Demographics (age, gender, parental status, household income) · Audience lists (first-party, Google, affinity, in-market, custom, combined, lookalike) · Device type, make/model, OS · Browser · Connection speed · Carrier & ISP · Environment (web, app) · Day & time · Viewability · Position (above/below fold, video player size, in-stream/out-stream) · Content (genres, categories, keywords, negative keywords) · Brand safety (digital content labels, sensitive categories, third-party verification: IAS, DoubleVerify, etc.) · Apps & URLs / channels · Inventory sources (exchanges, deals, groups) · Audio/video content duration, livestream · Native & rewarded · Targeting expansion

#### 5.5 Creatives
- Library: list, filters, review/approval status (pending, approved, disapproved per exchange)
- Create: standard display (upload image), HTML5 (zip), native (image/video), video (hosted, VAST), audio, third-party tags (display/VAST), bulk upload
- Creative details: dimensions, landing URL, tracking (impression/click trackers), integrations (Campaign Manager 360 sync), expansion, MRAID, SSL
- Preview, assignment to line items, creative QA errors
- Format gallery (Optimized, Native display, Native video, Parallax, Swirl…)
- Appeal history
- Creative status: DV360 review + per-exchange review + restrictions + LI eligibility

#### 5.6 Inventory
- **My inventory**: deals (Private Auction, Preferred, Programmatic Guaranteed), groups, sites/apps lists
- **Marketplace**: publisher catalog, proposals & negotiation flow (send RFP, accept/decline), packages, Programmatic Guaranteed setup
- Inventory sources: open exchanges list & settings
- ads.txt / sellers.json indicators
- Instant deals (pick exchange/publisher → name, targeting, advertiser access → forecast → accept)
- Marketplace Featured (curated package collections, bulk assign) and Discover (AI/keyword search + faceted filters, package detail with scale charts)
- Orders → deals hierarchy in My inventory; deal page tabs Overview / Access / Settings / History

#### 5.7 Audiences
- Audience list: types, sizes, match rates, status
- First-party: Floodlight remarketing lists, Customer Match uploads, YouTube users
- Google audiences: affinity, in-market, life events, detailed demographics
- Combined audiences, custom audiences (interest/intent), lookalike lists
- Audience size estimates in targeting
- Custom lists: Custom affinity, Custom intent (Display/Video), Custom intent (YouTube)
- Analysis: Geographic distribution (seed audience) and Audience insights (LIs with optimized targeting)

#### 5.8 Resources
- Channels (site/app lists), keyword lists, negative keyword lists, location lists
- Floodlight: groups, activities, tags, conversion counting methods, custom variables
- Linked accounts (CM360, Google Analytics, Google Ads, YouTube)
- Third-party verification setup
- Custom bidding algorithms (script / goal-based), with training status
- Brand controls overview (coverage of exclusions, authorized sellers, verification across LIs)
- YouTube assets (Location, Affiliate location, Sitelink)
- YouTube creator partnerships (BETA: Overview, Creator search, Content discovery, Management, Analytics)
- Custom bidding v2 wizard: objective → rules (score) + up to 4 multipliers → Test → Save

#### 5.9 Reporting
- **Instant reports**: dimensions & metrics picker, filters, date ranges, pivoting, charts, save/schedule, export CSV/XLSX
- **Offline reports** (classic Report Builder): types Floodlight, Inventory Availability; template, filters, dimensions, metrics, schedule (repeats, time zone, start/expiry), delivery (format, file name, email owner, share)
- In-UI performance columns & graphs on every list page
- Insights: reach & frequency, audience/demographic insights, brand lift (survey simulation)
- Generate report (BETA, AI natural-language report creation)
- Report field catalogue (~30 categories, ~700 fields) — see docs/explore/12-reporting.md

> Scope note (RC-066): field counts are plans. Module 16 plans about 830 fields in 34 categories; the catalogue test asserts at least the counts seen in the demo.

#### 5.10 Planning
- Planner / Plans (forecasting reach, impressions & cost for a plan, converting plans to campaigns)
- Reach planner

> Scope note (RC-066): Planner / Plans and Reach planner are one page in DV360 (explore 13). One module (04), one page.

#### 5.11 Advertiser settings
Basic details (name, URL, industry, currency, time zone) · Ad serving (CM360 link) · Creative settings (OBA icon, Dynamic creatives) · Floodlight config · Linked accounts · Billing · Targeting defaults · Brand safety defaults · Data access/Integrations

> Scope note (RC-066): Advertiser settings follow explore 14: Basic details, Targeting rules, Data manager, Alert preferences, Policy center. The demo shows no OBA icon, Dynamic creatives or Billing pages. `industry` is an optional field on Create advertiser only (module 03).

#### 5.12 Admin, history & misc
- Change history (per entity: who, when, field, old → new)
- Notifications & alerts centre
- Help panel (Adsmetor-written learning tips instead of Google help text)

#### 5.13 Simulator-only features (Adsmetor layer)
- **Simulation engine** (§7.3): time acceleration (1 day = N minutes), auction, pacing, metrics
- **Instructor console**: open/close classroom access, create class & student accounts, reset sandboxes, load scenarios, view student progress
- **Account management dashboard (super admin / admin / user)**: separate `/manage` area (spec: `docs/specs/modules/19-account-management.md`). Super admin (owner) and Admin (instructor) add accounts by email with a password they set or generate and share by hand; Admins manage only their own Users. Cohorts, CSV import, access periods, audit log, lockout and session policy
- **Scenarios / exercises**: guided tasks ("Launch a CTV campaign", "Fix under-pacing IO", "Add PG deal"), auto-checked
- Per-student sandboxed partner/advertiser with seeded data

---

### 6. Phase-by-Phase Action Plan & Checklist

Status keys: ⬜ Not started · 🟨 In progress · ✅ Done · ⛔ Blocked

#### Phase 0 — Planning & setup (Cowork) — target: 28–29 Oct
- ✅ P0-01 Draft PROJECT.md master plan
- ✅ P0-02 Review & approve PROJECT.md (Kailas) → approved 2026-10-28: stack as in §7.1 and ADR-006 to ADR-010, plan approved (ADR-039)
- ✅ P0-03 GitHub repo `iam-knr/dv360-adsmentor` created; PROJECT.md committed
- ✅ P0-04 Connect repo to Claude Code on the web (GitHub App) → cloud sessions commit successfully
- 🟨 P0-05 Connect repo to Vercel; set up Postgres → Supabase project exists (ref `bwqzdhyatvhpssxtwjza`, eu-west-1; ADR-040). Pending: Vercel project import (Hobby; no upgrade needed now, ADR-048), env vars (database URLs pasted only into Vercel), cloud environment, secrets (build-plan 1.2 to 1.10, items P-02, P-03, P-04, P-06, P-07)
- ⬜ P0-06 Turn off "usage credits" toggle in Claude settings (avoid surprise charges) → owner, build-plan item P-12
- ✅ P0-07 Browser = Claude in Chrome ("Browser 1" profile); DV360 signed in

#### Phase 1 — Full DV360 exploration (Cowork + browser) — target: 29–31 Oct
One explore file per item; screenshots on demo data only.
- ✅ P1-01 Global shell & navigation (§5.1) → docs/explore/01-global-shell.md
- ✅ P1-02 Partner level (§5.2) → docs/explore/02-partner-level.md
- ✅ P1-03 Campaigns (§5.3) → docs/explore/03-campaigns.md
- ✅ P1-04 Insertion orders (§5.3) → docs/explore/04-insertion-orders.md
- ✅ P1-05 Line items (§5.3) → docs/explore/05-line-items.md + docs/explore/19-gap-finish.md (CTV, Video, Display DOOH, Mobile app install 2 steps, YouTube 2 steps with ad group and ad; Demand Gen skipped by owner decision)
- ✅ P1-06 YouTube ad groups & ads (§5.3) → docs/explore/06-youtube.md
- ✅ P1-07 Targeting — every dimension (§5.4) → docs/explore/07-targeting.md
- ✅ P1-08 Creatives (§5.5) → docs/explore/08-creatives.md + docs/explore/19-gap-finish.md (all New ▾ forms, routes, validation messages, bulk native site)
- ✅ P1-09 Inventory & Marketplace (§5.6) → docs/explore/09-inventory.md
- ✅ P1-10 Audiences (§5.7) → docs/explore/10-audiences.md
- ✅ P1-11 Resources incl. Floodlight & custom bidding (§5.8) → docs/explore/11-resources.md
- ✅ P1-12 Reporting — instant & offline (§5.9) → docs/explore/12-reporting.md
- ✅ P1-13 Planning & reach planner (§5.10) → docs/explore/13-planning.md + docs/explore/19-gap-finish.md (New plan wizard, editable plan, Add ad formats, Additional Settings; forecast charts with data and plan → campaign not seen)
- ✅ P1-14 Advertiser settings (§5.11) → docs/explore/14-advertiser-settings.md
- ✅ P1-15 Bulk tools, SDF, rules, experiments, optimisation, alerts (§5.3) → docs/explore/15-bulk-sdf-experiments.md + docs/explore/18-experiments.md + docs/explore/19-gap-finish.md (A/B create form, live Intelligence alerts and suggestions; bulk edit side panels still not seen)
- ✅ P1-16 Change history, notifications, misc (§5.12) → docs/explore/16-history-notifications.md
- ✅ P1-17 Gap sweep: click every remaining menu item; add anything missing to §5 → docs/explore/17-gap-sweep.md (filled creative page/history, audience detail, Google tag, channel & keyword list editors, report runs, 404; remaining blocked gaps listed there for Phase 2 from public docs)
- ✅ P1-18 Experiments: A/B tests + Brand/Search lift studies → docs/explore/18-experiments.md
- ✅ P1-19 Gap finish in the second demo advertiser (create access): creatives, campaign → IO → LI chain for YouTube (with ad group and ad), CTV, DOOH, App install, Video, Display; New plan; A/B create → docs/explore/19-gap-finish.md

#### Phase 2 — Specs & architecture — target: 31 Oct–1 Nov
- ✅ P2-01 Data model (all entities & relationships) → [docs/specs/data-model.md](docs/specs/data-model.md)
- ✅ P2-02 Route map mirroring DV360 navigation → [docs/specs/routes.md](docs/specs/routes.md)
- ✅ P2-03 Design system: colours, typography, spacing, components matching DV360 look → [docs/specs/design-system.md](docs/specs/design-system.md)
- ✅ P2-04 Validation rules catalogue → [docs/specs/validation.md](docs/specs/validation.md)
- ✅ P2-05 Simulation engine spec → [docs/specs/engine.md](docs/specs/engine.md)
- ✅ P2-06 Module specs (one per §5 area) → [docs/specs/modules/](docs/specs/modules/README.md) (18 modules, 231 build tasks)
- ✅ P2-07 Build order & cloud-session prompts written → [docs/specs/build-plan.md](docs/specs/build-plan.md), conflict log [docs/specs/conflicts.md](docs/specs/conflicts.md), ADR log [docs/decisions.md](docs/decisions.md)

#### Phase 3 — Foundation build (cloud sessions, $100 credit) — target: 1–5 Nov
Plan: `docs/specs/build-plan.md` (owner prerequisites, waves, file ownership, merge order, prompts). Session ids below are the prompt ids in build-plan section 4. Starts when owner items P-01 and P-02 are done. A split task is ticked 🟨 until all its sessions are merged.
- ✅ P3-01 Next.js + TypeScript + Prisma + Postgres scaffold; Vercel deploy → session P3-01 (build-plan 4.1) (PR 1; Vercel preview waits on P-03 and P-04)
- ✅ P3-02 Adsmetor auth, roles (`USER` / `ADMIN` / `SUPER_ADMIN`), classroom access windows, password policy and lockout foundation → session P3-02 (4.6; module 18 M18-01 to M18-04; module 19 M19-01 to M19-04, M19-14) (login, lockout, forced password change, closed class, role guards, view-as; Vercel preview waits on P-03, P-04 and P-07)
- 🟨 P3-02b Account management dashboard `/manage` (Super admin / Admin / User, email + shared password, cohorts, CSV import, audit) → session P3-02b (4.17; module 19 M19-05 to M19-16; wave 5, merge 15b) (reduced scope, build-plan 5.2 cut 11: Accounts list, Add account with one-time reveal, Reset password, Disable/Enable, Delete/Restore, Unlock, Sign out everywhere, bulk bar, cohorts list/create, audit page; CSV import, cohort detail, access page, settings page still open)
- ✅ P3-03 App shell: top bar, switcher, left nav, breadcrumbs, date picker → session P3-03 (4.9; module 01 T1 to T6)
- ✅ P3-04 Shared components: data table (columns picker, filters, bulk actions), side panel forms, dialogs, status chips → session P3-04 (4.2; design-system.md) (Tier A and B kit, gallery behind `ENABLE_GALLERY`; column-view menu and Modify columns dialog deferred to the module sessions, see PR)
- ✅ P3-05 Full data model + seed generator (partners, advertisers, campaigns, IOs, LIs, creatives, deals, audiences) → sessions ✅ P3-05a schema core and `withChangeLog` (4.3), ✅ P3-05b seed generator (4.7), ✅ P3-05c remaining tables (4.8)
- 🟨 P3-06 Campaigns → IOs → Line items CRUD with full validation → sessions ✅ P3-06a validation library (4.4) (PR 3), ✅ P3-06b campaigns and IOs (4.11), 🟨 P3-06c line items (4.12)
- ✅ P3-07 Targeting panel (all dimensions) → sessions ✅ P3-07a card, state and basic editors (4.10), ✅ P3-07b geography, apps and URLs, brand suitability, audience builder (4.15)
- ✅ P3-08 Simulation engine v1 (auction, pacing, metrics) → sessions ✅ P3-08a engine core (4.5) (PR 8), ✅ P3-08b engine runtime and tick endpoint (4.13)
- ✅ P3-09 Performance columns on list pages → session P3-09 (4.14); metrics layer plus list-page e2e (Campaigns, IO, LI lists with Total rows, P3-INT)
- ✅ P3-INT Integration and hardening: demo path, gap list (added by P2-07; not a PROJECT.md task before) → session P3-INT (4.16) (demo path e2e, `/sim/admin/seed`, `docs/demo-script.md`, `docs/gaps/p3.md`; fast-forward provisioning not switched on, see gaps A3; fidelity pass needs a browser, gaps A6)

#### Phase 4 — Remaining modules (cloud sessions / normal limits after credit)
Outline of waves and module tasks: `docs/specs/build-plan.md` section 3.7. Module specs: `docs/specs/modules/README.md`.
- ✅ P4-01 Creatives (all types, review statuses) (PR 23)
- ✅ P4-02 Inventory, deals, Marketplace & PG negotiation (PR 29; M13-01..13 built; not done: LI form wiring, Plans list is module 04 per RC-050, see `docs/gaps/p4-02.md`)
- ✅ P4-03 Audiences (all types, combined, custom, lookalike) (module 14 M14-01..11 built on branch `p4-03-audiences`, migration `0008_p4_03_audience_deltas`; not done: tag list growth, engine-side geo and composition functions, standard LI grid on the Line items tab, see `docs/gaps/p4-03.md`)
- ✅ P4-04 Resources: channels, lists, Floodlight, linked accounts, verification (M15-01..07 and 09; custom bidding M15-08 is P4-05) (PR 27)
- ✅ P4-05 Custom & automated bidding (M15-08 built on branch `p4-05-bidding`: list, Set up/Test/Save wizard, algorithm picker on the line item form, migration `0009_p4_05_custom_bidding_draft`; not done: engine scoring with the algorithm, see `docs/gaps/p4-05.md`)
- ✅ P4-06 YouTube line items, ad groups, ads (PR 31; module 09 built incl. Demand Gen ad groups and ads and the review/alert engine hook; not done: engine delivery, ad sequence builder, YouTube on CTV, see `docs/gaps/p4-06.md`)
- ✅ P4-07 Reporting: instant reports, offline reports, exports, schedules (M16-01..12 built on branch `p4-07-reporting`, migration `0007_p4_07_report_schedule`; not done: see `docs/gaps/p4-07.md`)
- ✅ P4-08 Planning & reach planner (module 04 built on branch `p4-08-planning`: Plans list, plan page with forecast, line item table, Modify columns, copy, convert to campaign, Cross-media reach list, create form and report detail; not done: see `docs/gaps/p4-08.md`)
- ✅ P4-09 Partner & advertiser settings, users & roles (PR 24)
- ✅ P4-10 Bulk edit, SDF upload/download, rules, experiments → ✅ P4-10a bulk, SDF, saved views and charts (module 11 T11-01..13 built on branch `p4-10a-bulk-sdf`, migration `0010_p4_10a_bulk_charts`; not done: see `docs/gaps/p4-10a.md`) and ✅ P4-10b experiments and lift (module 17 M17-01..11 built on branch `p4-10b-experiments`, no migration; not done: see `docs/gaps/p4-10b.md`)
- 🟨 P4-11 Optimisation recommendations, alerts & troubleshooting (built on branch `p4-11-optimisation`, no migration: Intelligence panel with Investigate, Apply and Dismiss, `Recommendation` writer, Troubleshooter, campaign Alerts page, Alert preferences page; not done: grid `f.alert` filters, forecast panels, Combined tab, Overview cards, search, help, Advisor, see `docs/gaps/p4-11.md`)
- ✅ P4-12 Change history, notifications (module 05 T3..T10 built on branch `p4-12-history`: History pages at four levels, notes, CSV, notification service and bell; no migration; not done: see `docs/gaps/p4-12.md`)
- 🟨 ENG-FF Engine fast-forward history mode and sandbox provisioning job M18-05 (branch `eng-fast-forward`, no migration: batched history mode for `fastForward`, `engineDays` seed knob, `lib/sandbox/provision.ts` with QUEUED/BUILDING/READY/FAILED, welcome page progress, Create/Retry sandbox on the account page; 90 engine days in about 65 s per sandbox instead of 6 minutes; not done: see `docs/gaps/eng-ff.md`)
- 🟨 PROV-DRIVE Provisioning and the engine without the GitHub cron (branch `prov-drive`, no migration: the account page and `/sim/welcome` drive the build step by step, rate limited "maybe advance" after page loads through `AppMeta`, `POST /api/manage/accounts/[userId]/provision`; see `docs/gaps/prov-drive.md`; external pinger recommended, not built)

#### Phase 5 — Training layer
Outline: `docs/specs/build-plan.md` section 3.8. Module 18 holds the tasks.
- ✅ P5-01 Instructor console (built on branch `p5-01-instructor`, no migration: dashboard, classes, roster with one-time passwords, access windows with weekly series, Open now and Close now, sandbox create and reset, announcements, certificate requests (module 03 T09), Super admin classes, audit log and engine pages; not done: clock page (P5-03), snapshots (M18-17), scenarios and progress, see `docs/gaps/p5-01.md`)
- ✅ PROD-CRASH Production 500s on Campaigns, Reports, Channels, Custom bidding and Floodlights (branch `prod-crash`; migration 0011 read policies for the global tables under RLS, 403 page, request error log, prod-like crawler e2e job; see `docs/gaps/prod-crash.md`)
- ✅ PROD-SEED Global reference data in production (branch `prod-seed`; `ensureReferenceData` runs from the Vercel build bootstrap and self-heals sandbox provisioning; no migration; see `docs/gaps/prod-seed.md`)
- ⬜ P5-02 Scenario engine + 10 starter exercises with auto-checks
- ⬜ P5-03 Time-acceleration controls (instructor)
- ⬜ P5-04 Student progress dashboard

#### Phase 6 — QA & launch
- ⬜ P6-01 Fidelity review per module (SOP-3)
- ⬜ P6-02 Playwright end-to-end tests for core workflows
- ⬜ P6-03 Load test for a full classroom: 25 concurrent students (RC-057, ADR-045); 60 concurrent students is a stretch target
- ⬜ P6-04 Pilot class, collect feedback, fix
- ⬜ P6-05 Production launch

---

### 7. Architecture

#### 7.1 Stack
| Layer | Choice | Why |
|---|---|---|
| Framework | Next.js (App Router) + TypeScript | Full-stack, deploys natively on Vercel |
| UI | Material UI (MUI) + custom theme | DV360 is built on Material Design, so this gives the closest look and feel |
| Tables | MUI X Data Grid / TanStack Table | DV360-style column pickers, filters, bulk select |
| Charts | Recharts | Report & performance graphs |
| DB | PostgreSQL + Prisma | Relational hierarchy (Partner → … → Line item) |
| Jobs | GitHub Actions timer (every 5 minutes) + lazy catch-up + server actions | Runs simulation ticks; Vercel stays on Hobby (ADR-048) |
| Auth | Auth.js with credentials | Adsmetor login, classroom access windows |
| Tests | Vitest + Playwright | Rules + end-to-end workflows |

#### 7.2 Core data model (outline)
Partner · Advertiser · Campaign · InsertionOrder · BudgetSegment · LineItem · AdGroup · Ad · Creative · CreativeAssignment · TargetingOption (polymorphic per dimension) · Audience · CombinedAudience · Channel · KeywordList · LocationList · Deal · InventorySource · Exchange · FloodlightGroup · FloodlightActivity · CustomBiddingAlgorithm · Report · ReportRun · Plan · Experiment · ChangeLog · Alert · User · Role · Classroom · AccessWindow · Scenario · ScenarioAttempt · SimDailyMetric

#### 7.3 Simulation engine (how campaigns "run")
1. **Tick** = one simulated hour (instructor sets speed: e.g. 1 sim-day per 5 real minutes).
2. Each tick generates **bid opportunities** per exchange × geo × device × audience segment from synthetic supply curves.
3. Each active line item is checked: flight dates, budget left, pacing plan, targeting match, frequency cap, creative approved & size match.
4. **Bid** = strategy output (fixed CPM or model-based for auto bidding) → second-price/first-price auction against synthetic competitors → win rate.
5. Wins produce impressions → viewability, clicks (CTR model by creative/format), video quartiles, conversions (Floodlight, with lag).
6. Spend, pacing and metrics are written to `SimDailyMetric` → feeds tables, graphs and reports.
7. **Diagnostics**: when a line item doesn't deliver, the engine records why (budget, bid too low, targeting too narrow, creative disapproved), which feeds DV360-style alerts and troubleshooting.

---

### 8. Feasibility & Risks

| Risk | Impact | Mitigation |
|---|---|---|
| Scope is very large (DV360 has hundreds of screens) | Full build takes weeks to months, not one week | Phased plan; $100 credit covers Phases 3 core; later phases on normal limits / further credits |
| Cloud credit expires 5 Nov 2026 | Unused credit lost | Finish Phases 0–2 by 1 Nov; run several cloud sessions in parallel in Phase 3 |
| Demo account may hide some features (not enabled for vendor demos) | Gaps in replication | Note as "not visible in demo"; fill from public DV360 documentation |
| DV360 UI changes over time | Simulator drifts | Re-run SOP-3 fidelity review every quarter |
| Engine realism | Students learn wrong intuitions | Tune with realistic benchmark ranges (CPMs, CTRs, win rates) by format; instructor review |
| Classroom access control | Material leaving the classroom | Access windows, no data export outside reports module, session timeouts |
| Repo is public | Explore notes and screenshots of DV360 are visible to anyone; secrets could leak | Kailas decided (2026-10-28) it stays public (ADR-044). Hard rule: never commit secrets, `.env*` files, keys, DB URLs or student data; secret scanning in CI and on GitHub |
| Platform limits (Vercel Hobby cron and deployment limits, Supabase free tier: 500 MB, pause after 7 days idle) | Failed deploys, slow or missing ticks | Stay on Vercel Hobby with the GitHub Actions timer (ADR-048; deployment, duration and non-commercial limits in build-plan 5.3 R-05); reduced retention and slice caps (ADR-045); build-plan 5.3 R-05, R-06 |
| Credit runs out or expires before the minimum viable demo is merged | Phase 3 incomplete | Cut order and fallbacks in build-plan 5.2 and 5.4; merge freeze 5 Nov 9:00 AM IST |

---

### 9. Decision Log
Full records: `docs/decisions.md` (ADR-001 to ADR-046).
| Date | Decision | By |
|---|---|---|
| 2026-10-28 | Product name: DV360 Simulator by Adsmetor | Kailas |
| 2026-10-28 | Full fidelity, every section in scope | Kailas |
| 2026-10-28 | Demo account can be fully interacted with | Kailas |
| 2026-10-28 | Classroom-only access; legal handled by Adsmetor | Kailas |
| 2026-10-28 | Build in Claude Code cloud sessions using $100 credit | Kailas + Claude |
| 2026-10-28 | Proposed stack: Next.js + MUI + Postgres + Vercel (pending approval) | Claude |
| 2026-10-28 | Account confirmed as demo (no real spend); exploration browser = Claude in Chrome | Kailas |
| 2026-10-28 | All docs and build files live only in GitHub repo `iam-knr/dv360-adsmentor`; nothing saved on local PC | Kailas |
| 2026-10-28 | Repo made public so cloud sessions can access it | Kailas |
| 2026-10-28 | ADR-006 to ADR-010: stack detail (Next.js + MUI + TanStack Table + Recharts; Postgres + Prisma; Vercel; Auth.js; Vitest + Playwright) recorded; approved the same day by ADR-039 | Accepted (Kailas) |
| 2026-10-28 | ADR-015: routes mirror DV360 URLs without `/ng_nav`; simulator pages under `/sim` | Claude (routes.md) |
| 2026-10-28 | ADR-016: multi-tenancy by `sandboxId` with composite foreign keys and row level security | Claude (data-model.md) |
| 2026-10-28 | ADR-017: deterministic engine, pure TypeScript core, database only in `io/` | Claude (engine.md) |
| 2026-10-28 | ADR-018: enum authority rule and key spellings (conflicts.md RC-001 to RC-006) | Claude |
| 2026-10-28 | ADR-019 to ADR-021: one alert store; diagnostics and metric grain; money, version and wire-type rules (RC-013, RC-018 to RC-025) | Claude |
| 2026-10-28 | ADR-022 to ADR-027: folder convention, multi-file Prisma schema, embedded Postgres for tests, PR-per-session with ownership and ordered merges, engine v1 scope with history stub, partitioning deferred | Claude (build-plan.md) |
| 2026-10-28 | ADR-028: one sandbox per student | Proposed (awaiting Kailas) |
| 2026-10-28 | ADR-029: engine tick by GitHub Actions every 5 minutes plus lazy catch-up | Superseded by ADR-041, restored by ADR-048 |
| 2026-10-28 | ADR-030: Vercel Pro for class use (Hobby is non-commercial and limits cron) | Superseded by ADR-048 |
| 2026-10-28 | ADR-031 to ADR-036: canned Tutor, vendor names (ADR-032 superseded by ADR-042), billing deferred, instructor-created accounts, student uploads, data retention | Proposed (awaiting Kailas) |
| 2026-10-28 | ADR-037, ADR-038: students are Standard users in their sandbox; script custom bidding disabled in v1 | Claude (RC-047, RC-037) |
| 2026-10-28 | ADR-039: stack (§7.1, ADR-006 to ADR-010) and plan approved; closes P-01, P0-02, RC-060 | Kailas |
| 2026-10-28 | ADR-040: database is Supabase (existing project, eu-west-1, free Nano, Postgres only), not Neon; pooler 6543 for `DATABASE_URL`, direct 5432 for `DIRECT_URL`; values only in Vercel env vars | Kailas |
| 2026-10-28 | ADR-041: Vercel Pro required (paying students); Vercel Cron is the default engine trigger, GitHub Actions timer is the fallback; function region `dub1`; closes P-05, RC-056 | Superseded by ADR-048 (Kailas) |
| 2026-10-28 | ADR-042: real exchange, verifier and vendor names kept as reference data with invented prices, also for Advertiser settings checkboxes; closes P-10, RC-055 | Kailas |
| 2026-10-28 | ADR-043: logo committed at `docs/brand/adsmentor-logo-horizontal.png`; P3-03/P3-04 use it, P3-03 derives a square icon; screenshots still missing; closes P-09 partly, RC-058 | Kailas |
| 2026-10-28 | ADR-044: repo stays public; never commit secrets, `.env*`, keys, DB URLs or student data; secret scan in P3-01 CI; closes RC-059 | Kailas |
| 2026-10-28 | ADR-045: up to 25 concurrent students by default (free cohorts may be larger; RC-057 reopened as an owner question, ADR-048); free Supabase tier for the pilot with reduced retention; P6-03 target 25 (60 stretch); closes RC-057 | Kailas |
| 2026-10-28 | ADR-046: Cowork assistant may merge Phase 3+ build PRs under strict conditions (checks, preview, order, no open comments; squash only); closes P-13 | Kailas |
| 2026-10-28 | ADR-047: three-level account hierarchy (`SUPER_ADMIN`, `ADMIN`, `USER`), email login with a creator-set or generated shared password, `/manage` dashboard; supersedes ADR-034 (RC-063, RC-068 to RC-076) | Kailas (requirement), Claude (module 19) |
| 2026-10-28 | ADR-048 (1): the simulator is for FREE students only (lead-gen and training funnel); paying Ads Mentor students use the real DV360; account hierarchy unchanged | Kailas |
| 2026-10-28 | ADR-048 (2): stay on Vercel Hobby (team "BIGSEO's projects") with the GitHub Actions timer as engine trigger; revisit Pro before a large public free cohort or if Vercel asks; supersedes ADR-041, ADR-030; reopens RC-057 | Kailas |

---

### 10. Status Log
| Date | Task | Result | Next |
|---|---|---|---|
| 2026-10-28 | P0-01 | Master plan drafted | Kailas reviews; create GitHub repo; choose browser |
| 2026-10-28 | P0-03 | PROJECT.md and docs/ skeleton committed to `iam-knr/dv360-adsmentor` via cloud session | Kailas completes Google sign-in in Chrome; start P1-01 |
| 2026-10-28 | P1-01 | Global shell, partner + advertiser nav, top bar, right rail, Overview, Bulk status, shortcuts documented | P1-02 Partner level |
| 2026-10-28 | P1-02 | Partner level documented (advertisers list, basic details, exchanges, targeting defaults, advertiser configurations, resources, users) | P1-03 Campaigns |
| 2026-10-28 | P1-03 | Campaigns list, bulk/inline actions, New campaign form + validation + goal→KPI rules, campaign page, settings, alerts documented | P1-04 Insertion orders |
| 2026-10-28 | P1-04 | Insertion orders: list, bulk menu, 2-step create with objective matrix, full form + validation, IO page tabs documented | P1-05 Line items |
| 2026-10-28 | P1-05 | Line items: type picker + compatibility rules, full Display form, type differences, LI page, Troubleshooter funnel, bulk menu documented; some types blocked in demo | P1-06 YouTube |
| 2026-10-28 | P1-06 | YouTube LI subtypes, LI form, ad groups (targeting, bid), ad create form + preview; CTV & Audio added to 05 | P1-07 Targeting |
| 2026-10-28 | P1-07 | All Display targeting editors documented (geo, apps/URLs, keywords, categories, environment, position, viewability, language, brand suitability + 3P verification, audience lists builder, demographics, day & time, browser, device, connection speed, carrier/ISP) | P1-08 Creatives |
| 2026-10-28 | P1-08 | Creatives library, New menu, third-party display form, creative details/status/history, exchange review, format gallery, appeal history documented | P1-09 Inventory |
| 2026-10-28 | P1-09 | My inventory (orders/deals, packages, deal groups), deal page, instant deal flow, Marketplace Featured + Discover, Plans list, Negotiations list documented | P1-10 Audiences |
| 2026-10-28 | P1-10 | All audiences tabs (First-party, Custom lists, Combined, Partner), New audience types and forms (tag-based, customer match, combined, lookalike, custom affinity), Analysis pages documented | P1-11 Resources |
| 2026-10-28 | P1-11 | Brand controls, channels & negative keyword lists, Floodlight group (details, conversions, new conversion form), YouTube assets, creator partnerships, location lists, custom bidding list + wizard documented | P1-12 Reporting |
| 2026-10-28 | P1-12 | Reports hub, suggested templates, instant report builder (fields catalogue, visualisations, time zone, filters), offline report builder documented | P1-13 Planning |
| 2026-10-28 | DOC | Consolidated task/discussion/build log published at docs/PROJECT-LOG.md | P1-13 Planning |
| 2026-10-28 | P1-13 | Plans list (status filter, columns), plan forecast page (KPI strip + metric switches, forecast tabs, line-items table, Modify columns), Cross-media reach create flow documented; editors blocked in demo | P1-14 Advertiser settings |
| 2026-10-28 | P1-14 | Advertiser settings: basic details (identity, SDF, ad server, authorizations, EU political ads, Demand Gen conversion, business name/logo, additional settings, third-party services), targeting rules, data manager, alert preferences, policy center documented | P1-15 Bulk/SDF/experiments |
| 2026-10-28 | P1-15 | SDF download/upload dialogs, bulk Action bar, custom charts builder, Intelligence panel, lift study form, targeting templates documented; A/B tests and bulk edit panels blocked in demo | P1-16 Change history, notifications |
| 2026-10-28 | P1-16 | History page (spend chart, date range, local timezone / system changes toggles, download, day cards with field-level old → new), notes panel, notifications, right rail documented | P1-17 Gap sweep |
| 2026-10-28 | P1-17 | Gap sweep: image creative page, creative History table, audience detail, Floodlight Google tag, channel and negative keyword list editors, report run files, 404 page documented; still-blocked gaps tabled for Phase 2 | P2-01 Data model |
| 2026-10-28 | P1-18 | Experiments: A/B test list, create form, report + settings/difference; Lift studies list, create form (eligibility, budget, survey), report, review & fix documented | Phase 1 audit → P2-01 |
| 2026-10-28 | P2-01 | Data model: ER overview, multi-tenancy with row level security, seeding strategy, all enumerations, entity field tables, change-log design, Prisma schema (Appendix A) | P2-02 Route map |
| 2026-10-28 | P2-02 | Route map: route table, three navigation trees, frame hierarchy, URL conventions, simulator routes, API and server-action map | P2-03 Design system |
| 2026-10-28 | P2-03 | Design system: tokens, MUI theme, 20 component specs, icon map, layout, accessibility, fidelity checklist (SOP-3) | P2-04 Validation |
| 2026-10-28 | P2-04 | Validation catalogue: about 480 rules with ids and messages, matrices MX-01 to MX-18, state machines, validation library design | P2-05 Engine |
| 2026-10-28 | P2-05 | Simulation engine: tick scheduler, supply, eligibility funnel, bidding, auction, outcomes, pacing, costs, aggregation, scenario hooks, tests | P2-06 Module specs |
| 2026-10-28 | P2-06 | Module specs: 18 files (sections 1 to 8) and index; 231 build tasks; conflicts and open questions per module | P2-07 Build order |
| 2026-10-28 | P2-07 | Conflict log (67 rows: 55 resolved and applied to the specs, 12 owner decisions with defaults), ADR-001 to ADR-038, module index, build plan (owner prerequisites, repo skeleton, 16 sessions in 5 waves with ownership and merge order, ready-to-paste prompts, risks and cut order) | Owner completes build-plan section 1 by Sat 31 Oct (P-01, P-02, P-12, repo visibility block the start); run wave 1 (P3-01) on Sun 1 Nov |
| 2026-10-28 | OWNER | Stack/plan approved; Supabase + Vercel (Pro superseded by ADR-048); real vendor names; repo public; ≤25 students; assistant may merge PRs | Owner completes P-02/03/04/06/07/12; then P3-01 |
| 2026-10-28 | SPEC | Account management module 19 specified (3 levels, email+password, admin adds users) | Phase 3 prerequisites |
| 2026-10-28 | OWNER | Simulator for free students only (paid students use real DV360); Vercel Hobby + GitHub Actions timer | P-03 import repo to Vercel (Hobby), P-04..P-07 |
| 2026-10-28 | P3-01 | Scaffold done: Next.js 15, MUI 7, Prisma 6 (multi-file schema, `0000_base`), Vitest/Playwright, CI (check, db-tests, e2e green), stubs, engine-tick stub (off by default), no cron in vercel.json | P3-04, P3-05a, P3-06a, P3-08a (wave 2) |
| 2026-10-28 | P3-06a | Validation core in `lib/validation`: engine, MSG catalogue, matrices MX-01 to MX-06, MX-08, MX-10, MX-17, rules for GEN, CMP, IO, LI and the display, video, CTV, audio, app, DOOH and Demand Gen type files, state machines, bulk applicability, client hooks, server wrapper; 1,151 tests (docs-sync, coverage, matrices, state, dirty) | P3-06b, P3-06c (wave 4); P3-02b and P3-07a also read it |
| 2026-10-28 | P3-04 | UI kit done: tokens, MUI theme, `DvIcon`, Tier A and B components in `components/dv`, gallery at `/components` (404 in production unless `ENABLE_GALLERY=1`), 314 Vitest component and unit tests with axe on every gallery entry, `tests/e2e/gallery.spec.ts` | P3-03 (shell), P3-06b to P3-06c (forms and grids) |
| 2026-10-28 | P3-05a | Core schema (35 Appendix A models plus `AuditLog`, module 19 roles `USER`/`ADMIN`/`SUPER_ADMIN`, account, cohort, access-window and forced-password-change columns), migration `0001_core` (additive, RLS roles `app_tenant`/`app_engine`, `NULLS NOT DISTINCT` keys, `AccountPolicy` default row), `withSandbox`/`withBypass`, `withChangeLog` with the Advertiser registry and the scan test | P3-02, P3-05b, P3-05c, P3-03 (wave 3) |
| 2026-10-28 | P3-05c | Remaining tables: 112 models and their enums in `prisma/schema/70..74` (data-model 5.1 to 5.19, Appendix C, module deltas), migration `0002_extended` (additive, RLS via `app_enable_tenant_rls`, one-owner checks, grants), introspection tests (sandboxId, RLS, composite FKs, section 4 enum values, Appendix C tables, upgrade on a database holding 0001 rows). Column deltas on tables owned by 05a are not added (listed in the PR) | P3-05b (seed generator) still open, so P3-05 stays partly done; P3-02, P3-03 |
| 2026-10-28 | P3-05b | Seed generator in `lib/seed`: `mulberry32` plan builder for `starter-agency`, `healthy` and `troubleshooting-lab` (36 line items of every non-YouTube type, 11 planted delivery stories plus pacing cases, hidden `SIM_SEED` change groups, alerts), closed-form history stub (90 days daily, 14 days hourly, exchange and device slices, Troubleshooter diagnostics), 71 exchanges with `simClass`, targeting catalogue, vendor allow-list; `npm run db:seed` and demo class bootstrap (instructor, 3 students), both idempotent and blocked in production; 143 unit and 23 db tests. `FxRate`, `GoogleAudience`, alert preferences and the other Appendix C tables wait for P3-05c | P3-05c, P3-02, P3-09, P3-INT (swap the stub for `engine.fastForward`) |
| 2026-10-28 | P3-02 | Auth done: Auth.js credentials with argon2id, lockout (5 failures, 15 minutes), password policy and generator, forced password change, sessions with `sessionVersion`, single session and idle/absolute limits, class access windows with freeze/unfreeze, `can()` for the six DV360 levels, view-as, `middleware.ts` guards, `/sim` pages, first Super admin bootstrap (`prisma/bootstrap/10-admin.bootstrap.ts`, idempotent), `provisionStudent`; Vitest unit and db suites in `tests/auth`, `tests/e2e/auth.spec.ts` | P3-02b (`/manage`), P3-03 (shell calls `requireOpenClass`, mounts `ViewAsBanner`), P3-08b (tick calls `tickAccessWindows`) |
| 2026-10-28 | P3-08a | Pure engine core in `lib/engine` and `engine/params.json`: `runTick(world, state, params, tick)` with supply cells, eligibility funnel (integer conservation), frequency, bidding (fixed plus 16 goals, learning, lambda), auction, outcomes, Floodlight conversions, pacing, fees and revenue, diagnostics, alert decisions, hourly and daily slices, `forecast`, `estimateAudienceSize`; determinism, property and calibration tests, `npm run engine:golden`; p50 55 ms per sandbox-tick on the benchmark fixture | P3-08b (runtime, tick endpoint), P3-09 |
| 2026-10-29 | P1-19 | Gap finish documented in `docs/explore/19-gap-finish.md` (creative forms and routes; IO type/objective gating; LI picker rules; CTV, Video, DOOH, App install, YouTube LI forms; YouTube ad group and ad; New plan wizard; A/B create; live Intelligence). Owner-approved test entities in the paused demo advertiser listed there. Specs 04, 06, 07, 08, 09, 12, 17 now point to it | P3-03 finish, then wave 4 |
| 2026-10-29 | P3-03 | App shell done (resumed after a crashed run): top bar (RT 4.1), nav trees `lib/nav/trees.ts` for partner, advertiser and campaign with role filter and active matcher, layouts for every frame (G P A C IO LI F R), scope resolvers with the chain check (404 in place), path builders, `AppLink`, `useListParams`, `useUnsavedGuard`, `useHotkeys` with the shortcuts dialog, `savePrefs` and Recently opened on the P3-05c tables, banners (paused advertiser, view-as, class window), right rail stubs, sim clock chip, 404 and error pages, a stub page for every routes.md 3 row, minimal Overview and Advertisers pages, square icon; unit, component and db tests in `tests/shell`, `tests/e2e/shell.spec.ts` (PW-01-1 tour, RT 9 smoke over every route row) | Wave 4: P3-07a, P3-06b, P3-06c, P3-08b, P3-09 |
| 2026-10-29 | P3-07a | Targeting core: `lib/targeting` state/rows/summary/merge, TGT and TPL rules, `TargetingCard` with Add targeting menu, locked and inherited rows, slide-over editors (Environment, Position, Viewability, Language, Categories, Browser, Device, Connection speed, Carrier and ISP, Demographics, Keywords, Day and time), catalogue API, dev page `/targeting`; unit and component tests. Follow-up: categories tree editor, device OS and make/model editors, locked-row tooltip (LI-100 text), tests V-10-01/03/04/17/21, AC-10-09/16 and `tests/e2e/targeting.spec.ts` (PW-10-01/04/06/07/08/09/10/11/16, signs in as a synthetic student). PW-10-06 is adapted to the exclusive include/exclude toggle; the audience TGT-100 case waits for P3-07b. `cases.targeting.ts` not needed (traceability covers modules 06 to 08 only) | Wave 4 continues: P3-06b, P3-06c, P3-08b, P3-09 |
| 2026-10-29 | P3-06b | Campaigns and IOs: services (`lib/campaigns`, `lib/insertion-orders`) with change-log registries, server actions, `CampaignForm`, `CampaignsList`, campaign settings page, IO step 1 with the objective matrix, `IoForm`, `IoList` on campaign and advertiser tabs, IO details page, list/matrix API; unit, db and Playwright (`campaigns.spec.ts`: validation, create campaign then IO) green. Not done: copy-settings dialog DLG-10, inline budget edit via prompt only, campaign page tabs/pin/chart strip, IO page header and Intelligence stub, most PW-06/07 cases | P3-06c, P3-08b, P3-09 |
| 2026-10-29 | P3-06c | Line items: service, server actions, type picker (MX-03 tooltips, Demand Gen toast), `LiForm` with conversions panel and copy settings dialog, Mobile app install and Ads in mobile apps pre-step, DOOH and Demand Gen shell variants, `LiGrid` at IO, campaign and advertiser level with archived list (`[A]/explorerlis?f.status=ARCHIVED`, Unarchive), API handlers `app/api/dv/line-items/*` (list, create, detail, update, copy-source, creative candidates); 41 service tests in `tests/services/line-items`, `line-items.spec.ts` PW-08-01/02/03/04/06/07/08/09/17 green, `check` and `test:db` green. Not done: link to the archived list in the IO menu (IO grid belongs to P3-06b), targeting card is the P3-07a stub | P3-08b, P3-09 |
| 2026-10-29 | P3-09 | Metric layer in `lib/metrics` replaces the zero stub (same `getGridMetrics` signature, extended `MetricRow`): one batched query per level over `SimDailyMetric` day totals (campaign, IO, LI, ad group, advertiser), derived ratios, KPI Actual per engine 4.6 with minimum samples, Spent = revenue (RC-038), `FxRate` conversion at read time, null vs zero, `getTotals`, `getChartCardData` (Total cost, Avg. performance, Impressions lost; reach and budget cards return the empty marker), `d` param parsing on the sim clock, `GET /api/dv/metrics/grid` and `/cards`; unit and db tests incl. raw SQL reconciliation, time zones, FX, 500 ids, EXPLAIN. List-page e2e cases are `test.skip` until the lists exist | P3-06b, P3-06c (bind the lists to `getGridMetrics`), P3-INT |
| 2026-10-29 | P3-08b | Engine runtime: `lib/engine/io` (loadWorld per advertiser, persistTick with additive upserts of hourly, daily and DeliveryDiagnostic plus pacing, reach and Alert open and resolve, `FOR UPDATE SKIP LOCKED` claim and `SimTickLog` ledger, SimJob, retention, creative review sync through `withChangeLog`), `lib/engine/server.ts` (`ensureCaughtUp`, `runDueTicks`, `fastForward`, `resetSandbox`, `setSpeed`, `pause`, `resume`, `stepTicks`), `POST /api/sim/engine/tick` (Bearer or `x-cron-secret`, 45 s budget, 25 sandboxes per call, `stillDue`), `engine-tick.yml` finished, migration `0003_engine_runtime` (SimState, SimJob); db tests for idempotency, catch-up equals live, isolation, locks, frozen sandboxes, 7-day fast-forward with `NO_SPEND_LI` stop, alerts, reset, retention. Not done: Playwright check (needs P3-09), `SimConversionDaily`, Recommendation rows, flight-end flip, `untilBudgetExhausted`, `actionlint` | P3-09 (reads the rows), P3-INT (swap the seed history stub for `fastForward`), owner: `ENGINE_CRON_URL` and `CRON_SECRET` Actions secrets (P-06, P-07) |
| 2026-10-29 | P3-02b | `/manage` reduced scope done: `lib/accounts` (permissions, scope, status, ownership, audit, service), server actions, `/api/manage` routes, accounts list with bulk bar, add account with one-time reveal, account detail, cohorts list/create, audit page, ESLint ban on `db.user`/`db.classroom`, sandbox stub, `purgeOldAudit`; Super admin landing now `/manage/accounts`; 47 unit + 19 db + 3 e2e tests. Open: CSV import, cohort detail, access page, settings, move cohort, change role, ACC rules in the validation catalogue | Finish remaining module 19 screens; P3-INT |
| 2026-10-29 | P3-06b follow-up | Campaign page shell (tabs Combined / Insertion orders / Line items, pin, chart strip with empty states), DLG-10 copy settings and DLG-11 stale-save dialogs, inline budget editor, IO header, MX-17 fee menu, Playwright `insertion-orders.spec.ts` and more `campaigns.spec.ts` cases | P3-07b, P3-INT |
| 2026-10-29 | P3-07b | Advanced targeting editors: Geography (region search over the seeded catalogue, radius with km/mi, bulk points of interest with per-line TGT-011, static SVG tile map with selection shading, "All locations" empty state, location list stub), Apps and URLs (four categories, bulk add, composite list CSV, URL suggestions only with campaign context), Brand suitability with third-party verification (running total, TGT-091 exclusivity, TGT-092), Audience builder `DvAudienceBuilder` (sections, AND groups, exclusions, picker with eligibility, Impressions summary through `POST /api/dv/audiences/estimate` calling `estimateAudienceSize`); `components/targeting/editors/registry.ts`, `lib/targeting/geo.ts` and `audience.ts`; 66 unit tests in `tests/targeting/advanced`, `tests/e2e/targeting-advanced.spec.ts` (PW-10-02/03/05/06 plus apps and brand cases) green. Not done: LI form does not yet supply landing URLs, enabled providers or advertiser id to the editors; `parse-points` endpoint (parser is client-side); `totalCostCpm` in row config | P3-INT |
| 2026-10-29 | P4-04 | Resources: CH/KW/LOC/FL rules and parsers, change-log registries, services in `lib/resources` (channels, negative keyword lists, location lists, Floodlight group and conversions, brand controls, YouTube assets), screens for all module 15 routes except custom bidding, seed (`AppCatalog`, per-advertiser resources, wired into `provisionSandbox`), engine wiring (group windows and tag fault in `loadWorld`, custom bidding readiness in `persistTick`); unit, db and Playwright (`resources.spec.ts`) green. Not done: keyword/channel/location pickers in the targeting panel (P3-07 files), Floodlight group on advertiser create (module 02), partner brand controls page (P4-09), custom bidding (P4-05), geography allocation for postal codes in the engine | P4-05 (custom bidding), P4-03 (audiences need Floodlight) |
| 2026-10-29 | P3-INT | Integration pass: demo path e2e (`tests/e2e/demo-path.spec.ts`) green from instructor login to Performance columns; Campaigns and IO lists got Total rows and the grid labels them; list-page metric specs enabled; `/sim/admin/seed` (Super admin) reseeds the demo class and templates; `docs/demo-script.md`, `docs/gaps/p3.md` written; history stub kept because `engine.fastForward` takes about 11 minutes per sandbox (gaps A3) | Merge P3-INT PR; owner items P-02, P-03, P-04, P-06, P-07; Phase 4 wave 6 prompts from `docs/gaps/p3.md` |
| 2026-10-29 | P4-02 | Inventory and Marketplace (module 13): migration `0005_p4_02_inventory_deltas` (`Negotiation.replyAt`, `expiresAt`), services for assign, instant deal, Marketplace (Featured, Discover, item, Assign, Bulk assign) and negotiations (import, counter, accept, decline, seller reply settled on the sim clock), API routes, server actions; screens My inventory (Orders and deals with Action required and order hierarchy, Packages, Deal groups with slide-over), deal page (Overview, Access, Settings, History), New instant deal, Featured, Discover with item slide-over, Negotiations list and page, campaign-scope variants, route-table rows for `negotiations/{x}`; 22 db tests and 8 Playwright cases (`inventory.spec.ts`) green. Fixed `createDealGroup` and `updateDealGroup` member writes. Not done: LI form rows call, Plans list (module 04), toolbar date picker and saved chevron state; list in `docs/gaps/p4-02.md` | P4-03, P4-08, P4-10 |
| 2026-10-29 | P4-06 | YouTube and Demand Gen (module 09): migrations `0006_youtube_ad_groups` and `0007_youtube_demand_gen`, `lib/youtube` (ad group and ad service, simulated review, preview model, seed of 60 videos plus 7 YouTube and 1 Demand Gen line items), YouTube video/audio forms in the shared line item service, step 1, Ad groups tab, ad group and ad panels with live preview, Demand Gen ad panel, API routes, engine sync for ad reviews and `YT_AD_REJECTED` / `AD_GROUP_NOT_RUNNING`; check, db (557+) and Playwright (`youtube.spec.ts`, 6 tests) green. Not done: engine delivery and ad group metrics, ad sequence builder, YT on CTV, audio ads, Troubleshooter filter (`docs/gaps/p4-06.md`) | P4-03 (audiences), P4-05 (custom bidding), engine YouTube modelling |
| 2026-10-29 | P4-07 | Reporting (module 16): field catalogue (846 fields, 34 categories), query engine (planner, compat, rules RPT-001..020, aggregation, reach, FX, time zones), services in `lib/reporting` (hub list, CRUD, share, schedule, preview query, runs, downloads), CSV and XLSX writers, scheduled runs on the sim clock (`runDueReports` hook in `runBatch`, catch-up cap 10, idempotent per occurrence, inbox messages in the bell), canned Generate report, 7 templates, Reports hub, instant builder (picker, zones, undo/redo, bulk edit, five visualisations), offline Floodlight and Inventory Availability builder, runs page, seed (reference rows, FxRate, saved reports per sandbox), migration `0007_p4_07_report_schedule` (0006 is reserved for P4-06); unit, db and Playwright (`reporting.spec.ts`) green. Not done: change-log entries for reports, ad hoc run rows for direct download, Custom data dialog, a second person opening a shared report in a browser, Blob file retention, see `docs/gaps/p4-07.md` | P4-03, P4-08 (cross-media reach link) |
| 2026-10-29 | P4-05 | Custom bidding (module 15 M15-08): engine score model and `sampleImpressions` Test sampler (`lib/engine/bidding/customBidding.ts`), rules CB-001..012, History registry, services in `lib/resources/custom-bidding.ts` (draft, test, save with CB-008 guard, suspend/activate, delete), list and wizard at advertiser and partner level, algorithm picker in `LiForm`, `LI-047` accepts a training algorithm, migration `0009_p4_05_custom_bidding_draft` (`isDraft`); check (3,444), db (632) and full Playwright (150, incl. `custom-bidding.spec.ts`) green on the merged code. Not done: engine does not yet score impressions with the algorithm, no browser step attaches an algorithm to a line item (`docs/gaps/p4-05.md`) | P4-03, engine session (gaps p3 #8) |
| 2026-10-29 | P4-03 | Audiences (module 14): migration `0008_p4_03_audience_deltas`, AUD rules (001..114), `lib/audiences` (sizes, lifecycle `advanceAudiences` called from `persistTick`, services, analysis, seed wired into `provisionSandbox`), change-log registry, four list tabs, type picker, tag-based, customer match (browser-side hashing), YouTube users, combined, lookalike, custom affinity and intent forms, details with lock and archive, Line items tab, geographic distribution and audience insights; unit, db and Playwright (`audiences.spec.ts`) green. Not done: per-tick tag list growth, engine geo/composition functions, standard LI grid and metrics on the Line items tab, picker switch-over in the targeting panel, see `docs/gaps/p4-03.md` | P4-05, P4-08, P4-10 |
| 2026-10-30 | P4-10a | Bulk edit, SDF, saved views and charts (module 11 T11-01..13): `lib/bulk` (jobs, worker with cursor and lease, status, archive, unarchive, duplicate tree, settings, targeting Add/Replace/Remove, creative assignment, template apply), `lib/sdf` (layouts for versions 9 to 11, codec, download, QA, metadata, upload pipeline with result zip and BLK rules), column views, custom charts with chart data and canned prompt parser, seed, Bulk status page, bulk bar on the three grids, SDF dialogs; migration `0010_p4_10a_bulk_charts` (enum values). Not done: see `docs/gaps/p4-10a.md` | P4-10b experiments, P4-11 suggestions and Investigate |
| 2026-10-29 | P4-08 | Planning and reach planner (module 04): no migration; `lib/planning` (17 countries, deterministic `forecastPlan`, PLN rules, plan table columns, TV catalogue, cross-media overlap maths, services, change-log registry `PLAN`, seed of 12 plans per advertiser), Plans list, plan page (settings strip, Additional Settings, KPI strip with switchable tiles, five forecast tabs, line item table grouped by buying method, line item slide-over, Modify columns saved per user, Make a copy, Create campaign, Remove, Download CSV, locked and read-only states), Cross-media reach list, progressive create form with the IO and TV pickers, report detail, link from the Reports hub; 44 unit, 15 db and 6 Playwright cases (`planning.spec.ts`) green. Not done: shared targeting panel on plan rows, TV forecast model, `SimReachSnapshot` inputs, change-log for reports, see `docs/gaps/p4-08.md` | P4-10, P4-12 |
| 2026-10-30 | P4-10b | Experiments and lift (module 17): no migration (all Δ17 columns exist in `0002_extended`); `lib/experiments` (constants, AB and LS rules, A/B maths with z tests and Best, lift requirement and survey simulation, difference algorithm, services with change-log registries `EXPERIMENT` and `LIFT_STUDY`, seed of 2 tests and 3 studies per advertiser), engine steps `advanceExperiments` and `advanceLiftStudies` in `persistTick` plus the arm supply share (`LineItemEntity.supplyShare`), Experiments page with both tabs, A/B create and Settings form, arm picker, report with tiles, chart and Difference (parallel and intercepting routes), lift form with eligibility rail, Review and fix, report with lift types and slices, End and Add flight; 70 unit, 22 db and 8 Playwright cases (`experiments.spec.ts`) green. Not done: see `docs/gaps/p4-10b.md` | P4-10a merge, P4-11, P4-12 |
| 2026-10-30 | P4-11 | Optimisation, alerts and Troubleshooter (module 11 T11-14, T11-15, module 08 T08-11, module 06 T06-09, module 01 T12 partly): `lib/optimisation` (suggestion catalogue, health rows, `Recommendation` writer called from `persistTick`, `getIntelligence`, Investigate, Apply and Dismiss, campaign Alerts read model), engine rule `USE_OPTIMIZED_TARGETING`, `lib/troubleshooter` (assembler with the 5 stages and conservation, banner mapping, CSV, service), Intelligence panel body and Investigate drawer in the right rail, Troubleshooter page with SVG Sankey, campaign Alerts page, Alert preferences page (module 03 T6), API routes; no migration; unit, db and 9 Playwright cases (`optimisation.spec.ts`). Not done: see `docs/gaps/p4-11.md` | P4-12, then the A1 to A11 gaps |
| 2026-10-30 | P4-12 | Change history and notifications (module 05 T3..T10): no migration (every column exists); `lib/history` (zone labels, readers with day paging and Spend series, notes with HIS-001..004, CSV, notifications with HIS-010/011, actions, API routes), History pages for advertiser, campaign, IO and line item (day cards, toolbar, expand all, Load more, Spend chart, notes slide-over at `?sim_panel=notes:YYYYMMDD`), bell with announcements (30 s poll, per-user dismiss), creative History upgraded to the module 05 layout; `withChangeLog` now puts an entity in its own chain (IO and line item groups were invisible to their own History); unit, db and Playwright (`history.spec.ts`) green. Not done: see `docs/gaps/p4-12.md` | P4-11, Phase 5 instructor console |
| 2026-10-30 | ENG-FF | Engine history mode and sandbox provisioning (M18-05): `fastForward` can run in history mode (a 24 tick batch is merged and written once, hourly rows for 14 days and slices for `sliceDays` only), same numbers as the per-tick path (db test compares every engine table), 90 sim days in about 58 s instead of 364 s per sandbox; seed knob `engineDays`; `lib/sandbox/provision.ts` replaces the stub (enqueue, atomic claim, seed, access grant, chunked history job, post-history seeds, READY/FAILED, retry), driven by the tick route, `/sim/welcome` (progress bar, `POST /api/sim/provision`) and Create/Retry sandbox on the account page; no migration. Not done: see `docs/gaps/eng-ff.md` | P5-01 reset (calls `runProvisionStep` after marking PENDING), engine volume calibration vs the stub |
| 2026-10-30 | P5-01 | Instructor console (module 18 M18-07, M18-08, M18-09, M18-16, module 03 T09 console part): no migration (every column exists); `lib/instructor` (SIM rules, weekly window maths in the class time zone, window service with Open now and Close now, roster over the account service (RC-073), sandbox create and reset over the seed pipeline, dashboard, announcements list, certificate requests, Super admin classes, audit query and engine params), `app/sim/instructor/**` and `app/sim/admin/**` pages, `components/instructor`; unit, db and Playwright (`instructor.spec.ts`) green. Not done: M18-17 snapshots, clock page, scenarios, progress, see `docs/gaps/p5-01.md` | P5-03, P5-02 |

| 2026-10-30 | PROD-CRASH | Root cause of the production 500s: Supabase has RLS on for every table; the global tables that `app_tenant` may only SELECT had no policy, so `serviceCtx()` read no Sandbox row and answered FORBIDDEN. Migration `0011_rls_read_policies` (RLS + SELECT policy per table: Sandbox/Classroom own row, Notification/Scenario global or own classroom, catalogues all rows), `FORBIDDEN` renders a 403 page, `instrumentation.ts` logs request errors with the digest, the error page shows the digest. New: `tests/db/supabase-rls.db.test.ts`, `tests/e2e/prod-like-crawler.spec.ts` (Playwright project `prod-like`, CI job `prod-like`). Not done: `docs/gaps/prod-crash.md` | Review and merge |
| 2026-10-30 | ADM-FIX | Product decision (owner): two account levels only, a Super admin and students. Removed the Admin/instructor level from every user-facing place (`/sim/instructor/**`, `/sim/admin/**`, the instructor console of P5-01, class windows and `/sim/closed`, access periods at sign in, the owner-admin column, new-admin options); the DB enum value `ADMIN` stays (no migration) but nothing creates, lists or signs it in. Super admin console moved to `/manage` (accounts, cohorts, audit, seed, engine). Students always have access; cohorts are an optional grouping (a hidden default cohort holds students added without one). Provisioning: heartbeat and 60 s stale window, "Create / Retry / Restart sandbox" recovers any non-ready build, welcome page opens the sandbox home. 404 link goes to the person's own landing. Cohort detail page, bookmarkable `?q=` account search, readable audit log, responsive accounts table. Tests: db and e2e rewritten, new E2E-ADM-01/02 and E2E-ACC-04..08. Not done: `docs/gaps/adm-fix.md` | Review and merge; then clean the retired tables in a later migration if wanted |
---

### 11. Open Questions
Owner decisions are listed with their conflict-log id (`docs/specs/conflicts.md`) and checklist item (`docs/specs/build-plan.md` section 1). Each has a default, so the build can start; items marked **blocks** stop Phase 3.
1. ~~Which browser?~~ Answered: Claude in Chrome.
2. ~~Approve PROJECT.md and the stack in §7.1 (ADR-006 to ADR-010)?~~ Approved 2026-10-28 (P-01, RC-060, ADR-039).
3. Still open: prepare the cloud environment `dv360-build` and turn off the usage-credits toggle; confirm the $100 balance (P-02, P-12). **Blocks P3-01.**
4. ~~Keep the repo public, or make it private before code lands?~~ Stays public, with a never-commit-secrets rule (RC-059, ADR-044).
5. Still open: import the repo into Vercel Hobby, no upgrade needed now (P-03), copy the Supabase URLs into Vercel env vars (P-04), generate `AUTH_SECRET` and `CRON_SECRET` into Vercel (P-07), GitHub Actions secrets (P-06). Preview deploys wait for this.
6. ~~Engine tick plan?~~ GitHub Actions timer every 5 minutes plus lazy catch-up on Vercel Hobby (P-05, RC-056, ADR-048).
7. How many free students per cohort, and is public self-signup wanted? OPEN owner question (RC-057). Default: 25 concurrent, no self-signup (accounts created by Super admin or Admin only). Database: free Supabase tier for the pilot (ADR-040, ADR-045).
8. One simulated partner per student (default) or shared sandboxes for pairs (RC-061)?
9. Logo is committed (`docs/brand/adsmentor-logo-horizontal.png`, ADR-043). Still open: reference screenshots are not in the repo (design-system Q1) (P-09 partly done).
10. ~~Real or fictional vendor names?~~ Real names with invented prices (RC-055, ADR-042).
11. AI-looking features: canned Tutor (default) or real model calls (RC-054)?
12. Billing, invoices and partner-level lists deferred past Phase 4 (RC-062)? Please confirm.
13. Student accounts: **answered 2026-10-28** (RC-063, ADR-047): created by a Super admin or Admin with email login and a shared password, no email provider. Still open: forced password change default, one session per account, cohort size 25 (module 19 section 8)? Student uploads allowed (RC-064)? Retention after a course (RC-065)?
14. Any specific exercises you already teach that should become Phase 5 scenarios? Default: the 10 starters in module 18.
15. How many cloud sessions can run in parallel on this account? The wave plan assumes up to 5 (build-plan P-12, R-03).
16. ~~Who merges the pull requests?~~ The Cowork assistant may merge Phase 3+ build PRs under the conditions in build-plan 3.6 (P-13, ADR-046).

---

### Notes: screenshot guard (2026-10-31)
Students whose `screenshotsAllowed` is false (the default) are watched for Print Screen, Win+Shift+S, the macOS Cmd+Shift+3/4/5/6 shortcuts and print attempts; a recognised event suspends the account (all sessions invalidated, sign in refused with the same message), writes an audit entry and raises a Super admin alert (`/manage/security`, banner, badge, 30 s toast poll). The Super admin restores access and switches screenshots on or off per student, in bulk from the Accounts list. **Honest scope: browsers cannot detect screenshots, so this is a tripwire and deterrent for keyboard routes only, not prevention; keystrokes are never logged (only method, page path and time of a recognised event).** No email service yet (follow-up). Details and limits: `docs/gaps/screenshot-guard.md`; spec: `docs/specs/modules/19-account-management.md` 2.5, 4.5, 4.11.
