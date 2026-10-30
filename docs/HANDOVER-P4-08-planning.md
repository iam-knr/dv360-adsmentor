# Handover: P4-08 Planning and reach planner (module 04)

Branch `p4-08-planning` (from `origin/main` f88dcf6, which has P4-01, 02, 03, 04, 06, 07, 09). Written 2026-10-29. No PR yet. Session was stopped by the owner for a handover.

## Done and pushed (2 commits)
- `lib/planning/`: `countries.ts` (17 countries, demographics maths), `params.ts` (plan forecast parameters), `forecast.ts` (`forecastPlan`, pure, deterministic), `rules.ts` (PLN rules), `columns.ts`, `table.ts` (cell text and CSV), `tv-catalogue.ts`, `cross-media.ts` (overlap maths), `persist.ts`, `seed.ts` (12 plans per advertiser, hooked into `lib/seed/sandbox.ts`), `guard.ts`, `service.ts` (list, get, create, update/save with forecast, copy, remove, convert to campaign, columns SavedView, CSV, deals), `cross-media-service.ts` (options, create, list, get, rename, delete), `actions.ts` (server actions for all of it).
- `lib/changelog/registries/plan.ts` registered as `PLAN`.
- `tests/planning/planning.db.test.ts`: 15 db tests, all green locally.
- No migration was needed: every column, `PlanCountry`, `TvCampaign` and `SubLocation` already exist in the schema. Countries, TV catalogue and sub-locations are code constants. Migration 0009 is taken by p4-05-bidding, so if a migration turns out to be needed use 0010 after checking origin.

## Not done (all UI, tests and docs)
1. Pages. The routes still render `StubPage`: `marketplace/plans`, `pr/[planId]/marketplace/plan`, `cross-media-reach` (advertiser and partner, `(app)` and `(full)` trees), `cross-media-reach/new`, `cross-media-reach/[reportId]`. Pattern to copy: `components/inventory/pages/NegotiationsRoute.tsx` (server wrapper using `requireView`, `inventoryScope` from `lib/inventory/page.ts`) plus `components/inventory/NegotiationsList.tsx` (client grid, `DvGrid`, `DvFilterBar`, `DvPageHeader`). Full-screen pages use `FormFrame` from `components/shell/Frames`; dirty state via `useUnsavedGuard`.
2. Components to build (spec `docs/specs/modules/04-planning.md` section 2): Plans list (status chip filter via `f.status`, two header bands, sort, pager, New plan); plan page (header, settings strip, Additional Settings panel, summary card and KPI strip with switchable tiles, five Recharts tabs fed by `forecast.tabs`, line item table grouped by buying method, Modify columns dialog saving through `savePlanColumnsAction`, plan line item `DvSlideOver`, Copy dialog, Convert dialog, locked and read-only states, Remove with confirm, Download via `downloadPlanCsvAction`); Cross-media list with the "Welcome" empty state, progressive Create form with the two picker dialogs, report detail page with Digital, TV, Combined cards. Chart colours: `colors.chart` from `@/lib/theme/tokens` (see `components/reporting/ReportCanvas.tsx`).
3. Link from reporting hub to cross-media reach (`docs/gaps/p4-07.md` #12): add it in `components/reporting/ReportsHub.tsx`.
4. Unit tests: `forecastPlan` (identities TRPs, CPP, CPM; monotonic and concave; determinism; same seed gives same forecast, different seed differs), `rules.ts`, `columns.ts`, `cross-media.ts` bounds. Playwright `tests/e2e/planning.spec.ts` (PW-04-1 to 6). Add `/pr/{x}/marketplace/plan`, `/cross-media-reach/{x}` to `LOOKUP_PAGES` in `tests/e2e/shell.spec.ts`; the nav may need to show Plans.
5. Merge `origin/main` again before the PR (expect `PROJECT.md` and `vitest.config.ts` overlaps with p4-05-bidding: keep both sides), `npx prisma generate`, full e2e on a clean database (shell route smoke, demo-path).
6. `docs/gaps/p4-08.md`, PR with `.github/pull_request_template.md` (acceptance table, Not done list), tick PROJECT.md section 6, add one status row, last commit `docs: status P4-08`.

## Known gaps to list in `docs/gaps/p4-08.md`
- Plan forecast parameters live in `lib/planning/params.ts`, not `engine/params.json` (its schema belongs to the engine owner); `forecastPlan` is not in `lib/engine`.
- Plan row targeting is locations plus audience tags, not the shared targeting panel. Convert copies only a GEOGRAPHY include. TV channel is stored but not forecast. Cross-media digital reach is estimated from `SimDailyMetric` impressions, not `SimReachSnapshot`. Cross-media reports write no ChangeGroup (no `REPORT` registry, P4-12). The New plan wizard (explore 19, two steps) is replaced by direct create with defaults. Planned date inputs are native date fields.

## Run locally
PROJECT-LOG 9.4. `npm ci`, `npm run db:local`, export `DATABASE_URL_TEST=postgresql://postgres:postgres@127.0.0.1:54329/dv360_test` and `NODE_OPTIONS=--max-old-space-size=8192`. `npx vitest run --project db tests/planning` for my tests. Baseline note: `tests/components/gallery.test.tsx` axe cases for chart cards time out (5 s) in this container, also on untouched main; lint, typecheck and depcruise pass. After `eslint --fix` run `prettier --write` on touched files.

## Running processes
Nothing needs to keep running. The embedded Postgres started with `npm run db:local` dies with this container; restart it.
