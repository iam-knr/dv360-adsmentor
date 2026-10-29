# DV360 Simulator by Adsmetor — Master Project Plan

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
| Database | Supabase PostgreSQL (existing project, eu-west-1, free tier; Postgres only; ADR-040) |

### Repo layout
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

> Scope note (RC-062, RC-066): the demo partner nav has no pages for billing, invoices, partner costs and revenue models, or for partner-level audiences, combined audiences, custom lists, location lists and negative keyword lists, and routes.md has no routes for them. They are not built in Phases 3 and 4. Billing is deferred past Phase 4 (task 02-T14); the owner confirms this scope cut (build-plan 1.9).

### 5.3 Advertiser level — Campaigns
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

### 5.4 Targeting (shared panel used at IO / LI / ad group)
Geography (incl. radius, location lists, postal codes) · Language · Demographics (age, gender, parental status, household income) · Audience lists (first-party, Google, affinity, in-market, custom, combined, lookalike) · Device type, make/model, OS · Browser · Connection speed · Carrier & ISP · Environment (web, app) · Day & time · Viewability · Position (above/below fold, video player size, in-stream/out-stream) · Content (genres, categories, keywords, negative keywords) · Brand safety (digital content labels, sensitive categories, third-party verification: IAS, DoubleVerify, etc.) · Apps & URLs / channels · Inventory sources (exchanges, deals, groups) · Audio/video content duration, livestream · Native & rewarded · Targeting expansion

### 5.5 Creatives
- Library: list, filters, review/approval status (pending, approved, disapproved per exchange)
- Create: standard display (upload image), HTML5 (zip), native (image/video), video (hosted, VAST), audio, third-party tags (display/VAST), bulk upload
- Creative details: dimensions, landing URL, tracking (impression/click trackers), integrations (Campaign Manager 360 sync), expansion, MRAID, SSL
- Preview, assignment to line items, creative QA errors
- Format gallery (Optimized, Native display, Native video, Parallax, Swirl…)
- Appeal history
- Creative status: DV360 review + per-exchange review + restrictions + LI eligibility

### 5.6 Inventory
- **My inventory**: deals (Private Auction, Preferred, Programmatic Guaranteed), groups, sites/apps lists
- **Marketplace**: publisher catalog, proposals & negotiation flow (send RFP, accept/decline), packages, Programmatic Guaranteed setup
- Inventory sources: open exchanges list & settings
- ads.txt / sellers.json indicators
- Instant deals (pick exchange/publisher → name, targeting, advertiser access → forecast → accept)
- Marketplace Featured (curated package collections, bulk assign) and Discover (AI/keyword search + faceted filters, package detail with scale charts)
- Orders → deals hierarchy in My inventory; deal page tabs Overview / Access / Settings / History

### 5.7 Audiences
- Audience list: types, sizes, match rates, status
- First-party: Floodlight remarketing lists, Customer Match uploads, YouTube users
- Google audiences: affinity, in-market, life events, detailed demographics
- Combined audiences, custom audiences (interest/intent), lookalike lists
- Audience size estimates in targeting
- Custom lists: Custom affinity, Custom intent (Display/Video), Custom intent (YouTube)
- Analysis: Geographic distribution (seed audience) and Audience insights (LIs with optimized targeting)

### 5.8 Resources
- Channels (site/app lists), keyword lists, negative keyword lists, location lists
- Floodlight: groups, activities, tags, conversion counting methods, custom variables
- Linked accounts (CM360, Google Analytics, Google Ads, YouTube)
- Third-party verification setup
- Custom bidding algorithms (script / goal-based), with training status
- Brand controls overview (coverage of exclusions, authorized sellers, verification across LIs)
- YouTube assets (Location, Affiliate location, Sitelink)
- YouTube creator partnerships (BETA: Overview, Creator search, Content discovery, Management, Analytics)
- Custom bidding v2 wizard: objective → rules (score) + up to 4 multipliers → Test → Save

### 5.9 Reporting
- **Instant reports**: dimensions & metrics picker, filters, date ranges, pivoting, charts, save/schedule, export CSV/XLSX
- **Offline reports** (classic Report Builder): types Floodlight, Inventory Availability; template, filters, dimensions, metrics, schedule (repeats, time zone, start/expiry), delivery (format, file name, email owner, share)
- In-UI performance columns & graphs on every list page
- Insights: reach & frequency, audience/demographic insights, brand lift (survey simulation)
- Generate report (BETA, AI natural-language report creation)
- Report field catalogue (~30 categories, ~700 fields) — see docs/explore/12-reporting.md

> Scope note (RC-066): field counts are plans. Module 16 plans about 830 fields in 34 categories; the catalogue test asserts at least the counts seen in the demo.

### 5.10 Planning
- Planner / Plans (forecasting reach, impressions & cost for a plan, converting plans to campaigns)
- Reach planner

> Scope note (RC-066): Planner / Plans and Reach planner are one page in DV360 (explore 13). One module (04), one page.

### 5.11 Advertiser settings
Basic details (name, URL, industry, currency, time zone) · Ad serving (CM360 link) · Creative settings (OBA icon, Dynamic creatives) · Floodlight config · Linked accounts · Billing · Targeting defaults · Brand safety defaults · Data access/Integrations

> Scope note (RC-066): Advertiser settings follow explore 14: Basic details, Targeting rules, Data manager, Alert preferences, Policy center. The demo shows no OBA icon, Dynamic creatives or Billing pages. `industry` is an optional field on Create advertiser only (module 03).

### 5.12 Admin, history & misc
- Change history (per entity: who, when, field, old → new)
- Notifications & alerts centre
- Help panel (Adsmetor-written learning tips instead of Google help text)

### 5.13 Simulator-only features (Adsmetor layer)
- **Simulation engine** (§7.3): time acceleration (1 day = N minutes), auction, pacing, metrics
- **Instructor console**: open/close classroom access, create class & student accounts, reset sandboxes, load scenarios, view student progress
- **Account management dashboard (super admin / admin / user)**: separate `/manage` area (spec: `docs/specs/modules/19-account-management.md`). Super admin (owner) and Admin (instructor) add accounts by email with a password they set or generate and share by hand; Admins manage only their own Users. Cohorts, CSV import, access periods, audit log, lockout and session policy
- **Scenarios / exercises**: guided tasks ("Launch a CTV campaign", "Fix under-pacing IO", "Add PG deal"), auto-checked
- Per-student sandboxed partner/advertiser with seeded data

---

## 6. Phase-by-Phase Action Plan & Checklist

Status keys: ⬜ Not started · 🟨 In progress · ✅ Done · ⛔ Blocked

### Phase 0 — Planning & setup (Cowork) — target: 28–29 Oct
- ✅ P0-01 Draft PROJECT.md master plan
- ✅ P0-02 Review & approve PROJECT.md (Kailas) → approved 2026-10-28: stack as in §7.1 and ADR-006 to ADR-010, plan approved (ADR-039)
- ✅ P0-03 GitHub repo `iam-knr/dv360-adsmentor` created; PROJECT.md committed
- ✅ P0-04 Connect repo to Claude Code on the web (GitHub App) → cloud sessions commit successfully
- 🟨 P0-05 Connect repo to Vercel; set up Postgres → Supabase project exists (ref `bwqzdhyatvhpssxtwjza`, eu-west-1; ADR-040). Pending: Vercel project import (Hobby; no upgrade needed now, ADR-048), env vars (database URLs pasted only into Vercel), cloud environment, secrets (build-plan 1.2 to 1.10, items P-02, P-03, P-04, P-06, P-07)
- ⬜ P0-06 Turn off "usage credits" toggle in Claude settings (avoid surprise charges) → owner, build-plan item P-12
- ✅ P0-07 Browser = Claude in Chrome ("Browser 1" profile); DV360 signed in

### Phase 1 — Full DV360 exploration (Cowork + browser) — target: 29–31 Oct
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

### Phase 2 — Specs & architecture — target: 31 Oct–1 Nov
- ✅ P2-01 Data model (all entities & relationships) → [docs/specs/data-model.md](docs/specs/data-model.md)
- ✅ P2-02 Route map mirroring DV360 navigation → [docs/specs/routes.md](docs/specs/routes.md)
- ✅ P2-03 Design system: colours, typography, spacing, components matching DV360 look → [docs/specs/design-system.md](docs/specs/design-system.md)
- ✅ P2-04 Validation rules catalogue → [docs/specs/validation.md](docs/specs/validation.md)
- ✅ P2-05 Simulation engine spec → [docs/specs/engine.md](docs/specs/engine.md)
- ✅ P2-06 Module specs (one per §5 area) → [docs/specs/modules/](docs/specs/modules/README.md) (18 modules, 231 build tasks)
- ✅ P2-07 Build order & cloud-session prompts written → [docs/specs/build-plan.md](docs/specs/build-plan.md), conflict log [docs/specs/conflicts.md](docs/specs/conflicts.md), ADR log [docs/decisions.md](docs/decisions.md)

### Phase 3 — Foundation build (cloud sessions, $100 credit) — target: 1–5 Nov
Plan: `docs/specs/build-plan.md` (owner prerequisites, waves, file ownership, merge order, prompts). Session ids below are the prompt ids in build-plan section 4. Starts when owner items P-01 and P-02 are done. A split task is ticked 🟨 until all its sessions are merged.
- ✅ P3-01 Next.js + TypeScript + Prisma + Postgres scaffold; Vercel deploy → session P3-01 (build-plan 4.1) (PR 1; Vercel preview waits on P-03 and P-04)
- ✅ P3-02 Adsmetor auth, roles (`USER` / `ADMIN` / `SUPER_ADMIN`), classroom access windows, password policy and lockout foundation → session P3-02 (4.6; module 18 M18-01 to M18-04; module 19 M19-01 to M19-04, M19-14) (login, lockout, forced password change, closed class, role guards, view-as; Vercel preview waits on P-03, P-04 and P-07)
- ⬜ P3-02b Account management dashboard `/manage` (Super admin / Admin / User, email + shared password, cohorts, CSV import, audit) → session P3-02b (4.17; module 19 M19-05 to M19-16; wave 5, merge 15b)
- ✅ P3-03 App shell: top bar, switcher, left nav, breadcrumbs, date picker → session P3-03 (4.9; module 01 T1 to T6)
- ✅ P3-04 Shared components: data table (columns picker, filters, bulk actions), side panel forms, dialogs, status chips → session P3-04 (4.2; design-system.md) (Tier A and B kit, gallery behind `ENABLE_GALLERY`; column-view menu and Modify columns dialog deferred to the module sessions, see PR)
- ✅ P3-05 Full data model + seed generator (partners, advertisers, campaigns, IOs, LIs, creatives, deals, audiences) → sessions ✅ P3-05a schema core and `withChangeLog` (4.3), ✅ P3-05b seed generator (4.7), ✅ P3-05c remaining tables (4.8)
- 🟨 P3-06 Campaigns → IOs → Line items CRUD with full validation → sessions ✅ P3-06a validation library (4.4) (PR 3), ✅ P3-06b campaigns and IOs (4.11), 🟨 P3-06c line items (4.12)
- 🟨 P3-07 Targeting panel (all dimensions) → sessions ✅ P3-07a card, state and basic editors (4.10), ⬜ P3-07b geography, apps and URLs, brand suitability, audience builder (4.15)
- ✅ P3-08 Simulation engine v1 (auction, pacing, metrics) → sessions ✅ P3-08a engine core (4.5) (PR 8), ✅ P3-08b engine runtime and tick endpoint (4.13)
- 🟨 P3-09 Performance columns on list pages → session P3-09 (4.14); metrics layer done, list-page e2e waits for P3-06b/c
- ⬜ P3-INT Integration and hardening: demo path, gap list (added by P2-07; not a PROJECT.md task before) → session P3-INT (4.16)

### Phase 4 — Remaining modules (cloud sessions / normal limits after credit)
Outline of waves and module tasks: `docs/specs/build-plan.md` section 3.7. Module specs: `docs/specs/modules/README.md`.
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
Outline: `docs/specs/build-plan.md` section 3.8. Module 18 holds the tasks.
- ⬜ P5-01 Instructor console (access windows, class roster, sandbox reset)
- ⬜ P5-02 Scenario engine + 10 starter exercises with auto-checks
- ⬜ P5-03 Time-acceleration controls (instructor)
- ⬜ P5-04 Student progress dashboard

### Phase 6 — QA & launch
- ⬜ P6-01 Fidelity review per module (SOP-3)
- ⬜ P6-02 Playwright end-to-end tests for core workflows
- ⬜ P6-03 Load test for a full classroom: 25 concurrent students (RC-057, ADR-045); 60 concurrent students is a stretch target
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
| Jobs | GitHub Actions timer (every 5 minutes) + lazy catch-up + server actions | Runs simulation ticks; Vercel stays on Hobby (ADR-048) |
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
| Repo is public | Explore notes and screenshots of DV360 are visible to anyone; secrets could leak | Kailas decided (2026-10-28) it stays public (ADR-044). Hard rule: never commit secrets, `.env*` files, keys, DB URLs or student data; secret scanning in CI and on GitHub |
| Platform limits (Vercel Hobby cron and deployment limits, Supabase free tier: 500 MB, pause after 7 days idle) | Failed deploys, slow or missing ticks | Stay on Vercel Hobby with the GitHub Actions timer (ADR-048; deployment, duration and non-commercial limits in build-plan 5.3 R-05); reduced retention and slice caps (ADR-045); build-plan 5.3 R-05, R-06 |
| Credit runs out or expires before the minimum viable demo is merged | Phase 3 incomplete | Cut order and fallbacks in build-plan 5.2 and 5.4; merge freeze 5 Nov 9:00 AM IST |

---

## 9. Decision Log
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

## 10. Status Log
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
| 2026-10-29 | P3-07a | Targeting core: `lib/targeting` state/rows/summary/merge, TGT and TPL rules, `TargetingCard` with Add targeting menu, locked and inherited rows, slide-over editors (Environment, Position, Viewability, Language, Categories, Browser, Device, Connection speed, Carrier and ISP, Demographics, Keywords, Day and time), catalogue API, dev page `/targeting`; unit and component tests. Not done: Playwright `targeting.spec.ts`, category tree, device make/model | Wave 4 continues: P3-06b, P3-06c, P3-08b, P3-09 |
| 2026-10-29 | P3-06b | Campaigns and IOs: services (`lib/campaigns`, `lib/insertion-orders`) with change-log registries, server actions, `CampaignForm`, `CampaignsList`, campaign settings page, IO step 1 with the objective matrix, `IoForm`, `IoList` on campaign and advertiser tabs, IO details page, list/matrix API; unit, db and Playwright (`campaigns.spec.ts`: validation, create campaign then IO) green. Not done: copy-settings dialog DLG-10, inline budget edit via prompt only, campaign page tabs/pin/chart strip, IO page header and Intelligence stub, most PW-06/07 cases | P3-06c, P3-08b, P3-09 |
| 2026-10-29 | P3-06c | Line items: service, server actions, type picker (MX-03 tooltips, Demand Gen toast), `LiForm` with conversions panel and copy settings dialog, Mobile app install and Ads in mobile apps pre-step, DOOH and Demand Gen shell variants, `LiGrid` at IO, campaign and advertiser level with archived list (`[A]/explorerlis?f.status=ARCHIVED`, Unarchive), API handlers `app/api/dv/line-items/*` (list, create, detail, update, copy-source, creative candidates); 41 service tests in `tests/services/line-items`, `line-items.spec.ts` PW-08-01/02/03/04/06/07/08/09/17 green, `check` and `test:db` green. Not done: link to the archived list in the IO menu (IO grid belongs to P3-06b), targeting card is the P3-07a stub | P3-08b, P3-09 |
| 2026-10-29 | P3-09 | Metric layer in `lib/metrics` replaces the zero stub (same `getGridMetrics` signature, extended `MetricRow`): one batched query per level over `SimDailyMetric` day totals (campaign, IO, LI, ad group, advertiser), derived ratios, KPI Actual per engine 4.6 with minimum samples, Spent = revenue (RC-038), `FxRate` conversion at read time, null vs zero, `getTotals`, `getChartCardData` (Total cost, Avg. performance, Impressions lost; reach and budget cards return the empty marker), `d` param parsing on the sim clock, `GET /api/dv/metrics/grid` and `/cards`; unit and db tests incl. raw SQL reconciliation, time zones, FX, 500 ids, EXPLAIN. List-page e2e cases are `test.skip` until the lists exist | P3-06b, P3-06c (bind the lists to `getGridMetrics`), P3-INT |
| 2026-10-29 | P3-08b | Engine runtime: `lib/engine/io` (loadWorld per advertiser, persistTick with additive upserts of hourly, daily and DeliveryDiagnostic plus pacing, reach and Alert open and resolve, `FOR UPDATE SKIP LOCKED` claim and `SimTickLog` ledger, SimJob, retention, creative review sync through `withChangeLog`), `lib/engine/server.ts` (`ensureCaughtUp`, `runDueTicks`, `fastForward`, `resetSandbox`, `setSpeed`, `pause`, `resume`, `stepTicks`), `POST /api/sim/engine/tick` (Bearer or `x-cron-secret`, 45 s budget, 25 sandboxes per call, `stillDue`), `engine-tick.yml` finished, migration `0003_engine_runtime` (SimState, SimJob); db tests for idempotency, catch-up equals live, isolation, locks, frozen sandboxes, 7-day fast-forward with `NO_SPEND_LI` stop, alerts, reset, retention. Not done: Playwright check (needs P3-09), `SimConversionDaily`, Recommendation rows, flight-end flip, `untilBudgetExhausted`, `actionlint` | P3-09 (reads the rows), P3-INT (swap the seed history stub for `fastForward`), owner: `ENGINE_CRON_URL` and `CRON_SECRET` Actions secrets (P-06, P-07) |

---

## 11. Open Questions
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
