# DV360 Simulator by Adsmetor — Master Project Plan

> Single source of truth for the project: goals, rules, SOPs, full module scope, architecture, phase-by-phase action plan, checklist, decisions and status.
> **Update this file after every completed task** (see §10 Status Log).

| Field | Value |
|---|---|
| Product name | DV360 Simulator by Adsmetor |
| Purpose | Classroom-only training simulator that replicates Display & Video 360 so students practise real programmatic workflows |
| Reference source | Vendor-provided **demo** DV360 account (no live spend; full create/edit/activate allowed for exploration) |
| Target fidelity | 100% — every section, screen, option and workflow of DV360 |
| Doc owner | Kailas Nath R (Adsmetor) |
| Created | 2026-10-28 |
| Current phase | **Phase 1 — Exploration** |

---

## 1. Goals

1. Students experience DV360 exactly as they would on the job: same navigation, screens, forms, options, validations and workflows.
2. Everything is **functional**, not just visual: creating a line item validates like DV360, targeting changes affect delivery, reports reflect what the simulated campaigns did.
3. A **simulated ad-serving engine** makes campaigns "run" (impressions, clicks, conversions, spend, pacing) so students can optimise and troubleshoot.
4. Instructors control **when** students have access (classroom sessions only) and can run guided exercises.

### Non-goals
- No connection to real Google systems, real exchanges or real money.
- No real client or advertiser data — all data is synthetic.

---

## 2. Agreed Rules (from discussion, 2026-10-28)

| # | Rule |
|---|---|
| R1 | Branding is **"DV360 Simulator by Adsmetor"**. Google logos and Google Account sign-in screens are not reproduced; the simulator uses its own Adsmetor login. |
| R2 | UI/UX, layout, navigation, fields and workflows replicate DV360 as closely as possible. The code is written from scratch (no copying Google's source code, scripts or image assets). Icons come from the open-source Material Symbols set. |
| R3 | Access is **classroom-only**: instructor opens/closes access per session; no take-home access. Legal clearance is handled by Adsmetor. |
| R4 | The demo account may be freely explored, including create / edit / save / activate / pause, to observe real behaviour. |
| R5 | No real-looking client data is copied. Names, IDs, budgets and metrics in the simulator are generated. |
| R6 | Every exploration finding goes into `docs/explore/*.md` before it is built. Nothing is built from memory alone. |
| R7 | Exploration and planning run in Cowork (normal plan limits). The **build runs in Claude Code cloud sessions** (uses the $100 cloud credit, expires **5 Nov 2026, 1:29 PM IST**). |
| R8 | **No project files are stored on the local PC.** Everything (docs, explore notes, screenshots, code) lives only in the GitHub repo `iam-knr/dv360-adsmentor`. Local exploration sessions hand content to cloud sessions, which commit it. |

---

## 3. Tooling & Workflow

| Need | Tool |
|---|---|
| Explore DV360 demo account | Claude in Chrome (account signed in there) |
| Store docs + code | GitHub repo `iam-knr/dv360-adsmentor` (public) |
| Commit files | Claude Code cloud sessions on that repo (GitHub connector) |
| Build | Claude Code cloud sessions on that repo (claude.ai/code) |
| Hosting | Vercel (preview deploy per branch, production on `main`) |
| Database | PostgreSQL (Neon or Supabase free tier) |

### Repo layout
```
dv360-adsmentor/
├─ PROJECT.md                 ← this file
├─ docs/
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

## 4. SOPs

### SOP-1: Exploring a DV360 section
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

### SOP-2: Building a module
1. Write `docs/specs/<module>.md` from the explore file (data model, routes, components, rules, test cases).
2. Start a cloud session on the repo with prompt: *"Read PROJECT.md and docs/specs/<module>.md. Implement it. Write tests. Update PROJECT.md checklist and status log."*
3. Review the Vercel preview link side-by-side with DV360.
4. Log differences as tasks; fix; merge to `main`.
5. Update §6 checklist and §10 status log.

### SOP-3: Fidelity review (per module)
- Side-by-side check: layout, labels, field order, defaults, validation messages, table columns, empty states.
- Functional check: same inputs → same outcome as DV360.
- Pass = ≥ 95% items match; remaining gaps logged.

### SOP-4: Status updates
After every task: tick the checklist item, add one line to §10 (date, task ID, result, next step), commit with message `docs: status <task-id>`.

---

## 5. Complete Module Map (scope)

> Built from current knowledge of DV360. **Every item is verified (and gaps added) during Phase 1 exploration.** Nothing is out of scope.

### 5.1 Global shell
- Top bar: product name, Partner/Advertiser switcher with search, global search, notifications/alerts, help, settings, user menu
- Left navigation (changes by level: Partner / Advertiser)
- Breadcrumbs, entity status chips, date-range picker, "Compare" toggle
- Change history panel, notes/comments, recently viewed
- Ask Advisor (AI chat assistant panel), Quick help panel, Intelligence panel (advertiser health + optimisation suggestions)
- Partner Overview home page with workspaces, tutorials, pinned items, recently opened
- Bulk status page (history of bulk jobs)
- Keyboard shortcuts dialog

### 5.2 Partner level
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

### 5.3 Advertiser level — Campaigns
- **Campaigns**: list, create/edit (name, goal, KPI, planned spend, flight dates, frequency cap, creative types, inventory source types, demographics/geo defaults), statuses
- **Insertion Orders**: list, create/edit (type, budget unit, budget segments, pacing type & amount, frequency cap, KPI, optimisation, partner costs, targeting), duplicate, bulk edit
- **Line Items** — all types:
  - Display, Video, Audio, YouTube & partners (incl. Video reach / action / view / Demand Gen variants), Connected TV, Over-the-top, Mobile app install, Mobile app engagement
  - Tabs/sections: basic details, flight & budget, pacing, bid strategy (fixed CPM, maximise conversions/clicks, target CPA, target ROAS/custom bidding, viewable CPM), creatives assignment, frequency cap, conversion tracking (Floodlight), partner costs, revenue model, optimised targeting
- **Ad groups / ads** (YouTube line items)
- Bulk tools: bulk edit, duplicate, upload/download **Structured Data Files (SDF)**, rules/automation
- **Experiments** (A/B tests)
- **Optimisation**: recommendations, optimisation score, alerts & troubleshooting (e.g. "line item not spending" diagnostics)

### 5.4 Targeting (shared panel used at IO / LI / ad group)
Geography (incl. radius, location lists, postal codes) · Language · Demographics (age, gender, parental status, household income) · Audience lists (first-party, Google, affinity, in-market, custom, combined, lookalike) · Device type, make/model, OS · Browser · Connection speed · Carrier & ISP · Environment (web, app) · Day & time · Viewability · Position (above/below fold, video player size, in-stream/out-stream) · Content (genres, categories, keywords, negative keywords) · Brand safety (digital content labels, sensitive categories, third-party verification: IAS, DoubleVerify, etc.) · Apps & URLs / channels · Inventory sources (exchanges, deals, groups) · Audio/video content duration, livestream · Native & rewarded · Targeting expansion

### 5.5 Creatives
- Library: list, filters, review/approval status (pending, approved, disapproved per exchange)
- Create: standard display (upload image), HTML5 (zip), native (image/video), video (hosted, VAST), audio, third-party tags (display/VAST), bulk upload
- Creative details: dimensions, landing URL, tracking (impression/click trackers), integrations (Campaign Manager 360 sync), expansion, MRAID, SSL
- Preview, assignment to line items, creative QA errors

### 5.6 Inventory
- **My inventory**: deals (Private Auction, Preferred, Programmatic Guaranteed), groups, sites/apps lists
- **Marketplace**: publisher catalog, proposals & negotiation flow (send RFP, accept/decline), packages, Programmatic Guaranteed setup
- Inventory sources: open exchanges list & settings
- ads.txt / sellers.json indicators

### 5.7 Audiences
- Audience list: types, sizes, match rates, status
- First-party: Floodlight remarketing lists, Customer Match uploads, YouTube users
- Google audiences: affinity, in-market, life events, detailed demographics
- Combined audiences, custom audiences (interest/intent), lookalike lists
- Audience size estimates in targeting

### 5.8 Resources
- Channels (site/app lists), keyword lists, negative keyword lists, location lists
- Floodlight: groups, activities, tags, conversion counting methods, custom variables
- Linked accounts (CM360, Google Analytics, Google Ads, YouTube)
- Third-party verification setup
- Custom bidding algorithms (script / goal-based), with training status

### 5.9 Reporting
- **Instant reports**: dimensions & metrics picker, filters, date ranges, pivoting, charts, save/schedule, export CSV/XLSX
- **Offline / scheduled reports** (Report Builder): templates (Standard, Reach, Audience composition, Floodlight, YouTube, Path-to-conversion), schedule, email delivery, history
- In-UI performance columns & graphs on every list page
- Insights: reach & frequency, audience/demographic insights, brand lift (survey simulation)

### 5.10 Planning
- Planner / Plans (forecasting reach, impressions & cost for a plan, converting plans to campaigns)
- Reach planner

### 5.11 Advertiser settings
Basic details (name, URL, industry, currency, time zone) · Ad serving (CM360 link) · Creative settings (OBA icon, Dynamic creatives) · Floodlight config · Linked accounts · Billing · Targeting defaults · Brand safety defaults · Data access/Integrations

### 5.12 Admin, history & misc
- Change history (per entity: who, when, field, old → new)
- Notifications & alerts centre
- Help panel (Adsmetor-written learning tips instead of Google help text)

### 5.13 Simulator-only features (Adsmetor layer)
- **Simulation engine** (§7.3): time acceleration (1 day = N minutes), auction, pacing, metrics
- **Instructor console**: open/close classroom access, create class & student accounts, reset sandboxes, load scenarios, view student progress
- **Scenarios / exercises**: guided tasks ("Launch a CTV campaign", "Fix under-pacing IO", "Add PG deal"), auto-checked
- Per-student sandboxed partner/advertiser with seeded data

---

## 6. Phase-by-Phase Action Plan & Checklist

Status keys: ⬜ Not started · 🟨 In progress · ✅ Done · ⛔ Blocked

### Phase 0 — Planning & setup (Cowork) — target: 28–29 Oct
- ✅ P0-01 Draft PROJECT.md master plan
- ⬜ P0-02 Review & approve PROJECT.md (Kailas)
- ✅ P0-03 GitHub repo `iam-knr/dv360-adsmentor` created; PROJECT.md committed
- ⬜ P0-04 Connect repo to Claude Code on the web (GitHub App)
- ⬜ P0-05 Connect repo to Vercel; set up Postgres (Neon/Supabase)
- ⬜ P0-06 Turn off "usage credits" toggle in Claude settings (avoid surprise charges)
- ✅ P0-07 Browser = Claude in Chrome ("Browser 1" profile); DV360 signed in

### Phase 1 — Full DV360 exploration (Cowork + browser) — target: 29–31 Oct
One explore file per item; screenshots on demo data only.
- ✅ P1-01 Global shell & navigation (§5.1) → docs/explore/01-global-shell.md
- ✅ P1-02 Partner level (§5.2) → docs/explore/02-partner-level.md
- ⬜ P1-03 Campaigns (§5.3)
- ⬜ P1-04 Insertion orders (§5.3)
- ⬜ P1-05 Line items — every type, every tab (§5.3)
- ⬜ P1-06 YouTube ad groups & ads (§5.3)
- ⬜ P1-07 Targeting — every dimension (§5.4)
- ⬜ P1-08 Creatives — every type (§5.5)
- ⬜ P1-09 Inventory & Marketplace (§5.6)
- ⬜ P1-10 Audiences (§5.7)
- ⬜ P1-11 Resources incl. Floodlight & custom bidding (§5.8)
- ⬜ P1-12 Reporting — instant & offline (§5.9)
- ⬜ P1-13 Planning & reach planner (§5.10)
- ⬜ P1-14 Advertiser settings (§5.11)
- ⬜ P1-15 Bulk tools, SDF, rules, experiments, optimisation, alerts (§5.3)
- ⬜ P1-16 Change history, notifications, misc (§5.12)
- ⬜ P1-17 Gap sweep: click every remaining menu item; add anything missing to §5

### Phase 2 — Specs & architecture — target: 31 Oct–1 Nov
- ⬜ P2-01 Data model (all entities & relationships) → `docs/specs/data-model.md`
- ⬜ P2-02 Route map mirroring DV360 navigation → `docs/specs/routes.md`
- ⬜ P2-03 Design system: colours, typography, spacing, components matching DV360 look → `docs/specs/design-system.md`
- ⬜ P2-04 Validation rules catalogue → `docs/specs/validation.md`
- ⬜ P2-05 Simulation engine spec → `docs/specs/engine.md`
- ⬜ P2-06 Module specs (one per §5 area)
- ⬜ P2-07 Build order & cloud-session prompts written

### Phase 3 — Foundation build (cloud sessions, $100 credit) — target: 1–5 Nov
- ⬜ P3-01 Next.js + TypeScript + Prisma + Postgres scaffold; Vercel deploy
- ⬜ P3-02 Adsmetor auth, roles (student / instructor / admin), classroom access windows
- ⬜ P3-03 App shell: top bar, switcher, left nav, breadcrumbs, date picker
- ⬜ P3-04 Shared components: data table (columns picker, filters, bulk actions), side panel forms, dialogs, status chips
- ⬜ P3-05 Full data model + seed generator (partners, advertisers, campaigns, IOs, LIs, creatives, deals, audiences)
- ⬜ P3-06 Campaigns → IOs → Line items CRUD with full validation
- ⬜ P3-07 Targeting panel (all dimensions)
- ⬜ P3-08 Simulation engine v1 (auction, pacing, metrics)
- ⬜ P3-09 Performance columns on list pages

### Phase 4 — Remaining modules (cloud sessions / normal limits after credit)
- ⬜ P4-01 Creatives (all types, review statuses)
- ⬜ P4-02 Inventory, deals, Marketplace & PG negotiation
- ⬜ P4-03 Audiences (all types, combined, custom, lookalike)
- ⬜ P4-04 Resources: channels, lists, Floodlight, linked accounts, verification
- ⬜ P4-05 Custom & automated bidding
- ⬜ P4-06 YouTube line items, ad groups, ads
- ⬜ P4-07 Reporting: instant reports, offline reports, exports, schedules
- ⬜ P4-08 Planning & reach planner
- ⬜ P4-09 Partner & advertiser settings, users & roles
- ⬜ P4-10 Bulk edit, SDF upload/download, rules, experiments
- ⬜ P4-11 Optimisation recommendations, alerts & troubleshooting
- ⬜ P4-12 Change history, notifications

### Phase 5 — Training layer
- ⬜ P5-01 Instructor console (access windows, class roster, sandbox reset)
- ⬜ P5-02 Scenario engine + 10 starter exercises with auto-checks
- ⬜ P5-03 Time-acceleration controls (instructor)
- ⬜ P5-04 Student progress dashboard

### Phase 6 — QA & launch
- ⬜ P6-01 Fidelity review per module (SOP-3)
- ⬜ P6-02 Playwright end-to-end tests for core workflows
- ⬜ P6-03 Load test for a full classroom (e.g. 60 concurrent students)
- ⬜ P6-04 Pilot class, collect feedback, fix
- ⬜ P6-05 Production launch

---

## 7. Architecture

### 7.1 Stack
| Layer | Choice | Why |
|---|---|---|
| Framework | Next.js (App Router) + TypeScript | Full-stack, deploys natively on Vercel |
| UI | Material UI (MUI) + custom theme | DV360 is built on Material Design, so this gives the closest look and feel |
| Tables | MUI X Data Grid / TanStack Table | DV360-style column pickers, filters, bulk select |
| Charts | Recharts | Report & performance graphs |
| DB | PostgreSQL + Prisma | Relational hierarchy (Partner → … → Line item) |
| Jobs | Vercel Cron + server actions | Runs simulation ticks |
| Auth | Auth.js with credentials | Adsmetor login, classroom access windows |
| Tests | Vitest + Playwright | Rules + end-to-end workflows |

### 7.2 Core data model (outline)
Partner · Advertiser · Campaign · InsertionOrder · BudgetSegment · LineItem · AdGroup · Ad · Creative · CreativeAssignment · TargetingOption (polymorphic per dimension) · Audience · CombinedAudience · Channel · KeywordList · LocationList · Deal · InventorySource · Exchange · FloodlightGroup · FloodlightActivity · CustomBiddingAlgorithm · Report · ReportRun · Plan · Experiment · ChangeLog · Alert · User · Role · Classroom · AccessWindow · Scenario · ScenarioAttempt · SimDailyMetric

### 7.3 Simulation engine (how campaigns "run")
1. **Tick** = one simulated hour (instructor sets speed: e.g. 1 sim-day per 5 real minutes).
2. Each tick generates **bid opportunities** per exchange × geo × device × audience segment from synthetic supply curves.
3. Each active line item is checked: flight dates, budget left, pacing plan, targeting match, frequency cap, creative approved & size match.
4. **Bid** = strategy output (fixed CPM or model-based for auto bidding) → second-price/first-price auction against synthetic competitors → win rate.
5. Wins produce impressions → viewability, clicks (CTR model by creative/format), video quartiles, conversions (Floodlight, with lag).
6. Spend, pacing and metrics are written to `SimDailyMetric` → feeds tables, graphs and reports.
7. **Diagnostics**: when a line item doesn't deliver, the engine records why (budget, bid too low, targeting too narrow, creative disapproved), which feeds DV360-style alerts and troubleshooting.

---

## 8. Feasibility & Risks

| Risk | Impact | Mitigation |
|---|---|---|
| Scope is very large (DV360 has hundreds of screens) | Full build takes weeks to months, not one week | Phased plan; $100 credit covers Phases 3 core; later phases on normal limits / further credits |
| Cloud credit expires 5 Nov 2026 | Unused credit lost | Finish Phases 0–2 by 1 Nov; run several cloud sessions in parallel in Phase 3 |
| Demo account may hide some features (not enabled for vendor demos) | Gaps in replication | Note as "not visible in demo"; fill from public DV360 documentation |
| DV360 UI changes over time | Simulator drifts | Re-run SOP-3 fidelity review every quarter |
| Engine realism | Students learn wrong intuitions | Tune with realistic benchmark ranges (CPMs, CTRs, win rates) by format; instructor review |
| Classroom access control | Material leaving the classroom | Access windows, no data export outside reports module, session timeouts |
| Repo is public | Explore notes and screenshots of DV360 are visible to anyone | Kailas accepted (2026-10-28) to allow cloud-session access; revisit before Phase 3 |

---

## 9. Decision Log
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

---

## 10. Status Log
| Date | Task | Result | Next |
|---|---|---|---|
| 2026-10-28 | P0-01 | Master plan drafted | Kailas reviews; create GitHub repo; choose browser |
| 2026-10-28 | P0-03 | PROJECT.md and docs/ skeleton committed to `iam-knr/dv360-adsmentor` via cloud session | Kailas completes Google sign-in in Chrome; start P1-01 |
| 2026-10-28 | P1-01 | Global shell, partner + advertiser nav, top bar, right rail, Overview, Bulk status, shortcuts documented | P1-02 Partner level |
| 2026-10-28 | P1-02 | Partner level documented (advertisers list, basic details, exchanges, targeting defaults, advertiser configurations, resources, users) | P1-03 Campaigns |

---

## 11. Open Questions
1. ~~Which browser?~~ Answered: Claude in Chrome.
2. Approve the stack in §7.1?
3. How many students per class (sizes the load test and seed data)?
4. Should students share one simulated partner, or get one sandbox each? (Plan assumes one each.)
5. Any specific exercises you already teach that should become Phase 5 scenarios?
