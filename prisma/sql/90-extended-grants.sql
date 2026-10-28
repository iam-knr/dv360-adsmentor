-- P3-05c. Privileges on the global tables added in 0002_extended. Tenant tables are granted by app_enable_tenant_rls.
-- The engine and instructor jobs may touch every table.
GRANT SELECT, INSERT, UPDATE, DELETE ON
  "SeedTemplate", "Role", "Permission", "RolePermission", "Scenario", "ScenarioStep", "ScenarioSeedPatch",
  "ScenarioEvent", "ScenarioAssignment", "InstructorNote", "SandboxSnapshot", "Notification",
  "NotificationDismissal", "HelpArticle", "YoutubeVideo", "AppCatalog", "ThirdPartyVendor", "GoogleAudience",
  "MarketplaceProduct", "ReportField", "ReportTemplate", "FxRate", "PlanCountry", "SubLocation", "TvCampaign"
  TO app_engine;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO app_tenant, app_engine;

-- A student session reads the reference catalogues, the scenario definitions and the notices, and writes none of them.
GRANT SELECT ON
  "SeedTemplate", "Role", "Permission", "RolePermission", "Scenario", "ScenarioStep", "ScenarioSeedPatch",
  "ScenarioEvent", "Notification", "HelpArticle", "YoutubeVideo", "AppCatalog", "ThirdPartyVendor",
  "GoogleAudience", "MarketplaceProduct", "ReportField", "ReportTemplate", "FxRate", "PlanCountry",
  "SubLocation", "TvCampaign"
  TO app_tenant;
