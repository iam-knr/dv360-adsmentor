# DV360 Simulator by Adsmetor — Project Log (tasks, discussions, build details)
Last updated: 2026-10-29 (wave 4 built, handover to colleague) · Master plan: `PROJECT.md` · Findings: `docs/explore/` · Specs: `docs/specs/` · Decisions: `docs/decisions.md` · Build plan: `docs/specs/build-plan.md`

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
