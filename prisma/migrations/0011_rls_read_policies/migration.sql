-- PROD-CRASH. Read policies for the tables a student session (role app_tenant) may SELECT but that are not tenant tables.
--
-- Why: 0001/0002 only GRANT SELECT on them. Plain Postgres has RLS off on such tables, so that is enough. Supabase can
-- switch RLS on for every table in `public` ("enable RLS on new tables" / the security advisor fix); a table with RLS on
-- and no policy for app_tenant then returns ZERO rows, no error. serviceCtx() read the Sandbox row that way, got null
-- and answered FORBIDDEN on every service backed page (Campaigns, Reports, Channels, Custom bidding, Floodlights).
--
-- What: RLS is enabled on these tables (it is what Supabase does anyway, and it makes CI behave like production) and each
-- gets an explicit SELECT policy for app_tenant. Nothing here grants a write. The connecting (owner) role is not subject
-- to RLS, so the app's own queries, bootstrap and provisioning are unchanged. app_engine gets an all-rows policy (it is
-- BYPASSRLS where the host allows it; the policy covers hosts that do not). Idempotent: DROP POLICY IF EXISTS first.
--
--   own row only   Sandbox (id = app.sandbox_id), Classroom (the classroom of that sandbox)
--   own or global  Notification, Scenario (classroomId IS NULL = platform wide, or the classroom of that sandbox)
--   every row      reference catalogues (Exchange, TargetingOption, Marketplace, report reference, roles, templates ...)

CREATE OR REPLACE FUNCTION app_enable_read_policy(tbl text, using_expr text) RETURNS void
LANGUAGE plpgsql AS $fn$
BEGIN
  EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', tbl);
  EXECUTE format('DROP POLICY IF EXISTS tenant_read ON %I', tbl);
  EXECUTE format('CREATE POLICY tenant_read ON %I AS PERMISSIVE FOR SELECT TO app_tenant USING (%s)', tbl, using_expr);
  EXECUTE format('DROP POLICY IF EXISTS engine_access ON %I', tbl);
  EXECUTE format('CREATE POLICY engine_access ON %I AS PERMISSIVE FOR ALL TO app_engine USING (true) WITH CHECK (true)', tbl);
END
$fn$;

SELECT app_enable_read_policy('Sandbox', $$"id" = current_setting('app.sandbox_id', true)$$);
SELECT app_enable_read_policy('Classroom',
  $$"id" = (SELECT s."classroomId" FROM "Sandbox" s WHERE s."id" = current_setting('app.sandbox_id', true))$$);
SELECT app_enable_read_policy('Notification',
  $$"classroomId" IS NULL OR "classroomId" = (SELECT s."classroomId" FROM "Sandbox" s WHERE s."id" = current_setting('app.sandbox_id', true))$$);
SELECT app_enable_read_policy('Scenario',
  $$"classroomId" IS NULL OR "classroomId" = (SELECT s."classroomId" FROM "Sandbox" s WHERE s."id" = current_setting('app.sandbox_id', true))$$);

SELECT app_enable_read_policy(t, 'true') FROM unnest(ARRAY[
  'Exchange', 'TargetingOption', 'SeedTemplate', 'Role', 'Permission', 'RolePermission', 'ScenarioStep',
  'ScenarioSeedPatch', 'ScenarioEvent', 'HelpArticle', 'YoutubeVideo', 'AppCatalog', 'ThirdPartyVendor',
  'GoogleAudience', 'MarketplaceProduct', 'ReportField', 'ReportTemplate', 'FxRate', 'PlanCountry', 'SubLocation',
  'TvCampaign'
]) AS t;
