# DV360 Simulator by Adsmetor — Project Log (tasks, discussions, build details)
Last updated: 2026-10-28 (owner approvals recorded) · Master plan: `PROJECT.md` · Findings: `docs/explore/` · Specs: `docs/specs/` · Decisions: `docs/decisions.md` · Build plan: `docs/specs/build-plan.md`

---

## 1. What we are building
A classroom-only training simulator that replicates Google Display & Video 360 (DV360) screen-for-screen and is fully functional (forms validate, campaigns "run" via a simulated ad-serving engine, reports reflect simulated delivery), so students learn real programmatic workflows without real money or real client data.

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
| D16 | Hosting and cron | Vercel team "BIGSEO's projects"; Pro required for paying students; Vercel Cron is the default tick trigger, GitHub Actions timer is the fallback; function region `dub1`. Closes P-05, RC-056 (ADR-041) | Kailas |
| D17 | Vendor names | Real exchange, verifier and vendor names with invented prices, also in Advertiser settings. Closes P-10, RC-055 (ADR-042) | Kailas |
| D18 | Logo | `docs/brand/adsmentor-logo-horizontal.png` committed; used in app bar and login; P3-03 derives a square icon. Screenshots still missing. Closes RC-058, P-09 partly (ADR-043) | Kailas |
| D19 | Repo visibility | Stays public. Never commit secrets, `.env*`, keys, DB URLs or student data; secret scan in P3-01 CI. Closes RC-059 (ADR-044) | Kailas |
| D20 | Class size | Up to 25 concurrent students; free Supabase tier for the pilot with reduced retention; P6-03 target 25, 60 stretch. Closes RC-057 (ADR-045) | Kailas |
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
| P0-05 | Vercel + Postgres | 🟨 | Supabase project exists (ref `bwqzdhyatvhpssxtwjza`); pending: Vercel import and Pro upgrade, env vars, secrets, cloud environment (build-plan 1.2 to 1.10, P-02, P-03, P-04, P-06, P-07) |
| P0-06 | Turn off usage-credits toggle | ⬜ | Kailas (build-plan P-12) |
| P0-07 | Browser + DV360 sign-in | ✅ | Claude in Chrome |

### Phase 1 — DV360 exploration (`docs/explore/`)
| ID | Section | Status | File | Key findings |
|---|---|---|---|---|
| P1-01 | Global shell | ✅ | `01-global-shell.md` | URL scheme; top bar (AI search, notifications, user mgmt, bulk status, reports, shortcuts, product switcher); partner/advertiser nav; right rail (Ask Advisor, Quick help, Intelligence); Partner Overview; Bulk status; shortcuts |
| P1-02 | Partner level | ✅ | `02-partner-level.md` | Advertisers list; date picker presets; basic details (SDF versions); exchanges list; targeting defaults; advertiser configurations; brand controls; users & roles |
| P1-03 | Campaigns | ✅ | `03-campaigns.md` | List + actions; New campaign form; goal→KPI table; validation; campaign page; alerts |
| P1-04 | Insertion orders | ✅ | `04-insertion-orders.md` | Type + objective matrix; full form (budget segments, pacing, KPIs, optimisation, freq cap, partner costs); IO page |
| P1-05 | Line items | 🟨 | `05-line-items.md` | Type picker; full Display form; type differences; LI page; Troubleshooter funnel. Gaps: DOOH, Demand Gen, app-install step 2 |
| P1-06 | YouTube | ✅ | `06-youtube.md` | YT LI subtypes/ad formats; details; ad groups; create ad + preview |
| P1-07 | Targeting | ✅ | `07-targeting.md` | All 16 Display targeting editors |
| P1-08 | Creatives | 🟨 | `08-creatives.md` | Library; New menu; 3P display form; creative status & exchange review; format gallery; appeals. Gaps: upload/native/video/audio forms |
| P1-09 | Inventory & Marketplace | ✅ | `09-inventory.md` | Orders/deals, packages, groups; deal page; instant deals; Featured & Discover; plans & negotiations lists |
| P1-10 | Audiences | ✅ | `10-audiences.md` | Tabs; create types; tag-based, combined, lookalike, custom affinity forms; analysis |
| P1-11 | Resources | ✅ | `11-resources.md` | Brand controls; channels; negative keywords; Floodlight; YouTube assets; location lists; custom bidding wizard |
| P1-12 | Reporting | ✅ | `12-reporting.md` | Hub, templates, instant builder, ~700-field catalogue, offline builder |
| P1-13 | Planning & reach planner | 🟨 | `13-planning.md` | Plans list; plan forecast page (KPIs, tabs, line-items table, columns); Cross-media reach create flow. Gaps: New plan, editable settings, forecast charts, plan → campaign |
| P1-14 | Advertiser settings | ✅ | `14-advertiser-settings.md` | Basic details (SDF, ad server, authorizations, EU political, Demand Gen Floodlight switch, 3P services); targeting rules; data manager; alert preferences (10 alerts); policy center certificates |
| P1-15 | Bulk, SDF, rules, experiments, optimisation | 🟨 | `15-bulk-sdf-experiments.md` | SDF download/upload; bulk Action bar; custom charts; Intelligence panel; lift study form; targeting templates. Gaps: bulk edit panels only (A/B now in 18) |
| P1-16 | Change history, notifications | ✅ | `16-history-notifications.md` | History page at advertiser/IO level (toggles, date range, day cards, old → new), notes panel, notifications, right rail |
| P1-17 | Gap sweep | ✅ | `17-gap-sweep.md` | Filled: image creative page, creative History, audience detail, Google tag tab, channel/keyword list editors, report runs, 404. Remaining gaps blocked by demo access — see file |
| P1-18 | Experiments (A/B + lift) | ✅ | `18-experiments.md` | A/B create/report/settings; lift study create (eligibility, required media cost, survey), report slices, review & fix |

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

### Known gaps to revisit
- LI: DOOH, Demand Gen, app-install step 2, YouTube audio, YT target-frequency/TrueView/ad-sequence forms.
- Creatives: HTML5/image, video, audio, native, VAST, bulk upload.
- Targeting: video-only options; Apps & URLs sub-pages; IAS/Scope3 options.
- Partner: create advertiser, billing, role picker.
- Inventory: negotiation/RFP flow; deal group create.
- Audiences: detail page; custom intent; YouTube users.
- Resources: channel/keyword list/app & CTV Floodlight forms; Google tag tab; custom bidding Test step.
- Reporting: full Date/Fees/Conversions/YouTube lists; results grid; Inventory Availability builder.
- Planning: New plan flow; editable Location/Dates/Demographics/Additional Settings; forecast charts per tab; plan line-item editor; Copy dialog; plan → campaign conversion (demo has Limited Access and only past-dated plans).
- Advertiser settings: other ad server options; Google tag Manage page; Link new account flows; Schedule for deletion dialog; targeting rules editors.
- Bulk/SDF/experiments: A/B test create flow; bulk edit Settings/Creative assignment panels; SDF Download step 2; Download metadata/QA outputs; lift study Object type/Intended action options.
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
| Jobs | Vercel Cron + server actions for simulation ticks |
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
2. Vercel project import and Pro upgrade (P-03); Supabase URLs into Vercel env vars (P-04); GitHub Actions secrets (P-06); `AUTH_SECRET` and `CRON_SECRET` into Vercel (P-07). Preview deploys wait for these.
3. Reference screenshots are not in the repo (`docs/screenshots/` is empty); design-system Q1 stays open (P-09 partly done).
4. One sandbox per student (assumed, RC-061); canned Tutor (RC-054); billing deferred (RC-062); student accounts, uploads and retention (RC-063 to RC-065).
5. Existing exercises to turn into scenarios (default: the 10 starters in module 18).
6. Access to an IO without objective and a Floodlight-optimised advertiser to finish the LI gaps (still open from Phase 1).

## 8. Next steps
1. Phase 1 and Phase 2 are done (Phase 1 gaps are listed in "Known gaps"; they are filled from public docs in the specs). Owner approvals of 2026-10-28 are recorded (ADR-039 to ADR-046).
2. Owner: complete P-02 (cloud environment `dv360-build`) and P-12 (usage credits off, $100 balance) by Sat 31 Oct; P-03 (Vercel import and Pro upgrade), P-04 (Supabase URLs into Vercel), P-06 (GitHub Actions secrets) and P-07 (`AUTH_SECRET`, `CRON_SECRET` into Vercel) by Sun 1 Nov morning. Values go only into Vercel, never chat or the repo.
3. Sun 1 Nov: run wave 1 (P3-01, including the secret-scan CI step), then waves 2 to 5 as in build-plan section 3. The Cowork assistant merges build PRs under the conditions in build-plan 3.6. Merge freeze Thu 5 Nov 9:00 AM IST; credit expires 1:29 PM IST.
4. After Phase 3: planning sessions update the specs from the gap list (`docs/gaps/p3.md`) and write Phase 4 prompts from build-plan 3.7.
