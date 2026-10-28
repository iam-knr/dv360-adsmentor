-- P3-05a. Privileges for the two RLS roles, and the one default row. Runs last.
GRANT USAGE ON SCHEMA public TO app_tenant, app_engine;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO app_tenant, app_engine;

-- The engine and instructor jobs may touch every table.
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_engine;

-- A student session reads global reference tables but writes only tenant tables (granted per table by
-- app_enable_tenant_rls). No access to User, AuthThrottle, AccountPolicy or AuditLog.
GRANT SELECT ON "Exchange", "TargetingOption", "Sandbox", "Classroom" TO app_tenant;

-- Module 19 M19-01: the one policy row (id = 1). Idempotent.
INSERT INTO "AccountPolicy" ("id", "updatedAt") VALUES (1, CURRENT_TIMESTAMP) ON CONFLICT ("id") DO NOTHING;
