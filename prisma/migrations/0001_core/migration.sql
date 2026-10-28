-- 0001_core (P3-05a). Additive only: new enums, tables, indexes, roles, policies. Assembled from prisma/sql/*.sql
-- plus the Prisma generated DDL (marked below). tests/db/migration-sync.test.ts keeps the parts in sync.

-- >>> prisma/sql/00-extensions-sequences.sql
-- P3-05a. Runs before the generated tables (Prisma defaults call nextval on the sequence; User.email uses citext).
-- Safe to re-run: every statement is IF NOT EXISTS.

-- module 19 delta 19-8: case-insensitive e-mail
CREATE EXTENSION IF NOT EXISTS citext;

-- global public id sequence (10 digit ids, shared by every PID table), data-model Appendix B
CREATE SEQUENCE IF NOT EXISTS entity_public_id_seq START 5100000001;

-- Column default for PID tables. Prisma reads a bare nextval('seq') default as a sequence it owns and then proposes
-- to drop the shared sequence on the next "migrate dev". A function default is read back unchanged, so no drift.
CREATE OR REPLACE FUNCTION next_public_id() RETURNS bigint
LANGUAGE sql VOLATILE AS $$ SELECT nextval('entity_public_id_seq') $$;

-- >>> prisma/sql/10-roles.sql
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

-- >>> prisma/sql/20-rls-function.sql
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

-- >>> prisma generated DDL (npx prisma migrate diff --from-migrations prisma/migrations --to-schema-datamodel prisma/schema --script)
-- CreateEnum
CREATE TYPE "AppRole" AS ENUM ('USER', 'ADMIN', 'SUPER_ADMIN');

-- CreateEnum
CREATE TYPE "AccountStatus" AS ENUM ('ACTIVE', 'DISABLED', 'LOCKED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "DvRole" AS ENUM ('ADMIN', 'STANDARD', 'READ_ONLY', 'REPORTING_ONLY', 'PARTNER_CLIENT', 'CREATIVE');

-- CreateEnum
CREATE TYPE "SeedMode" AS ENUM ('SHARED_MARKET', 'ISOLATED');

-- CreateEnum
CREATE TYPE "CatchUp" AS ENUM ('SIMULATE', 'SKIP');

-- CreateEnum
CREATE TYPE "AccessWindowClosedBy" AS ENUM ('SCHEDULE', 'INSTRUCTOR');

-- CreateEnum
CREATE TYPE "SandboxKind" AS ENUM ('STUDENT', 'DEMO', 'TEMPLATE', 'SOLUTION', 'SNAPSHOT');

-- CreateEnum
CREATE TYPE "ProvisionState" AS ENUM ('PENDING', 'SEEDING', 'BACKFILLING', 'READY', 'FAILED');

-- CreateEnum
CREATE TYPE "FrozenReason" AS ENUM ('WINDOW', 'ACCOUNT');

-- CreateEnum
CREATE TYPE "SimClockState" AS ENUM ('RUNNING', 'PAUSED', 'STEPPING', 'LOCKED');

-- CreateEnum
CREATE TYPE "AuditResult" AS ENUM ('OK', 'DENIED');

-- CreateEnum
CREATE TYPE "SandboxStatus" AS ENUM ('ACTIVE', 'RESETTING', 'FROZEN', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "AccessWindowStatus" AS ENUM ('SCHEDULED', 'OPEN', 'CLOSED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "EntityStatus" AS ENUM ('DRAFT', 'ACTIVE', 'PAUSED', 'ARCHIVED', 'SCHEDULED_FOR_DELETION');

-- CreateEnum
CREATE TYPE "SdfVersion" AS ENUM ('V9', 'V9_1', 'V9_2', 'V10', 'V10_1', 'V11');

-- CreateEnum
CREATE TYPE "AdServerType" AS ENUM ('THIRD_PARTY_ONLY', 'CM360_HYBRID');

-- CreateEnum
CREATE TYPE "EuPoliticalAds" AS ENUM ('CONTAINS_EU_POLITICAL_ADS', 'DOES_NOT_CONTAIN_EU_POLITICAL_ADS');

-- CreateEnum
CREATE TYPE "CampaignGoal" AS ENUM ('AWARENESS', 'ONLINE_ACTION', 'OFFLINE_SALES', 'APP_INSTALLS');

-- CreateEnum
CREATE TYPE "Kpi" AS ENUM ('CPM', 'CPV', 'VIEWABLE_PCT', 'CPIAVC', 'CPC', 'CPA', 'CTR', 'CPCL', 'CPCV', 'COMPL_AUDIO', 'COMPL_VIDEO', 'TOS10', 'VCPM', 'VTR', 'VALUE_COST', 'CLICK_CVR', 'IMPR_CVR', 'OTHER');

-- CreateEnum
CREATE TYPE "CampaignCreativeType" AS ENUM ('DISPLAY', 'VIDEO', 'AUDIO');

-- CreateEnum
CREATE TYPE "IoType" AS ENUM ('STANDARD', 'CTV_OTT', 'DOOH');

-- CreateEnum
CREATE TYPE "IoObjective" AS ENUM ('BRAND_AWARENESS', 'CLICKS', 'CONVERSIONS', 'CUSTOM', 'NONE');

-- CreateEnum
CREATE TYPE "BudgetUnit" AS ENUM ('CURRENCY', 'IMPRESSIONS');

-- CreateEnum
CREATE TYPE "PacingPeriod" AS ENUM ('FLIGHT', 'DAILY');

-- CreateEnum
CREATE TYPE "PacingType" AS ENUM ('AHEAD', 'EVEN', 'ASAP');

-- CreateEnum
CREATE TYPE "FrequencyMode" AS ENUM ('INHERIT', 'UNLIMITED', 'LIMITED');

-- CreateEnum
CREATE TYPE "FrequencyUnit" AS ENUM ('MONTH', 'WEEK', 'DAY', 'HOUR', 'MINUTE');

-- CreateEnum
CREATE TYPE "IoBidBudgetControl" AS ENUM ('IO_AUTOMATED', 'LI_CONTROLLED');

-- CreateEnum
CREATE TYPE "IoOptimizeTarget" AS ENUM ('MAX_VIEWABLE_IMPRESSIONS', 'MAX_VIEWABLE_10S', 'MAX_COMPLETED_IN_VIEW_AUDIBLE', 'MAX_CUSTOM_VALUE_COST', 'MAX_REACH');

-- CreateEnum
CREATE TYPE "FeeKind" AS ENUM ('CPM_FEE', 'MEDIA_FEE');

-- CreateEnum
CREATE TYPE "FeeType" AS ENUM ('DEFAULT', 'THIRD_PARTY_AD_SERVER', 'DOUBLEVERIFY', 'ADSAFE', 'ADXPOSE', 'VIZU', 'AGGREGATE_KNOWLEDGE', 'TERACENT', 'EVIDON', 'AGENCY_TRADING_DESK', 'SHOPLOCAL', 'TRUSTMETRICS', 'INTEGRAL_AD_SCIENCE_VIDEO', 'MOAT_VIDEO', 'SCOPE3', 'CUSTOM_FEE_1', 'CUSTOM_FEE_2', 'CUSTOM_FEE_3', 'CUSTOM_FEE_4', 'CUSTOM_FEE_5', 'DV360_FEE');

-- CreateEnum
CREATE TYPE "LineItemType" AS ENUM ('DISPLAY', 'VIDEO', 'CTV', 'AUDIO', 'MOBILE_APP_INSTALL', 'ADS_IN_MOBILE_APPS', 'YT_VIDEO', 'YT_AUDIO', 'YT_ON_CTV', 'DEMAND_GEN', 'DOOH_DISPLAY', 'DOOH_VIDEO');

-- CreateEnum
CREATE TYPE "AppAdFormat" AS ENUM ('DISPLAY', 'VIDEO');

-- CreateEnum
CREATE TYPE "MobileAppPlatform" AS ENUM ('ALL', 'IOS', 'ANDROID');

-- CreateEnum
CREATE TYPE "YouTubeSubtype" AS ENUM ('EFFICIENT_REACH', 'NON_SKIPPABLE_REACH', 'TARGET_FREQUENCY', 'TARGET_FREQUENCY_IN_STREAM', 'TRUEVIEW_VIEWS', 'AD_SEQUENCE', 'VIDEO_ACTION', 'AUDIO_REACH');

-- CreateEnum
CREATE TYPE "YouTubeSurface" AS ENUM ('IN_STREAM', 'IN_FEED', 'SHORTS');

-- CreateEnum
CREATE TYPE "InventoryQuality" AS ENUM ('AUTHORIZED_DIRECT_SELLERS', 'AUTHORIZED_DIRECT_SELLERS_AND_RESELLERS', 'AUTHORIZED_AND_NON_PARTICIPATING');

-- CreateEnum
CREATE TYPE "FlightDateMode" AS ENUM ('INHERIT_IO', 'CUSTOM');

-- CreateEnum
CREATE TYPE "BudgetMode" AS ENUM ('UNLIMITED_UP_TO_IO', 'FIXED');

-- CreateEnum
CREATE TYPE "BidStrategyKind" AS ENUM ('AUTOMATED', 'FIXED');

-- CreateEnum
CREATE TYPE "BidGoal" AS ENUM ('MAX_CLICKS', 'MAX_CONVERSIONS', 'MAX_CONVERSION_VALUE', 'MAX_VIEWABLE_IMPRESSIONS', 'MAX_VIEWABLE_10S', 'MAX_COMPLETED_IN_VIEW_AUDIBLE', 'MAX_REACH', 'MAX_CUSTOM_VALUE_COST', 'MAX_CPV', 'TARGET_CPM', 'TARGET_CPV', 'TARGET_CPC', 'TARGET_CPA', 'TARGET_ROAS', 'TARGET_CUSTOM_VALUE_COST', 'TARGET_VIEWABLE_IMPRESSIONS');

-- CreateEnum
CREATE TYPE "BidPriority" AS ENUM ('SPEND_FULL_BUDGET', 'TARGET_VALUE');

-- CreateEnum
CREATE TYPE "ConversionCounting" AS ENUM ('ALL', 'POST_CLICK_ONLY', 'PERCENTAGE');

-- CreateEnum
CREATE TYPE "RevenueModelType" AS ENUM ('TOTAL_MEDIA_COST_MARKUP', 'MEDIA_COST_MARKUP', 'CPM_VALUE');

-- CreateEnum
CREATE TYPE "YtAdFormat" AS ENUM ('RESPONSIVE', 'IN_STREAM_SKIPPABLE', 'BUMPER', 'NON_SKIPPABLE_IN_STREAM', 'IN_FEED', 'SHORTS', 'AUDIO', 'DEMAND_GEN_VIDEO', 'DEMAND_GEN_IMAGE', 'DEMAND_GEN_CAROUSEL');

-- CreateEnum
CREATE TYPE "AdReviewStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'RESTRICTED');

-- CreateEnum
CREATE TYPE "CreativeKind" AS ENUM ('STANDARD_IMAGE', 'STANDARD_HTML5', 'THIRD_PARTY_DISPLAY', 'NATIVE_SITE', 'NATIVE_VIDEO', 'VIDEO_FILE', 'YOUTUBE_VIDEO', 'AUDIO_FILE', 'THIRD_PARTY_VIDEO', 'THIRD_PARTY_AUDIO');

-- CreateEnum
CREATE TYPE "CreativeSource" AS ENUM ('DV360', 'CM360', 'THIRD_PARTY');

-- CreateEnum
CREATE TYPE "Dv360ReviewStatus" AS ENUM ('PENDING', 'SERVABLE', 'NOT_SERVABLE');

-- CreateEnum
CREATE TYPE "ExchangeReviewStatus" AS ENUM ('PENDING', 'APPROVED', 'DISAPPROVED');

-- CreateEnum
CREATE TYPE "AiLabel" AS ENUM ('UNSET', 'AI_GENERATED', 'NOT_AI_GENERATED');

-- CreateEnum
CREATE TYPE "ExpandDirection" AS ENUM ('NONE', 'UP', 'DOWN', 'LEFT', 'RIGHT', 'UP_AND_LEFT', 'UP_AND_RIGHT', 'DOWN_AND_LEFT', 'DOWN_AND_RIGHT');

-- CreateEnum
CREATE TYPE "CreativeAssetRole" AS ENUM ('MAIN', 'LOGO', 'COMPANION', 'THUMBNAIL', 'EXTRA');

-- CreateEnum
CREATE TYPE "TargetingDimension" AS ENUM ('GEOGRAPHY', 'LANGUAGE', 'GENDER', 'AGE', 'PARENTAL_STATUS', 'HOUSEHOLD_INCOME', 'AUDIENCE_LIST', 'DEVICE_TYPE', 'DEVICE_MAKE_MODEL', 'OPERATING_SYSTEM', 'BROWSER', 'CONNECTION_SPEED', 'CARRIER_ISP', 'ENVIRONMENT', 'DAY_TIME', 'VIEWABILITY', 'POSITION_ON_SCREEN', 'POSITION_IN_CONTENT', 'VIDEO_PLAYER_SIZE', 'CONTENT_DURATION', 'CONTENT_STREAM_TYPE', 'CONTENT_GENRE', 'CATEGORY', 'KEYWORD', 'NEGATIVE_KEYWORD_LIST', 'BRAND_SUITABILITY', 'DIGITAL_CONTENT_LABEL', 'SENSITIVE_CATEGORY', 'THIRD_PARTY_VERIFIER', 'APPS_AND_URLS', 'INVENTORY_SOURCE', 'AUTHORIZED_SELLER', 'REWARDED', 'AUDIO_CONTENT_TYPE', 'OPTIMIZED_TARGETING', 'TARGETING_EXPANSION', 'YOUTUBE_PLACEMENT', 'DOOH_VENUE');

-- CreateEnum
CREATE TYPE "TargetMode" AS ENUM ('INCLUDE', 'EXCLUDE');

-- CreateEnum
CREATE TYPE "TargetOwnerType" AS ENUM ('PARTNER', 'ADVERTISER', 'TEMPLATE', 'LINE_ITEM', 'AD_GROUP');

-- CreateEnum
CREATE TYPE "TargetRefType" AS ENUM ('AUDIENCE', 'GOOGLE_AUDIENCE', 'CHANNEL', 'COLLECTION', 'KEYWORD_LIST', 'LOCATION_LIST', 'EXCHANGE', 'DEAL', 'PACKAGE', 'DEAL_GROUP', 'CUSTOM_LIST');

-- CreateEnum
CREATE TYPE "AudienceSection" AS ENUM ('FIRST_PARTY_AND_PARTNER', 'GOOGLE', 'COMBINED', 'CUSTOM_LIST');

-- CreateEnum
CREATE TYPE "AudienceType" AS ENUM ('TAG_BASED', 'CUSTOMER_MATCH', 'YOUTUBE_USERS', 'LOOKALIKE', 'COMBINED', 'CUSTOM_AFFINITY', 'CUSTOM_INTENT_DISPLAY_VIDEO', 'CUSTOM_INTENT_YOUTUBE', 'PARTNER');

-- CreateEnum
CREATE TYPE "AudienceStatus" AS ENUM ('PROCESSING', 'ACTIVE', 'INACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "AudienceSource" AS ENUM ('DISPLAY_VIDEO_360', 'GOOGLE_ANALYTICS', 'COMMERCE_PARTNER', 'YOUTUBE');

-- CreateEnum
CREATE TYPE "ExchangeKind" AS ENUM ('EXCHANGE', 'APP_MEDIATION_PARTNER');

-- CreateEnum
CREATE TYPE "AuctionType" AS ENUM ('FIRST_PRICE', 'SECOND_PRICE');

-- CreateEnum
CREATE TYPE "DeviceType" AS ENUM ('COMPUTER', 'SMARTPHONE', 'TABLET', 'CONNECTED_TV');

-- CreateEnum
CREATE TYPE "Environment" AS ENUM ('WEB', 'APP');

-- CreateEnum
CREATE TYPE "DiagStage" AS ENUM ('AVAILABLE', 'TARGETING', 'CREATIVE', 'FREQUENCY', 'BUDGET', 'PACING', 'AUCTION', 'EXTERNAL', 'WON');

-- CreateEnum
CREATE TYPE "ChangeActor" AS ENUM ('USER', 'SYSTEM');

-- CreateEnum
CREATE TYPE "ChangeKind" AS ENUM ('CREATE', 'UPDATE', 'DELETE', 'STATUS_CHANGE');

-- CreateEnum
CREATE TYPE "ChangeSource" AS ENUM ('UI', 'SDF_UPLOAD', 'BULK_EDIT', 'DUPLICATION', 'ENGINE', 'SCENARIO', 'INSTRUCTOR', 'SEED', 'PARTNER_FANOUT');

-- CreateEnum
CREATE TYPE "EntityType" AS ENUM ('PARTNER', 'ADVERTISER', 'CAMPAIGN', 'INSERTION_ORDER', 'LINE_ITEM', 'AD_GROUP', 'AD', 'CREATIVE', 'AUDIENCE', 'CHANNEL', 'KEYWORD_LIST', 'LOCATION_LIST', 'DEAL', 'FLOODLIGHT_GROUP', 'FLOODLIGHT_ACTIVITY', 'CUSTOM_BIDDING_ALGORITHM', 'TARGETING_TEMPLATE', 'EXPERIMENT', 'LIFT_STUDY', 'REPORT', 'PLAN');

-- CreateEnum
CREATE TYPE "AlertType" AS ENUM ('NO_SPEND', 'UNDERPACING', 'UNDERPERFORMING', 'LIMITED_AUDIENCE_SIZE', 'DEALS_OFFLINE', 'RESTRICTED_AUDIENCE_LIST', 'REJECTED_CREATIVE', 'RESTRICTED_CREATIVE', 'EXCEEDED_SPEND_THRESHOLD', 'CONFLICTING_SETTINGS', 'YOUTUBE_AD_REJECTED', 'AD_GROUP_NOT_RUNNING');

-- CreateEnum
CREATE TYPE "AlertSeverity" AS ENUM ('CRITICAL', 'NEEDS_ATTENTION');

-- CreateEnum
CREATE TYPE "AlertCategory" AS ENUM ('BUDGET', 'CREATIVES', 'PERFORMANCE', 'TARGETING', 'SETTINGS', 'SPEND_THRESHOLD');

-- CreateEnum
CREATE TYPE "AlertState" AS ENUM ('OPEN', 'RESOLVED', 'DISMISSED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" CITEXT NOT NULL,
    "name" TEXT NOT NULL,
    "passwordHash" TEXT,
    "appRole" "AppRole" NOT NULL DEFAULT 'USER',
    "status" "AccountStatus" NOT NULL DEFAULT 'ACTIVE',
    "mustChangePassword" BOOLEAN NOT NULL DEFAULT true,
    "failedLoginCount" INTEGER NOT NULL DEFAULT 0,
    "lockedUntil" TIMESTAMP(3),
    "sessionVersion" INTEGER NOT NULL DEFAULT 0,
    "activeSessionId" TEXT,
    "passwordChangedAt" TIMESTAMP(3),
    "createdById" TEXT,
    "ownerAdminId" TEXT,
    "cohortId" TEXT,
    "accessStartsAt" TIMESTAMP(3),
    "accessEndsAt" TIMESTAMP(3),
    "notes" TEXT,
    "studentCode" TEXT,
    "lastSeenAt" TIMESTAMP(3),
    "disabledAt" TIMESTAMP(3),
    "disabledById" TEXT,
    "archivedAt" TIMESTAMP(3),
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Classroom" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "timeZone" TEXT NOT NULL DEFAULT 'Asia/Kolkata',
    "realSecondsPerSimDay" INTEGER NOT NULL DEFAULT 300,
    "defaultSeedTemplate" TEXT NOT NULL DEFAULT 'blank',
    "ownerAdminId" TEXT NOT NULL,
    "capacity" INTEGER NOT NULL DEFAULT 25,
    "defaultAccessStartsAt" TIMESTAMP(3),
    "defaultAccessEndsAt" TIMESTAMP(3),
    "allowStudentClockControl" BOOLEAN NOT NULL DEFAULT false,
    "allowStudentReset" BOOLEAN NOT NULL DEFAULT false,
    "seedMode" "SeedMode" NOT NULL DEFAULT 'SHARED_MARKET',
    "catchUp" "CatchUp" NOT NULL DEFAULT 'SIMULATE',
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Classroom_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AccountPolicy" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "idleMinutesUser" INTEGER NOT NULL DEFAULT 480,
    "idleMinutesAdmin" INTEGER NOT NULL DEFAULT 480,
    "idleMinutesSuper" INTEGER NOT NULL DEFAULT 120,
    "absoluteHoursUser" INTEGER NOT NULL DEFAULT 12,
    "absoluteHoursAdmin" INTEGER NOT NULL DEFAULT 24,
    "absoluteHoursSuper" INTEGER NOT NULL DEFAULT 8,
    "singleSessionUser" BOOLEAN NOT NULL DEFAULT true,
    "singleSessionAdmin" BOOLEAN NOT NULL DEFAULT false,
    "singleSessionSuper" BOOLEAN NOT NULL DEFAULT false,
    "lockoutThreshold" INTEGER NOT NULL DEFAULT 5,
    "lockoutMinutes" INTEGER NOT NULL DEFAULT 15,
    "minPasswordLength" INTEGER NOT NULL DEFAULT 10,
    "defaultMustChange" BOOLEAN NOT NULL DEFAULT true,
    "defaultCohortCapacity" INTEGER NOT NULL DEFAULT 25,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedById" TEXT,

    CONSTRAINT "AccountPolicy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuthThrottle" (
    "key" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,
    "windowStart" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lockedUntil" TIMESTAMP(3),

    CONSTRAINT "AuthThrottle_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "ClassroomMember" (
    "id" TEXT NOT NULL,
    "classroomId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "appRole" "AppRole" NOT NULL DEFAULT 'USER',
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClassroomMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AccessWindow" (
    "id" TEXT NOT NULL,
    "classroomId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "opensAt" TIMESTAMP(3) NOT NULL,
    "closesAt" TIMESTAMP(3) NOT NULL,
    "status" "AccessWindowStatus" NOT NULL DEFAULT 'SCHEDULED',
    "seriesId" TEXT,
    "repeatRule" JSONB,
    "note" TEXT,
    "closedBy" "AccessWindowClosedBy",
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AccessWindow_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Sandbox" (
    "id" TEXT NOT NULL,
    "classroomId" TEXT NOT NULL,
    "ownerUserId" TEXT,
    "name" TEXT NOT NULL,
    "status" "SandboxStatus" NOT NULL DEFAULT 'ACTIVE',
    "seedTemplateKey" TEXT NOT NULL DEFAULT 'blank',
    "seedValue" INTEGER NOT NULL,
    "seedVersion" INTEGER NOT NULL DEFAULT 1,
    "kind" "SandboxKind" NOT NULL DEFAULT 'STUDENT',
    "provisionState" "ProvisionState" NOT NULL DEFAULT 'PENDING',
    "provisionError" TEXT,
    "frozenReason" "FrozenReason",
    "frozenAt" TIMESTAMP(3),
    "clockStateBeforeFreeze" "SimClockState",
    "resetCount" INTEGER NOT NULL DEFAULT 0,
    "lastResetAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Sandbox_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SimClock" (
    "sandboxId" TEXT NOT NULL,
    "simStart" TIMESTAMP(3) NOT NULL,
    "tickIndex" BIGINT NOT NULL DEFAULT 0,
    "state" "SimClockState" NOT NULL DEFAULT 'PAUSED',
    "minutesPerSimDay" INTEGER NOT NULL DEFAULT 5,
    "lastAdvanceRealAt" TIMESTAMP(3),
    "remainderMs" INTEGER NOT NULL DEFAULT 0,
    "marketSeed" TEXT NOT NULL,
    "sandboxSeed" TEXT NOT NULL,
    "paramsVersion" TEXT NOT NULL DEFAULT '',
    "runOutsideSession" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "SimClock_pkey" PRIMARY KEY ("sandboxId")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "actorUserId" TEXT,
    "actorRole" "AppRole",
    "classroomId" TEXT,
    "action" TEXT NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetId" TEXT,
    "targetUserId" TEXT,
    "result" "AuditResult" NOT NULL DEFAULT 'OK',
    "requestId" TEXT,
    "payload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserAccessGrant" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "sandboxId" TEXT NOT NULL,
    "partnerId" TEXT,
    "advertiserId" TEXT,
    "role" "DvRole" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserAccessGrant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Exchange" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" "ExchangeKind" NOT NULL DEFAULT 'EXCHANGE',
    "supportsDisplay" BOOLEAN NOT NULL DEFAULT true,
    "supportsVideo" BOOLEAN NOT NULL DEFAULT true,
    "supportsAudio" BOOLEAN NOT NULL DEFAULT false,
    "supportsCtv" BOOLEAN NOT NULL DEFAULT false,
    "supportsDooh" BOOLEAN NOT NULL DEFAULT false,
    "needsSeatId" BOOLEAN NOT NULL DEFAULT false,
    "needsNetworkId" BOOLEAN NOT NULL DEFAULT false,
    "enabledByDefault" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "auctionType" "AuctionType" NOT NULL DEFAULT 'SECOND_PRICE',
    "simSupplyShare" DECIMAL(8,6) NOT NULL DEFAULT 0.01,
    "simFloorCpm" DECIMAL(20,6) NOT NULL DEFAULT 0.5,

    CONSTRAINT "Exchange_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TargetingOption" (
    "id" TEXT NOT NULL,
    "dimension" "TargetingDimension" NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "path" TEXT,
    "parentId" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "meta" JSONB,

    CONSTRAINT "TargetingOption_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Partner" (
    "id" TEXT NOT NULL,
    "sandboxId" TEXT NOT NULL,
    "publicId" BIGINT NOT NULL DEFAULT next_public_id(),
    "name" TEXT NOT NULL,
    "status" "EntityStatus" NOT NULL DEFAULT 'ACTIVE',
    "timeZone" TEXT NOT NULL DEFAULT 'Asia/Calcutta',
    "currencyCode" TEXT NOT NULL DEFAULT 'INR',
    "nielsenContractCountry" TEXT,
    "includeDataInCmTransfer" BOOLEAN NOT NULL DEFAULT false,
    "reportCostToCm" BOOLEAN NOT NULL DEFAULT false,
    "autoEnableNewExchanges" BOOLEAN NOT NULL DEFAULT false,
    "sdfVersion" "SdfVersion" NOT NULL DEFAULT 'V11',
    "sdfAdminEmail" TEXT,
    "dataTermsAcceptedAt" TIMESTAMP(3),
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Partner_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PartnerExchange" (
    "id" TEXT NOT NULL,
    "sandboxId" TEXT NOT NULL,
    "partnerId" TEXT NOT NULL,
    "exchangeId" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "seatId" TEXT,
    "networkId" TEXT,
    "agencyId" TEXT,

    CONSTRAINT "PartnerExchange_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Advertiser" (
    "id" TEXT NOT NULL,
    "sandboxId" TEXT NOT NULL,
    "publicId" BIGINT NOT NULL DEFAULT next_public_id(),
    "partnerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" "EntityStatus" NOT NULL DEFAULT 'ACTIVE',
    "websiteUrl" TEXT NOT NULL,
    "industry" TEXT,
    "currencyCode" TEXT NOT NULL,
    "timeZone" TEXT NOT NULL,
    "adServer" "AdServerType" NOT NULL DEFAULT 'THIRD_PARTY_ONLY',
    "floodlightGroupId" TEXT,
    "sdfVersion" "SdfVersion" NOT NULL DEFAULT 'V9',
    "sdfAdminEmail" TEXT,
    "productImprovement" BOOLEAN NOT NULL DEFAULT true,
    "orderIdReporting" BOOLEAN NOT NULL DEFAULT false,
    "adBadging" BOOLEAN NOT NULL DEFAULT true,
    "shareDataWithCommercePartners" BOOLEAN NOT NULL DEFAULT false,
    "creativesContainTracking" BOOLEAN NOT NULL DEFAULT false,
    "authorizeVideoForTvReporting" BOOLEAN NOT NULL DEFAULT false,
    "prismaEnabled" BOOLEAN NOT NULL DEFAULT false,
    "euPoliticalAds" "EuPoliticalAds",
    "demandGenFloodlightOptimization" BOOLEAN NOT NULL DEFAULT false,
    "googleInventoryEnabled" BOOLEAN NOT NULL DEFAULT true,
    "ytBusinessName" TEXT,
    "ytLogoAssetId" TEXT,
    "integrationCode" TEXT,
    "integrationDetail" TEXT,
    "iasClientId" BIGINT NOT NULL DEFAULT 0,
    "thirdPartyConfig" JSONB,
    "scheduledDeletionAt" TIMESTAMP(3),
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Advertiser_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Campaign" (
    "id" TEXT NOT NULL,
    "sandboxId" TEXT NOT NULL,
    "publicId" BIGINT NOT NULL DEFAULT next_public_id(),
    "advertiserId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" "EntityStatus" NOT NULL DEFAULT 'ACTIVE',
    "goal" "CampaignGoal",
    "kpi" "Kpi",
    "kpiValue" DECIMAL(20,6),
    "kpiOtherText" TEXT,
    "creativeTypes" "CampaignCreativeType"[],
    "plannedSpend" DECIMAL(20,6),
    "plannedStart" DATE NOT NULL,
    "plannedEnd" DATE,
    "freqMode" "FrequencyMode" NOT NULL DEFAULT 'UNLIMITED',
    "freqMaxExposures" INTEGER,
    "freqUnit" "FrequencyUnit",
    "freqUnitCount" INTEGER,
    "landingPageUrls" TEXT[],
    "keywords" TEXT[],
    "copiedFromId" TEXT,
    "budgetUnit" "BudgetUnit" NOT NULL DEFAULT 'CURRENCY',
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Campaign_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CampaignBudget" (
    "id" TEXT NOT NULL,
    "sandboxId" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "amount" DECIMAL(20,6) NOT NULL,
    "name" TEXT NOT NULL,
    "startDate" DATE,
    "endDate" DATE,
    "invoiceGroupingId" TEXT,
    "externalBudgetId" TEXT,

    CONSTRAINT "CampaignBudget_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InsertionOrder" (
    "id" TEXT NOT NULL,
    "sandboxId" TEXT NOT NULL,
    "publicId" BIGINT NOT NULL DEFAULT next_public_id(),
    "campaignId" TEXT NOT NULL,
    "advertiserId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" "EntityStatus" NOT NULL DEFAULT 'DRAFT',
    "type" "IoType" NOT NULL DEFAULT 'STANDARD',
    "objective" "IoObjective" NOT NULL,
    "budgetUnit" "BudgetUnit" NOT NULL DEFAULT 'CURRENCY',
    "pacingPeriod" "PacingPeriod" NOT NULL DEFAULT 'FLIGHT',
    "pacingType" "PacingType" NOT NULL DEFAULT 'AHEAD',
    "dailyMaxAmount" DECIMAL(20,6),
    "dailyMaxImpressions" BIGINT,
    "kpi" "Kpi",
    "kpiValue" DECIMAL(20,6),
    "kpiOtherText" TEXT,
    "bidBudgetControl" "IoBidBudgetControl" NOT NULL DEFAULT 'IO_AUTOMATED',
    "optimizeTarget" "IoOptimizeTarget",
    "prioritizeFullBudget" BOOLEAN NOT NULL DEFAULT true,
    "autoBudgetAllocation" BOOLEAN NOT NULL DEFAULT false,
    "ytReachFreqOptimization" BOOLEAN NOT NULL DEFAULT false,
    "freqMode" "FrequencyMode" NOT NULL DEFAULT 'INHERIT',
    "freqMaxExposures" INTEGER,
    "freqUnit" "FrequencyUnit",
    "freqUnitCount" INTEGER,
    "integrationCode" TEXT,
    "integrationDetail" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InsertionOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BudgetSegment" (
    "id" TEXT NOT NULL,
    "sandboxId" TEXT NOT NULL,
    "ioId" TEXT NOT NULL,
    "ordinal" INTEGER NOT NULL DEFAULT 0,
    "amount" DECIMAL(20,6) NOT NULL,
    "description" TEXT,
    "startDate" DATE NOT NULL,
    "endDate" DATE NOT NULL,
    "externalBudgetId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BudgetSegment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PartnerCost" (
    "id" TEXT NOT NULL,
    "sandboxId" TEXT NOT NULL,
    "ioId" TEXT,
    "lineItemId" TEXT,
    "kind" "FeeKind" NOT NULL,
    "slot" INTEGER NOT NULL,
    "feeType" "FeeType" NOT NULL DEFAULT 'DEFAULT',
    "amount" DECIMAL(20,6),
    "percentage" DECIMAL(9,4),
    "invoiced" BOOLEAN NOT NULL DEFAULT false,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "PartnerCost_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LineItem" (
    "id" TEXT NOT NULL,
    "sandboxId" TEXT NOT NULL,
    "publicId" BIGINT NOT NULL DEFAULT next_public_id(),
    "ioId" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "advertiserId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" "EntityStatus" NOT NULL DEFAULT 'DRAFT',
    "type" "LineItemType" NOT NULL,
    "appAdFormat" "AppAdFormat",
    "mobileAppPlatform" "MobileAppPlatform",
    "mobileAppId" TEXT,
    "ytSubtype" "YouTubeSubtype",
    "ytSurfaces" "YouTubeSurface"[],
    "inventoryQuality" "InventoryQuality" NOT NULL DEFAULT 'AUTHORIZED_DIRECT_SELLERS_AND_RESELLERS',
    "targetCuratedCtv" BOOLEAN NOT NULL DEFAULT false,
    "optimizedTargeting" BOOLEAN NOT NULL DEFAULT false,
    "targetingTemplateId" TEXT,
    "flightMode" "FlightDateMode" NOT NULL DEFAULT 'INHERIT_IO',
    "flightStart" TIMESTAMP(3),
    "flightEnd" TIMESTAMP(3),
    "budgetMode" "BudgetMode" NOT NULL DEFAULT 'UNLIMITED_UP_TO_IO',
    "budgetAmount" DECIMAL(20,6),
    "pacingPeriod" "PacingPeriod" NOT NULL DEFAULT 'FLIGHT',
    "pacingType" "PacingType" NOT NULL DEFAULT 'EVEN',
    "dailyMaxAmount" DECIMAL(20,6),
    "dailyMaxImpressions" BIGINT,
    "bidKind" "BidStrategyKind" NOT NULL DEFAULT 'AUTOMATED',
    "bidGoal" "BidGoal",
    "bidPriority" "BidPriority" NOT NULL DEFAULT 'SPEND_FULL_BUDGET',
    "bidTargetValue" DECIMAL(20,6),
    "fixedBidCpm" DECIMAL(20,6),
    "customBiddingAlgorithmId" TEXT,
    "creativeOptimization" BOOLEAN NOT NULL DEFAULT true,
    "freqMode" "FrequencyMode" NOT NULL DEFAULT 'INHERIT',
    "freqMaxExposures" INTEGER,
    "freqUnit" "FrequencyUnit",
    "freqUnitCount" INTEGER,
    "viewFreqMode" "FrequencyMode" NOT NULL DEFAULT 'UNLIMITED',
    "viewFreqMax" INTEGER,
    "viewFreqUnit" "FrequencyUnit",
    "viewFreqUnitCount" INTEGER,
    "conversionCounting" "ConversionCounting" NOT NULL DEFAULT 'ALL',
    "conversionCountingPct" INTEGER,
    "attributionModelId" TEXT,
    "euPoliticalAds" "EuPoliticalAds",
    "revenueModelType" "RevenueModelType" NOT NULL DEFAULT 'TOTAL_MEDIA_COST_MARKUP',
    "revenueMarkupPct" DECIMAL(9,4),
    "revenueCpm" DECIMAL(20,6),
    "productFeedEnabled" BOOLEAN NOT NULL DEFAULT false,
    "relatedVideoIds" TEXT[],
    "integrationCode" TEXT,
    "integrationDetail" TEXT,
    "copiedFromId" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LineItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdGroup" (
    "id" TEXT NOT NULL,
    "sandboxId" TEXT NOT NULL,
    "publicId" BIGINT NOT NULL DEFAULT next_public_id(),
    "lineItemId" TEXT NOT NULL,
    "advertiserId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" "EntityStatus" NOT NULL DEFAULT 'ACTIVE',
    "adSourceLabel" TEXT,
    "bidValue" DECIMAL(20,6),
    "cm360Id" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdGroup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Ad" (
    "id" TEXT NOT NULL,
    "sandboxId" TEXT NOT NULL,
    "publicId" BIGINT NOT NULL DEFAULT next_public_id(),
    "adGroupId" TEXT NOT NULL,
    "advertiserId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" "EntityStatus" NOT NULL DEFAULT 'ACTIVE',
    "format" "YtAdFormat" NOT NULL DEFAULT 'RESPONSIVE',
    "reviewStatus" "AdReviewStatus" NOT NULL DEFAULT 'PENDING',
    "reviewFeedback" TEXT,
    "youtubeVideoId" TEXT NOT NULL,
    "logoAssetId" TEXT,
    "companionAssetId" TEXT,
    "headline" TEXT,
    "longHeadline" TEXT,
    "description" TEXT,
    "callToAction" TEXT,
    "businessName" TEXT,
    "displayUrl" TEXT,
    "path1" TEXT,
    "path2" TEXT,
    "landingPageUrl" TEXT NOT NULL,
    "clickTrackerUrl" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Ad_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Creative" (
    "id" TEXT NOT NULL,
    "sandboxId" TEXT NOT NULL,
    "publicId" BIGINT NOT NULL DEFAULT next_public_id(),
    "advertiserId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" "EntityStatus" NOT NULL DEFAULT 'ACTIVE',
    "kind" "CreativeKind" NOT NULL,
    "formatKey" TEXT,
    "source" "CreativeSource" NOT NULL DEFAULT 'DV360',
    "cm360Id" TEXT,
    "width" INTEGER NOT NULL DEFAULT 0,
    "height" INTEGER NOT NULL DEFAULT 0,
    "durationSeconds" INTEGER,
    "landingPageUrl" TEXT,
    "dontScaleToFit" BOOLEAN NOT NULL DEFAULT false,
    "requiresMraid" BOOLEAN NOT NULL DEFAULT false,
    "requiresHtml5" BOOLEAN NOT NULL DEFAULT false,
    "expandDirection" "ExpandDirection" NOT NULL DEFAULT 'NONE',
    "expandsOnHover" BOOLEAN NOT NULL DEFAULT false,
    "thirdPartyTag" TEXT,
    "vastTagUrl" TEXT,
    "appendTrackingTag" BOOLEAN NOT NULL DEFAULT false,
    "requiresPing" BOOLEAN NOT NULL DEFAULT false,
    "aiLabel" "AiLabel" NOT NULL DEFAULT 'UNSET',
    "integrationCode" TEXT,
    "notes" TEXT,
    "companionOfCreativeId" TEXT,
    "cmAuditFeedback" TEXT,
    "dv360Review" "Dv360ReviewStatus" NOT NULL DEFAULT 'PENDING',
    "dv360Feedback" TEXT,
    "reviewCompletedAt" TIMESTAMP(3),
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Creative_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CreativeAsset" (
    "id" TEXT NOT NULL,
    "sandboxId" TEXT NOT NULL,
    "advertiserId" TEXT NOT NULL,
    "creativeId" TEXT,
    "role" "CreativeAssetRole" NOT NULL DEFAULT 'MAIN',
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "storageKey" TEXT NOT NULL,
    "width" INTEGER,
    "height" INTEGER,
    "durationSeconds" INTEGER,

    CONSTRAINT "CreativeAsset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CreativeReview" (
    "id" TEXT NOT NULL,
    "sandboxId" TEXT NOT NULL,
    "creativeId" TEXT NOT NULL,
    "exchangeId" TEXT NOT NULL,
    "status" "ExchangeReviewStatus" NOT NULL DEFAULT 'PENDING',
    "sslStatus" "ExchangeReviewStatus" NOT NULL DEFAULT 'PENDING',
    "feedback" TEXT,
    "lastSyncAt" TIMESTAMP(3),
    "decideAt" TIMESTAMP(3),

    CONSTRAINT "CreativeReview_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CreativeAssignment" (
    "id" TEXT NOT NULL,
    "sandboxId" TEXT NOT NULL,
    "lineItemId" TEXT NOT NULL,
    "creativeId" TEXT NOT NULL,
    "assignedById" TEXT,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CreativeAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TargetingTemplate" (
    "id" TEXT NOT NULL,
    "sandboxId" TEXT NOT NULL,
    "publicId" BIGINT NOT NULL DEFAULT next_public_id(),
    "advertiserId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "lineItemType" "LineItemType" NOT NULL,
    "inventoryQuality" "InventoryQuality" NOT NULL DEFAULT 'AUTHORIZED_DIRECT_SELLERS_AND_RESELLERS',
    "exchangeIds" TEXT[],
    "optimizedTargeting" BOOLEAN NOT NULL DEFAULT false,
    "status" "EntityStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TargetingTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TargetingAssignment" (
    "id" TEXT NOT NULL,
    "sandboxId" TEXT NOT NULL,
    "ownerType" "TargetOwnerType" NOT NULL,
    "partnerId" TEXT,
    "advertiserId" TEXT,
    "templateId" TEXT,
    "lineItemId" TEXT,
    "adGroupId" TEXT,
    "dimension" "TargetingDimension" NOT NULL,
    "mode" "TargetMode" NOT NULL DEFAULT 'INCLUDE',
    "optionId" TEXT,
    "refType" "TargetRefType",
    "refId" TEXT,
    "valueText" TEXT,
    "groupIndex" INTEGER NOT NULL DEFAULT 0,
    "audienceSection" "AudienceSection",
    "config" JSONB,
    "isLocked" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TargetingAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Audience" (
    "id" TEXT NOT NULL,
    "sandboxId" TEXT NOT NULL,
    "publicId" BIGINT NOT NULL DEFAULT next_public_id(),
    "advertiserId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "type" "AudienceType" NOT NULL,
    "status" "AudienceStatus" NOT NULL DEFAULT 'PROCESSING',
    "source" "AudienceSource" NOT NULL DEFAULT 'DISPLAY_VIDEO_360',
    "sizeDisplay" BIGINT,
    "sizeYoutube" BIGINT,
    "sizeMobileApp" BIGINT,
    "sizeCtv" BIGINT,
    "membershipDays" INTEGER,
    "floodlightActivityId" TEXT,
    "lookalikeReachPct" DECIMAL(4,1),
    "lookalikeCountries" TEXT[],
    "config" JSONB,
    "availableAt" TIMESTAMP(3),
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Audience_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SimHourlyMetric" (
    "id" BIGSERIAL NOT NULL,
    "sandboxId" TEXT NOT NULL,
    "lineItemId" TEXT NOT NULL,
    "adGroupId" TEXT,
    "simHour" TIMESTAMP(3) NOT NULL,
    "bidRequests" BIGINT NOT NULL DEFAULT 0,
    "eligibleRequests" BIGINT NOT NULL DEFAULT 0,
    "bidsSubmitted" BIGINT NOT NULL DEFAULT 0,
    "bidResponses" BIGINT NOT NULL DEFAULT 0,
    "impressions" BIGINT NOT NULL DEFAULT 0,
    "billableImpressions" BIGINT NOT NULL DEFAULT 0,
    "invalidImpressions" BIGINT NOT NULL DEFAULT 0,
    "beginToRenderImpressions" BIGINT NOT NULL DEFAULT 0,
    "blockedImpressions" BIGINT NOT NULL DEFAULT 0,
    "inactiveImpressions" BIGINT NOT NULL DEFAULT 0,
    "provisionalImpressions" BIGINT NOT NULL DEFAULT 0,
    "floodlightImpressions" BIGINT NOT NULL DEFAULT 0,
    "clicks" BIGINT NOT NULL DEFAULT 0,
    "invalidClicks" BIGINT NOT NULL DEFAULT 0,
    "engagements" BIGINT NOT NULL DEFAULT 0,
    "companionClicks" BIGINT NOT NULL DEFAULT 0,
    "qrScans" BIGINT NOT NULL DEFAULT 0,
    "measurableImpressions" BIGINT NOT NULL DEFAULT 0,
    "viewableImpressions" BIGINT NOT NULL DEFAULT 0,
    "viewable10sImpressions" BIGINT NOT NULL DEFAULT 0,
    "audibleImpressions" BIGINT NOT NULL DEFAULT 0,
    "audibleVisibleStart" BIGINT NOT NULL DEFAULT 0,
    "audibleVisibleQ1" BIGINT NOT NULL DEFAULT 0,
    "audibleVisibleMid" BIGINT NOT NULL DEFAULT 0,
    "audibleVisibleQ3" BIGINT NOT NULL DEFAULT 0,
    "audibleVisibleComplete" BIGINT NOT NULL DEFAULT 0,
    "fullyOnScreen2s" BIGINT NOT NULL DEFAULT 0,
    "inBackgroundImpressions" BIGINT NOT NULL DEFAULT 0,
    "videoStarts" BIGINT NOT NULL DEFAULT 0,
    "videoQ1" BIGINT NOT NULL DEFAULT 0,
    "videoMid" BIGINT NOT NULL DEFAULT 0,
    "videoQ3" BIGINT NOT NULL DEFAULT 0,
    "videoCompletions" BIGINT NOT NULL DEFAULT 0,
    "skips" BIGINT NOT NULL DEFAULT 0,
    "videoViews" BIGINT NOT NULL DEFAULT 0,
    "coViewedImpressions" BIGINT NOT NULL DEFAULT 0,
    "companionViews" BIGINT NOT NULL DEFAULT 0,
    "adSequenceImpressions" BIGINT NOT NULL DEFAULT 0,
    "watchSecondsTotal" BIGINT NOT NULL DEFAULT 0,
    "lostTargeting" BIGINT NOT NULL DEFAULT 0,
    "lostCreative" BIGINT NOT NULL DEFAULT 0,
    "lostFrequency" BIGINT NOT NULL DEFAULT 0,
    "lostBudget" BIGINT NOT NULL DEFAULT 0,
    "lostPacing" BIGINT NOT NULL DEFAULT 0,
    "lostBelowMinBid" BIGINT NOT NULL DEFAULT 0,
    "lostInternal" BIGINT NOT NULL DEFAULT 0,
    "lostExternalBid" BIGINT NOT NULL DEFAULT 0,
    "lostExternalCreative" BIGINT NOT NULL DEFAULT 0,
    "lostExternalOther" BIGINT NOT NULL DEFAULT 0,
    "lostNotReported" BIGINT NOT NULL DEFAULT 0,
    "pgCommittedImpressions" BIGINT NOT NULL DEFAULT 0,
    "pgShortfallImpressions" BIGINT NOT NULL DEFAULT 0,
    "convPostClick" DECIMAL(20,4) NOT NULL DEFAULT 0,
    "convPostView" DECIMAL(20,4) NOT NULL DEFAULT 0,
    "convTotal" DECIMAL(20,4) NOT NULL DEFAULT 0,
    "convTransactions" DECIMAL(20,4) NOT NULL DEFAULT 0,
    "convItems" DECIMAL(20,4) NOT NULL DEFAULT 0,
    "convRevenue" DECIMAL(20,6) NOT NULL DEFAULT 0,
    "cartRevenue" DECIMAL(20,6) NOT NULL DEFAULT 0,
    "mediaCost" DECIMAL(20,6) NOT NULL DEFAULT 0,
    "refund" DECIMAL(20,6) NOT NULL DEFAULT 0,
    "cpmFee1" DECIMAL(20,6) NOT NULL DEFAULT 0,
    "cpmFee2" DECIMAL(20,6) NOT NULL DEFAULT 0,
    "mediaFee1" DECIMAL(20,6) NOT NULL DEFAULT 0,
    "mediaFee2" DECIMAL(20,6) NOT NULL DEFAULT 0,
    "dataCost" DECIMAL(20,6) NOT NULL DEFAULT 0,
    "verificationCost" DECIMAL(20,6) NOT NULL DEFAULT 0,
    "adServingCost" DECIMAL(20,6) NOT NULL DEFAULT 0,
    "totalMediaCost" DECIMAL(20,6) NOT NULL DEFAULT 0,
    "revenue" DECIMAL(20,6) NOT NULL DEFAULT 0,
    "profit" DECIMAL(20,6) NOT NULL DEFAULT 0,
    "clientCost" DECIMAL(20,6) NOT NULL DEFAULT 0,
    "dealSavings" DECIMAL(20,6) NOT NULL DEFAULT 0,
    "customImpressionValue" DECIMAL(20,6) NOT NULL DEFAULT 0,
    "customImpressionCost" DECIMAL(20,6) NOT NULL DEFAULT 0,

    CONSTRAINT "SimHourlyMetric_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SimDailyMetric" (
    "id" BIGSERIAL NOT NULL,
    "sandboxId" TEXT NOT NULL,
    "classroomId" TEXT NOT NULL,
    "lineItemId" TEXT NOT NULL,
    "simDate" DATE NOT NULL,
    "sliceKind" TEXT NOT NULL DEFAULT 'total',
    "sliceKey" TEXT NOT NULL DEFAULT '',
    "exchangeId" TEXT,
    "deviceType" "DeviceType",
    "environment" "Environment",
    "regionCode" TEXT,
    "creativeId" TEXT,
    "adGroupId" TEXT,
    "dealId" TEXT,
    "bidRequests" BIGINT NOT NULL DEFAULT 0,
    "eligibleRequests" BIGINT NOT NULL DEFAULT 0,
    "bidsSubmitted" BIGINT NOT NULL DEFAULT 0,
    "bidResponses" BIGINT NOT NULL DEFAULT 0,
    "impressions" BIGINT NOT NULL DEFAULT 0,
    "billableImpressions" BIGINT NOT NULL DEFAULT 0,
    "invalidImpressions" BIGINT NOT NULL DEFAULT 0,
    "beginToRenderImpressions" BIGINT NOT NULL DEFAULT 0,
    "blockedImpressions" BIGINT NOT NULL DEFAULT 0,
    "inactiveImpressions" BIGINT NOT NULL DEFAULT 0,
    "provisionalImpressions" BIGINT NOT NULL DEFAULT 0,
    "floodlightImpressions" BIGINT NOT NULL DEFAULT 0,
    "clicks" BIGINT NOT NULL DEFAULT 0,
    "invalidClicks" BIGINT NOT NULL DEFAULT 0,
    "engagements" BIGINT NOT NULL DEFAULT 0,
    "companionClicks" BIGINT NOT NULL DEFAULT 0,
    "qrScans" BIGINT NOT NULL DEFAULT 0,
    "measurableImpressions" BIGINT NOT NULL DEFAULT 0,
    "viewableImpressions" BIGINT NOT NULL DEFAULT 0,
    "viewable10sImpressions" BIGINT NOT NULL DEFAULT 0,
    "audibleImpressions" BIGINT NOT NULL DEFAULT 0,
    "audibleVisibleStart" BIGINT NOT NULL DEFAULT 0,
    "audibleVisibleQ1" BIGINT NOT NULL DEFAULT 0,
    "audibleVisibleMid" BIGINT NOT NULL DEFAULT 0,
    "audibleVisibleQ3" BIGINT NOT NULL DEFAULT 0,
    "audibleVisibleComplete" BIGINT NOT NULL DEFAULT 0,
    "fullyOnScreen2s" BIGINT NOT NULL DEFAULT 0,
    "inBackgroundImpressions" BIGINT NOT NULL DEFAULT 0,
    "videoStarts" BIGINT NOT NULL DEFAULT 0,
    "videoQ1" BIGINT NOT NULL DEFAULT 0,
    "videoMid" BIGINT NOT NULL DEFAULT 0,
    "videoQ3" BIGINT NOT NULL DEFAULT 0,
    "videoCompletions" BIGINT NOT NULL DEFAULT 0,
    "skips" BIGINT NOT NULL DEFAULT 0,
    "videoViews" BIGINT NOT NULL DEFAULT 0,
    "coViewedImpressions" BIGINT NOT NULL DEFAULT 0,
    "companionViews" BIGINT NOT NULL DEFAULT 0,
    "adSequenceImpressions" BIGINT NOT NULL DEFAULT 0,
    "watchSecondsTotal" BIGINT NOT NULL DEFAULT 0,
    "lostTargeting" BIGINT NOT NULL DEFAULT 0,
    "lostCreative" BIGINT NOT NULL DEFAULT 0,
    "lostFrequency" BIGINT NOT NULL DEFAULT 0,
    "lostBudget" BIGINT NOT NULL DEFAULT 0,
    "lostPacing" BIGINT NOT NULL DEFAULT 0,
    "lostBelowMinBid" BIGINT NOT NULL DEFAULT 0,
    "lostInternal" BIGINT NOT NULL DEFAULT 0,
    "lostExternalBid" BIGINT NOT NULL DEFAULT 0,
    "lostExternalCreative" BIGINT NOT NULL DEFAULT 0,
    "lostExternalOther" BIGINT NOT NULL DEFAULT 0,
    "lostNotReported" BIGINT NOT NULL DEFAULT 0,
    "pgCommittedImpressions" BIGINT NOT NULL DEFAULT 0,
    "pgShortfallImpressions" BIGINT NOT NULL DEFAULT 0,
    "convPostClick" DECIMAL(20,4) NOT NULL DEFAULT 0,
    "convPostView" DECIMAL(20,4) NOT NULL DEFAULT 0,
    "convTotal" DECIMAL(20,4) NOT NULL DEFAULT 0,
    "convTransactions" DECIMAL(20,4) NOT NULL DEFAULT 0,
    "convItems" DECIMAL(20,4) NOT NULL DEFAULT 0,
    "convRevenue" DECIMAL(20,6) NOT NULL DEFAULT 0,
    "cartRevenue" DECIMAL(20,6) NOT NULL DEFAULT 0,
    "mediaCost" DECIMAL(20,6) NOT NULL DEFAULT 0,
    "refund" DECIMAL(20,6) NOT NULL DEFAULT 0,
    "cpmFee1" DECIMAL(20,6) NOT NULL DEFAULT 0,
    "cpmFee2" DECIMAL(20,6) NOT NULL DEFAULT 0,
    "mediaFee1" DECIMAL(20,6) NOT NULL DEFAULT 0,
    "mediaFee2" DECIMAL(20,6) NOT NULL DEFAULT 0,
    "dataCost" DECIMAL(20,6) NOT NULL DEFAULT 0,
    "verificationCost" DECIMAL(20,6) NOT NULL DEFAULT 0,
    "adServingCost" DECIMAL(20,6) NOT NULL DEFAULT 0,
    "totalMediaCost" DECIMAL(20,6) NOT NULL DEFAULT 0,
    "revenue" DECIMAL(20,6) NOT NULL DEFAULT 0,
    "profit" DECIMAL(20,6) NOT NULL DEFAULT 0,
    "clientCost" DECIMAL(20,6) NOT NULL DEFAULT 0,
    "dealSavings" DECIMAL(20,6) NOT NULL DEFAULT 0,
    "customImpressionValue" DECIMAL(20,6) NOT NULL DEFAULT 0,
    "customImpressionCost" DECIMAL(20,6) NOT NULL DEFAULT 0,
    "budgetSegmentBudget" DECIMAL(20,6),
    "liPacingPct" DECIMAL(9,4),
    "ioPacingPct" DECIMAL(9,4),
    "dailyTarget" DECIMAL(20,6),

    CONSTRAINT "SimDailyMetric_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DeliveryDiagnostic" (
    "id" BIGSERIAL NOT NULL,
    "sandboxId" TEXT NOT NULL,
    "lineItemId" TEXT NOT NULL,
    "adGroupId" TEXT,
    "date" DATE NOT NULL,
    "exchangeId" TEXT NOT NULL,
    "stage" "DiagStage" NOT NULL,
    "reasonCode" TEXT NOT NULL,
    "count" BIGINT NOT NULL DEFAULT 0,

    CONSTRAINT "DeliveryDiagnostic_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChangeGroup" (
    "id" TEXT NOT NULL,
    "sandboxId" TEXT NOT NULL,
    "classroomId" TEXT NOT NULL,
    "advertiserId" TEXT,
    "campaignId" TEXT,
    "ioId" TEXT,
    "lineItemId" TEXT,
    "entityType" "EntityType" NOT NULL,
    "entityId" TEXT NOT NULL,
    "entityPublicId" BIGINT,
    "entityName" TEXT,
    "actorType" "ChangeActor" NOT NULL DEFAULT 'USER',
    "userId" TEXT,
    "actorLabel" TEXT,
    "systemActor" TEXT,
    "source" "ChangeSource" NOT NULL DEFAULT 'UI',
    "bulkJobId" TEXT,
    "summary" TEXT NOT NULL,
    "note" TEXT,
    "fanOutFromGroupId" TEXT,
    "idempotencyKey" TEXT,
    "schemaVersion" INTEGER NOT NULL DEFAULT 1,
    "isHidden" BOOLEAN NOT NULL DEFAULT false,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChangeGroup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChangeEntry" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "sandboxId" TEXT NOT NULL,
    "kind" "ChangeKind" NOT NULL DEFAULT 'UPDATE',
    "fieldPath" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "oldValue" TEXT,
    "newValue" TEXT,
    "parentPath" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ChangeEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Alert" (
    "id" TEXT NOT NULL,
    "sandboxId" TEXT NOT NULL,
    "advertiserId" TEXT NOT NULL,
    "campaignId" TEXT,
    "ioId" TEXT,
    "lineItemId" TEXT,
    "type" "AlertType" NOT NULL,
    "severity" "AlertSeverity" NOT NULL,
    "category" "AlertCategory" NOT NULL,
    "state" "AlertState" NOT NULL DEFAULT 'OPEN',
    "title" TEXT NOT NULL,
    "detail" TEXT,
    "affectedCount" INTEGER NOT NULL DEFAULT 1,
    "diagnosticCode" TEXT,
    "payload" JSONB,
    "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "Alert_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_appRole_status_idx" ON "User"("appRole", "status");

-- CreateIndex
CREATE INDEX "User_ownerAdminId_status_idx" ON "User"("ownerAdminId", "status");

-- CreateIndex
CREATE INDEX "User_cohortId_status_idx" ON "User"("cohortId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "User_cohortId_studentCode_key" ON "User"("cohortId", "studentCode");

-- CreateIndex
CREATE UNIQUE INDEX "Classroom_code_key" ON "Classroom"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Classroom_ownerAdminId_name_key" ON "Classroom"("ownerAdminId", "name");

-- CreateIndex
CREATE INDEX "ClassroomMember_userId_idx" ON "ClassroomMember"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "ClassroomMember_classroomId_userId_key" ON "ClassroomMember"("classroomId", "userId");

-- CreateIndex
CREATE INDEX "AccessWindow_classroomId_opensAt_idx" ON "AccessWindow"("classroomId", "opensAt");

-- CreateIndex
CREATE INDEX "AccessWindow_status_closesAt_idx" ON "AccessWindow"("status", "closesAt");

-- CreateIndex
CREATE INDEX "AccessWindow_seriesId_idx" ON "AccessWindow"("seriesId");

-- CreateIndex
CREATE INDEX "Sandbox_classroomId_status_idx" ON "Sandbox"("classroomId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Sandbox_classroomId_ownerUserId_key" ON "Sandbox"("classroomId", "ownerUserId");

-- CreateIndex
CREATE INDEX "AuditLog_targetUserId_createdAt_idx" ON "AuditLog"("targetUserId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_actorUserId_createdAt_idx" ON "AuditLog"("actorUserId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_classroomId_createdAt_idx" ON "AuditLog"("classroomId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- CreateIndex
CREATE INDEX "UserAccessGrant_sandboxId_idx" ON "UserAccessGrant"("sandboxId");

-- CreateIndex
CREATE UNIQUE INDEX "UserAccessGrant_userId_sandboxId_partnerId_advertiserId_key" ON "UserAccessGrant"("userId", "sandboxId", "partnerId", "advertiserId");

-- CreateIndex
CREATE UNIQUE INDEX "Exchange_code_key" ON "Exchange"("code");

-- CreateIndex
CREATE INDEX "TargetingOption_dimension_parentId_idx" ON "TargetingOption"("dimension", "parentId");

-- CreateIndex
CREATE UNIQUE INDEX "TargetingOption_dimension_code_key" ON "TargetingOption"("dimension", "code");

-- CreateIndex
CREATE UNIQUE INDEX "Partner_publicId_key" ON "Partner"("publicId");

-- CreateIndex
CREATE INDEX "Partner_sandboxId_idx" ON "Partner"("sandboxId");

-- CreateIndex
CREATE UNIQUE INDEX "Partner_id_sandboxId_key" ON "Partner"("id", "sandboxId");

-- CreateIndex
CREATE INDEX "PartnerExchange_sandboxId_idx" ON "PartnerExchange"("sandboxId");

-- CreateIndex
CREATE UNIQUE INDEX "PartnerExchange_partnerId_exchangeId_key" ON "PartnerExchange"("partnerId", "exchangeId");

-- CreateIndex
CREATE UNIQUE INDEX "Advertiser_publicId_key" ON "Advertiser"("publicId");

-- CreateIndex
CREATE INDEX "Advertiser_sandboxId_partnerId_status_idx" ON "Advertiser"("sandboxId", "partnerId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Advertiser_id_sandboxId_key" ON "Advertiser"("id", "sandboxId");

-- CreateIndex
CREATE UNIQUE INDEX "Campaign_publicId_key" ON "Campaign"("publicId");

-- CreateIndex
CREATE INDEX "Campaign_sandboxId_advertiserId_status_idx" ON "Campaign"("sandboxId", "advertiserId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Campaign_id_sandboxId_key" ON "Campaign"("id", "sandboxId");

-- CreateIndex
CREATE INDEX "CampaignBudget_sandboxId_campaignId_idx" ON "CampaignBudget"("sandboxId", "campaignId");

-- CreateIndex
CREATE UNIQUE INDEX "InsertionOrder_publicId_key" ON "InsertionOrder"("publicId");

-- CreateIndex
CREATE INDEX "InsertionOrder_sandboxId_campaignId_status_idx" ON "InsertionOrder"("sandboxId", "campaignId", "status");

-- CreateIndex
CREATE INDEX "InsertionOrder_sandboxId_advertiserId_idx" ON "InsertionOrder"("sandboxId", "advertiserId");

-- CreateIndex
CREATE UNIQUE INDEX "InsertionOrder_id_sandboxId_key" ON "InsertionOrder"("id", "sandboxId");

-- CreateIndex
CREATE INDEX "BudgetSegment_sandboxId_ioId_startDate_idx" ON "BudgetSegment"("sandboxId", "ioId", "startDate");

-- CreateIndex
CREATE UNIQUE INDEX "BudgetSegment_id_sandboxId_key" ON "BudgetSegment"("id", "sandboxId");

-- CreateIndex
CREATE INDEX "PartnerCost_sandboxId_ioId_idx" ON "PartnerCost"("sandboxId", "ioId");

-- CreateIndex
CREATE INDEX "PartnerCost_sandboxId_lineItemId_idx" ON "PartnerCost"("sandboxId", "lineItemId");

-- CreateIndex
CREATE UNIQUE INDEX "LineItem_publicId_key" ON "LineItem"("publicId");

-- CreateIndex
CREATE INDEX "LineItem_sandboxId_ioId_status_idx" ON "LineItem"("sandboxId", "ioId", "status");

-- CreateIndex
CREATE INDEX "LineItem_sandboxId_advertiserId_type_idx" ON "LineItem"("sandboxId", "advertiserId", "type");

-- CreateIndex
CREATE INDEX "LineItem_sandboxId_campaignId_idx" ON "LineItem"("sandboxId", "campaignId");

-- CreateIndex
CREATE UNIQUE INDEX "LineItem_id_sandboxId_key" ON "LineItem"("id", "sandboxId");

-- CreateIndex
CREATE UNIQUE INDEX "AdGroup_publicId_key" ON "AdGroup"("publicId");

-- CreateIndex
CREATE INDEX "AdGroup_sandboxId_lineItemId_status_idx" ON "AdGroup"("sandboxId", "lineItemId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "AdGroup_id_sandboxId_key" ON "AdGroup"("id", "sandboxId");

-- CreateIndex
CREATE UNIQUE INDEX "Ad_publicId_key" ON "Ad"("publicId");

-- CreateIndex
CREATE INDEX "Ad_sandboxId_adGroupId_status_idx" ON "Ad"("sandboxId", "adGroupId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Ad_id_sandboxId_key" ON "Ad"("id", "sandboxId");

-- CreateIndex
CREATE UNIQUE INDEX "Creative_publicId_key" ON "Creative"("publicId");

-- CreateIndex
CREATE INDEX "Creative_sandboxId_advertiserId_status_idx" ON "Creative"("sandboxId", "advertiserId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Creative_id_sandboxId_key" ON "Creative"("id", "sandboxId");

-- CreateIndex
CREATE INDEX "CreativeAsset_sandboxId_creativeId_idx" ON "CreativeAsset"("sandboxId", "creativeId");

-- CreateIndex
CREATE INDEX "CreativeReview_sandboxId_status_idx" ON "CreativeReview"("sandboxId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "CreativeReview_creativeId_exchangeId_key" ON "CreativeReview"("creativeId", "exchangeId");

-- CreateIndex
CREATE INDEX "CreativeAssignment_sandboxId_creativeId_idx" ON "CreativeAssignment"("sandboxId", "creativeId");

-- CreateIndex
CREATE UNIQUE INDEX "CreativeAssignment_lineItemId_creativeId_key" ON "CreativeAssignment"("lineItemId", "creativeId");

-- CreateIndex
CREATE UNIQUE INDEX "TargetingTemplate_publicId_key" ON "TargetingTemplate"("publicId");

-- CreateIndex
CREATE INDEX "TargetingTemplate_sandboxId_advertiserId_idx" ON "TargetingTemplate"("sandboxId", "advertiserId");

-- CreateIndex
CREATE UNIQUE INDEX "TargetingTemplate_id_sandboxId_key" ON "TargetingTemplate"("id", "sandboxId");

-- CreateIndex
CREATE INDEX "TargetingAssignment_sandboxId_lineItemId_dimension_idx" ON "TargetingAssignment"("sandboxId", "lineItemId", "dimension");

-- CreateIndex
CREATE INDEX "TargetingAssignment_sandboxId_adGroupId_dimension_idx" ON "TargetingAssignment"("sandboxId", "adGroupId", "dimension");

-- CreateIndex
CREATE INDEX "TargetingAssignment_sandboxId_advertiserId_dimension_idx" ON "TargetingAssignment"("sandboxId", "advertiserId", "dimension");

-- CreateIndex
CREATE INDEX "TargetingAssignment_sandboxId_templateId_idx" ON "TargetingAssignment"("sandboxId", "templateId");

-- CreateIndex
CREATE INDEX "TargetingAssignment_sandboxId_refType_refId_idx" ON "TargetingAssignment"("sandboxId", "refType", "refId");

-- CreateIndex
CREATE UNIQUE INDEX "Audience_publicId_key" ON "Audience"("publicId");

-- CreateIndex
CREATE INDEX "Audience_sandboxId_advertiserId_type_idx" ON "Audience"("sandboxId", "advertiserId", "type");

-- CreateIndex
CREATE UNIQUE INDEX "Audience_id_sandboxId_key" ON "Audience"("id", "sandboxId");

-- CreateIndex
CREATE INDEX "SimHourlyMetric_sandboxId_simHour_idx" ON "SimHourlyMetric"("sandboxId", "simHour");

-- CreateIndex
CREATE UNIQUE INDEX "SimHourlyMetric_lineItemId_adGroupId_simHour_key" ON "SimHourlyMetric"("lineItemId", "adGroupId", "simHour");

-- CreateIndex
CREATE INDEX "SimDailyMetric_sandboxId_simDate_idx" ON "SimDailyMetric"("sandboxId", "simDate");

-- CreateIndex
CREATE INDEX "SimDailyMetric_classroomId_simDate_idx" ON "SimDailyMetric"("classroomId", "simDate");

-- CreateIndex
CREATE UNIQUE INDEX "SimDailyMetric_lineItemId_simDate_sliceKind_sliceKey_key" ON "SimDailyMetric"("lineItemId", "simDate", "sliceKind", "sliceKey");

-- CreateIndex
CREATE INDEX "DeliveryDiagnostic_sandboxId_date_idx" ON "DeliveryDiagnostic"("sandboxId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "DeliveryDiagnostic_lineItemId_adGroupId_date_exchangeId_rea_key" ON "DeliveryDiagnostic"("lineItemId", "adGroupId", "date", "exchangeId", "reasonCode");

-- CreateIndex
CREATE INDEX "ChangeGroup_sandboxId_advertiserId_occurredAt_idx" ON "ChangeGroup"("sandboxId", "advertiserId", "occurredAt");

-- CreateIndex
CREATE INDEX "ChangeGroup_sandboxId_advertiserId_isHidden_occurredAt_idx" ON "ChangeGroup"("sandboxId", "advertiserId", "isHidden", "occurredAt");

-- CreateIndex
CREATE INDEX "ChangeGroup_fanOutFromGroupId_idx" ON "ChangeGroup"("fanOutFromGroupId");

-- CreateIndex
CREATE INDEX "ChangeGroup_sandboxId_idempotencyKey_idx" ON "ChangeGroup"("sandboxId", "idempotencyKey");

-- CreateIndex
CREATE INDEX "ChangeGroup_sandboxId_entityType_entityId_occurredAt_idx" ON "ChangeGroup"("sandboxId", "entityType", "entityId", "occurredAt");

-- CreateIndex
CREATE INDEX "ChangeGroup_sandboxId_ioId_occurredAt_idx" ON "ChangeGroup"("sandboxId", "ioId", "occurredAt");

-- CreateIndex
CREATE INDEX "ChangeGroup_sandboxId_lineItemId_occurredAt_idx" ON "ChangeGroup"("sandboxId", "lineItemId", "occurredAt");

-- CreateIndex
CREATE INDEX "ChangeGroup_classroomId_occurredAt_idx" ON "ChangeGroup"("classroomId", "occurredAt");

-- CreateIndex
CREATE INDEX "ChangeEntry_groupId_sortOrder_idx" ON "ChangeEntry"("groupId", "sortOrder");

-- CreateIndex
CREATE INDEX "ChangeEntry_sandboxId_fieldPath_idx" ON "ChangeEntry"("sandboxId", "fieldPath");

-- CreateIndex
CREATE INDEX "Alert_sandboxId_advertiserId_state_severity_idx" ON "Alert"("sandboxId", "advertiserId", "state", "severity");

-- CreateIndex
CREATE INDEX "Alert_sandboxId_campaignId_state_idx" ON "Alert"("sandboxId", "campaignId", "state");

-- CreateIndex
CREATE INDEX "Alert_sandboxId_lineItemId_type_state_idx" ON "Alert"("sandboxId", "lineItemId", "type", "state");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_ownerAdminId_fkey" FOREIGN KEY ("ownerAdminId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_cohortId_fkey" FOREIGN KEY ("cohortId") REFERENCES "Classroom"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Classroom" ADD CONSTRAINT "Classroom_ownerAdminId_fkey" FOREIGN KEY ("ownerAdminId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClassroomMember" ADD CONSTRAINT "ClassroomMember_classroomId_fkey" FOREIGN KEY ("classroomId") REFERENCES "Classroom"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClassroomMember" ADD CONSTRAINT "ClassroomMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccessWindow" ADD CONSTRAINT "AccessWindow_classroomId_fkey" FOREIGN KEY ("classroomId") REFERENCES "Classroom"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Sandbox" ADD CONSTRAINT "Sandbox_classroomId_fkey" FOREIGN KEY ("classroomId") REFERENCES "Classroom"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Sandbox" ADD CONSTRAINT "Sandbox_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SimClock" ADD CONSTRAINT "SimClock_sandboxId_fkey" FOREIGN KEY ("sandboxId") REFERENCES "Sandbox"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserAccessGrant" ADD CONSTRAINT "UserAccessGrant_sandboxId_fkey" FOREIGN KEY ("sandboxId") REFERENCES "Sandbox"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserAccessGrant" ADD CONSTRAINT "UserAccessGrant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TargetingOption" ADD CONSTRAINT "TargetingOption_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "TargetingOption"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Partner" ADD CONSTRAINT "Partner_sandboxId_fkey" FOREIGN KEY ("sandboxId") REFERENCES "Sandbox"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartnerExchange" ADD CONSTRAINT "PartnerExchange_partnerId_sandboxId_fkey" FOREIGN KEY ("partnerId", "sandboxId") REFERENCES "Partner"("id", "sandboxId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartnerExchange" ADD CONSTRAINT "PartnerExchange_exchangeId_fkey" FOREIGN KEY ("exchangeId") REFERENCES "Exchange"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Advertiser" ADD CONSTRAINT "Advertiser_partnerId_sandboxId_fkey" FOREIGN KEY ("partnerId", "sandboxId") REFERENCES "Partner"("id", "sandboxId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Campaign" ADD CONSTRAINT "Campaign_advertiserId_sandboxId_fkey" FOREIGN KEY ("advertiserId", "sandboxId") REFERENCES "Advertiser"("id", "sandboxId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampaignBudget" ADD CONSTRAINT "CampaignBudget_campaignId_sandboxId_fkey" FOREIGN KEY ("campaignId", "sandboxId") REFERENCES "Campaign"("id", "sandboxId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InsertionOrder" ADD CONSTRAINT "InsertionOrder_campaignId_sandboxId_fkey" FOREIGN KEY ("campaignId", "sandboxId") REFERENCES "Campaign"("id", "sandboxId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InsertionOrder" ADD CONSTRAINT "InsertionOrder_advertiserId_sandboxId_fkey" FOREIGN KEY ("advertiserId", "sandboxId") REFERENCES "Advertiser"("id", "sandboxId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BudgetSegment" ADD CONSTRAINT "BudgetSegment_ioId_sandboxId_fkey" FOREIGN KEY ("ioId", "sandboxId") REFERENCES "InsertionOrder"("id", "sandboxId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartnerCost" ADD CONSTRAINT "PartnerCost_ioId_sandboxId_fkey" FOREIGN KEY ("ioId", "sandboxId") REFERENCES "InsertionOrder"("id", "sandboxId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartnerCost" ADD CONSTRAINT "PartnerCost_lineItemId_sandboxId_fkey" FOREIGN KEY ("lineItemId", "sandboxId") REFERENCES "LineItem"("id", "sandboxId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LineItem" ADD CONSTRAINT "LineItem_ioId_sandboxId_fkey" FOREIGN KEY ("ioId", "sandboxId") REFERENCES "InsertionOrder"("id", "sandboxId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LineItem" ADD CONSTRAINT "LineItem_campaignId_sandboxId_fkey" FOREIGN KEY ("campaignId", "sandboxId") REFERENCES "Campaign"("id", "sandboxId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LineItem" ADD CONSTRAINT "LineItem_advertiserId_sandboxId_fkey" FOREIGN KEY ("advertiserId", "sandboxId") REFERENCES "Advertiser"("id", "sandboxId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdGroup" ADD CONSTRAINT "AdGroup_lineItemId_sandboxId_fkey" FOREIGN KEY ("lineItemId", "sandboxId") REFERENCES "LineItem"("id", "sandboxId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdGroup" ADD CONSTRAINT "AdGroup_advertiserId_sandboxId_fkey" FOREIGN KEY ("advertiserId", "sandboxId") REFERENCES "Advertiser"("id", "sandboxId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ad" ADD CONSTRAINT "Ad_adGroupId_sandboxId_fkey" FOREIGN KEY ("adGroupId", "sandboxId") REFERENCES "AdGroup"("id", "sandboxId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ad" ADD CONSTRAINT "Ad_advertiserId_sandboxId_fkey" FOREIGN KEY ("advertiserId", "sandboxId") REFERENCES "Advertiser"("id", "sandboxId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Creative" ADD CONSTRAINT "Creative_advertiserId_sandboxId_fkey" FOREIGN KEY ("advertiserId", "sandboxId") REFERENCES "Advertiser"("id", "sandboxId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreativeAsset" ADD CONSTRAINT "CreativeAsset_advertiserId_sandboxId_fkey" FOREIGN KEY ("advertiserId", "sandboxId") REFERENCES "Advertiser"("id", "sandboxId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreativeAsset" ADD CONSTRAINT "CreativeAsset_creativeId_sandboxId_fkey" FOREIGN KEY ("creativeId", "sandboxId") REFERENCES "Creative"("id", "sandboxId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreativeReview" ADD CONSTRAINT "CreativeReview_creativeId_sandboxId_fkey" FOREIGN KEY ("creativeId", "sandboxId") REFERENCES "Creative"("id", "sandboxId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreativeAssignment" ADD CONSTRAINT "CreativeAssignment_lineItemId_sandboxId_fkey" FOREIGN KEY ("lineItemId", "sandboxId") REFERENCES "LineItem"("id", "sandboxId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreativeAssignment" ADD CONSTRAINT "CreativeAssignment_creativeId_sandboxId_fkey" FOREIGN KEY ("creativeId", "sandboxId") REFERENCES "Creative"("id", "sandboxId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TargetingTemplate" ADD CONSTRAINT "TargetingTemplate_advertiserId_sandboxId_fkey" FOREIGN KEY ("advertiserId", "sandboxId") REFERENCES "Advertiser"("id", "sandboxId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TargetingAssignment" ADD CONSTRAINT "TargetingAssignment_advertiserId_sandboxId_fkey" FOREIGN KEY ("advertiserId", "sandboxId") REFERENCES "Advertiser"("id", "sandboxId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TargetingAssignment" ADD CONSTRAINT "TargetingAssignment_templateId_sandboxId_fkey" FOREIGN KEY ("templateId", "sandboxId") REFERENCES "TargetingTemplate"("id", "sandboxId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TargetingAssignment" ADD CONSTRAINT "TargetingAssignment_lineItemId_sandboxId_fkey" FOREIGN KEY ("lineItemId", "sandboxId") REFERENCES "LineItem"("id", "sandboxId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TargetingAssignment" ADD CONSTRAINT "TargetingAssignment_adGroupId_sandboxId_fkey" FOREIGN KEY ("adGroupId", "sandboxId") REFERENCES "AdGroup"("id", "sandboxId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Audience" ADD CONSTRAINT "Audience_advertiserId_sandboxId_fkey" FOREIGN KEY ("advertiserId", "sandboxId") REFERENCES "Advertiser"("id", "sandboxId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SimHourlyMetric" ADD CONSTRAINT "SimHourlyMetric_lineItemId_sandboxId_fkey" FOREIGN KEY ("lineItemId", "sandboxId") REFERENCES "LineItem"("id", "sandboxId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SimDailyMetric" ADD CONSTRAINT "SimDailyMetric_lineItemId_sandboxId_fkey" FOREIGN KEY ("lineItemId", "sandboxId") REFERENCES "LineItem"("id", "sandboxId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeliveryDiagnostic" ADD CONSTRAINT "DeliveryDiagnostic_lineItemId_sandboxId_fkey" FOREIGN KEY ("lineItemId", "sandboxId") REFERENCES "LineItem"("id", "sandboxId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChangeGroup" ADD CONSTRAINT "ChangeGroup_sandboxId_fkey" FOREIGN KEY ("sandboxId") REFERENCES "Sandbox"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChangeEntry" ADD CONSTRAINT "ChangeEntry_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "ChangeGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Alert" ADD CONSTRAINT "Alert_advertiserId_sandboxId_fkey" FOREIGN KEY ("advertiserId", "sandboxId") REFERENCES "Advertiser"("id", "sandboxId") ON DELETE CASCADE ON UPDATE CASCADE;


-- >>> prisma/sql/30-constraints.sql
-- P3-05a. Constraints Prisma cannot express (data-model Appendix B and 8 Q22). Runs after the generated tables.

-- Nulls-not-distinct unique keys (Postgres 15+). The indexes keep the names Prisma generated, so
-- "prisma migrate dev" sees no drift.
DROP INDEX "UserAccessGrant_userId_sandboxId_partnerId_advertiserId_key";
CREATE UNIQUE INDEX "UserAccessGrant_userId_sandboxId_partnerId_advertiserId_key"
  ON "UserAccessGrant" ("userId", "sandboxId", "partnerId", "advertiserId") NULLS NOT DISTINCT;

DROP INDEX "SimHourlyMetric_lineItemId_adGroupId_simHour_key";
CREATE UNIQUE INDEX "SimHourlyMetric_lineItemId_adGroupId_simHour_key"
  ON "SimHourlyMetric" ("lineItemId", "adGroupId", "simHour") NULLS NOT DISTINCT;

DROP INDEX "DeliveryDiagnostic_lineItemId_adGroupId_date_exchangeId_rea_key";
CREATE UNIQUE INDEX "DeliveryDiagnostic_lineItemId_adGroupId_date_exchangeId_rea_key"
  ON "DeliveryDiagnostic" ("lineItemId", "adGroupId", "date", "exchangeId", "reasonCode") NULLS NOT DISTINCT;

-- Exactly one owner column is set
ALTER TABLE "TargetingAssignment" ADD CONSTRAINT "TargetingAssignment_one_owner" CHECK (
  (("partnerId" IS NOT NULL)::int + ("advertiserId" IS NOT NULL)::int +
   ("templateId" IS NOT NULL)::int + ("lineItemId" IS NOT NULL)::int +
   ("adGroupId" IS NOT NULL)::int) = 1);
ALTER TABLE "PartnerCost" ADD CONSTRAINT "PartnerCost_one_owner" CHECK (
  (("ioId" IS NOT NULL)::int + ("lineItemId" IS NOT NULL)::int) = 1);

-- >>> prisma/sql/40-rls-apply.sql
-- P3-05a. GENERATED by `npm run db:gen-rls` from prisma/schema (every model with a "sandboxId" column).
-- A test regenerates this text and fails if it differs. Tables added later call app_enable_tenant_rls in their own migration.
SELECT app_enable_tenant_rls('Ad');
SELECT app_enable_tenant_rls('AdGroup');
SELECT app_enable_tenant_rls('Advertiser');
SELECT app_enable_tenant_rls('Alert');
SELECT app_enable_tenant_rls('Audience');
SELECT app_enable_tenant_rls('BudgetSegment');
SELECT app_enable_tenant_rls('Campaign');
SELECT app_enable_tenant_rls('CampaignBudget');
SELECT app_enable_tenant_rls('ChangeEntry');
SELECT app_enable_tenant_rls('ChangeGroup');
SELECT app_enable_tenant_rls('Creative');
SELECT app_enable_tenant_rls('CreativeAsset');
SELECT app_enable_tenant_rls('CreativeAssignment');
SELECT app_enable_tenant_rls('CreativeReview');
SELECT app_enable_tenant_rls('DeliveryDiagnostic');
SELECT app_enable_tenant_rls('InsertionOrder');
SELECT app_enable_tenant_rls('LineItem');
SELECT app_enable_tenant_rls('Partner');
SELECT app_enable_tenant_rls('PartnerCost');
SELECT app_enable_tenant_rls('PartnerExchange');
SELECT app_enable_tenant_rls('SimClock');
SELECT app_enable_tenant_rls('SimDailyMetric');
SELECT app_enable_tenant_rls('SimHourlyMetric');
SELECT app_enable_tenant_rls('TargetingAssignment');
SELECT app_enable_tenant_rls('TargetingTemplate');
SELECT app_enable_tenant_rls('UserAccessGrant');

-- >>> prisma/sql/50-grants-and-defaults.sql
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
