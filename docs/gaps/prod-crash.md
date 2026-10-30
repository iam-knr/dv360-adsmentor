# Production crashes (prod-crash)

## What a student saw

After the sandbox was READY, Campaigns (and everything below it), Reports, Channels, Custom bidding and Floodlights showed only "Something went wrong. Try again." Home, the advertiser list, bulk status, notifications and `/sim/me` worked.

## Root cause

Not data and not ids. Vercel runtime logs showed `ServiceFailure: FORBIDDEN` (`issues: []`), thrown by `serviceCtx()` in `lib/campaigns/service-kit.ts`.

`serviceCtx()` reads the student's `Sandbox` row inside `withSandbox`, which runs as the NOLOGIN role `app_tenant` (RLS). `Sandbox`, `Classroom`, `Exchange`, `TargetingOption`, the Marketplace and report reference tables and about twenty more global tables were only **granted** `SELECT` to `app_tenant`; they had **no RLS policy**. On plain Postgres (local, CI) RLS is off on them, so the read works. Supabase switches RLS on for every table in `public`. With RLS on and no policy for `app_tenant`, a `SELECT` returns zero rows without an error, `findUnique` gives `null`, and `serviceCtx()` throws `forbidden()`.

Pages that read only tenant tables (home, advertisers, notifications) have policies and kept working. Pages that call a service (`serviceCtx`) crashed. CI never saw it because CI never had RLS on those tables.

Reproduced locally: migrate deploy + bootstrap only, two students through `/manage`, the real provisioning job, production build; the five pages were fine until `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` was run on the global tables, then they gave HTTP 500 with the same `FORBIDDEN` and digest. The hypothesis in the task (the full seed provides data that production lacks) was **rejected**: with the production data path alone all pages render once RLS is not in the way.

## Fixed

1. **Migration `0011_rls_read_policies`** (idempotent: `ENABLE ROW LEVEL SECURITY`, `DROP POLICY IF EXISTS`, `CREATE POLICY`). All policies are `SELECT` only, `TO app_tenant`; plus `engine_access` (all rows) `TO app_engine`, the same as the tenant tables, for hosts where `app_engine` is not BYPASSRLS. The connecting owner role is not subject to RLS (not `FORCE`), so the app, bootstrap and provisioning are unchanged.

   | Table | `app_tenant` can read |
   | --- | --- |
   | `Sandbox` | its own row (`id = app.sandbox_id`) |
   | `Classroom` | the classroom of its own sandbox |
   | `Notification`, `Scenario` | platform wide rows (`classroomId IS NULL`) and those of its own classroom |
   | `Exchange`, `TargetingOption`, `SeedTemplate`, `Role`, `Permission`, `RolePermission`, `ScenarioStep`, `ScenarioSeedPatch`, `ScenarioEvent`, `HelpArticle`, `YoutubeVideo`, `AppCatalog`, `ThirdPartyVendor`, `GoogleAudience`, `MarketplaceProduct`, `ReportField`, `ReportTemplate`, `FxRate`, `PlanCountry`, `SubLocation`, `TvCampaign` | all rows (reference data) |

   Tenant tables keep the policies of `app_enable_tenant_rls`. Future global tables that get a grant to `app_tenant` must call `app_enable_read_policy(table, predicate)` (defined in the migration).
2. **403 page.** A `FORBIDDEN` `ServiceFailure` carries the Next.js digest `NEXT_HTTP_ERROR_FALLBACK;403`; with `experimental.authInterrupts` and `app/forbidden.tsx` it renders "You do not have access to this page." with HTTP 403 on every page that calls a service. Actions still get the `Result` (the class is unchanged).
3. **Errors are findable.** `instrumentation.ts` (`onRequestError`) writes one `console.error` line per server error: digest, method, path (no query string), route pattern, route type, error name and message, then the stack. No headers, cookies or bodies. The error page (`app/error.tsx`, `app/global-error.tsx`) shows "Error reference: <digest>".
4. **Tests.**
   - `tests/db/supabase-rls.db.test.ts`: enables RLS on every public table (what Supabase does), provisions two students with the real job, runs the service functions behind the five pages for both, checks that student A cannot read B's `Sandbox`/`Classroom`/`Notification` rows, that a student cannot write, and that `withBypass` (engine) still sees everything. It fails with `FORBIDDEN` when migration 0011 is removed.
   - `tests/e2e/prod-like-crawler.spec.ts`, Playwright project `prod-like` (`PROD_LIKE=1`), CI job `prod-like`: database from `scripts/prod-like-db.sh` (empty, `migrate deploy`, bootstrap under `NODE_ENV=production`, no seed, no demo class), RLS on for all tables, production build. The Super admin adds two students through `/manage`, the real job builds both, the crawler signs in as the **second** student and opens every link of the left menu (partner, advertiser, campaign level) and the top bar, plus every `route-table.ts` row without an id of its own (about 100 URLs, about 1 minute; the whole spec takes about 3.5 minutes with `SANDBOX_ENGINE_DAYS=3`). Fails on the error page, 5xx, 403 or "Page not found". Known placeholders are listed in `KNOWN_GAPS`; a new gap fails, and so does a listed gap that now works.
5. Provisioning and the engine job already ran with RLS on in production; confirmed again here (the db test provisions under RLS-on tables).

## Not done (separate sessions)

All of these are in `KNOWN_GAPS` of the crawler, so closing one forces its removal from the list.

- "Not built yet" placeholders, module 02: `/users` (top bar "User management"), `/email-preferences`, `/p/{pid}/advertisers/new`, `/p/{pid}/details`, `/p/{pid}/targeting`, `/p/{pid}/third-party-configuration` (Advertiser configurations), `/p/{pid}/brand/controls`.
- Module 03 (advertiser level): `/a/{aid}/details`, `/targeting`, `/data-manager`, `/linked-accounts`, `/policy-center`. Module 10: `/a/{aid}/templates`, `/templates/new`. Module 06: `/c/{cid}/explorercombined`.
- Navigation: the left menu has no entries for audiences, inventory, YouTube, planning, experiments; `/p/{pid}/cross-media-reach` (list) has no route row, so it is 404. Menu and nav wiring is a separate follow-up. The crawler only covers what is linked or in `route-table.ts`; add the new entries to the menu and the crawl follows automatically.
- In the earlier report `/a/{aid}/creatives` and `/history` showed "Page not found" in the body. They render normally in the prod-like run with migration 0011 (they hit the same RLS lookups); if they still fail in production after deploy, the crawler would have caught them, so check the deployed migration first.
- Not changed: the Super admin is still asked to change the bootstrap password at first sign in (the crawler clears the flag directly); `NOT_FOUND` service failures still render the error page rather than 404.

## Deploy check

After deploy, `migrate deploy` applies 0011 in the Vercel build. In Supabase: `select relname, relrowsecurity from pg_class where relname in ('Sandbox','Classroom','Exchange');` shows `t` and `select tablename, policyname from pg_policies where policyname = 'tenant_read';` lists 25 rows.
