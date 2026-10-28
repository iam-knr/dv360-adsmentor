-- P3-05a. Roles for row level security (data-model 2.2, 8 Q21).
--   app_tenant: NOLOGIN. withSandbox() runs "SET LOCAL ROLE app_tenant", so RLS applies even when the
--               connection role owns the tables (an owner or a BYPASSRLS role is never subject to RLS).
--   app_engine: NOLOGIN. withBypass() runs "SET LOCAL ROLE app_engine" for the engine and instructor jobs.
--               Created with BYPASSRLS when the host allows it; the "engine_access" policy covers the rest.
-- Nothing here may fail a deploy on a managed host: every privileged step falls back to a NOTICE.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_tenant') THEN
    CREATE ROLE app_tenant NOLOGIN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_engine') THEN
    BEGIN
      CREATE ROLE app_engine NOLOGIN BYPASSRLS;
    EXCEPTION WHEN insufficient_privilege THEN
      CREATE ROLE app_engine NOLOGIN;
      RAISE NOTICE 'app_engine created without BYPASSRLS (host does not allow it); the engine_access policy is used instead';
    END;
  END IF;
END
$$;

-- The connecting role must be a member to use SET ROLE.
DO $$
BEGIN
  BEGIN
    EXECUTE format('GRANT app_tenant, app_engine TO %I', current_user);
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'could not grant app_tenant/app_engine to %: %', current_user, SQLERRM;
  END;
END
$$;
