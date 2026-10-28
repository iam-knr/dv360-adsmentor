# Decisions (ADR log)

Architecture and project decisions for DV360 Simulator by Adsmetor. One record per decision. Records are not edited after acceptance; a new record supersedes an old one.

Status values
- **Accepted**: decided by the owner (Kailas) or fixed by an accepted spec. Binding.
- **Proposed-awaiting-owner**: chosen as a default so work can start. The owner can change it; the consequence column says what that costs.

Sources: `PROJECT.md` section 9, `docs/PROJECT-LOG.md` section 2, `docs/specs/routes.md` section 1, `docs/specs/conflicts.md`, `docs/specs/build-plan.md`. Index at the end.

---

## Project and process

### ADR-001 Product name and branding
- Status: Accepted. Date: 2026-10-28. By: Kailas.
- Decision: The product is "DV360 Simulator by Adsmetor". No Google logos or Google sign-in screens. Adsmetor has its own login. Icons come from Material Symbols. Code is written from scratch (rules R1, R2).
- Why: Legal and brand safety for a training product.
- Consequences: Tutor and help text are written by Adsmetor, not copied from Google (RC-051). Design tokens are approximations of the DV360 look, not Google assets.

### ADR-002 Full fidelity scope
- Status: Accepted. Date: 2026-10-28. By: Kailas.
- Decision: Every DV360 section, screen, option and workflow is in scope, with a 95 % pass target per module in the fidelity review (SOP-3).
- Why: Students must practise exactly what they will see on the job.
- Consequences: The plan is phased; areas blocked in the demo account are built from public documentation and marked (`(from public docs)`, `[SIM]`). Items deferred past Phase 4 need the owner's confirmation (ADR-033).

### ADR-003 Demo account use
- Status: Accepted. Date: 2026-10-28. By: Kailas and Claude.
- Decision: The reference account is a demo account with no real spend. Full interaction is allowed (rule R4). In practice exploration was read-only: forms were opened and discarded, never saved or activated.
- Why: The account has limited permissions, and read-only exploration avoids side effects.
- Consequences: Behaviour that needs a save (for example plan to campaign conversion, bulk edit panels) is filled from public docs and re-checked with a full-access account before the fidelity review.

### ADR-004 Classroom-only access
- Status: Accepted. Date: 2026-10-28. By: Kailas.
- Decision: Access is classroom-only. The instructor opens and closes access per session. Legal clearance is handled by Adsmetor (rule R3).
- Consequences: Access windows, a frozen sandbox and clock when the window closes, and a hard stop for writes (ADR-016, module 18).

### ADR-005 Build in Claude Code cloud sessions on the $100 credit
- Status: Accepted. Date: 2026-10-28. By: Kailas and Claude.
- Decision: Phase 3 is built in parallel Claude Code cloud sessions using the $100 credit that expires 5 Nov 2026, 1:29 PM IST. Planning and exploration stay in Cowork (rule R7).
- Consequences: The build plan splits Phase 3 into 16 sessions with disjoint file ownership (ADR-025) and a cut order if credit runs short (build-plan 5).

### ADR-011 All project files live only in GitHub
- Status: Accepted. Date: 2026-10-28. By: Kailas.
- Decision: Docs, notes, screenshots and code are stored only in the repo `iam-knr/dv360-adsmentor`. Nothing is saved on the local PC (rule R8).
- Consequences: Local sessions hand content to cloud sessions, which commit it.

### ADR-012 Repository is public
- Status: Accepted. Date: 2026-10-28. By: Kailas. Revisit: before P3-01 (RC-059).
- Decision: The repo is public so cloud sessions can reach it.
- Consequences: Explore notes about DV360 are visible to anyone. No secrets may be committed; secret scanning and push protection are required (build-plan 1.6). The owner can switch to private; Vercel and cloud sessions work with private repos.

### ADR-013 Hand-off workflow between local and cloud sessions
- Status: Accepted. Date: 2026-10-28. By: Claude.
- Decision: A local session explores DV360 and writes the content of `docs/explore/NN-*.md`; a cloud session commits it to `main` as `docs: status P1-NN`; the result is verified on GitHub.
- Consequences: Phase 1 and Phase 2 documents were committed directly to `main`. From Phase 3 on, code goes through pull requests (ADR-025).

### ADR-014 Exploration browser is Claude in Chrome
- Status: Accepted. Date: 2026-10-28. By: Kailas.
- Decision: The Chrome profile where DV360 is signed in is used for exploration.

---

## Stack (proposed, one approval covers ADR-006 to ADR-010)

### ADR-006 Framework and UI
- Status: Proposed-awaiting-owner (RC-060, owner item P-01). Date: 2026-10-28.
- Decision: Next.js App Router with TypeScript, Material UI (MUI) with a custom DV360-like theme, TanStack Table for grids, Recharts for charts, Material Symbols icons, self-hosted fonts.
- Why: DV360 is built on Material Design; Next.js deploys natively on Vercel; TanStack Table avoids the MUI X Pro licence for sticky columns and trees (design-system Q5).
- Consequences if changed: the design-system and routes specs assume this stack (Next 15 async `params`, route groups). A different framework means rewriting routes.md 5 and the component kit.

### ADR-007 Data
- Status: Proposed-awaiting-owner. Date: 2026-10-28.
- Decision: PostgreSQL with Prisma (6.x, multi-file schema). Neon is recommended, Supabase is the alternative.
- Why: The hierarchy Partner to Line item is relational; row level security gives sandbox isolation (ADR-016).
- Consequences if changed: Appendix A of data-model.md is Prisma and Postgres-specific (RLS, `NULLS NOT DISTINCT`).

### ADR-008 Hosting and jobs
- Status: Proposed-awaiting-owner. Date: 2026-10-28.
- Decision: Vercel for hosting, preview deploys per branch and production on `main`. The simulation tick is an HTTP endpoint (`POST /api/sim/engine/tick`) called by a scheduler plus lazy catch-up on page loads. The scheduler choice is ADR-029.
- Consequences: Vercel plan limits matter (ADR-030).

### ADR-009 Authentication
- Status: Proposed-awaiting-owner. Date: 2026-10-28.
- Decision: Auth.js v5 with the credentials provider and argon2id password hashing. Roles: student, instructor, admin, plus DV360-style access levels (Standard, Read only, Reporting only, Partner client, Creative, Admin) inside a sandbox.
- Consequences: Auth.js v5 is a beta package; all use goes through `lib/auth/session.ts` so it can be swapped (build-plan R-19).

### ADR-010 Tests
- Status: Proposed-awaiting-owner. Date: 2026-10-28.
- Decision: Vitest for unit, component and database tests, fast-check for engine properties, Playwright for end-to-end tests, vitest-axe for accessibility checks.

---

## Architecture decisions taken in the specs

### ADR-015 Routes mirror DV360 URLs
- Status: Accepted (spec routes.md section 1). Date: 2026-10-28.
- Decision: Keep DV360 path spelling for every segment, drop the `/ng_nav` prefix (and 308-redirect it), tabs are path segments, simulator-only pages live under `/sim/**` and `/api/sim/**`, two route trees (with and without chrome), reads through `GET /api/dv/**` and writes through server actions, every page dynamic, "today" is the simulated date, every URL entity chain is verified (R1 to R10 in routes.md).
- Consequences: Teachers can paste a real DV360 URL and land on the same screen. 404 for ids of another sandbox.

### ADR-016 Multi-tenancy by sandbox
- Status: Accepted (spec data-model.md section 2). Date: 2026-10-28.
- Decision: Every tenant row carries `sandboxId`; children use composite foreign keys `(parentId, sandboxId)`; row level security uses `app.sandbox_id` set per transaction; the engine uses a bypass role. Nothing is shared between students.
- Consequences: Every request runs inside one interactive transaction (`withSandbox`). A feature flag `RLS_ENABLED` allows falling back to service-layer filtering (ADR-027, fallback F-4).

### ADR-017 Deterministic engine with a pure core
- Status: Accepted (spec engine.md section 1). Date: 2026-10-28.
- Decision: The engine is pure TypeScript with seeded random streams, one tick per simulated hour, and an `io/` layer as the only place that touches the database. Edits take effect at `appliedAtTick`. Same seeds and parameters give the same output.
- Consequences: Lint and dependency rules enforce purity (build-plan 2.4). Property and calibration tests are the quality bar.

### ADR-018 Enum authority rule
- Status: Accepted (conflicts.md section 1.2, RC-001 to RC-005). Date: 2026-10-28.
- Decision: Authority order for conflicts is data-model > validation > routes > engine > design-system > modules, with one exception: enum key spellings that validation, routes and the modules agree on win over data-model (campaign goal and KPI keys, IO control keys, line item types, bid strategies). Engine wins for what it computes or stores; routes win for route and action names.
- Consequences: Spec files were edited to match. Retired names must not appear in code (conflicts.md section 5).

### ADR-019 One alert store
- Status: Accepted (RC-013). Date: 2026-10-28.
- Decision: The `Alert` table is the only alert store. `type` is the preference-aligned key; the engine's granular code is `diagnosticCode`. `DISMISSED` is not used in v1.

### ADR-020 Diagnostics and metric grain
- Status: Accepted (RC-021, RC-022, RC-024). Date: 2026-10-28.
- Decision: `DeliveryDiagnostic` is stored as date x exchange x `reasonCode` with milestone rows. `SimDailyMetric` has `sliceKind` and `sliceKey`; hourly rows are totals only. Hourly rows are kept 14 sim days, daily rows for the life of the sandbox.
- Consequences: The Troubleshooter funnel in the UI is derived from stored reason codes by a mapping table (module 08 section 5.1).

### ADR-021 Money, versions and wire types
- Status: Accepted (RC-018, RC-019, RC-020, RC-025). Date: 2026-10-28.
- Decision: Money is stored once in the advertiser currency as Decimal; partner and USD values are derived at read time from fixed FX rates. The wire uses major units; validation rules receive minor units; conversion happens at the service boundary. Every editable entity has an integer `version` for optimistic locking. Frequency caps use `mode: UNLIMITED | INHERIT | LIMITED`.

### ADR-037 Students are Standard users in their sandbox
- Status: Accepted (RC-047). Date: 2026-10-28.
- Decision: A student is `STANDARD` on their own sandbox partner. Standard users may edit advertiser name, status and settings; scheduling deletion and partner settings need Admin. A scenario can raise the role.

### ADR-038 Script custom bidding is disabled in v1
- Status: Accepted (RC-037). Date: 2026-10-28.
- Decision: Rules and goal-based custom bidding only. The Script card is disabled; tables and rules stay dormant.

---

## Build process

### ADR-022 Folder convention: components and lib per module
- Status: Accepted (build-plan 2.1). Date: 2026-10-28.
- Decision: UI for a module is in `components/<module>`, server services in `lib/<module>`; route files in `app/**` are thin. There is no `features/` folder. This matches PROJECT.md section 3.

### ADR-023 Multi-file Prisma schema owned by session
- Status: Accepted (build-plan 2.5). Date: 2026-10-28.
- Decision: The schema lives in `prisma/schema/` as numbered files; each file range belongs to one session; migrations are named by session; migration conflicts are resolved by regenerating.
- Consequences: Requires Prisma 6.7 or later.

### ADR-024 Real Postgres for tests, without Docker
- Status: Accepted (build-plan 2.2, 2.6). Date: 2026-10-28.
- Decision: Local and cloud-session tests run on a real PostgreSQL 17 from the `embedded-postgres` package (`npm run db:local`); GitHub Actions uses a Postgres service container. No mocked database.
- Why: RLS, composite foreign keys and unique constraints need the real engine.

### ADR-025 Pull request per session, disjoint ownership, ordered merges
- Status: Accepted (build-plan 3). Date: 2026-10-28.
- Decision: Each cloud session works on its own branch `p3-<id>-<name>` and opens one PR. No session pushes to `main`. A path is owned by one session while it is open. PRs merge in the fixed order of build-plan 3.5. The last commit of each PR is `docs: status <id>` and edits only PROJECT.md. `main` is protected after P3-01 (checks `check`, `db-tests`, `e2e`).
- Consequences: Planning sessions still commit documents directly to `main` until protection is enabled.

### ADR-026 Engine v1 scope and history stub for Phase 3
- Status: Accepted (build-plan 4.5, 4.7). Date: 2026-10-28.
- Decision: Phase 3 builds the engine core for display, video and CTV with Fixed, Max clicks, Max conversions, Target CPA, Max viewable and Target CPM strategies, plus pacing, fees and diagnostics. YouTube, deals, A/B and lift, faults and reprocessing wait. The seed generator writes closed-form history so the UI has data before the engine is wired; P3-INT swaps it for `engine.fastForward` if time allows.

### ADR-027 Partitioning deferred, RLS behind a flag
- Status: Accepted (build-plan 4.3). Date: 2026-10-28.
- Decision: Hash partitioning of large tables (data-model Appendix B) is not done in Phase 3. `RLS_ENABLED` can be turned off as a fallback.
- Why: Partitioning adds migration risk with no benefit at pilot size.

---

## Owner decisions with a default (Proposed-awaiting-owner)

### ADR-028 One sandbox per student
- Status: Proposed-awaiting-owner (RC-061). Default: one sandbox per student; session picks the class with an open window; instructors can override with `?sim_class=`. Changing to shared sandboxes for pairs needs `Sandbox.ownerUserId` to be nullable and extra grants (already supported by the model).

### ADR-029 Cron plan for the engine tick
- Status: Proposed-awaiting-owner (RC-056, owner item P-05). Default: GitHub Actions every 5 minutes plus lazy catch-up; Vercel Pro cron every minute if the owner upgrades; manual stepping as the weakest option. Needed before P3-08b merges.

### ADR-030 Vercel plan
- Status: Proposed-awaiting-owner (owner item P-03). Default: Pro for class use. Hobby is for non-commercial use, allows daily cron only (a deploy with a faster cron fails) and limits deployments per day (build-plan R-05).

### ADR-031 AI-looking features are canned
- Status: Proposed-awaiting-owner (RC-054). Default: Ask Advisor, search, report generation and chart prompts use canned logic with a visible "Tutor" label and no model calls. Revisit after the credit window.

### ADR-032 Vendor names
- Status: Proposed-awaiting-owner (RC-055). Default: real exchange and verifier names where option lists need them, with invented prices and synthetic IDs; fictional names for Advertiser settings vendor checkboxes. A fictional-name pass is a constants change.

### ADR-033 Billing and partner-level lists deferred
- Status: Proposed-awaiting-owner (RC-062). Default: billing profiles, invoices, partner costs and revenue models pages, and partner-level audiences and lists are built after Phase 4 (task 02-T14). Tables stay in the schema.

### ADR-034 Student accounts
- Status: Proposed-awaiting-owner (RC-063). Default: instructor creates accounts (form or CSV); temporary password shown once and changed at first login; no email provider, no self-registration.

### ADR-035 Student uploads
- Status: Proposed-awaiting-owner (RC-064). Default: students may upload creative files with MIME checks and size caps (10 MB for HTML5, video and audio, 5 MB for others), direct to Blob by signed URL, no scanning, deleted on sandbox reset.

### ADR-036 Student data retention
- Status: Proposed-awaiting-owner (RC-065). Default: archive 90 days after the course, delete on request.

---

## Index

| ID | Title | Status |
|---|---|---|
| ADR-001 | Product name and branding | Accepted |
| ADR-002 | Full fidelity scope | Accepted |
| ADR-003 | Demo account use | Accepted |
| ADR-004 | Classroom-only access | Accepted |
| ADR-005 | Build in cloud sessions on the $100 credit | Accepted |
| ADR-006 | Framework and UI | Proposed-awaiting-owner |
| ADR-007 | Data | Proposed-awaiting-owner |
| ADR-008 | Hosting and jobs | Proposed-awaiting-owner |
| ADR-009 | Authentication | Proposed-awaiting-owner |
| ADR-010 | Tests | Proposed-awaiting-owner |
| ADR-011 | Files only in GitHub | Accepted |
| ADR-012 | Repository is public | Accepted |
| ADR-013 | Local to cloud hand-off | Accepted |
| ADR-014 | Exploration browser | Accepted |
| ADR-015 | Routes mirror DV360 URLs | Accepted |
| ADR-016 | Multi-tenancy by sandbox | Accepted |
| ADR-017 | Deterministic engine, pure core | Accepted |
| ADR-018 | Enum authority rule | Accepted |
| ADR-019 | One alert store | Accepted |
| ADR-020 | Diagnostics and metric grain | Accepted |
| ADR-021 | Money, versions, wire types | Accepted |
| ADR-022 | Folder convention | Accepted |
| ADR-023 | Multi-file Prisma schema | Accepted |
| ADR-024 | Real Postgres for tests | Accepted |
| ADR-025 | PR per session, ordered merges | Accepted |
| ADR-026 | Engine v1 scope, history stub | Accepted |
| ADR-027 | Partitioning deferred, RLS flag | Accepted |
| ADR-028 | One sandbox per student | Proposed-awaiting-owner |
| ADR-029 | Cron plan | Proposed-awaiting-owner |
| ADR-030 | Vercel plan | Proposed-awaiting-owner |
| ADR-031 | Canned AI features | Proposed-awaiting-owner |
| ADR-032 | Vendor names | Proposed-awaiting-owner |
| ADR-033 | Billing deferred | Proposed-awaiting-owner |
| ADR-034 | Student accounts | Proposed-awaiting-owner |
| ADR-035 | Student uploads | Proposed-awaiting-owner |
| ADR-036 | Data retention | Proposed-awaiting-owner |
| ADR-037 | Students are Standard users | Accepted |
| ADR-038 | Script custom bidding disabled | Accepted |
