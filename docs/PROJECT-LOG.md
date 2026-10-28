# DV360 Simulator by Adsmetor — Project Log (tasks, discussions, build details)
Last updated: 2026-10-28 · Master plan: `PROJECT.md` · Findings: `docs/explore/`

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
| D9 | Stack (proposed, pending approval) | Next.js App Router + TypeScript + MUI + Prisma/PostgreSQL + Vercel; Recharts; Auth.js; Vitest + Playwright | Claude |
| D10 | Build budget | Build in Claude Code cloud sessions using the $100 cloud credit (expires 5 Nov 2026) | Kailas + Claude |

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
| P0-02 | Review & approve PROJECT.md | ⬜ | Incl. stack approval |
| P0-03 | Repo + PROJECT.md committed | ✅ | |
| P0-04 | Repo connected to Claude Code on the web | ✅ | Cloud sessions commit successfully |
| P0-05 | Vercel + Postgres | ⬜ | |
| P0-06 | Turn off usage-credits toggle | ⬜ | Kailas |
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
| P1-15 | Bulk, SDF, rules, experiments, optimisation | 🟨 | `15-bulk-sdf-experiments.md` | SDF download/upload; bulk Action bar; custom charts; Intelligence panel; lift study form; targeting templates. Gaps: A/B test create, bulk edit panels |
| P1-16 | Change history, notifications | ⬜ | | |
| P1-17 | Gap sweep | ⬜ | | Revisit 🟨 items |

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

## 5. Build details

### 5.1 Architecture
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
Partner · Advertiser · Campaign · InsertionOrder · BudgetSegment · LineItem · AdGroup · Ad · Creative · CreativeReview · CreativeAssignment · TargetingAssignment · Audience · Channel · KeywordList · LocationList · Exchange · Deal · Package · Order · InventorySource · FloodlightGroup · FloodlightActivity · CustomBiddingAlgorithm · Report · ReportRun · Plan · Experiment · BulkJob · ChangeLog · Alert · User · Role · Classroom · AccessWindow · Scenario · ScenarioAttempt · SimDailyMetric · DeliveryDiagnostic.

### 5.3 Business rules captured (examples)
- Campaign goal → recommended KPIs; non-recommended KPI = warning only.
- IO type + objective gate KPIs, bid strategies and LI types (CTV disables Clicks; DOOH only "no objective" + fixed bid).
- New IO/LI default Draft; required: name ("Enter a value"), budget > 0, KPI value > 0 ("Enter a number greater than 0"), creative type, EU political ads answer.
- Pacing Flight (Ahead/Even) or Daily (Even/ASAP); IO automated bid & budget forces LI ASAP.
- Frequency caps nest campaign → IO → LI.
- Creatives serve only on exchanges where approved; geo restrictions block matching LIs.
- Audiences available after 4 h (combined immediately); lookalike seed ≥ 1,000 users.
- Floodlight counting: Standard / Unique / Per session / Transactions / Items sold.

### 5.4 Simulation engine
1. Tick = 1 simulated hour; speed set by instructor.
2. Bid opportunities per exchange × geo × device × environment × audience from synthetic supply.
3. Each active LI passes the Troubleshooter funnel: Targeting → Creatives → Frequency → Budget → Pacing → Min bid → Internal auction → External (bid too low / creatives / other) → Won.
4. Bid from strategy (fixed CPM, maximise clicks/conversions/reach, target CPA/CPM, custom bidding score × multipliers).
5. Wins → impressions, viewability, clicks, video quartiles, Floodlight conversions (lag, counting, attribution window), costs incl. fees.
6. Write SimDailyMetric + DeliveryDiagnostic → list columns, chart cards, alerts, Troubleshooter, reports.

### 5.5 Build order
| Phase | Tasks |
|---|---|
| P2 Specs | data model, routes, design system, validation catalogue, engine spec, module specs, cloud-session prompts |
| P3 Foundation | scaffold + Vercel; auth/roles/access windows; app shell; shared components; data model + seed; Campaign→IO→LI CRUD + validation; targeting panel; engine v1; performance columns |
| P4 Modules | creatives; inventory/marketplace; audiences; resources; custom bidding; YouTube; reporting; planning; settings/users; bulk/SDF/experiments; optimisation & alerts; change history |
| P5 Training | instructor console; scenarios + auto-checks; time acceleration; progress dashboard |
| P6 QA & launch | fidelity review; E2E tests; load test; pilot; launch |

## 6. SOPs in use
- Explore: open section → record path → capture views, tables, forms, actions → write explore file → tick checklist.
- Safety: read-only exploration; forms discarded; no real names/emails copied.
- Status: each task → checklist tick + status row + commit `docs: status <task-id>`.

## 7. Open questions
1. Approve stack?
2. Students per class?
3. One sandbox per student (assumed) or shared?
4. Existing exercises to turn into scenarios?
5. Keep repo public or make private before code lands?
6. Access to an IO without objective and a Floodlight-optimised advertiser to finish LI gaps?

## 8. Next steps
1. P1-16 → P1-17.
2. Phase 2 specs by 1 Nov so Phase 3 can use the cloud credit before 5 Nov 2026.
