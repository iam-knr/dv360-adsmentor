-- P3-05a. One helper that puts a tenant table (any table with a "sandboxId" column) under row level security.
-- Later migrations that add tenant tables call:  SELECT app_enable_tenant_rls('TableName');
-- A db test fails when a table with a "sandboxId" column is left without RLS.
--
-- Policies (data-model Appendix B, adapted so a student session cannot switch the bypass on by itself):
--   tenant_isolation  TO app_tenant  rows where "sandboxId" = current_setting('app.sandbox_id')
--   engine_access     TO app_engine  all rows
-- An unset or empty app.sandbox_id matches no row.
CREATE OR REPLACE FUNCTION app_enable_tenant_rls(tbl text) RETURNS void
LANGUAGE plpgsql AS $fn$
BEGIN
  EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', tbl);
  EXECUTE format('DROP POLICY IF EXISTS tenant_isolation ON %I', tbl);
  EXECUTE format(
    $p$CREATE POLICY tenant_isolation ON %I AS PERMISSIVE FOR ALL TO app_tenant
       USING ("sandboxId" = current_setting('app.sandbox_id', true))
       WITH CHECK ("sandboxId" = current_setting('app.sandbox_id', true))$p$, tbl);
  EXECUTE format('DROP POLICY IF EXISTS engine_access ON %I', tbl);
  EXECUTE format(
    'CREATE POLICY engine_access ON %I AS PERMISSIVE FOR ALL TO app_engine USING (true) WITH CHECK (true)', tbl);
  EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON %I TO app_tenant, app_engine', tbl);
END
$fn$;
