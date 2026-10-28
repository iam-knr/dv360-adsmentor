-- P3-05c. Remaining tables of data-model 5.1 to 5.19 and Appendix C. Additive only: new enums, new tables, new keys.
-- Generated DDL (prisma migrate diff from the 0001 schema), then prisma/sql files 70, 80 and 90 inlined in file order.

-- CreateEnum
CREATE TYPE "PartnerContactRole" AS ENUM ('PRIMARY', 'DATA_PROTECTION_OFFICER', 'EU_REPRESENTATIVE');

-- CreateEnum
CREATE TYPE "PartnerFeatureKey" AS ENUM ('ENHANCED_AUTOMATION', 'PRODUCT_IMPROVEMENT', 'GOOGLE_PARTNER_INVENTORY', 'YOUTUBE_GUARANTEED_INSTANT_DEALS', 'AUTO_TAGGING', 'ADVANCED_AD_SERVING', 'APP_MEDIATION_FEES', 'CREATIVE_RANDOM_DISAPPROVAL_RATE', 'REPORTING_MAX_ROWS');

-- CreateEnum
CREATE TYPE "FeatureScope" AS ENUM ('ALL_ADVERTISERS', 'SELECTED');

-- CreateEnum
CREATE TYPE "InvoiceLevel" AS ENUM ('ADVERTISER', 'INSERTION_ORDER', 'CAMPAIGN');

-- CreateEnum
CREATE TYPE "InvoiceStatus" AS ENUM ('OPEN', 'ISSUED', 'PAID');

-- CreateEnum
CREATE TYPE "LinkedAccountType" AS ENUM ('ADS_DATA_HUB', 'EXTERNAL_DATA_PARTNER', 'YOUTUBE_CHANNEL', 'YOUTUBE_CREATOR_VIDEOS', 'GOOGLE_ADS', 'BIGQUERY_EXPORTER', 'GOOGLE_ANALYTICS', 'CM360', 'MERCHANT_CENTER', 'GOOGLE_MY_BUSINESS');

-- CreateEnum
CREATE TYPE "LinkedAccountStatus" AS ENUM ('LINKED', 'PENDING', 'REMOVED');

-- CreateEnum
CREATE TYPE "PolicyCertificateKind" AS ENUM ('ADDICTION_SERVICES', 'CRYPTOCURRENCY', 'PHARMA_DRUG_SALES', 'SPECULATIVE_FINANCIAL', 'GAMBLING', 'ONLINE_PHARMACY', 'PHARMA_MANUFACTURER', 'PHARMA_NON_PRESCRIPTION', 'POLITICAL_EU', 'POLITICAL_INDIA', 'POLITICAL_US', 'NEW_YORK_REGISTRATION', 'CALIFORNIA_ELECTIONS', 'SOCIAL_CASINO');

-- CreateEnum
CREATE TYPE "CertificateStatus" AS ENUM ('NONE', 'REQUESTED', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "ThirdPartyVendorGroup" AS ENUM ('VIEWABILITY', 'BRAND_SAFETY', 'REACH', 'BRAND_LIFT', 'CONVERSION_ATTRIBUTION', 'YT_MEASUREMENT', 'BIDDING');

-- CreateEnum
CREATE TYPE "BrandSuitabilityMode" AS ENUM ('MAXIMUM', 'STANDARD', 'LIMITED');

-- CreateEnum
CREATE TYPE "CreativeUrlType" AS ENUM ('LANDING_PAGE', 'CLICK_TRACKER', 'IMPRESSION_TRACKER', 'DETECTED_DESTINATION');

-- CreateEnum
CREATE TYPE "AppealStatus" AS ENUM ('OPEN', 'ACCEPTED', 'REJECTED');

-- CreateEnum
CREATE TYPE "CreativeRestrictionKind" AS ENUM ('LEGAL_COUNTRY', 'POLICY', 'AGE_RATING');

-- CreateEnum
CREATE TYPE "UploadPurpose" AS ENUM ('CREATIVE_ASSET', 'ADVERTISER_LOGO', 'CUSTOMER_MATCH', 'SDF', 'OTHER');

-- CreateEnum
CREATE TYPE "UploadStatus" AS ENUM ('PENDING', 'READY', 'FAILED');

-- CreateEnum
CREATE TYPE "GoogleAudienceKind" AS ENUM ('AFFINITY', 'IN_MARKET', 'LIFE_EVENT', 'DETAILED_DEMOGRAPHIC');

-- CreateEnum
CREATE TYPE "ContactType" AS ENUM ('EMAIL', 'PHONE', 'MAIL_ADDRESS', 'MOBILE_DEVICE_ID');

-- CreateEnum
CREATE TYPE "AudienceTagOperator" AS ENUM ('EQUALS', 'NOT_EQUALS', 'CONTAINS', 'STARTS_WITH', 'GREATER_THAN', 'LESS_THAN');

-- CreateEnum
CREATE TYPE "CombinedAudienceMode" AS ENUM ('INCLUDE', 'EXCLUDE');

-- CreateEnum
CREATE TYPE "CombinedAudienceMemberKind" AS ENUM ('AUDIENCE', 'GOOGLE_AUDIENCE', 'CUSTOM_LIST');

-- CreateEnum
CREATE TYPE "CustomListEntryKind" AS ENUM ('INTEREST', 'URL', 'APP', 'KEYWORD');

-- CreateEnum
CREATE TYPE "CustomerMatchUploadStatus" AS ENUM ('PROCESSING', 'DONE', 'FAILED');

-- CreateEnum
CREATE TYPE "AudienceDataSource" AS ENUM ('CONNECTED', 'UPLOAD', 'LATER');

-- CreateEnum
CREATE TYPE "AppPlatform" AS ENUM ('ANDROID', 'IOS', 'CTV');

-- CreateEnum
CREATE TYPE "ChannelEntryKind" AS ENUM ('URL', 'ANDROID_APP', 'IOS_APP', 'CTV_APP');

-- CreateEnum
CREATE TYPE "LocationListType" AS ENUM ('REGIONAL', 'PROXIMITY');

-- CreateEnum
CREATE TYPE "YoutubeAssetKind" AS ENUM ('LOCATION', 'AFFILIATE_LOCATION', 'SITELINK');

-- CreateEnum
CREATE TYPE "DealType" AS ENUM ('PRIVATE_AUCTION', 'PREFERRED_DEAL', 'PROGRAMMATIC_GUARANTEED', 'INSTANT_DEAL');

-- CreateEnum
CREATE TYPE "DealCommitment" AS ENUM ('GUARANTEED', 'NON_GUARANTEED');

-- CreateEnum
CREATE TYPE "DealDeliveryMethod" AS ENUM ('PROGRAMMATIC', 'TAGGED');

-- CreateEnum
CREATE TYPE "DealRateType" AS ENUM ('FIXED', 'FLOOR');

-- CreateEnum
CREATE TYPE "DealSource" AS ENUM ('NEGOTIATED', 'INSTANT', 'MARKETPLACE');

-- CreateEnum
CREATE TYPE "NegotiationStatus" AS ENUM ('DRAFT', 'PROPOSED', 'COUNTERED', 'ACCEPTED', 'DECLINED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "NegotiationAwaiting" AS ENUM ('BUYER', 'SELLER', 'NONE');

-- CreateEnum
CREATE TYPE "NegotiationAuthorKind" AS ENUM ('BUYER', 'SELLER');

-- CreateEnum
CREATE TYPE "SellerKind" AS ENUM ('EXCHANGE', 'PUBLISHER');

-- CreateEnum
CREATE TYPE "MarketplaceProductType" AS ENUM ('CENTRAL_PARTNER_DEAL', 'DEAL', 'PACKAGE', 'PUBLISHER');

-- CreateEnum
CREATE TYPE "InventoryFormat" AS ENUM ('DISPLAY', 'VIDEO', 'AUDIO');

-- CreateEnum
CREATE TYPE "DealGroupKind" AS ENUM ('DEAL_GROUP', 'PREFERRED_DEAL_GROUP');

-- CreateEnum
CREATE TYPE "DealGroupMemberKind" AS ENUM ('DEAL', 'PACKAGE');

-- CreateEnum
CREATE TYPE "LineItemInventoryKind" AS ENUM ('DEAL', 'PACKAGE', 'GROUP');

-- CreateEnum
CREATE TYPE "InventoryMode" AS ENUM ('INCLUDE', 'EXCLUDE');

-- CreateEnum
CREATE TYPE "FloodlightPlatform" AS ENUM ('WEB', 'MOBILE_APP', 'CONNECTED_TV');

-- CreateEnum
CREATE TYPE "FloodlightFormat" AS ENUM ('GOOGLE_TAG', 'IFRAME_TAG', 'IMAGE_TAG');

-- CreateEnum
CREATE TYPE "FloodlightType" AS ENUM ('COUNTER', 'SALE');

-- CreateEnum
CREATE TYPE "CountingMethod" AS ENUM ('STANDARD', 'UNIQUE', 'PER_SESSION', 'TRANSACTIONS', 'ITEMS_SOLD');

-- CreateEnum
CREATE TYPE "FloodlightCategory" AS ENUM ('PURCHASE', 'ADD_TO_CART', 'BEGIN_CHECKOUT', 'SUBSCRIBE_PAID', 'CONTACT', 'SUBMIT_LEAD_FORM', 'BOOK_APPOINTMENT', 'SIGN_UP', 'REQUEST_QUOTE', 'GET_DIRECTIONS', 'OUTBOUND_CLICK', 'QUALIFIED_LEAD', 'CONVERTED_LEAD', 'PAGE_VIEW');

-- CreateEnum
CREATE TYPE "PersonalizedAdExclusion" AS ENUM ('DONT_EXCLUDE', 'EXCLUDE_ALL_LOCATIONS');

-- CreateEnum
CREATE TYPE "FloodlightVariableType" AS ENUM ('STRING', 'NUMBER');

-- CreateEnum
CREATE TYPE "AttributionModelKind" AS ENUM ('FLOODLIGHT_DEFAULT', 'LAST_CLICK', 'FIRST_CLICK', 'LINEAR', 'TIME_DECAY', 'POSITION_BASED', 'DATA_DRIVEN');

-- CreateEnum
CREATE TYPE "CustomBiddingSource" AS ENUM ('RULE_BASED', 'SCRIPT', 'GOAL');

-- CreateEnum
CREATE TYPE "CustomBiddingObjective" AS ENUM ('BRAND_AWARENESS', 'CLICKS', 'CONVERSIONS', 'CUSTOM');

-- CreateEnum
CREATE TYPE "CustomBiddingStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'TRAINING');

-- CreateEnum
CREATE TYPE "CustomBiddingReadiness" AS ENUM ('NOT_READY', 'TRAINING', 'READY');

-- CreateEnum
CREATE TYPE "CustomBiddingMultiplierKind" AS ENUM ('AD_POSITION', 'CREATIVE_DIMENSION', 'DAY_AND_TIME', 'DEVICE_TYPE', 'GENRE', 'DELIVERY_TYPE', 'DURATION');

-- CreateEnum
CREATE TYPE "CustomBiddingMatchMode" AS ENUM ('ANY', 'ALL');

-- CreateEnum
CREATE TYPE "CustomBiddingScriptState" AS ENUM ('ACCEPTED', 'REJECTED', 'PENDING');

-- CreateEnum
CREATE TYPE "OwnerScope" AS ENUM ('PARTNER', 'ADVERTISER');

-- CreateEnum
CREATE TYPE "ReportKind" AS ENUM ('INSTANT', 'OFFLINE_FLOODLIGHT', 'OFFLINE_INVENTORY_AVAILABILITY');

-- CreateEnum
CREATE TYPE "ReportVisualization" AS ENUM ('TABLE', 'PIVOT_TABLE', 'COLUMN', 'TIME_SERIES', 'PIE', 'SCATTER');

-- CreateEnum
CREATE TYPE "ReportTimeZone" AS ENUM ('ADVERTISER', 'UTC');

-- CreateEnum
CREATE TYPE "ReportFormat" AS ENUM ('CSV', 'XLSX');

-- CreateEnum
CREATE TYPE "ReportRepeat" AS ENUM ('DAILY', 'WEEKLY', 'MONTHLY', 'QUARTERLY', 'YEARLY');

-- CreateEnum
CREATE TYPE "ReportRunStatus" AS ENUM ('QUEUED', 'RUNNING', 'DONE', 'FAILED');

-- CreateEnum
CREATE TYPE "ReportFieldKind" AS ENUM ('DIMENSION', 'METRIC');

-- CreateEnum
CREATE TYPE "ReportFieldStatus" AS ENUM ('LIVE', 'ZERO', 'NA');

-- CreateEnum
CREATE TYPE "ReportFieldSensitivity" AS ENUM ('NONE', 'PARTNER_COST');

-- CreateEnum
CREATE TYPE "CrossMediaCountry" AS ENUM ('ARGENTINA', 'AUSTRALIA', 'BRAZIL', 'CANADA', 'CHILE', 'COLOMBIA', 'FRANCE', 'GERMANY', 'JAPAN', 'MEXICO', 'UNITED_KINGDOM', 'UNITED_STATES', 'VIETNAM');

-- CreateEnum
CREATE TYPE "CrossMediaScope" AS ENUM ('NATIONAL', 'SUB_LOCATION');

-- CreateEnum
CREATE TYPE "CrossMediaStatus" AS ENUM ('PROCESSING', 'DONE', 'FAILED');

-- CreateEnum
CREATE TYPE "SavedViewGrid" AS ENUM ('CAMPAIGN', 'IO', 'LI', 'AD_GROUP', 'DEAL', 'PLAN');

-- CreateEnum
CREATE TYPE "ChartCardScope" AS ENUM ('CAMPAIGN', 'IO', 'LI');

-- CreateEnum
CREATE TYPE "ChartCardKind" AS ENUM ('BAR', 'LINE', 'PIE', 'BUBBLE', 'BUILT_IN_IMPRESSIONS_LOST');

-- CreateEnum
CREATE TYPE "InboxMessageKind" AS ENUM ('REPORT_READY', 'REPORT_FAILED', 'SYSTEM');

-- CreateEnum
CREATE TYPE "PlanStatus" AS ENUM ('PLANNED', 'TRAFFICKED');

-- CreateEnum
CREATE TYPE "PlanBuyingMethod" AS ENUM ('OPEN_AUCTION', 'PROGRAMMATIC_GUARANTEED', 'PREFERRED_DEAL', 'PRIVATE_AUCTION', 'YOUTUBE_RESERVE');

-- CreateEnum
CREATE TYPE "PlanChannel" AS ENUM ('DIGITAL', 'TV', 'CROSS_MEDIA');

-- CreateEnum
CREATE TYPE "PlanReachBasis" AS ENUM ('CENSUS', 'DIGITAL');

-- CreateEnum
CREATE TYPE "ExperimentTarget" AS ENUM ('INSERTION_ORDER', 'LINE_ITEM');

-- CreateEnum
CREATE TYPE "ExperimentGoal" AS ENUM ('CLICKS', 'CONVERSIONS', 'REACH', 'CUSTOM_IMPRESSION_VALUE', 'VIDEO_COMPLETIONS', 'VIEWS_YOUTUBE');

-- CreateEnum
CREATE TYPE "ExperimentStatus" AS ENUM ('SCHEDULED', 'ACTIVE', 'COMPLETED');

-- CreateEnum
CREATE TYPE "ExperimentChannelScope" AS ENUM ('CROSS_EXCHANGE', 'YOUTUBE', 'DEMAND_GEN', 'MIXED');

-- CreateEnum
CREATE TYPE "ConfidenceLevel" AS ENUM ('P90', 'P95');

-- CreateEnum
CREATE TYPE "LiftType" AS ENUM ('BRAND_LIFT', 'SEARCH_LIFT');

-- CreateEnum
CREATE TYPE "BrandLiftMetric" AS ENUM ('VIDEO_AD_RECALL', 'AWARENESS', 'CONSIDERATION', 'FAVORABILITY', 'PURCHASE_INTENT', 'ASSOCIATION');

-- CreateEnum
CREATE TYPE "LiftStrength" AS ENUM ('STANDARD', 'ENHANCED');

-- CreateEnum
CREATE TYPE "IntendedAction" AS ENUM ('BUY', 'CHOOSE', 'USE');

-- CreateEnum
CREATE TYPE "LiftStatus" AS ENUM ('ELIGIBLE', 'NOT_ELIGIBLE', 'IN_PROGRESS', 'COMPLETE', 'PAUSED', 'ENDED');

-- CreateEnum
CREATE TYPE "LiftSlice" AS ENUM ('OVERALL', 'AGE', 'GENDER', 'INSERTION_ORDER', 'LINE_ITEM', 'DEVICE', 'YOUTUBE_AD_VIDEO', 'CREATIVE', 'PUBLISHER_DOMAIN', 'PUBLISHER_VERTICAL');

-- CreateEnum
CREATE TYPE "LiftMeasure" AS ENUM ('ABSOLUTE', 'RELATIVE', 'HEADROOM');

-- CreateEnum
CREATE TYPE "LiftResultScope" AS ENUM ('YOUTUBE_DEMAND_GEN', 'CROSS_EXCHANGE');

-- CreateEnum
CREATE TYPE "BulkSource" AS ENUM ('DUPLICATION', 'BULK_EDIT', 'CAMPAIGN_DOWNLOAD', 'SDF_DOWNLOAD', 'SDF_UPLOAD', 'CREATIVE_BULK_ADD');

-- CreateEnum
CREATE TYPE "BulkAction" AS ENUM ('ACTIVATE', 'PAUSE', 'ARCHIVE', 'UNARCHIVE', 'DUPLICATE', 'APPLY_TARGETING_TEMPLATE', 'EDIT_SETTINGS', 'EDIT_CREATIVE_ASSIGNMENT', 'DOWNLOAD_SDF', 'DOWNLOAD_QA', 'DOWNLOAD_METADATA', 'UPLOAD_SDF', 'UPLOAD_CREATIVES');

-- CreateEnum
CREATE TYPE "BulkJobStatus" AS ENUM ('QUEUED', 'RUNNING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "BulkResultKind" AS ENUM ('ENTITY_LIST', 'FILE');

-- CreateEnum
CREATE TYPE "BulkItemStatus" AS ENUM ('OK', 'FAILED');

-- CreateEnum
CREATE TYPE "SdfEntityFile" AS ENUM ('CAMPAIGNS', 'MEDIA_PRODUCTS', 'INSERTION_ORDERS', 'LINE_ITEMS', 'AD_GROUPS', 'ADS');

-- CreateEnum
CREATE TYPE "ScenarioStatus" AS ENUM ('NOT_STARTED', 'IN_PROGRESS', 'PASSED', 'FAILED', 'ABANDONED');

-- CreateEnum
CREATE TYPE "ScenarioCheckKind" AS ENUM ('ENTITY_EXISTS', 'FIELD_EQUALS', 'FIELD_RANGE', 'METRIC_THRESHOLD', 'ALERT_CLEARED', 'STATUS_IS', 'ENTITY_STATE', 'METRIC', 'DIAGNOSTIC', 'ALERT_ABSENT', 'LEARNING', 'PACING', 'CUSTOM_FN');

-- CreateEnum
CREATE TYPE "ScenarioStepKind" AS ENUM ('TASK', 'QUESTION', 'INFO');

-- CreateEnum
CREATE TYPE "ScenarioLatch" AS ENUM ('STICKY', 'LIVE');

-- CreateEnum
CREATE TYPE "ScenarioPatchOp" AS ENUM ('CREATE', 'UPDATE', 'DELETE', 'SET_STATUS', 'SET_METRIC_BIAS');

-- CreateEnum
CREATE TYPE "NotificationKind" AS ENUM ('ANNOUNCEMENT');

-- CreateEnum
CREATE TYPE "NotificationSeverity" AS ENUM ('INFO', 'WARNING');

-- CreateEnum
CREATE TYPE "NotificationAudience" AS ENUM ('ALL', 'STUDENT', 'INSTRUCTOR');

-- CreateEnum
CREATE TYPE "HelpArticleKind" AS ENUM ('ARTICLE', 'VIDEO', 'TUTORIAL');

-- CreateEnum
CREATE TYPE "AdvisorRole" AS ENUM ('USER', 'TUTOR');

-- CreateEnum
CREATE TYPE "AdvisorVote" AS ENUM ('UP', 'DOWN');

-- CreateEnum
CREATE TYPE "RecommendationType" AS ENUM ('ENABLE_AUTOMATED_BID_BUDGET_IO', 'ENABLE_AUTOMATED_BIDDING_LI', 'ENABLE_AUTO_BUDGET_ALLOCATION', 'USE_OPTIMIZED_TARGETING', 'ADD_CREATIVES', 'RAISE_BID', 'BROADEN_TARGETING', 'BID_LEARNING');

-- CreateEnum
CREATE TYPE "RecommendationStatus" AS ENUM ('OPEN', 'DISMISSED', 'APPLIED');

-- CreateEnum
CREATE TYPE "SimScopeType" AS ENUM ('LINE_ITEM', 'IO', 'CAMPAIGN', 'ADVERTISER');

-- CreateEnum
CREATE TYPE "SimConversionType" AS ENUM ('POST_CLICK', 'POST_VIEW');

-- CreateEnum
CREATE TYPE "SimTickStatus" AS ENUM ('OK', 'FAILED', 'SKIPPED');

-- CreateTable
CREATE TABLE "SeedTemplate" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "sizeKnobs" JSONB NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SeedTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Role" (
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Role_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "Permission" (
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Permission_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "RolePermission" (
    "roleKey" TEXT NOT NULL,
    "permissionKey" TEXT NOT NULL,

    CONSTRAINT "RolePermission_pkey" PRIMARY KEY ("roleKey","permissionKey")
);

-- CreateTable
CREATE TABLE "Scenario" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "difficulty" INTEGER NOT NULL DEFAULT 1,
    "estimatedMinutes" INTEGER NOT NULL DEFAULT 15,
    "seedTemplateKey" TEXT NOT NULL DEFAULT 'blank',
    "version" INTEGER NOT NULL DEFAULT 1,
    "classroomId" TEXT,
    "isPublished" BOOLEAN NOT NULL DEFAULT false,
    "setup" JSONB,
    "completion" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Scenario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScenarioStep" (
    "id" TEXT NOT NULL,
    "scenarioId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "ordinal" INTEGER NOT NULL,
    "kind" "ScenarioStepKind" NOT NULL DEFAULT 'TASK',
    "instruction" TEXT NOT NULL,
    "hint" TEXT,
    "hintPenalty" INTEGER NOT NULL DEFAULT 0,
    "required" BOOLEAN NOT NULL DEFAULT true,
    "latch" "ScenarioLatch" NOT NULL DEFAULT 'STICKY',
    "unlockAfterStepKey" TEXT,
    "options" JSONB,
    "checkKind" "ScenarioCheckKind" NOT NULL DEFAULT 'ENTITY_EXISTS',
    "checkSpec" JSONB NOT NULL,
    "points" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "ScenarioStep_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScenarioSeedPatch" (
    "id" TEXT NOT NULL,
    "scenarioId" TEXT NOT NULL,
    "ordinal" INTEGER NOT NULL,
    "op" "ScenarioPatchOp" NOT NULL,
    "entityType" "EntityType" NOT NULL,
    "selector" JSONB NOT NULL,
    "payload" JSONB,

    CONSTRAINT "ScenarioSeedPatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScenarioEvent" (
    "id" TEXT NOT NULL,
    "scenarioId" TEXT NOT NULL,
    "afterTick" INTEGER NOT NULL,
    "faultSpec" JSONB NOT NULL,
    "revertAfterHours" INTEGER,

    CONSTRAINT "ScenarioEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScenarioAssignment" (
    "id" TEXT NOT NULL,
    "classroomId" TEXT NOT NULL,
    "scenarioId" TEXT NOT NULL,
    "opensAt" TIMESTAMP(3),
    "dueAt" TIMESTAMP(3),
    "maxAttempts" INTEGER NOT NULL DEFAULT 3,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ScenarioAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScenarioAttempt" (
    "id" TEXT NOT NULL,
    "sandboxId" TEXT NOT NULL,
    "scenarioId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "classroomId" TEXT NOT NULL,
    "status" "ScenarioStatus" NOT NULL DEFAULT 'NOT_STARTED',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "score" INTEGER,
    "maxScore" INTEGER NOT NULL DEFAULT 0,
    "bindings" JSONB,
    "hintsUsed" JSONB,
    "startedFromSnapshotId" TEXT,
    "lastCheckedAt" TIMESTAMP(3),
    "scoreBreakdown" JSONB,

    CONSTRAINT "ScenarioAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScenarioCheckResult" (
    "id" TEXT NOT NULL,
    "sandboxId" TEXT NOT NULL,
    "attemptId" TEXT NOT NULL,
    "stepId" TEXT NOT NULL,
    "passed" BOOLEAN NOT NULL DEFAULT false,
    "passedNow" BOOLEAN NOT NULL DEFAULT false,
    "firstPassedAt" TIMESTAMP(3),
    "evaluatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "evidence" JSONB,
    "points" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ScenarioCheckResult_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InstructorNote" (
    "id" TEXT NOT NULL,
    "classroomId" TEXT NOT NULL,
    "studentUserId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InstructorNote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SandboxSnapshot" (
    "id" TEXT NOT NULL,
    "classroomId" TEXT NOT NULL,
    "sourceSandboxId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SandboxSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "classroomId" TEXT,
    "kind" "NotificationKind" NOT NULL DEFAULT 'ANNOUNCEMENT',
    "severity" "NotificationSeverity" NOT NULL DEFAULT 'INFO',
    "audienceRole" "NotificationAudience" NOT NULL DEFAULT 'ALL',
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "learnMoreRoute" TEXT,
    "pinned" BOOLEAN NOT NULL DEFAULT false,
    "publishedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),
    "createdById" TEXT NOT NULL,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotificationDismissal" (
    "id" TEXT NOT NULL,
    "notificationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "dismissedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NotificationDismissal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HelpArticle" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "kind" "HelpArticleKind" NOT NULL DEFAULT 'ARTICLE',
    "bodyMd" TEXT NOT NULL,
    "routePatterns" TEXT[],
    "rank" INTEGER NOT NULL DEFAULT 0,
    "durationMin" INTEGER,

    CONSTRAINT "HelpArticle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "YoutubeVideo" (
    "id" TEXT NOT NULL,
    "videoId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "channelName" TEXT NOT NULL,
    "durationSec" INTEGER NOT NULL,
    "orientation" TEXT NOT NULL,
    "thumbnailUrl" TEXT,
    "category" TEXT,
    "isPublic" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "YoutubeVideo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AppCatalog" (
    "id" TEXT NOT NULL,
    "platform" "AppPlatform" NOT NULL,
    "appId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT,

    CONSTRAINT "AppCatalog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ThirdPartyVendor" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "group" "ThirdPartyVendorGroup" NOT NULL,
    "onByDefault" BOOLEAN NOT NULL DEFAULT false,
    "feePct" DECIMAL(6,3),
    "termsText" TEXT,

    CONSTRAINT "ThirdPartyVendor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GoogleAudience" (
    "id" TEXT NOT NULL,
    "kind" "GoogleAudienceKind" NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "parentId" TEXT,
    "sizeDisplay" BIGINT,
    "sizeYoutube" BIGINT,
    "sizeMobileApp" BIGINT,
    "sizeCtv" BIGINT,
    "eligibleDisplay" BOOLEAN NOT NULL DEFAULT true,
    "eligibleYoutube" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "GoogleAudience_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarketplaceProduct" (
    "id" TEXT NOT NULL,
    "type" "MarketplaceProductType" NOT NULL,
    "exchangeId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "sellerKind" "SellerKind",
    "isInstantSeller" BOOLEAN NOT NULL DEFAULT false,
    "instantTargetingOptions" JSONB,
    "sevenDayImpressions" BIGINT NOT NULL DEFAULT 0,
    "floorPrice" DECIMAL(14,4),
    "floorCurrency" TEXT NOT NULL DEFAULT 'USD',
    "startAt" TIMESTAMP(3),
    "endAt" TIMESTAMP(3),
    "featuredCarousel" TEXT,
    "featuredCarouselOrder" INTEGER,
    "bannerKey" TEXT,
    "categories" TEXT[],
    "googleAudienceCount" INTEGER NOT NULL DEFAULT 0,
    "scale" JSONB,
    "searchText" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "MarketplaceProduct_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReportField" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "kind" "ReportFieldKind" NOT NULL,
    "dataType" TEXT NOT NULL,
    "currency" TEXT,
    "sourceKind" TEXT,
    "sourceSpec" JSONB,
    "expression" TEXT,
    "status" "ReportFieldStatus" NOT NULL DEFAULT 'LIVE',
    "downloadOnly" BOOLEAN NOT NULL DEFAULT false,
    "frequentlyUsed" BOOLEAN NOT NULL DEFAULT false,
    "offlineTypes" "ReportKind"[],
    "sensitivity" "ReportFieldSensitivity" NOT NULL DEFAULT 'NONE',
    "compatGroups" TEXT[],
    "ordinal" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ReportField_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReportTemplate" (
    "id" TEXT NOT NULL,
    "family" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "definition" JSONB NOT NULL,
    "ordinal" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ReportTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FxRate" (
    "id" TEXT NOT NULL,
    "fromCurrency" TEXT NOT NULL,
    "toCurrency" TEXT NOT NULL,
    "rate" DECIMAL(18,8) NOT NULL,
    "validFrom" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FxRate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlanCountry" (
    "id" TEXT NOT NULL,
    "countryCode" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "currencyCode" TEXT NOT NULL,
    "censusPopulation" BIGINT NOT NULL,
    "digitalPopulation" BIGINT NOT NULL,
    "tvPopulation" BIGINT NOT NULL,
    "youtubePopulation" BIGINT NOT NULL,
    "demoShares" JSONB NOT NULL,
    "engineMarket" TEXT,

    CONSTRAINT "PlanCountry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SubLocation" (
    "id" TEXT NOT NULL,
    "countryCode" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "populationShare" DECIMAL(8,6) NOT NULL,

    CONSTRAINT "SubLocation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TvCampaign" (
    "id" TEXT NOT NULL,
    "countryCode" TEXT NOT NULL,
    "company" TEXT NOT NULL,
    "brand" TEXT NOT NULL,
    "campaign" TEXT NOT NULL,
    "startDate" DATE NOT NULL,
    "endDate" DATE NOT NULL,
    "spend" DECIMAL(16,2) NOT NULL,
    "grps" DECIMAL(10,2) NOT NULL,
    "reachPct" DECIMAL(6,3) NOT NULL,
    "avgFrequency" DECIMAL(6,2) NOT NULL,
    "impressions" BIGINT NOT NULL,
    "subLocationReach" JSONB,
    "availableFrom" DATE,
    "availableTo" DATE,
    "nextUpdate" TIMESTAMP(3),

    CONSTRAINT "TvCampaign_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PartnerContact" (
    "id" TEXT NOT NULL,
    "sandboxId" TEXT NOT NULL,
    "partnerId" TEXT NOT NULL,
    "role" "PartnerContactRole" NOT NULL,
    "name" TEXT,
    "email" TEXT,
    "address" TEXT,
    "phone" TEXT,
    "isContactPerson" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "PartnerContact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PartnerFeatureFlag" (
    "id" TEXT NOT NULL,
    "sandboxId" TEXT NOT NULL,
    "partnerId" TEXT NOT NULL,
    "key" "PartnerFeatureKey" NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "scope" "FeatureScope" NOT NULL DEFAULT 'ALL_ADVERTISERS',
    "numericValue" INTEGER,
    "termsVersion" INTEGER NOT NULL DEFAULT 1,
    "termsAcceptedAt" TIMESTAMP(3),
    "termsAcceptedById" TEXT,

    CONSTRAINT "PartnerFeatureFlag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PartnerFeatureAdvertiser" (
    "id" TEXT NOT NULL,
    "sandboxId" TEXT NOT NULL,
    "flagId" TEXT NOT NULL,
    "advertiserId" TEXT NOT NULL,

    CONSTRAINT "PartnerFeatureAdvertiser_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BillingProfile" (
    "id" TEXT NOT NULL,
    "sandboxId" TEXT NOT NULL,
    "partnerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "currencyCode" TEXT NOT NULL,
    "invoiceLevel" "InvoiceLevel" NOT NULL DEFAULT 'ADVERTISER',
    "purchaseOrder" TEXT,
    "billToName" TEXT NOT NULL,
    "billToAddress" TEXT,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "status" "EntityStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BillingProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Invoice" (
    "id" TEXT NOT NULL,
    "sandboxId" TEXT NOT NULL,
    "billingProfileId" TEXT NOT NULL,
    "invoiceNumber" TEXT NOT NULL,
    "periodMonth" DATE NOT NULL,
    "status" "InvoiceStatus" NOT NULL DEFAULT 'OPEN',
    "subtotal" DECIMAL(16,2) NOT NULL DEFAULT 0,
    "tax" DECIMAL(16,2) NOT NULL DEFAULT 0,
    "total" DECIMAL(16,2) NOT NULL DEFAULT 0,
    "currencyCode" TEXT NOT NULL,
    "issuedAt" TIMESTAMP(3),

    CONSTRAINT "Invoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InvoiceLine" (
    "id" TEXT NOT NULL,
    "sandboxId" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "advertiserId" TEXT NOT NULL,
    "ioId" TEXT,
    "description" TEXT NOT NULL,
    "mediaCost" DECIMAL(16,2) NOT NULL DEFAULT 0,
    "feeCost" DECIMAL(16,2) NOT NULL DEFAULT 0,
    "amount" DECIMAL(16,2) NOT NULL DEFAULT 0,

    CONSTRAINT "InvoiceLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ThirdPartyRateCard" (
    "id" TEXT NOT NULL,
    "sandboxId" TEXT NOT NULL,
    "partnerId" TEXT,
    "advertiserId" TEXT,
    "vendorKey" TEXT NOT NULL,
    "vendorName" TEXT NOT NULL,
    "rateMediaFeePct" DECIMAL(6,3) NOT NULL,
    "termsAcceptedAt" TIMESTAMP(3),

    CONSTRAINT "ThirdPartyRateCard_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdvertiserAlertPreference" (
    "id" TEXT NOT NULL,
    "sandboxId" TEXT NOT NULL,
    "advertiserId" TEXT NOT NULL,
    "alertType" "AlertType" NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "thresholdPct" INTEGER,
    "thresholdAmount" DECIMAL(16,2),

    CONSTRAINT "AdvertiserAlertPreference_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LinkedAccount" (
    "id" TEXT NOT NULL,
    "sandboxId" TEXT NOT NULL,
    "advertiserId" TEXT NOT NULL,
    "type" "LinkedAccountType" NOT NULL,
    "externalId" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "status" "LinkedAccountStatus" NOT NULL DEFAULT 'LINKED',
    "linkedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LinkedAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PolicyCertificate" (
    "id" TEXT NOT NULL,
    "sandboxId" TEXT NOT NULL,
    "advertiserId" TEXT NOT NULL,
    "kind" "PolicyCertificateKind" NOT NULL,
    "countryCode" TEXT NOT NULL DEFAULT '',
    "status" "CertificateStatus" NOT NULL DEFAULT 'NONE',
    "details" JSONB,
    "notes" TEXT,
    "rejectionReason" TEXT,
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decidedAt" TIMESTAMP(3),
    "decidedById" TEXT,

    CONSTRAINT "PolicyCertificate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdvertiserVendorSelection" (
    "id" TEXT NOT NULL,
    "sandboxId" TEXT NOT NULL,
    "advertiserId" TEXT NOT NULL,
    "vendorKey" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "affirmedAt" TIMESTAMP(3),

    CONSTRAINT "AdvertiserVendorSelection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "YoutubeAsset" (
    "id" TEXT NOT NULL,
    "sandboxId" TEXT NOT NULL,
    "advertiserId" TEXT NOT NULL,
    "kind" "YoutubeAssetKind" NOT NULL,
    "name" TEXT NOT NULL,
    "filters" JSONB,
    "status" "EntityStatus" NOT NULL DEFAULT 'ACTIVE',
    "parentId" TEXT,

    CONSTRAINT "YoutubeAsset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HistoryNote" (
    "id" TEXT NOT NULL,
    "sandboxId" TEXT NOT NULL,
    "advertiserId" TEXT NOT NULL,
    "entityType" "EntityType" NOT NULL,
    "entityId" TEXT NOT NULL,
    "noteDate" DATE NOT NULL,
    "authorId" TEXT NOT NULL,
    "authorLabel" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HistoryNote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Recommendation" (
    "id" TEXT NOT NULL,
    "sandboxId" TEXT NOT NULL,
    "advertiserId" TEXT NOT NULL,
    "scopeType" "SimScopeType" NOT NULL,
    "scopeId" TEXT NOT NULL,
    "type" "RecommendationType" NOT NULL,
    "title" TEXT NOT NULL,
    "detail" TEXT,
    "status" "RecommendationStatus" NOT NULL DEFAULT 'OPEN',
    "payload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Recommendation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Upload" (
    "id" TEXT NOT NULL,
    "sandboxId" TEXT NOT NULL,
    "purpose" "UploadPurpose" NOT NULL,
    "fileName" TEXT NOT NULL,
    "sizeBytes" BIGINT NOT NULL DEFAULT 0,
    "contentType" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "status" "UploadStatus" NOT NULL DEFAULT 'PENDING',
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Upload_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Workspace" (
    "id" TEXT NOT NULL,
    "sandboxId" TEXT NOT NULL,
    "partnerId" TEXT NOT NULL,
    "ownerUserId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "layout" JSONB NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Workspace_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkspaceShare" (
    "id" TEXT NOT NULL,
    "sandboxId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "canEdit" BOOLEAN NOT NULL DEFAULT false,
    "sharedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkspaceShare_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PinnedItem" (
    "id" TEXT NOT NULL,
    "sandboxId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "partnerId" TEXT NOT NULL,
    "entityType" "EntityType" NOT NULL,
    "entityId" TEXT NOT NULL,
    "pinnedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PinnedItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecentlyViewed" (
    "id" TEXT NOT NULL,
    "sandboxId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "partnerId" TEXT NOT NULL,
    "entityType" "EntityType" NOT NULL,
    "entityId" TEXT NOT NULL,
    "viewedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RecentlyViewed_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserPreference" (
    "id" TEXT NOT NULL,
    "sandboxId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserPreference_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserEmailPreference" (
    "id" TEXT NOT NULL,
    "sandboxId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "alerts" BOOLEAN NOT NULL DEFAULT true,
    "news" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserEmailPreference_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdvisorSession" (
    "id" TEXT NOT NULL,
    "sandboxId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastMessageAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdvisorSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdvisorMessage" (
    "id" TEXT NOT NULL,
    "sandboxId" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "role" "AdvisorRole" NOT NULL,
    "text" TEXT NOT NULL,
    "vote" "AdvisorVote",
    "contextRoute" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdvisorMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InboxMessage" (
    "id" TEXT NOT NULL,
    "sandboxId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kind" "InboxMessageKind" NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "reportRunId" TEXT,
    "createdAtSim" TIMESTAMP(3) NOT NULL,
    "readAt" TIMESTAMP(3),

    CONSTRAINT "InboxMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SavedView" (
    "id" TEXT NOT NULL,
    "sandboxId" TEXT NOT NULL,
    "advertiserId" TEXT NOT NULL,
    "ownerUserId" TEXT NOT NULL,
    "grid" "SavedViewGrid" NOT NULL,
    "name" TEXT NOT NULL,
    "columns" JSONB NOT NULL,
    "isPinned" BOOLEAN NOT NULL DEFAULT false,
    "sharedWithSandbox" BOOLEAN NOT NULL DEFAULT false,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SavedView_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChartCard" (
    "id" TEXT NOT NULL,
    "sandboxId" TEXT NOT NULL,
    "advertiserId" TEXT NOT NULL,
    "ownerUserId" TEXT NOT NULL,
    "scope" "ChartCardScope" NOT NULL,
    "scopeId" TEXT NOT NULL,
    "kind" "ChartCardKind" NOT NULL,
    "viewKey" TEXT,
    "definition" JSONB NOT NULL,
    "ordinal" INTEGER NOT NULL DEFAULT 0,
    "sharedWithSandbox" BOOLEAN NOT NULL DEFAULT false,
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "ChartCard_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AudienceTagRule" (
    "id" TEXT NOT NULL,
    "sandboxId" TEXT NOT NULL,
    "audienceId" TEXT NOT NULL,
    "activityId" TEXT NOT NULL,
    "variableKey" TEXT,
    "operator" "AudienceTagOperator" NOT NULL DEFAULT 'EQUALS',
    "value" TEXT NOT NULL,
    "ordinal" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "AudienceTagRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AudienceSeed" (
    "id" TEXT NOT NULL,
    "sandboxId" TEXT NOT NULL,
    "audienceId" TEXT NOT NULL,
    "seedAudienceId" TEXT NOT NULL,

    CONSTRAINT "AudienceSeed_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CombinedAudienceTerm" (
    "id" TEXT NOT NULL,
    "sandboxId" TEXT NOT NULL,
    "audienceId" TEXT NOT NULL,
    "mode" "CombinedAudienceMode" NOT NULL,
    "groupIndex" INTEGER NOT NULL DEFAULT 0,
    "memberKind" "CombinedAudienceMemberKind" NOT NULL,
    "memberId" TEXT NOT NULL,

    CONSTRAINT "CombinedAudienceTerm_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustomListEntry" (
    "id" TEXT NOT NULL,
    "sandboxId" TEXT NOT NULL,
    "audienceId" TEXT NOT NULL,
    "kind" "CustomListEntryKind" NOT NULL,
    "value" TEXT NOT NULL,
    "appId" TEXT,
    "ordinal" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "CustomListEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustomerMatchUpload" (
    "id" TEXT NOT NULL,
    "sandboxId" TEXT NOT NULL,
    "audienceId" TEXT NOT NULL,
    "contactType" "ContactType" NOT NULL,
    "fileName" TEXT NOT NULL,
    "rowCount" INTEGER NOT NULL DEFAULT 0,
    "matchedCount" INTEGER NOT NULL DEFAULT 0,
    "matchRatePct" DECIMAL(5,2),
    "status" "CustomerMatchUploadStatus" NOT NULL DEFAULT 'PROCESSING',
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CustomerMatchUpload_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CreativeRestriction" (
    "id" TEXT NOT NULL,
    "sandboxId" TEXT NOT NULL,
    "creativeId" TEXT NOT NULL,
    "kind" "CreativeRestrictionKind" NOT NULL,
    "countryCode" TEXT,
    "message" TEXT NOT NULL,
    "blocksGeoTargeting" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "CreativeRestriction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CreativeUrl" (
    "id" TEXT NOT NULL,
    "sandboxId" TEXT NOT NULL,
    "creativeId" TEXT NOT NULL,
    "type" "CreativeUrlType" NOT NULL,
    "url" TEXT NOT NULL,
    "ordinal" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "CreativeUrl_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CreativeAppeal" (
    "id" TEXT NOT NULL,
    "sandboxId" TEXT NOT NULL,
    "creativeId" TEXT,
    "adId" TEXT,
    "exchangeId" TEXT,
    "reviewId" TEXT,
    "campaignImpact" TEXT,
    "appealType" TEXT NOT NULL,
    "inventory" TEXT,
    "policy" TEXT,
    "reasonText" TEXT,
    "status" "AppealStatus" NOT NULL DEFAULT 'OPEN',
    "initiatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decideAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "result" TEXT,

    CONSTRAINT "CreativeAppeal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdSequenceStep" (
    "id" TEXT NOT NULL,
    "sandboxId" TEXT NOT NULL,
    "adGroupId" TEXT NOT NULL,
    "ordinal" INTEGER NOT NULL,
    "adId" TEXT NOT NULL,
    "condition" TEXT,

    CONSTRAINT "AdSequenceStep_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LineItemFloodlightActivity" (
    "id" TEXT NOT NULL,
    "sandboxId" TEXT NOT NULL,
    "lineItemId" TEXT NOT NULL,
    "activityId" TEXT NOT NULL,

    CONSTRAINT "LineItemFloodlightActivity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Channel" (
    "id" TEXT NOT NULL,
    "sandboxId" TEXT NOT NULL,
    "publicId" BIGINT NOT NULL DEFAULT next_public_id(),
    "partnerId" TEXT,
    "advertiserId" TEXT,
    "name" TEXT NOT NULL,
    "status" "EntityStatus" NOT NULL DEFAULT 'ACTIVE',
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Channel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChannelEntry" (
    "id" TEXT NOT NULL,
    "sandboxId" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "kind" "ChannelEntryKind" NOT NULL,
    "value" TEXT NOT NULL,
    "displayName" TEXT,

    CONSTRAINT "ChannelEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KeywordList" (
    "id" TEXT NOT NULL,
    "sandboxId" TEXT NOT NULL,
    "publicId" BIGINT NOT NULL DEFAULT next_public_id(),
    "advertiserId" TEXT NOT NULL,
    "partnerId" TEXT,
    "name" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KeywordList_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KeywordListEntry" (
    "id" TEXT NOT NULL,
    "sandboxId" TEXT NOT NULL,
    "keywordListId" TEXT NOT NULL,
    "keyword" TEXT NOT NULL,

    CONSTRAINT "KeywordListEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LocationList" (
    "id" TEXT NOT NULL,
    "sandboxId" TEXT NOT NULL,
    "publicId" BIGINT NOT NULL DEFAULT next_public_id(),
    "advertiserId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "LocationListType" NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LocationList_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LocationListEntry" (
    "id" TEXT NOT NULL,
    "sandboxId" TEXT NOT NULL,
    "locationListId" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "resolvedOptionId" TEXT,
    "resolvedLabel" TEXT,
    "lat" DECIMAL(9,6),
    "lng" DECIMAL(9,6),
    "radiusKm" DECIMAL(8,2) DEFAULT 5,

    CONSTRAINT "LocationListEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InventoryOrder" (
    "id" TEXT NOT NULL,
    "sandboxId" TEXT NOT NULL,
    "publicId" BIGINT NOT NULL DEFAULT next_public_id(),
    "partnerId" TEXT NOT NULL,
    "exchangeId" TEXT NOT NULL,
    "sellerName" TEXT NOT NULL,
    "externalCode" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" "EntityStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InventoryOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InventorySourceDeal" (
    "id" TEXT NOT NULL,
    "sandboxId" TEXT NOT NULL,
    "publicId" BIGINT NOT NULL DEFAULT next_public_id(),
    "partnerId" TEXT NOT NULL,
    "orderId" TEXT,
    "exchangeId" TEXT NOT NULL,
    "dealId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "status" "EntityStatus" NOT NULL DEFAULT 'ACTIVE',
    "dealType" "DealType" NOT NULL,
    "sellerName" TEXT NOT NULL,
    "sellerKind" "SellerKind",
    "allowPausing" BOOLEAN NOT NULL DEFAULT false,
    "deliveryMethod" "DealDeliveryMethod" NOT NULL DEFAULT 'PROGRAMMATIC',
    "commitment" "DealCommitment" NOT NULL DEFAULT 'NON_GUARANTEED',
    "pgDirect" BOOLEAN NOT NULL DEFAULT false,
    "rateType" "DealRateType" NOT NULL DEFAULT 'FIXED',
    "rate" DECIMAL(14,4) NOT NULL,
    "floorPrice" DECIMAL(14,4),
    "cost" DECIMAL(16,2),
    "quantityImpressions" BIGINT,
    "shareOfVoicePct" DECIMAL(5,2),
    "startAt" TIMESTAMP(3) NOT NULL,
    "endAt" TIMESTAMP(3) NOT NULL,
    "dayTimeSpec" JSONB,
    "frequencyCap" JSONB,
    "format" "InventoryFormat" NOT NULL DEFAULT 'DISPLAY',
    "durationSeconds" INTEGER,
    "creativeSource" TEXT NOT NULL DEFAULT 'Advertiser provided',
    "targetingSummary" JSONB,
    "bidRatioPct" DECIMAL(6,2),
    "centralPartnerDeal" BOOLEAN NOT NULL DEFAULT false,
    "allAdvertisers" BOOLEAN NOT NULL DEFAULT false,
    "sizes" TEXT[],
    "source" "DealSource" NOT NULL DEFAULT 'NEGOTIATED',
    "fillPct" DECIMAL(5,2),
    "lastDeliveredAt" TIMESTAMP(3),
    "shortfallImpressions" BIGINT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InventorySourceDeal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DealAccess" (
    "id" TEXT NOT NULL,
    "sandboxId" TEXT NOT NULL,
    "dealId" TEXT NOT NULL,
    "partnerId" TEXT,
    "advertiserId" TEXT,
    "isDefaultAdvertiser" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "DealAccess_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InventoryPackage" (
    "id" TEXT NOT NULL,
    "sandboxId" TEXT NOT NULL,
    "publicId" BIGINT NOT NULL DEFAULT next_public_id(),
    "partnerId" TEXT NOT NULL,
    "exchangeId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "packageUuid" TEXT NOT NULL,
    "format" "InventoryFormat" NOT NULL DEFAULT 'DISPLAY',
    "dealType" "DealType" NOT NULL DEFAULT 'PRIVATE_AUCTION',
    "rate" DECIMAL(14,4) NOT NULL,
    "floorPrice" DECIMAL(14,4),
    "currencyCode" TEXT NOT NULL,
    "rateCurrencyOriginal" TEXT,
    "rateOriginal" DECIMAL(14,4),
    "bidRatioPct" DECIMAL(6,2),
    "startAt" TIMESTAMP(3) NOT NULL,
    "endAt" TIMESTAMP(3),
    "status" "EntityStatus" NOT NULL DEFAULT 'ACTIVE',
    "marketplaceProductId" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InventoryPackage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DealGroup" (
    "id" TEXT NOT NULL,
    "sandboxId" TEXT NOT NULL,
    "publicId" BIGINT NOT NULL DEFAULT next_public_id(),
    "partnerId" TEXT,
    "advertiserId" TEXT,
    "name" TEXT NOT NULL,
    "kind" "DealGroupKind" NOT NULL DEFAULT 'DEAL_GROUP',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DealGroup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DealGroupMember" (
    "id" TEXT NOT NULL,
    "sandboxId" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "memberKind" "DealGroupMemberKind" NOT NULL,
    "memberId" TEXT NOT NULL,

    CONSTRAINT "DealGroupMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LineItemInventory" (
    "id" TEXT NOT NULL,
    "sandboxId" TEXT NOT NULL,
    "lineItemId" TEXT NOT NULL,
    "kind" "LineItemInventoryKind" NOT NULL,
    "refId" TEXT NOT NULL,
    "mode" "InventoryMode" NOT NULL DEFAULT 'INCLUDE',

    CONSTRAINT "LineItemInventory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Negotiation" (
    "id" TEXT NOT NULL,
    "sandboxId" TEXT NOT NULL,
    "publicId" BIGINT NOT NULL DEFAULT next_public_id(),
    "partnerId" TEXT NOT NULL,
    "advertiserId" TEXT,
    "exchangeId" TEXT NOT NULL,
    "sellerName" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "rfpId" TEXT NOT NULL,
    "status" "NegotiationStatus" NOT NULL DEFAULT 'DRAFT',
    "awaiting" "NegotiationAwaiting" NOT NULL DEFAULT 'SELLER',
    "round" INTEGER NOT NULL DEFAULT 1,
    "sellerPolicy" JSONB,
    "terms" JSONB,
    "deliveryMethod" "DealDeliveryMethod" NOT NULL DEFAULT 'PROGRAMMATIC',
    "commitment" "DealCommitment" NOT NULL DEFAULT 'NON_GUARANTEED',
    "volume" BIGINT,
    "averagePrice" DECIMAL(14,4),
    "spend" DECIMAL(16,2),
    "lastEditedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resultingDealId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Negotiation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NegotiationMessage" (
    "id" TEXT NOT NULL,
    "sandboxId" TEXT NOT NULL,
    "negotiationId" TEXT NOT NULL,
    "authorKind" "NegotiationAuthorKind" NOT NULL,
    "body" TEXT NOT NULL,
    "proposedRate" DECIMAL(14,4),
    "proposedVolume" BIGINT,
    "replyToId" TEXT,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NegotiationMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FloodlightGroup" (
    "id" TEXT NOT NULL,
    "sandboxId" TEXT NOT NULL,
    "publicId" BIGINT NOT NULL DEFAULT next_public_id(),
    "advertiserId" TEXT NOT NULL,
    "partnerId" TEXT,
    "ownerScope" "OwnerScope" NOT NULL DEFAULT 'ADVERTISER',
    "name" TEXT NOT NULL,
    "clickWindowDays" INTEGER NOT NULL DEFAULT 30,
    "impressionWindowDays" INTEGER NOT NULL DEFAULT 1,
    "imageTagOnly" BOOLEAN NOT NULL DEFAULT false,
    "dynamicTag" BOOLEAN NOT NULL DEFAULT true,
    "personalizedAdExclusion" "PersonalizedAdExclusion" NOT NULL DEFAULT 'DONT_EXCLUDE',
    "defaultConsent" JSONB,
    "importedDataConsent" JSONB,
    "viewableImpressionPct" INTEGER NOT NULL DEFAULT 50,
    "engagedViewMetricVariable" TEXT,
    "activeViewMetricVariable" TEXT,
    "enhancedConversions" BOOLEAN NOT NULL DEFAULT false,
    "appAttributionPartners" JSONB,
    "googleAnalyticsLinked" BOOLEAN NOT NULL DEFAULT false,
    "googleTagId" TEXT,
    "tagStatus" TEXT,
    "lastSeenAt" TIMESTAMP(3),
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FloodlightGroup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FloodlightActivity" (
    "id" TEXT NOT NULL,
    "sandboxId" TEXT NOT NULL,
    "publicId" BIGINT NOT NULL DEFAULT next_public_id(),
    "groupId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" "EntityStatus" NOT NULL DEFAULT 'ACTIVE',
    "platform" "FloodlightPlatform" NOT NULL DEFAULT 'WEB',
    "format" "FloodlightFormat" NOT NULL DEFAULT 'GOOGLE_TAG',
    "type" "FloodlightType" NOT NULL DEFAULT 'COUNTER',
    "countingMethod" "CountingMethod" NOT NULL DEFAULT 'STANDARD',
    "category" "FloodlightCategory",
    "remarketingEnabled" BOOLEAN NOT NULL DEFAULT false,
    "youtubeEnabled" BOOLEAN NOT NULL DEFAULT false,
    "valueBasedBidding" BOOLEAN NOT NULL DEFAULT false,
    "commercePartnerMeasurement" BOOLEAN NOT NULL DEFAULT false,
    "personalizedAdExclusion" "PersonalizedAdExclusion" NOT NULL DEFAULT 'DONT_EXCLUDE',
    "customVariableKeys" TEXT[],
    "appId" TEXT,
    "ctvAppId" TEXT,
    "appStoreId" TEXT,
    "conversionEventName" TEXT,
    "lockedFieldsAt" TIMESTAMP(3),
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FloodlightActivity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FloodlightVariable" (
    "id" TEXT NOT NULL,
    "sandboxId" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "dataType" "FloodlightVariableType" NOT NULL DEFAULT 'STRING',
    "ordinal" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "FloodlightVariable_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FloodlightAttributionModel" (
    "id" TEXT NOT NULL,
    "sandboxId" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "kind" "AttributionModelKind" NOT NULL DEFAULT 'FLOODLIGHT_DEFAULT',

    CONSTRAINT "FloodlightAttributionModel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConversionGroup" (
    "id" TEXT NOT NULL,
    "sandboxId" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "ConversionGroup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConversionGroupActivity" (
    "id" TEXT NOT NULL,
    "sandboxId" TEXT NOT NULL,
    "conversionGroupId" TEXT NOT NULL,
    "activityId" TEXT NOT NULL,

    CONSTRAINT "ConversionGroupActivity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustomBiddingAlgorithm" (
    "id" TEXT NOT NULL,
    "sandboxId" TEXT NOT NULL,
    "publicId" BIGINT NOT NULL DEFAULT next_public_id(),
    "advertiserId" TEXT,
    "partnerId" TEXT,
    "ownerScope" "OwnerScope" NOT NULL DEFAULT 'ADVERTISER',
    "name" TEXT NOT NULL,
    "source" "CustomBiddingSource" NOT NULL DEFAULT 'RULE_BASED',
    "objective" "CustomBiddingObjective" NOT NULL DEFAULT 'CLICKS',
    "status" "CustomBiddingStatus" NOT NULL DEFAULT 'ACTIVE',
    "modelReadiness" "CustomBiddingReadiness" NOT NULL DEFAULT 'NOT_READY',
    "readinessPct" INTEGER NOT NULL DEFAULT 0,
    "trainingImpressions" BIGINT NOT NULL DEFAULT 0,
    "errorPct" DECIMAL(6,3),
    "activeLineItems" INTEGER NOT NULL DEFAULT 0,
    "lastTestRunId" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CustomBiddingAlgorithm_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustomBiddingRule" (
    "id" TEXT NOT NULL,
    "sandboxId" TEXT NOT NULL,
    "algorithmId" TEXT NOT NULL,
    "groupKey" TEXT NOT NULL,
    "matchMode" "CustomBiddingMatchMode" NOT NULL DEFAULT 'ANY',
    "signal" TEXT NOT NULL,
    "signalKey" TEXT,
    "operator" TEXT NOT NULL DEFAULT 'IS',
    "value" TEXT NOT NULL,
    "score" DECIMAL(10,4) NOT NULL DEFAULT 1,
    "ordinal" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "CustomBiddingRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustomBiddingMultiplier" (
    "id" TEXT NOT NULL,
    "sandboxId" TEXT NOT NULL,
    "algorithmId" TEXT NOT NULL,
    "kind" "CustomBiddingMultiplierKind" NOT NULL,
    "ordinal" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "CustomBiddingMultiplier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustomBiddingMultiplierValue" (
    "id" TEXT NOT NULL,
    "sandboxId" TEXT NOT NULL,
    "multiplierId" TEXT NOT NULL,
    "valueKey" TEXT NOT NULL,
    "multiplier" DECIMAL(6,3) NOT NULL,

    CONSTRAINT "CustomBiddingMultiplierValue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustomBiddingTestRun" (
    "id" TEXT NOT NULL,
    "sandboxId" TEXT NOT NULL,
    "algorithmId" TEXT NOT NULL,
    "ranAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sampleImpressions" BIGINT NOT NULL DEFAULT 0,
    "scoreHistogram" JSONB,
    "warnings" JSONB,
    "passed" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "CustomBiddingTestRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustomBiddingScript" (
    "id" TEXT NOT NULL,
    "sandboxId" TEXT NOT NULL,
    "algorithmId" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "sourceText" TEXT NOT NULL,
    "state" "CustomBiddingScriptState" NOT NULL DEFAULT 'PENDING',
    "errors" JSONB,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CustomBiddingScript_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Report" (
    "id" TEXT NOT NULL,
    "sandboxId" TEXT NOT NULL,
    "publicId" BIGINT NOT NULL DEFAULT next_public_id(),
    "partnerId" TEXT NOT NULL,
    "advertiserId" TEXT,
    "ownerUserId" TEXT NOT NULL,
    "kind" "ReportKind" NOT NULL DEFAULT 'INSTANT',
    "name" TEXT NOT NULL,
    "definition" JSONB NOT NULL,
    "timeZone" "ReportTimeZone" NOT NULL DEFAULT 'ADVERTISER',
    "dateRange" JSONB NOT NULL,
    "autoRun" BOOLEAN NOT NULL DEFAULT false,
    "template" TEXT,
    "languageFormatting" TEXT NOT NULL DEFAULT 'RAW',
    "schedule" JSONB,
    "delivery" JSONB,
    "lastRunAt" TIMESTAMP(3),
    "nextRunSimAt" TIMESTAMP(3),
    "lastScheduledRunSimAt" TIMESTAMP(3),
    "scheduleRunCount" INTEGER NOT NULL DEFAULT 0,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Report_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReportRun" (
    "id" TEXT NOT NULL,
    "sandboxId" TEXT NOT NULL,
    "publicId" BIGINT NOT NULL DEFAULT next_public_id(),
    "reportId" TEXT NOT NULL,
    "dateRangeStart" DATE NOT NULL,
    "dateRangeEnd" DATE NOT NULL,
    "createdById" TEXT NOT NULL,
    "status" "ReportRunStatus" NOT NULL DEFAULT 'QUEUED',
    "scheduled" BOOLEAN NOT NULL DEFAULT false,
    "completedAt" TIMESTAMP(3),
    "completedAtSim" TIMESTAMP(3),
    "format" "ReportFormat" NOT NULL DEFAULT 'CSV',
    "fileName" TEXT,
    "storageKey" TEXT,
    "sizeBytes" BIGINT,
    "rowCount" INTEGER,
    "definitionSnapshot" JSONB,
    "warnings" JSONB,
    "error" TEXT,

    CONSTRAINT "ReportRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReportShare" (
    "id" TEXT NOT NULL,
    "sandboxId" TEXT NOT NULL,
    "reportId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "canEdit" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "ReportShare_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CrossMediaReachReport" (
    "id" TEXT NOT NULL,
    "sandboxId" TEXT NOT NULL,
    "publicId" BIGINT NOT NULL DEFAULT next_public_id(),
    "partnerId" TEXT NOT NULL,
    "advertiserId" TEXT,
    "createdById" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "country" "CrossMediaCountry" NOT NULL,
    "currencyCode" TEXT NOT NULL,
    "scope" "CrossMediaScope" NOT NULL DEFAULT 'NATIONAL',
    "subLocations" TEXT[],
    "ioIds" TEXT[],
    "tvCampaigns" JSONB,
    "tvDatasetVersion" INTEGER NOT NULL DEFAULT 1,
    "dateStart" DATE,
    "dateEnd" DATE,
    "status" "CrossMediaStatus" NOT NULL DEFAULT 'PROCESSING',
    "result" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CrossMediaReachReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Plan" (
    "id" TEXT NOT NULL,
    "sandboxId" TEXT NOT NULL,
    "publicId" BIGINT NOT NULL DEFAULT next_public_id(),
    "advertiserId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" "PlanStatus" NOT NULL DEFAULT 'PLANNED',
    "locationCountry" TEXT NOT NULL,
    "currencyCode" TEXT NOT NULL,
    "startDate" DATE NOT NULL,
    "endDate" DATE NOT NULL,
    "totalBudget" DECIMAL(16,2),
    "channels" "PlanChannel"[],
    "demographics" JSONB,
    "additionalSettings" JSONB,
    "frequencyGoal" INTEGER NOT NULL DEFAULT 3,
    "reachBasis" "PlanReachBasis" NOT NULL DEFAULT 'CENSUS',
    "includeYoutube" BOOLEAN NOT NULL DEFAULT true,
    "forecastStale" BOOLEAN NOT NULL DEFAULT true,
    "savedAt" TIMESTAMP(3),
    "savedAtSim" TIMESTAMP(3),
    "convertedCampaignId" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Plan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlanRow" (
    "id" TEXT NOT NULL,
    "sandboxId" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "ordinal" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "buyingMethod" "PlanBuyingMethod" NOT NULL DEFAULT 'OPEN_AUCTION',
    "locations" TEXT[],
    "startDate" DATE NOT NULL,
    "endDate" DATE NOT NULL,
    "targeting" JSONB,
    "audienceRefs" JSONB,
    "pricing" TEXT NOT NULL DEFAULT 'Auction',
    "dealId" TEXT,
    "feePct" DECIMAL(6,3) NOT NULL DEFAULT 0,
    "budgetNet" DECIMAL(16,2) NOT NULL DEFAULT 0,
    "budgetTotal" DECIMAL(16,2) NOT NULL DEFAULT 0,
    "maxCpm" DECIMAL(14,4),
    "isCpmLocked" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "PlanRow_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlanForecast" (
    "id" TEXT NOT NULL,
    "sandboxId" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "asOf" TIMESTAMP(3) NOT NULL,
    "onTargetReachPct" DECIMAL(7,3),
    "avgFrequency" DECIMAL(7,3),
    "totalCpm" DECIMAL(14,4),
    "onTargetCpm" DECIMAL(14,4),
    "censusTrps" DECIMAL(10,3),
    "censusCpp" DECIMAL(14,4),
    "censusPopulation" BIGINT,
    "digitalPopulation" BIGINT,
    "tvPopulation" BIGINT,
    "youtubePopulation" BIGINT,
    "actionCpa" DECIMAL(14,4),
    "cpa" DECIMAL(14,4),
    "viewableCpm" DECIMAL(14,4),
    "viewabilityRate" DECIMAL(7,3),
    "perRow" JSONB,
    "curves" JSONB,
    "reachByFrequency" JSONB,
    "tabs" JSONB,
    "engineParamsVersion" INTEGER NOT NULL DEFAULT 1,
    "inputsHash" TEXT,

    CONSTRAINT "PlanForecast_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Experiment" (
    "id" TEXT NOT NULL,
    "sandboxId" TEXT NOT NULL,
    "publicId" BIGINT NOT NULL DEFAULT next_public_id(),
    "advertiserId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "hypothesis" TEXT,
    "startDate" DATE NOT NULL,
    "endDate" DATE,
    "target" "ExperimentTarget" NOT NULL,
    "goal" "ExperimentGoal" NOT NULL DEFAULT 'CONVERSIONS',
    "confidence" "ConfidenceLevel" NOT NULL DEFAULT 'P90',
    "excludeUnidentifiedUsers" BOOLEAN NOT NULL DEFAULT false,
    "channelScope" "ExperimentChannelScope" NOT NULL DEFAULT 'CROSS_EXCHANGE',
    "status" "ExperimentStatus" NOT NULL DEFAULT 'SCHEDULED',
    "controlArmId" TEXT,
    "liftStudyId" TEXT,
    "endedAt" TIMESTAMP(3),
    "endedById" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Experiment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExperimentArm" (
    "id" TEXT NOT NULL,
    "sandboxId" TEXT NOT NULL,
    "experimentId" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT 'Arm 1',
    "splitPct" INTEGER NOT NULL DEFAULT 50,
    "isControl" BOOLEAN NOT NULL DEFAULT false,
    "ordinal" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ExperimentArm_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExperimentArmEntity" (
    "id" TEXT NOT NULL,
    "sandboxId" TEXT NOT NULL,
    "experimentId" TEXT NOT NULL,
    "armId" TEXT NOT NULL,
    "ioId" TEXT,
    "lineItemId" TEXT,

    CONSTRAINT "ExperimentArmEntity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExperimentResult" (
    "id" TEXT NOT NULL,
    "sandboxId" TEXT NOT NULL,
    "experimentId" TEXT NOT NULL,
    "armId" TEXT NOT NULL,
    "controlArmId" TEXT,
    "metric" TEXT NOT NULL,
    "confidence" "ConfidenceLevel" NOT NULL DEFAULT 'P90',
    "rangeHash" TEXT NOT NULL DEFAULT '',
    "value" DECIMAL(20,6) NOT NULL,
    "lift" DECIMAL(12,6),
    "pValue" DECIMAL(10,8),
    "isBest" BOOLEAN NOT NULL DEFAULT false,
    "computedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExperimentResult_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LiftStudy" (
    "id" TEXT NOT NULL,
    "sandboxId" TEXT NOT NULL,
    "publicId" BIGINT NOT NULL DEFAULT next_public_id(),
    "advertiserId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "types" "LiftType"[],
    "brandLiftMetrics" "BrandLiftMetric"[],
    "brandName" TEXT NOT NULL,
    "competitors" TEXT[],
    "language" TEXT NOT NULL DEFAULT 'en-US',
    "objectType" TEXT,
    "intendedAction" "IntendedAction",
    "strength" "LiftStrength" NOT NULL DEFAULT 'STANDARD',
    "status" "LiftStatus" NOT NULL DEFAULT 'ELIGIBLE',
    "originExperimentId" TEXT,
    "endedAt" TIMESTAMP(3),
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LiftStudy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LiftStudyEntity" (
    "id" TEXT NOT NULL,
    "sandboxId" TEXT NOT NULL,
    "studyId" TEXT NOT NULL,
    "ioId" TEXT NOT NULL,
    "containsYoutubePg" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "LiftStudyEntity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LiftFlight" (
    "id" TEXT NOT NULL,
    "sandboxId" TEXT NOT NULL,
    "studyId" TEXT NOT NULL,
    "liftType" "LiftType" NOT NULL,
    "number" INTEGER NOT NULL,
    "status" "LiftStatus" NOT NULL DEFAULT 'ELIGIBLE',
    "pctComplete" INTEGER NOT NULL DEFAULT 0,
    "requiredMediaCost" DECIMAL(16,2),
    "mediaCostSoFar" DECIMAL(16,2) NOT NULL DEFAULT 0,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "endedAt" TIMESTAMP(3),

    CONSTRAINT "LiftFlight_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LiftSearchTermGroup" (
    "id" TEXT NOT NULL,
    "sandboxId" TEXT NOT NULL,
    "studyId" TEXT NOT NULL,
    "ordinal" INTEGER NOT NULL,
    "terms" TEXT[],

    CONSTRAINT "LiftSearchTermGroup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LiftResult" (
    "id" TEXT NOT NULL,
    "sandboxId" TEXT NOT NULL,
    "flightId" TEXT NOT NULL,
    "scope" "LiftResultScope" NOT NULL DEFAULT 'YOUTUBE_DEMAND_GEN',
    "metric" TEXT NOT NULL,
    "slice" "LiftSlice" NOT NULL DEFAULT 'OVERALL',
    "sliceValue" TEXT NOT NULL DEFAULT '',
    "surveyResponses" INTEGER NOT NULL DEFAULT 0,
    "absoluteLift" DECIMAL(10,6),
    "relativeLift" DECIMAL(10,6),
    "headroomLift" DECIMAL(10,6),
    "baselineRate" DECIMAL(10,6),
    "exposedRate" DECIMAL(10,6),
    "significant" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "LiftResult_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BulkJob" (
    "id" TEXT NOT NULL,
    "sandboxId" TEXT NOT NULL,
    "publicId" BIGINT NOT NULL DEFAULT next_public_id(),
    "advertiserId" TEXT,
    "partnerId" TEXT NOT NULL,
    "requestedById" TEXT NOT NULL,
    "source" "BulkSource" NOT NULL,
    "action" "BulkAction" NOT NULL,
    "description" TEXT NOT NULL,
    "status" "BulkJobStatus" NOT NULL DEFAULT 'QUEUED',
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "payload" JSONB,
    "selectionCount" INTEGER NOT NULL DEFAULT 0,
    "resultKind" "BulkResultKind",
    "resultEntityId" TEXT,
    "resultStorageKey" TEXT,
    "errorSummary" TEXT,

    CONSTRAINT "BulkJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BulkJobItem" (
    "id" TEXT NOT NULL,
    "sandboxId" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "entityType" "EntityType" NOT NULL,
    "entityId" TEXT,
    "status" "BulkItemStatus" NOT NULL,
    "message" TEXT,
    "rowNumber" INTEGER,
    "ruleId" TEXT,
    "field" TEXT,

    CONSTRAINT "BulkJobItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SimConversionDaily" (
    "id" TEXT NOT NULL,
    "sandboxId" TEXT NOT NULL,
    "lineItemId" TEXT NOT NULL,
    "activityId" TEXT NOT NULL,
    "simDate" DATE NOT NULL,
    "conversionType" "SimConversionType" NOT NULL,
    "lagBucket" INTEGER NOT NULL DEFAULT 0,
    "count" DECIMAL(20,4) NOT NULL DEFAULT 0,
    "salesCount" DECIMAL(20,4) NOT NULL DEFAULT 0,
    "revenue" DECIMAL(20,4) NOT NULL DEFAULT 0,
    "itemsSold" DECIMAL(20,4) NOT NULL DEFAULT 0,

    CONSTRAINT "SimConversionDaily_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SimReachSnapshot" (
    "id" TEXT NOT NULL,
    "sandboxId" TEXT NOT NULL,
    "scopeType" "SimScopeType" NOT NULL,
    "scopeId" TEXT NOT NULL,
    "simDate" DATE NOT NULL,
    "windowDays" INTEGER NOT NULL,
    "impressionReach" BIGINT NOT NULL DEFAULT 0,
    "coViewedReach" BIGINT NOT NULL DEFAULT 0,
    "clickReach" BIGINT NOT NULL DEFAULT 0,
    "avgFrequency" DECIMAL(10,4) NOT NULL DEFAULT 0,
    "reachByFrequency" JSONB,

    CONSTRAINT "SimReachSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SimPacingSnapshot" (
    "id" TEXT NOT NULL,
    "sandboxId" TEXT NOT NULL,
    "ioId" TEXT NOT NULL,
    "budgetSegmentId" TEXT NOT NULL,
    "simDate" DATE NOT NULL,
    "plannedSpendToDate" DECIMAL(20,4) NOT NULL DEFAULT 0,
    "actualSpendToDate" DECIMAL(20,4) NOT NULL DEFAULT 0,
    "remainingBudget" DECIMAL(20,4) NOT NULL DEFAULT 0,
    "pacingPct" DECIMAL(10,4) NOT NULL DEFAULT 0,
    "budgetAtRisk" DECIMAL(20,4) NOT NULL DEFAULT 0,
    "daysLeft" INTEGER NOT NULL DEFAULT 0,
    "likelyToSpendPct" DECIMAL(10,4) NOT NULL DEFAULT 0,
    "underpacing" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "SimPacingSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SimTickLog" (
    "id" TEXT NOT NULL,
    "sandboxId" TEXT NOT NULL,
    "tickNo" BIGINT NOT NULL,
    "simHour" TIMESTAMP(3) NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "durationMs" INTEGER NOT NULL DEFAULT 0,
    "lineItemsProcessed" INTEGER NOT NULL DEFAULT 0,
    "rowsWritten" INTEGER NOT NULL DEFAULT 0,
    "status" "SimTickStatus" NOT NULL DEFAULT 'OK',
    "error" TEXT,

    CONSTRAINT "SimTickLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SeedTemplate_key_key" ON "SeedTemplate"("key");

-- CreateIndex
CREATE UNIQUE INDEX "Scenario_key_key" ON "Scenario"("key");

-- CreateIndex
CREATE INDEX "Scenario_classroomId_isPublished_idx" ON "Scenario"("classroomId", "isPublished");

-- CreateIndex
CREATE UNIQUE INDEX "ScenarioStep_scenarioId_key_key" ON "ScenarioStep"("scenarioId", "key");

-- CreateIndex
CREATE UNIQUE INDEX "ScenarioStep_scenarioId_ordinal_key" ON "ScenarioStep"("scenarioId", "ordinal");

-- CreateIndex
CREATE UNIQUE INDEX "ScenarioSeedPatch_scenarioId_ordinal_key" ON "ScenarioSeedPatch"("scenarioId", "ordinal");

-- CreateIndex
CREATE INDEX "ScenarioEvent_scenarioId_afterTick_idx" ON "ScenarioEvent"("scenarioId", "afterTick");

-- CreateIndex
CREATE UNIQUE INDEX "ScenarioAssignment_classroomId_scenarioId_key" ON "ScenarioAssignment"("classroomId", "scenarioId");

-- CreateIndex
CREATE INDEX "ScenarioAttempt_classroomId_scenarioId_idx" ON "ScenarioAttempt"("classroomId", "scenarioId");

-- CreateIndex
CREATE INDEX "ScenarioAttempt_sandboxId_idx" ON "ScenarioAttempt"("sandboxId");

-- CreateIndex
CREATE UNIQUE INDEX "ScenarioAttempt_id_sandboxId_key" ON "ScenarioAttempt"("id", "sandboxId");

-- CreateIndex
CREATE UNIQUE INDEX "ScenarioAttempt_scenarioId_sandboxId_startedAt_key" ON "ScenarioAttempt"("scenarioId", "sandboxId", "startedAt");

-- CreateIndex
CREATE INDEX "ScenarioCheckResult_sandboxId_idx" ON "ScenarioCheckResult"("sandboxId");

-- CreateIndex
CREATE UNIQUE INDEX "ScenarioCheckResult_attemptId_stepId_key" ON "ScenarioCheckResult"("attemptId", "stepId");

-- CreateIndex
CREATE INDEX "InstructorNote_classroomId_studentUserId_idx" ON "InstructorNote"("classroomId", "studentUserId");

-- CreateIndex
CREATE INDEX "SandboxSnapshot_classroomId_idx" ON "SandboxSnapshot"("classroomId");

-- CreateIndex
CREATE INDEX "Notification_classroomId_publishedAt_idx" ON "Notification"("classroomId", "publishedAt");

-- CreateIndex
CREATE UNIQUE INDEX "NotificationDismissal_notificationId_userId_key" ON "NotificationDismissal"("notificationId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "HelpArticle_slug_key" ON "HelpArticle"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "YoutubeVideo_videoId_key" ON "YoutubeVideo"("videoId");

-- CreateIndex
CREATE UNIQUE INDEX "AppCatalog_platform_appId_key" ON "AppCatalog"("platform", "appId");

-- CreateIndex
CREATE UNIQUE INDEX "ThirdPartyVendor_key_key" ON "ThirdPartyVendor"("key");

-- CreateIndex
CREATE INDEX "GoogleAudience_kind_parentId_idx" ON "GoogleAudience"("kind", "parentId");

-- CreateIndex
CREATE UNIQUE INDEX "GoogleAudience_kind_code_key" ON "GoogleAudience"("kind", "code");

-- CreateIndex
CREATE INDEX "MarketplaceProduct_type_featuredCarousel_idx" ON "MarketplaceProduct"("type", "featuredCarousel");

-- CreateIndex
CREATE UNIQUE INDEX "ReportField_key_key" ON "ReportField"("key");

-- CreateIndex
CREATE INDEX "ReportField_category_ordinal_idx" ON "ReportField"("category", "ordinal");

-- CreateIndex
CREATE UNIQUE INDEX "ReportTemplate_family_title_key" ON "ReportTemplate"("family", "title");

-- CreateIndex
CREATE UNIQUE INDEX "FxRate_fromCurrency_toCurrency_validFrom_key" ON "FxRate"("fromCurrency", "toCurrency", "validFrom");

-- CreateIndex
CREATE UNIQUE INDEX "PlanCountry_countryCode_key" ON "PlanCountry"("countryCode");

-- CreateIndex
CREATE UNIQUE INDEX "SubLocation_countryCode_code_key" ON "SubLocation"("countryCode", "code");

-- CreateIndex
CREATE INDEX "TvCampaign_countryCode_company_idx" ON "TvCampaign"("countryCode", "company");

-- CreateIndex
CREATE INDEX "PartnerContact_sandboxId_idx" ON "PartnerContact"("sandboxId");

-- CreateIndex
CREATE UNIQUE INDEX "PartnerContact_partnerId_role_key" ON "PartnerContact"("partnerId", "role");

-- CreateIndex
CREATE INDEX "PartnerFeatureFlag_sandboxId_idx" ON "PartnerFeatureFlag"("sandboxId");

-- CreateIndex
CREATE UNIQUE INDEX "PartnerFeatureFlag_id_sandboxId_key" ON "PartnerFeatureFlag"("id", "sandboxId");

-- CreateIndex
CREATE UNIQUE INDEX "PartnerFeatureFlag_partnerId_key_key" ON "PartnerFeatureFlag"("partnerId", "key");

-- CreateIndex
CREATE INDEX "PartnerFeatureAdvertiser_sandboxId_idx" ON "PartnerFeatureAdvertiser"("sandboxId");

-- CreateIndex
CREATE UNIQUE INDEX "PartnerFeatureAdvertiser_flagId_advertiserId_key" ON "PartnerFeatureAdvertiser"("flagId", "advertiserId");

-- CreateIndex
CREATE INDEX "BillingProfile_sandboxId_partnerId_idx" ON "BillingProfile"("sandboxId", "partnerId");

-- CreateIndex
CREATE UNIQUE INDEX "BillingProfile_id_sandboxId_key" ON "BillingProfile"("id", "sandboxId");

-- CreateIndex
CREATE INDEX "Invoice_sandboxId_billingProfileId_periodMonth_idx" ON "Invoice"("sandboxId", "billingProfileId", "periodMonth");

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_id_sandboxId_key" ON "Invoice"("id", "sandboxId");

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_sandboxId_invoiceNumber_key" ON "Invoice"("sandboxId", "invoiceNumber");

-- CreateIndex
CREATE INDEX "InvoiceLine_sandboxId_invoiceId_idx" ON "InvoiceLine"("sandboxId", "invoiceId");

-- CreateIndex
CREATE INDEX "ThirdPartyRateCard_sandboxId_partnerId_idx" ON "ThirdPartyRateCard"("sandboxId", "partnerId");

-- CreateIndex
CREATE INDEX "ThirdPartyRateCard_sandboxId_advertiserId_idx" ON "ThirdPartyRateCard"("sandboxId", "advertiserId");

-- CreateIndex
CREATE INDEX "AdvertiserAlertPreference_sandboxId_idx" ON "AdvertiserAlertPreference"("sandboxId");

-- CreateIndex
CREATE UNIQUE INDEX "AdvertiserAlertPreference_advertiserId_alertType_key" ON "AdvertiserAlertPreference"("advertiserId", "alertType");

-- CreateIndex
CREATE INDEX "LinkedAccount_sandboxId_idx" ON "LinkedAccount"("sandboxId");

-- CreateIndex
CREATE UNIQUE INDEX "LinkedAccount_advertiserId_externalId_key" ON "LinkedAccount"("advertiserId", "externalId");

-- CreateIndex
CREATE INDEX "PolicyCertificate_sandboxId_idx" ON "PolicyCertificate"("sandboxId");

-- CreateIndex
CREATE UNIQUE INDEX "PolicyCertificate_advertiserId_kind_countryCode_key" ON "PolicyCertificate"("advertiserId", "kind", "countryCode");

-- CreateIndex
CREATE INDEX "AdvertiserVendorSelection_sandboxId_idx" ON "AdvertiserVendorSelection"("sandboxId");

-- CreateIndex
CREATE UNIQUE INDEX "AdvertiserVendorSelection_advertiserId_vendorKey_key" ON "AdvertiserVendorSelection"("advertiserId", "vendorKey");

-- CreateIndex
CREATE INDEX "YoutubeAsset_sandboxId_advertiserId_kind_idx" ON "YoutubeAsset"("sandboxId", "advertiserId", "kind");

-- CreateIndex
CREATE INDEX "HistoryNote_sandboxId_entityType_entityId_noteDate_idx" ON "HistoryNote"("sandboxId", "entityType", "entityId", "noteDate");

-- CreateIndex
CREATE INDEX "Recommendation_sandboxId_advertiserId_status_idx" ON "Recommendation"("sandboxId", "advertiserId", "status");

-- CreateIndex
CREATE INDEX "Recommendation_sandboxId_scopeType_scopeId_idx" ON "Recommendation"("sandboxId", "scopeType", "scopeId");

-- CreateIndex
CREATE INDEX "Upload_sandboxId_createdById_idx" ON "Upload"("sandboxId", "createdById");

-- CreateIndex
CREATE UNIQUE INDEX "Workspace_id_sandboxId_key" ON "Workspace"("id", "sandboxId");

-- CreateIndex
CREATE UNIQUE INDEX "Workspace_sandboxId_ownerUserId_partnerId_name_key" ON "Workspace"("sandboxId", "ownerUserId", "partnerId", "name");

-- CreateIndex
CREATE INDEX "WorkspaceShare_sandboxId_idx" ON "WorkspaceShare"("sandboxId");

-- CreateIndex
CREATE UNIQUE INDEX "WorkspaceShare_workspaceId_userId_key" ON "WorkspaceShare"("workspaceId", "userId");

-- CreateIndex
CREATE INDEX "PinnedItem_sandboxId_userId_partnerId_idx" ON "PinnedItem"("sandboxId", "userId", "partnerId");

-- CreateIndex
CREATE UNIQUE INDEX "PinnedItem_sandboxId_userId_entityType_entityId_key" ON "PinnedItem"("sandboxId", "userId", "entityType", "entityId");

-- CreateIndex
CREATE INDEX "RecentlyViewed_sandboxId_userId_viewedAt_idx" ON "RecentlyViewed"("sandboxId", "userId", "viewedAt");

-- CreateIndex
CREATE UNIQUE INDEX "RecentlyViewed_sandboxId_userId_entityType_entityId_key" ON "RecentlyViewed"("sandboxId", "userId", "entityType", "entityId");

-- CreateIndex
CREATE UNIQUE INDEX "UserPreference_userId_sandboxId_key_key" ON "UserPreference"("userId", "sandboxId", "key");

-- CreateIndex
CREATE UNIQUE INDEX "UserEmailPreference_userId_sandboxId_key" ON "UserEmailPreference"("userId", "sandboxId");

-- CreateIndex
CREATE INDEX "AdvisorSession_sandboxId_userId_lastMessageAt_idx" ON "AdvisorSession"("sandboxId", "userId", "lastMessageAt");

-- CreateIndex
CREATE UNIQUE INDEX "AdvisorSession_id_sandboxId_key" ON "AdvisorSession"("id", "sandboxId");

-- CreateIndex
CREATE INDEX "AdvisorMessage_sandboxId_sessionId_createdAt_idx" ON "AdvisorMessage"("sandboxId", "sessionId", "createdAt");

-- CreateIndex
CREATE INDEX "InboxMessage_sandboxId_userId_readAt_idx" ON "InboxMessage"("sandboxId", "userId", "readAt");

-- CreateIndex
CREATE INDEX "SavedView_sandboxId_advertiserId_grid_idx" ON "SavedView"("sandboxId", "advertiserId", "grid");

-- CreateIndex
CREATE INDEX "ChartCard_sandboxId_advertiserId_scope_scopeId_idx" ON "ChartCard"("sandboxId", "advertiserId", "scope", "scopeId");

-- CreateIndex
CREATE INDEX "AudienceTagRule_sandboxId_audienceId_ordinal_idx" ON "AudienceTagRule"("sandboxId", "audienceId", "ordinal");

-- CreateIndex
CREATE INDEX "AudienceSeed_sandboxId_idx" ON "AudienceSeed"("sandboxId");

-- CreateIndex
CREATE UNIQUE INDEX "AudienceSeed_audienceId_seedAudienceId_key" ON "AudienceSeed"("audienceId", "seedAudienceId");

-- CreateIndex
CREATE INDEX "CombinedAudienceTerm_sandboxId_audienceId_mode_groupIndex_idx" ON "CombinedAudienceTerm"("sandboxId", "audienceId", "mode", "groupIndex");

-- CreateIndex
CREATE INDEX "CustomListEntry_sandboxId_audienceId_ordinal_idx" ON "CustomListEntry"("sandboxId", "audienceId", "ordinal");

-- CreateIndex
CREATE INDEX "CustomerMatchUpload_sandboxId_audienceId_idx" ON "CustomerMatchUpload"("sandboxId", "audienceId");

-- CreateIndex
CREATE INDEX "CreativeRestriction_sandboxId_creativeId_idx" ON "CreativeRestriction"("sandboxId", "creativeId");

-- CreateIndex
CREATE INDEX "CreativeUrl_sandboxId_creativeId_ordinal_idx" ON "CreativeUrl"("sandboxId", "creativeId", "ordinal");

-- CreateIndex
CREATE INDEX "CreativeAppeal_sandboxId_status_idx" ON "CreativeAppeal"("sandboxId", "status");

-- CreateIndex
CREATE INDEX "CreativeAppeal_sandboxId_creativeId_idx" ON "CreativeAppeal"("sandboxId", "creativeId");

-- CreateIndex
CREATE INDEX "AdSequenceStep_sandboxId_idx" ON "AdSequenceStep"("sandboxId");

-- CreateIndex
CREATE UNIQUE INDEX "AdSequenceStep_adGroupId_ordinal_key" ON "AdSequenceStep"("adGroupId", "ordinal");

-- CreateIndex
CREATE INDEX "LineItemFloodlightActivity_sandboxId_activityId_idx" ON "LineItemFloodlightActivity"("sandboxId", "activityId");

-- CreateIndex
CREATE UNIQUE INDEX "LineItemFloodlightActivity_lineItemId_activityId_key" ON "LineItemFloodlightActivity"("lineItemId", "activityId");

-- CreateIndex
CREATE UNIQUE INDEX "Channel_publicId_key" ON "Channel"("publicId");

-- CreateIndex
CREATE INDEX "Channel_sandboxId_advertiserId_idx" ON "Channel"("sandboxId", "advertiserId");

-- CreateIndex
CREATE INDEX "Channel_sandboxId_partnerId_idx" ON "Channel"("sandboxId", "partnerId");

-- CreateIndex
CREATE UNIQUE INDEX "Channel_id_sandboxId_key" ON "Channel"("id", "sandboxId");

-- CreateIndex
CREATE INDEX "ChannelEntry_sandboxId_idx" ON "ChannelEntry"("sandboxId");

-- CreateIndex
CREATE UNIQUE INDEX "ChannelEntry_channelId_kind_value_key" ON "ChannelEntry"("channelId", "kind", "value");

-- CreateIndex
CREATE UNIQUE INDEX "KeywordList_publicId_key" ON "KeywordList"("publicId");

-- CreateIndex
CREATE INDEX "KeywordList_sandboxId_advertiserId_idx" ON "KeywordList"("sandboxId", "advertiserId");

-- CreateIndex
CREATE UNIQUE INDEX "KeywordList_id_sandboxId_key" ON "KeywordList"("id", "sandboxId");

-- CreateIndex
CREATE INDEX "KeywordListEntry_sandboxId_idx" ON "KeywordListEntry"("sandboxId");

-- CreateIndex
CREATE UNIQUE INDEX "KeywordListEntry_keywordListId_keyword_key" ON "KeywordListEntry"("keywordListId", "keyword");

-- CreateIndex
CREATE UNIQUE INDEX "LocationList_publicId_key" ON "LocationList"("publicId");

-- CreateIndex
CREATE INDEX "LocationList_sandboxId_advertiserId_idx" ON "LocationList"("sandboxId", "advertiserId");

-- CreateIndex
CREATE UNIQUE INDEX "LocationList_id_sandboxId_key" ON "LocationList"("id", "sandboxId");

-- CreateIndex
CREATE INDEX "LocationListEntry_sandboxId_locationListId_idx" ON "LocationListEntry"("sandboxId", "locationListId");

-- CreateIndex
CREATE UNIQUE INDEX "InventoryOrder_publicId_key" ON "InventoryOrder"("publicId");

-- CreateIndex
CREATE INDEX "InventoryOrder_sandboxId_partnerId_idx" ON "InventoryOrder"("sandboxId", "partnerId");

-- CreateIndex
CREATE UNIQUE INDEX "InventoryOrder_id_sandboxId_key" ON "InventoryOrder"("id", "sandboxId");

-- CreateIndex
CREATE UNIQUE INDEX "InventorySourceDeal_publicId_key" ON "InventorySourceDeal"("publicId");

-- CreateIndex
CREATE INDEX "InventorySourceDeal_sandboxId_partnerId_status_idx" ON "InventorySourceDeal"("sandboxId", "partnerId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "InventorySourceDeal_id_sandboxId_key" ON "InventorySourceDeal"("id", "sandboxId");

-- CreateIndex
CREATE UNIQUE INDEX "InventorySourceDeal_partnerId_exchangeId_dealId_key" ON "InventorySourceDeal"("partnerId", "exchangeId", "dealId");

-- CreateIndex
CREATE INDEX "DealAccess_sandboxId_dealId_idx" ON "DealAccess"("sandboxId", "dealId");

-- CreateIndex
CREATE INDEX "DealAccess_sandboxId_advertiserId_idx" ON "DealAccess"("sandboxId", "advertiserId");

-- CreateIndex
CREATE UNIQUE INDEX "InventoryPackage_publicId_key" ON "InventoryPackage"("publicId");

-- CreateIndex
CREATE INDEX "InventoryPackage_sandboxId_partnerId_status_idx" ON "InventoryPackage"("sandboxId", "partnerId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "InventoryPackage_id_sandboxId_key" ON "InventoryPackage"("id", "sandboxId");

-- CreateIndex
CREATE UNIQUE INDEX "DealGroup_publicId_key" ON "DealGroup"("publicId");

-- CreateIndex
CREATE INDEX "DealGroup_sandboxId_advertiserId_idx" ON "DealGroup"("sandboxId", "advertiserId");

-- CreateIndex
CREATE INDEX "DealGroup_sandboxId_partnerId_idx" ON "DealGroup"("sandboxId", "partnerId");

-- CreateIndex
CREATE UNIQUE INDEX "DealGroup_id_sandboxId_key" ON "DealGroup"("id", "sandboxId");

-- CreateIndex
CREATE INDEX "DealGroupMember_sandboxId_idx" ON "DealGroupMember"("sandboxId");

-- CreateIndex
CREATE UNIQUE INDEX "DealGroupMember_groupId_memberKind_memberId_key" ON "DealGroupMember"("groupId", "memberKind", "memberId");

-- CreateIndex
CREATE INDEX "LineItemInventory_sandboxId_kind_refId_idx" ON "LineItemInventory"("sandboxId", "kind", "refId");

-- CreateIndex
CREATE UNIQUE INDEX "LineItemInventory_lineItemId_kind_refId_key" ON "LineItemInventory"("lineItemId", "kind", "refId");

-- CreateIndex
CREATE UNIQUE INDEX "Negotiation_publicId_key" ON "Negotiation"("publicId");

-- CreateIndex
CREATE INDEX "Negotiation_sandboxId_partnerId_status_idx" ON "Negotiation"("sandboxId", "partnerId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Negotiation_id_sandboxId_key" ON "Negotiation"("id", "sandboxId");

-- CreateIndex
CREATE UNIQUE INDEX "Negotiation_partnerId_rfpId_key" ON "Negotiation"("partnerId", "rfpId");

-- CreateIndex
CREATE INDEX "NegotiationMessage_sandboxId_negotiationId_sentAt_idx" ON "NegotiationMessage"("sandboxId", "negotiationId", "sentAt");

-- CreateIndex
CREATE UNIQUE INDEX "FloodlightGroup_publicId_key" ON "FloodlightGroup"("publicId");

-- CreateIndex
CREATE INDEX "FloodlightGroup_sandboxId_advertiserId_idx" ON "FloodlightGroup"("sandboxId", "advertiserId");

-- CreateIndex
CREATE UNIQUE INDEX "FloodlightGroup_id_sandboxId_key" ON "FloodlightGroup"("id", "sandboxId");

-- CreateIndex
CREATE UNIQUE INDEX "FloodlightActivity_publicId_key" ON "FloodlightActivity"("publicId");

-- CreateIndex
CREATE INDEX "FloodlightActivity_sandboxId_groupId_status_idx" ON "FloodlightActivity"("sandboxId", "groupId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "FloodlightActivity_id_sandboxId_key" ON "FloodlightActivity"("id", "sandboxId");

-- CreateIndex
CREATE INDEX "FloodlightVariable_sandboxId_idx" ON "FloodlightVariable"("sandboxId");

-- CreateIndex
CREATE UNIQUE INDEX "FloodlightVariable_groupId_key_key" ON "FloodlightVariable"("groupId", "key");

-- CreateIndex
CREATE INDEX "FloodlightAttributionModel_sandboxId_groupId_idx" ON "FloodlightAttributionModel"("sandboxId", "groupId");

-- CreateIndex
CREATE INDEX "ConversionGroup_sandboxId_groupId_idx" ON "ConversionGroup"("sandboxId", "groupId");

-- CreateIndex
CREATE UNIQUE INDEX "ConversionGroup_id_sandboxId_key" ON "ConversionGroup"("id", "sandboxId");

-- CreateIndex
CREATE INDEX "ConversionGroupActivity_sandboxId_idx" ON "ConversionGroupActivity"("sandboxId");

-- CreateIndex
CREATE UNIQUE INDEX "ConversionGroupActivity_conversionGroupId_activityId_key" ON "ConversionGroupActivity"("conversionGroupId", "activityId");

-- CreateIndex
CREATE UNIQUE INDEX "CustomBiddingAlgorithm_publicId_key" ON "CustomBiddingAlgorithm"("publicId");

-- CreateIndex
CREATE INDEX "CustomBiddingAlgorithm_sandboxId_advertiserId_idx" ON "CustomBiddingAlgorithm"("sandboxId", "advertiserId");

-- CreateIndex
CREATE INDEX "CustomBiddingAlgorithm_sandboxId_partnerId_idx" ON "CustomBiddingAlgorithm"("sandboxId", "partnerId");

-- CreateIndex
CREATE UNIQUE INDEX "CustomBiddingAlgorithm_id_sandboxId_key" ON "CustomBiddingAlgorithm"("id", "sandboxId");

-- CreateIndex
CREATE INDEX "CustomBiddingRule_sandboxId_algorithmId_ordinal_idx" ON "CustomBiddingRule"("sandboxId", "algorithmId", "ordinal");

-- CreateIndex
CREATE UNIQUE INDEX "CustomBiddingMultiplier_id_sandboxId_key" ON "CustomBiddingMultiplier"("id", "sandboxId");

-- CreateIndex
CREATE UNIQUE INDEX "CustomBiddingMultiplier_algorithmId_kind_key" ON "CustomBiddingMultiplier"("algorithmId", "kind");

-- CreateIndex
CREATE INDEX "CustomBiddingMultiplierValue_sandboxId_idx" ON "CustomBiddingMultiplierValue"("sandboxId");

-- CreateIndex
CREATE UNIQUE INDEX "CustomBiddingMultiplierValue_multiplierId_valueKey_key" ON "CustomBiddingMultiplierValue"("multiplierId", "valueKey");

-- CreateIndex
CREATE INDEX "CustomBiddingTestRun_sandboxId_algorithmId_ranAt_idx" ON "CustomBiddingTestRun"("sandboxId", "algorithmId", "ranAt");

-- CreateIndex
CREATE INDEX "CustomBiddingScript_sandboxId_idx" ON "CustomBiddingScript"("sandboxId");

-- CreateIndex
CREATE UNIQUE INDEX "CustomBiddingScript_algorithmId_version_key" ON "CustomBiddingScript"("algorithmId", "version");

-- CreateIndex
CREATE UNIQUE INDEX "Report_publicId_key" ON "Report"("publicId");

-- CreateIndex
CREATE INDEX "Report_sandboxId_ownerUserId_updatedAt_idx" ON "Report"("sandboxId", "ownerUserId", "updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Report_id_sandboxId_key" ON "Report"("id", "sandboxId");

-- CreateIndex
CREATE UNIQUE INDEX "ReportRun_publicId_key" ON "ReportRun"("publicId");

-- CreateIndex
CREATE INDEX "ReportRun_sandboxId_reportId_status_idx" ON "ReportRun"("sandboxId", "reportId", "status");

-- CreateIndex
CREATE INDEX "ReportShare_sandboxId_idx" ON "ReportShare"("sandboxId");

-- CreateIndex
CREATE UNIQUE INDEX "ReportShare_reportId_userId_key" ON "ReportShare"("reportId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "CrossMediaReachReport_publicId_key" ON "CrossMediaReachReport"("publicId");

-- CreateIndex
CREATE INDEX "CrossMediaReachReport_sandboxId_partnerId_idx" ON "CrossMediaReachReport"("sandboxId", "partnerId");

-- CreateIndex
CREATE UNIQUE INDEX "Plan_publicId_key" ON "Plan"("publicId");

-- CreateIndex
CREATE INDEX "Plan_sandboxId_advertiserId_status_idx" ON "Plan"("sandboxId", "advertiserId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Plan_id_sandboxId_key" ON "Plan"("id", "sandboxId");

-- CreateIndex
CREATE INDEX "PlanRow_sandboxId_idx" ON "PlanRow"("sandboxId");

-- CreateIndex
CREATE UNIQUE INDEX "PlanRow_planId_ordinal_key" ON "PlanRow"("planId", "ordinal");

-- CreateIndex
CREATE INDEX "PlanForecast_sandboxId_planId_asOf_idx" ON "PlanForecast"("sandboxId", "planId", "asOf");

-- CreateIndex
CREATE UNIQUE INDEX "Experiment_publicId_key" ON "Experiment"("publicId");

-- CreateIndex
CREATE INDEX "Experiment_sandboxId_advertiserId_status_idx" ON "Experiment"("sandboxId", "advertiserId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Experiment_id_sandboxId_key" ON "Experiment"("id", "sandboxId");

-- CreateIndex
CREATE INDEX "ExperimentArm_sandboxId_experimentId_ordinal_idx" ON "ExperimentArm"("sandboxId", "experimentId", "ordinal");

-- CreateIndex
CREATE UNIQUE INDEX "ExperimentArm_id_sandboxId_key" ON "ExperimentArm"("id", "sandboxId");

-- CreateIndex
CREATE INDEX "ExperimentArmEntity_sandboxId_armId_idx" ON "ExperimentArmEntity"("sandboxId", "armId");

-- CreateIndex
CREATE UNIQUE INDEX "ExperimentArmEntity_experimentId_ioId_key" ON "ExperimentArmEntity"("experimentId", "ioId");

-- CreateIndex
CREATE UNIQUE INDEX "ExperimentArmEntity_experimentId_lineItemId_key" ON "ExperimentArmEntity"("experimentId", "lineItemId");

-- CreateIndex
CREATE INDEX "ExperimentResult_sandboxId_experimentId_idx" ON "ExperimentResult"("sandboxId", "experimentId");

-- CreateIndex
CREATE UNIQUE INDEX "ExperimentResult_experimentId_armId_controlArmId_metric_con_key" ON "ExperimentResult"("experimentId", "armId", "controlArmId", "metric", "confidence", "rangeHash");

-- CreateIndex
CREATE UNIQUE INDEX "LiftStudy_publicId_key" ON "LiftStudy"("publicId");

-- CreateIndex
CREATE INDEX "LiftStudy_sandboxId_advertiserId_status_idx" ON "LiftStudy"("sandboxId", "advertiserId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "LiftStudy_id_sandboxId_key" ON "LiftStudy"("id", "sandboxId");

-- CreateIndex
CREATE INDEX "LiftStudyEntity_sandboxId_idx" ON "LiftStudyEntity"("sandboxId");

-- CreateIndex
CREATE UNIQUE INDEX "LiftStudyEntity_studyId_ioId_key" ON "LiftStudyEntity"("studyId", "ioId");

-- CreateIndex
CREATE UNIQUE INDEX "LiftFlight_id_sandboxId_key" ON "LiftFlight"("id", "sandboxId");

-- CreateIndex
CREATE UNIQUE INDEX "LiftFlight_studyId_liftType_number_key" ON "LiftFlight"("studyId", "liftType", "number");

-- CreateIndex
CREATE INDEX "LiftSearchTermGroup_sandboxId_idx" ON "LiftSearchTermGroup"("sandboxId");

-- CreateIndex
CREATE UNIQUE INDEX "LiftSearchTermGroup_studyId_ordinal_key" ON "LiftSearchTermGroup"("studyId", "ordinal");

-- CreateIndex
CREATE INDEX "LiftResult_sandboxId_idx" ON "LiftResult"("sandboxId");

-- CreateIndex
CREATE UNIQUE INDEX "LiftResult_flightId_scope_metric_slice_sliceValue_key" ON "LiftResult"("flightId", "scope", "metric", "slice", "sliceValue");

-- CreateIndex
CREATE UNIQUE INDEX "BulkJob_publicId_key" ON "BulkJob"("publicId");

-- CreateIndex
CREATE INDEX "BulkJob_sandboxId_requestedAt_idx" ON "BulkJob"("sandboxId", "requestedAt");

-- CreateIndex
CREATE INDEX "BulkJob_sandboxId_advertiserId_requestedAt_idx" ON "BulkJob"("sandboxId", "advertiserId", "requestedAt");

-- CreateIndex
CREATE UNIQUE INDEX "BulkJob_id_sandboxId_key" ON "BulkJob"("id", "sandboxId");

-- CreateIndex
CREATE INDEX "BulkJobItem_sandboxId_jobId_idx" ON "BulkJobItem"("sandboxId", "jobId");

-- CreateIndex
CREATE INDEX "SimConversionDaily_sandboxId_simDate_idx" ON "SimConversionDaily"("sandboxId", "simDate");

-- CreateIndex
CREATE UNIQUE INDEX "SimConversionDaily_lineItemId_activityId_simDate_conversion_key" ON "SimConversionDaily"("lineItemId", "activityId", "simDate", "conversionType", "lagBucket");

-- CreateIndex
CREATE INDEX "SimReachSnapshot_sandboxId_simDate_idx" ON "SimReachSnapshot"("sandboxId", "simDate");

-- CreateIndex
CREATE UNIQUE INDEX "SimReachSnapshot_scopeType_scopeId_simDate_windowDays_key" ON "SimReachSnapshot"("scopeType", "scopeId", "simDate", "windowDays");

-- CreateIndex
CREATE INDEX "SimPacingSnapshot_sandboxId_ioId_simDate_idx" ON "SimPacingSnapshot"("sandboxId", "ioId", "simDate");

-- CreateIndex
CREATE UNIQUE INDEX "SimPacingSnapshot_budgetSegmentId_simDate_key" ON "SimPacingSnapshot"("budgetSegmentId", "simDate");

-- CreateIndex
CREATE UNIQUE INDEX "SimTickLog_sandboxId_tickNo_key" ON "SimTickLog"("sandboxId", "tickNo");

-- AddForeignKey
ALTER TABLE "RolePermission" ADD CONSTRAINT "RolePermission_roleKey_fkey" FOREIGN KEY ("roleKey") REFERENCES "Role"("key") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RolePermission" ADD CONSTRAINT "RolePermission_permissionKey_fkey" FOREIGN KEY ("permissionKey") REFERENCES "Permission"("key") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScenarioStep" ADD CONSTRAINT "ScenarioStep_scenarioId_fkey" FOREIGN KEY ("scenarioId") REFERENCES "Scenario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScenarioSeedPatch" ADD CONSTRAINT "ScenarioSeedPatch_scenarioId_fkey" FOREIGN KEY ("scenarioId") REFERENCES "Scenario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScenarioEvent" ADD CONSTRAINT "ScenarioEvent_scenarioId_fkey" FOREIGN KEY ("scenarioId") REFERENCES "Scenario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScenarioAssignment" ADD CONSTRAINT "ScenarioAssignment_scenarioId_fkey" FOREIGN KEY ("scenarioId") REFERENCES "Scenario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScenarioAttempt" ADD CONSTRAINT "ScenarioAttempt_sandboxId_fkey" FOREIGN KEY ("sandboxId") REFERENCES "Sandbox"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScenarioAttempt" ADD CONSTRAINT "ScenarioAttempt_scenarioId_fkey" FOREIGN KEY ("scenarioId") REFERENCES "Scenario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScenarioCheckResult" ADD CONSTRAINT "ScenarioCheckResult_attemptId_sandboxId_fkey" FOREIGN KEY ("attemptId", "sandboxId") REFERENCES "ScenarioAttempt"("id", "sandboxId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScenarioCheckResult" ADD CONSTRAINT "ScenarioCheckResult_stepId_fkey" FOREIGN KEY ("stepId") REFERENCES "ScenarioStep"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationDismissal" ADD CONSTRAINT "NotificationDismissal_notificationId_fkey" FOREIGN KEY ("notificationId") REFERENCES "Notification"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartnerContact" ADD CONSTRAINT "PartnerContact_partnerId_sandboxId_fkey" FOREIGN KEY ("partnerId", "sandboxId") REFERENCES "Partner"("id", "sandboxId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartnerFeatureFlag" ADD CONSTRAINT "PartnerFeatureFlag_partnerId_sandboxId_fkey" FOREIGN KEY ("partnerId", "sandboxId") REFERENCES "Partner"("id", "sandboxId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartnerFeatureAdvertiser" ADD CONSTRAINT "PartnerFeatureAdvertiser_flagId_sandboxId_fkey" FOREIGN KEY ("flagId", "sandboxId") REFERENCES "PartnerFeatureFlag"("id", "sandboxId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartnerFeatureAdvertiser" ADD CONSTRAINT "PartnerFeatureAdvertiser_advertiserId_sandboxId_fkey" FOREIGN KEY ("advertiserId", "sandboxId") REFERENCES "Advertiser"("id", "sandboxId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillingProfile" ADD CONSTRAINT "BillingProfile_partnerId_sandboxId_fkey" FOREIGN KEY ("partnerId", "sandboxId") REFERENCES "Partner"("id", "sandboxId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_billingProfileId_sandboxId_fkey" FOREIGN KEY ("billingProfileId", "sandboxId") REFERENCES "BillingProfile"("id", "sandboxId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvoiceLine" ADD CONSTRAINT "InvoiceLine_invoiceId_sandboxId_fkey" FOREIGN KEY ("invoiceId", "sandboxId") REFERENCES "Invoice"("id", "sandboxId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvoiceLine" ADD CONSTRAINT "InvoiceLine_advertiserId_sandboxId_fkey" FOREIGN KEY ("advertiserId", "sandboxId") REFERENCES "Advertiser"("id", "sandboxId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ThirdPartyRateCard" ADD CONSTRAINT "ThirdPartyRateCard_partnerId_sandboxId_fkey" FOREIGN KEY ("partnerId", "sandboxId") REFERENCES "Partner"("id", "sandboxId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ThirdPartyRateCard" ADD CONSTRAINT "ThirdPartyRateCard_advertiserId_sandboxId_fkey" FOREIGN KEY ("advertiserId", "sandboxId") REFERENCES "Advertiser"("id", "sandboxId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdvertiserAlertPreference" ADD CONSTRAINT "AdvertiserAlertPreference_advertiserId_sandboxId_fkey" FOREIGN KEY ("advertiserId", "sandboxId") REFERENCES "Advertiser"("id", "sandboxId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LinkedAccount" ADD CONSTRAINT "LinkedAccount_advertiserId_sandboxId_fkey" FOREIGN KEY ("advertiserId", "sandboxId") REFERENCES "Advertiser"("id", "sandboxId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PolicyCertificate" ADD CONSTRAINT "PolicyCertificate_advertiserId_sandboxId_fkey" FOREIGN KEY ("advertiserId", "sandboxId") REFERENCES "Advertiser"("id", "sandboxId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdvertiserVendorSelection" ADD CONSTRAINT "AdvertiserVendorSelection_advertiserId_sandboxId_fkey" FOREIGN KEY ("advertiserId", "sandboxId") REFERENCES "Advertiser"("id", "sandboxId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "YoutubeAsset" ADD CONSTRAINT "YoutubeAsset_advertiserId_sandboxId_fkey" FOREIGN KEY ("advertiserId", "sandboxId") REFERENCES "Advertiser"("id", "sandboxId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HistoryNote" ADD CONSTRAINT "HistoryNote_advertiserId_sandboxId_fkey" FOREIGN KEY ("advertiserId", "sandboxId") REFERENCES "Advertiser"("id", "sandboxId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Recommendation" ADD CONSTRAINT "Recommendation_advertiserId_sandboxId_fkey" FOREIGN KEY ("advertiserId", "sandboxId") REFERENCES "Advertiser"("id", "sandboxId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Upload" ADD CONSTRAINT "Upload_sandboxId_fkey" FOREIGN KEY ("sandboxId") REFERENCES "Sandbox"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Workspace" ADD CONSTRAINT "Workspace_partnerId_sandboxId_fkey" FOREIGN KEY ("partnerId", "sandboxId") REFERENCES "Partner"("id", "sandboxId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkspaceShare" ADD CONSTRAINT "WorkspaceShare_workspaceId_sandboxId_fkey" FOREIGN KEY ("workspaceId", "sandboxId") REFERENCES "Workspace"("id", "sandboxId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PinnedItem" ADD CONSTRAINT "PinnedItem_partnerId_sandboxId_fkey" FOREIGN KEY ("partnerId", "sandboxId") REFERENCES "Partner"("id", "sandboxId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecentlyViewed" ADD CONSTRAINT "RecentlyViewed_partnerId_sandboxId_fkey" FOREIGN KEY ("partnerId", "sandboxId") REFERENCES "Partner"("id", "sandboxId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserPreference" ADD CONSTRAINT "UserPreference_sandboxId_fkey" FOREIGN KEY ("sandboxId") REFERENCES "Sandbox"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserEmailPreference" ADD CONSTRAINT "UserEmailPreference_sandboxId_fkey" FOREIGN KEY ("sandboxId") REFERENCES "Sandbox"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdvisorSession" ADD CONSTRAINT "AdvisorSession_sandboxId_fkey" FOREIGN KEY ("sandboxId") REFERENCES "Sandbox"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdvisorMessage" ADD CONSTRAINT "AdvisorMessage_sessionId_sandboxId_fkey" FOREIGN KEY ("sessionId", "sandboxId") REFERENCES "AdvisorSession"("id", "sandboxId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InboxMessage" ADD CONSTRAINT "InboxMessage_sandboxId_fkey" FOREIGN KEY ("sandboxId") REFERENCES "Sandbox"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SavedView" ADD CONSTRAINT "SavedView_advertiserId_sandboxId_fkey" FOREIGN KEY ("advertiserId", "sandboxId") REFERENCES "Advertiser"("id", "sandboxId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChartCard" ADD CONSTRAINT "ChartCard_advertiserId_sandboxId_fkey" FOREIGN KEY ("advertiserId", "sandboxId") REFERENCES "Advertiser"("id", "sandboxId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AudienceTagRule" ADD CONSTRAINT "AudienceTagRule_audienceId_sandboxId_fkey" FOREIGN KEY ("audienceId", "sandboxId") REFERENCES "Audience"("id", "sandboxId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AudienceSeed" ADD CONSTRAINT "AudienceSeed_audienceId_sandboxId_fkey" FOREIGN KEY ("audienceId", "sandboxId") REFERENCES "Audience"("id", "sandboxId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CombinedAudienceTerm" ADD CONSTRAINT "CombinedAudienceTerm_audienceId_sandboxId_fkey" FOREIGN KEY ("audienceId", "sandboxId") REFERENCES "Audience"("id", "sandboxId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomListEntry" ADD CONSTRAINT "CustomListEntry_audienceId_sandboxId_fkey" FOREIGN KEY ("audienceId", "sandboxId") REFERENCES "Audience"("id", "sandboxId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerMatchUpload" ADD CONSTRAINT "CustomerMatchUpload_audienceId_sandboxId_fkey" FOREIGN KEY ("audienceId", "sandboxId") REFERENCES "Audience"("id", "sandboxId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreativeRestriction" ADD CONSTRAINT "CreativeRestriction_creativeId_sandboxId_fkey" FOREIGN KEY ("creativeId", "sandboxId") REFERENCES "Creative"("id", "sandboxId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreativeUrl" ADD CONSTRAINT "CreativeUrl_creativeId_sandboxId_fkey" FOREIGN KEY ("creativeId", "sandboxId") REFERENCES "Creative"("id", "sandboxId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreativeAppeal" ADD CONSTRAINT "CreativeAppeal_creativeId_sandboxId_fkey" FOREIGN KEY ("creativeId", "sandboxId") REFERENCES "Creative"("id", "sandboxId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdSequenceStep" ADD CONSTRAINT "AdSequenceStep_adGroupId_sandboxId_fkey" FOREIGN KEY ("adGroupId", "sandboxId") REFERENCES "AdGroup"("id", "sandboxId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LineItemFloodlightActivity" ADD CONSTRAINT "LineItemFloodlightActivity_lineItemId_sandboxId_fkey" FOREIGN KEY ("lineItemId", "sandboxId") REFERENCES "LineItem"("id", "sandboxId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LineItemFloodlightActivity" ADD CONSTRAINT "LineItemFloodlightActivity_activityId_sandboxId_fkey" FOREIGN KEY ("activityId", "sandboxId") REFERENCES "FloodlightActivity"("id", "sandboxId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Channel" ADD CONSTRAINT "Channel_partnerId_sandboxId_fkey" FOREIGN KEY ("partnerId", "sandboxId") REFERENCES "Partner"("id", "sandboxId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Channel" ADD CONSTRAINT "Channel_advertiserId_sandboxId_fkey" FOREIGN KEY ("advertiserId", "sandboxId") REFERENCES "Advertiser"("id", "sandboxId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChannelEntry" ADD CONSTRAINT "ChannelEntry_channelId_sandboxId_fkey" FOREIGN KEY ("channelId", "sandboxId") REFERENCES "Channel"("id", "sandboxId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KeywordList" ADD CONSTRAINT "KeywordList_advertiserId_sandboxId_fkey" FOREIGN KEY ("advertiserId", "sandboxId") REFERENCES "Advertiser"("id", "sandboxId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KeywordListEntry" ADD CONSTRAINT "KeywordListEntry_keywordListId_sandboxId_fkey" FOREIGN KEY ("keywordListId", "sandboxId") REFERENCES "KeywordList"("id", "sandboxId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LocationList" ADD CONSTRAINT "LocationList_advertiserId_sandboxId_fkey" FOREIGN KEY ("advertiserId", "sandboxId") REFERENCES "Advertiser"("id", "sandboxId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LocationListEntry" ADD CONSTRAINT "LocationListEntry_locationListId_sandboxId_fkey" FOREIGN KEY ("locationListId", "sandboxId") REFERENCES "LocationList"("id", "sandboxId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryOrder" ADD CONSTRAINT "InventoryOrder_partnerId_sandboxId_fkey" FOREIGN KEY ("partnerId", "sandboxId") REFERENCES "Partner"("id", "sandboxId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventorySourceDeal" ADD CONSTRAINT "InventorySourceDeal_partnerId_sandboxId_fkey" FOREIGN KEY ("partnerId", "sandboxId") REFERENCES "Partner"("id", "sandboxId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventorySourceDeal" ADD CONSTRAINT "InventorySourceDeal_orderId_sandboxId_fkey" FOREIGN KEY ("orderId", "sandboxId") REFERENCES "InventoryOrder"("id", "sandboxId") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DealAccess" ADD CONSTRAINT "DealAccess_dealId_sandboxId_fkey" FOREIGN KEY ("dealId", "sandboxId") REFERENCES "InventorySourceDeal"("id", "sandboxId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DealAccess" ADD CONSTRAINT "DealAccess_partnerId_sandboxId_fkey" FOREIGN KEY ("partnerId", "sandboxId") REFERENCES "Partner"("id", "sandboxId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DealAccess" ADD CONSTRAINT "DealAccess_advertiserId_sandboxId_fkey" FOREIGN KEY ("advertiserId", "sandboxId") REFERENCES "Advertiser"("id", "sandboxId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryPackage" ADD CONSTRAINT "InventoryPackage_partnerId_sandboxId_fkey" FOREIGN KEY ("partnerId", "sandboxId") REFERENCES "Partner"("id", "sandboxId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DealGroup" ADD CONSTRAINT "DealGroup_partnerId_sandboxId_fkey" FOREIGN KEY ("partnerId", "sandboxId") REFERENCES "Partner"("id", "sandboxId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DealGroup" ADD CONSTRAINT "DealGroup_advertiserId_sandboxId_fkey" FOREIGN KEY ("advertiserId", "sandboxId") REFERENCES "Advertiser"("id", "sandboxId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DealGroupMember" ADD CONSTRAINT "DealGroupMember_groupId_sandboxId_fkey" FOREIGN KEY ("groupId", "sandboxId") REFERENCES "DealGroup"("id", "sandboxId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LineItemInventory" ADD CONSTRAINT "LineItemInventory_lineItemId_sandboxId_fkey" FOREIGN KEY ("lineItemId", "sandboxId") REFERENCES "LineItem"("id", "sandboxId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Negotiation" ADD CONSTRAINT "Negotiation_partnerId_sandboxId_fkey" FOREIGN KEY ("partnerId", "sandboxId") REFERENCES "Partner"("id", "sandboxId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Negotiation" ADD CONSTRAINT "Negotiation_advertiserId_sandboxId_fkey" FOREIGN KEY ("advertiserId", "sandboxId") REFERENCES "Advertiser"("id", "sandboxId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NegotiationMessage" ADD CONSTRAINT "NegotiationMessage_negotiationId_sandboxId_fkey" FOREIGN KEY ("negotiationId", "sandboxId") REFERENCES "Negotiation"("id", "sandboxId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FloodlightGroup" ADD CONSTRAINT "FloodlightGroup_advertiserId_sandboxId_fkey" FOREIGN KEY ("advertiserId", "sandboxId") REFERENCES "Advertiser"("id", "sandboxId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FloodlightActivity" ADD CONSTRAINT "FloodlightActivity_groupId_sandboxId_fkey" FOREIGN KEY ("groupId", "sandboxId") REFERENCES "FloodlightGroup"("id", "sandboxId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FloodlightVariable" ADD CONSTRAINT "FloodlightVariable_groupId_sandboxId_fkey" FOREIGN KEY ("groupId", "sandboxId") REFERENCES "FloodlightGroup"("id", "sandboxId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FloodlightAttributionModel" ADD CONSTRAINT "FloodlightAttributionModel_groupId_sandboxId_fkey" FOREIGN KEY ("groupId", "sandboxId") REFERENCES "FloodlightGroup"("id", "sandboxId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConversionGroup" ADD CONSTRAINT "ConversionGroup_groupId_sandboxId_fkey" FOREIGN KEY ("groupId", "sandboxId") REFERENCES "FloodlightGroup"("id", "sandboxId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConversionGroupActivity" ADD CONSTRAINT "ConversionGroupActivity_conversionGroupId_sandboxId_fkey" FOREIGN KEY ("conversionGroupId", "sandboxId") REFERENCES "ConversionGroup"("id", "sandboxId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConversionGroupActivity" ADD CONSTRAINT "ConversionGroupActivity_activityId_sandboxId_fkey" FOREIGN KEY ("activityId", "sandboxId") REFERENCES "FloodlightActivity"("id", "sandboxId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomBiddingAlgorithm" ADD CONSTRAINT "CustomBiddingAlgorithm_advertiserId_sandboxId_fkey" FOREIGN KEY ("advertiserId", "sandboxId") REFERENCES "Advertiser"("id", "sandboxId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomBiddingAlgorithm" ADD CONSTRAINT "CustomBiddingAlgorithm_partnerId_sandboxId_fkey" FOREIGN KEY ("partnerId", "sandboxId") REFERENCES "Partner"("id", "sandboxId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomBiddingRule" ADD CONSTRAINT "CustomBiddingRule_algorithmId_sandboxId_fkey" FOREIGN KEY ("algorithmId", "sandboxId") REFERENCES "CustomBiddingAlgorithm"("id", "sandboxId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomBiddingMultiplier" ADD CONSTRAINT "CustomBiddingMultiplier_algorithmId_sandboxId_fkey" FOREIGN KEY ("algorithmId", "sandboxId") REFERENCES "CustomBiddingAlgorithm"("id", "sandboxId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomBiddingMultiplierValue" ADD CONSTRAINT "CustomBiddingMultiplierValue_multiplierId_sandboxId_fkey" FOREIGN KEY ("multiplierId", "sandboxId") REFERENCES "CustomBiddingMultiplier"("id", "sandboxId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomBiddingTestRun" ADD CONSTRAINT "CustomBiddingTestRun_algorithmId_sandboxId_fkey" FOREIGN KEY ("algorithmId", "sandboxId") REFERENCES "CustomBiddingAlgorithm"("id", "sandboxId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomBiddingScript" ADD CONSTRAINT "CustomBiddingScript_algorithmId_sandboxId_fkey" FOREIGN KEY ("algorithmId", "sandboxId") REFERENCES "CustomBiddingAlgorithm"("id", "sandboxId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Report" ADD CONSTRAINT "Report_partnerId_sandboxId_fkey" FOREIGN KEY ("partnerId", "sandboxId") REFERENCES "Partner"("id", "sandboxId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Report" ADD CONSTRAINT "Report_advertiserId_sandboxId_fkey" FOREIGN KEY ("advertiserId", "sandboxId") REFERENCES "Advertiser"("id", "sandboxId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReportRun" ADD CONSTRAINT "ReportRun_reportId_sandboxId_fkey" FOREIGN KEY ("reportId", "sandboxId") REFERENCES "Report"("id", "sandboxId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReportShare" ADD CONSTRAINT "ReportShare_reportId_sandboxId_fkey" FOREIGN KEY ("reportId", "sandboxId") REFERENCES "Report"("id", "sandboxId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrossMediaReachReport" ADD CONSTRAINT "CrossMediaReachReport_partnerId_sandboxId_fkey" FOREIGN KEY ("partnerId", "sandboxId") REFERENCES "Partner"("id", "sandboxId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrossMediaReachReport" ADD CONSTRAINT "CrossMediaReachReport_advertiserId_sandboxId_fkey" FOREIGN KEY ("advertiserId", "sandboxId") REFERENCES "Advertiser"("id", "sandboxId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Plan" ADD CONSTRAINT "Plan_advertiserId_sandboxId_fkey" FOREIGN KEY ("advertiserId", "sandboxId") REFERENCES "Advertiser"("id", "sandboxId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanRow" ADD CONSTRAINT "PlanRow_planId_sandboxId_fkey" FOREIGN KEY ("planId", "sandboxId") REFERENCES "Plan"("id", "sandboxId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanForecast" ADD CONSTRAINT "PlanForecast_planId_sandboxId_fkey" FOREIGN KEY ("planId", "sandboxId") REFERENCES "Plan"("id", "sandboxId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Experiment" ADD CONSTRAINT "Experiment_advertiserId_sandboxId_fkey" FOREIGN KEY ("advertiserId", "sandboxId") REFERENCES "Advertiser"("id", "sandboxId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExperimentArm" ADD CONSTRAINT "ExperimentArm_experimentId_sandboxId_fkey" FOREIGN KEY ("experimentId", "sandboxId") REFERENCES "Experiment"("id", "sandboxId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExperimentArmEntity" ADD CONSTRAINT "ExperimentArmEntity_armId_sandboxId_fkey" FOREIGN KEY ("armId", "sandboxId") REFERENCES "ExperimentArm"("id", "sandboxId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExperimentResult" ADD CONSTRAINT "ExperimentResult_experimentId_sandboxId_fkey" FOREIGN KEY ("experimentId", "sandboxId") REFERENCES "Experiment"("id", "sandboxId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LiftStudy" ADD CONSTRAINT "LiftStudy_advertiserId_sandboxId_fkey" FOREIGN KEY ("advertiserId", "sandboxId") REFERENCES "Advertiser"("id", "sandboxId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LiftStudyEntity" ADD CONSTRAINT "LiftStudyEntity_studyId_sandboxId_fkey" FOREIGN KEY ("studyId", "sandboxId") REFERENCES "LiftStudy"("id", "sandboxId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LiftFlight" ADD CONSTRAINT "LiftFlight_studyId_sandboxId_fkey" FOREIGN KEY ("studyId", "sandboxId") REFERENCES "LiftStudy"("id", "sandboxId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LiftSearchTermGroup" ADD CONSTRAINT "LiftSearchTermGroup_studyId_sandboxId_fkey" FOREIGN KEY ("studyId", "sandboxId") REFERENCES "LiftStudy"("id", "sandboxId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LiftResult" ADD CONSTRAINT "LiftResult_flightId_sandboxId_fkey" FOREIGN KEY ("flightId", "sandboxId") REFERENCES "LiftFlight"("id", "sandboxId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BulkJob" ADD CONSTRAINT "BulkJob_advertiserId_sandboxId_fkey" FOREIGN KEY ("advertiserId", "sandboxId") REFERENCES "Advertiser"("id", "sandboxId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BulkJobItem" ADD CONSTRAINT "BulkJobItem_jobId_sandboxId_fkey" FOREIGN KEY ("jobId", "sandboxId") REFERENCES "BulkJob"("id", "sandboxId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SimConversionDaily" ADD CONSTRAINT "SimConversionDaily_lineItemId_sandboxId_fkey" FOREIGN KEY ("lineItemId", "sandboxId") REFERENCES "LineItem"("id", "sandboxId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SimConversionDaily" ADD CONSTRAINT "SimConversionDaily_activityId_sandboxId_fkey" FOREIGN KEY ("activityId", "sandboxId") REFERENCES "FloodlightActivity"("id", "sandboxId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SimReachSnapshot" ADD CONSTRAINT "SimReachSnapshot_sandboxId_fkey" FOREIGN KEY ("sandboxId") REFERENCES "Sandbox"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SimPacingSnapshot" ADD CONSTRAINT "SimPacingSnapshot_budgetSegmentId_sandboxId_fkey" FOREIGN KEY ("budgetSegmentId", "sandboxId") REFERENCES "BudgetSegment"("id", "sandboxId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SimTickLog" ADD CONSTRAINT "SimTickLog_sandboxId_fkey" FOREIGN KEY ("sandboxId") REFERENCES "Sandbox"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- >>> prisma/sql/70-extended-constraints.sql
-- P3-05c. Constraints Prisma cannot express, for the tables added in 0002_extended. Runs after the generated tables.

-- Exactly one owner column is set
ALTER TABLE "ThirdPartyRateCard" ADD CONSTRAINT "ThirdPartyRateCard_one_owner" CHECK (
  (("partnerId" IS NOT NULL)::int + ("advertiserId" IS NOT NULL)::int) = 1);
ALTER TABLE "Channel" ADD CONSTRAINT "Channel_one_owner" CHECK (
  (("partnerId" IS NOT NULL)::int + ("advertiserId" IS NOT NULL)::int) = 1);
ALTER TABLE "DealGroup" ADD CONSTRAINT "DealGroup_one_owner" CHECK (
  (("partnerId" IS NOT NULL)::int + ("advertiserId" IS NOT NULL)::int) = 1);
ALTER TABLE "ExperimentArmEntity" ADD CONSTRAINT "ExperimentArmEntity_one_entity" CHECK (
  (("ioId" IS NOT NULL)::int + ("lineItemId" IS NOT NULL)::int) = 1);

-- At least one owner column is set
ALTER TABLE "CustomBiddingAlgorithm" ADD CONSTRAINT "CustomBiddingAlgorithm_has_owner" CHECK (
  "partnerId" IS NOT NULL OR "advertiserId" IS NOT NULL);
ALTER TABLE "DealAccess" ADD CONSTRAINT "DealAccess_has_owner" CHECK (
  "partnerId" IS NOT NULL OR "advertiserId" IS NOT NULL);

-- Value ranges from the field tables
ALTER TABLE "ExperimentArm" ADD CONSTRAINT "ExperimentArm_split_range" CHECK ("splitPct" BETWEEN 0 AND 100);
ALTER TABLE "FloodlightGroup" ADD CONSTRAINT "FloodlightGroup_viewable_range" CHECK ("viewableImpressionPct" BETWEEN 0 AND 100);
ALTER TABLE "Scenario" ADD CONSTRAINT "Scenario_difficulty_range" CHECK ("difficulty" BETWEEN 1 AND 5);

-- >>> prisma/sql/80-extended-rls.sql
-- P3-05c. GENERATED by `npx tsx prisma/sql/generate-extended-rls.ts` from prisma/schema/70..89 (every model with a "sandboxId" column).
-- A test regenerates this text and fails if it differs.
SELECT app_enable_tenant_rls('AdSequenceStep');
SELECT app_enable_tenant_rls('AdvertiserAlertPreference');
SELECT app_enable_tenant_rls('AdvertiserVendorSelection');
SELECT app_enable_tenant_rls('AdvisorMessage');
SELECT app_enable_tenant_rls('AdvisorSession');
SELECT app_enable_tenant_rls('AudienceSeed');
SELECT app_enable_tenant_rls('AudienceTagRule');
SELECT app_enable_tenant_rls('BillingProfile');
SELECT app_enable_tenant_rls('BulkJob');
SELECT app_enable_tenant_rls('BulkJobItem');
SELECT app_enable_tenant_rls('Channel');
SELECT app_enable_tenant_rls('ChannelEntry');
SELECT app_enable_tenant_rls('ChartCard');
SELECT app_enable_tenant_rls('CombinedAudienceTerm');
SELECT app_enable_tenant_rls('ConversionGroup');
SELECT app_enable_tenant_rls('ConversionGroupActivity');
SELECT app_enable_tenant_rls('CreativeAppeal');
SELECT app_enable_tenant_rls('CreativeRestriction');
SELECT app_enable_tenant_rls('CreativeUrl');
SELECT app_enable_tenant_rls('CrossMediaReachReport');
SELECT app_enable_tenant_rls('CustomBiddingAlgorithm');
SELECT app_enable_tenant_rls('CustomBiddingMultiplier');
SELECT app_enable_tenant_rls('CustomBiddingMultiplierValue');
SELECT app_enable_tenant_rls('CustomBiddingRule');
SELECT app_enable_tenant_rls('CustomBiddingScript');
SELECT app_enable_tenant_rls('CustomBiddingTestRun');
SELECT app_enable_tenant_rls('CustomListEntry');
SELECT app_enable_tenant_rls('CustomerMatchUpload');
SELECT app_enable_tenant_rls('DealAccess');
SELECT app_enable_tenant_rls('DealGroup');
SELECT app_enable_tenant_rls('DealGroupMember');
SELECT app_enable_tenant_rls('Experiment');
SELECT app_enable_tenant_rls('ExperimentArm');
SELECT app_enable_tenant_rls('ExperimentArmEntity');
SELECT app_enable_tenant_rls('ExperimentResult');
SELECT app_enable_tenant_rls('FloodlightActivity');
SELECT app_enable_tenant_rls('FloodlightAttributionModel');
SELECT app_enable_tenant_rls('FloodlightGroup');
SELECT app_enable_tenant_rls('FloodlightVariable');
SELECT app_enable_tenant_rls('HistoryNote');
SELECT app_enable_tenant_rls('InboxMessage');
SELECT app_enable_tenant_rls('InventoryOrder');
SELECT app_enable_tenant_rls('InventoryPackage');
SELECT app_enable_tenant_rls('InventorySourceDeal');
SELECT app_enable_tenant_rls('Invoice');
SELECT app_enable_tenant_rls('InvoiceLine');
SELECT app_enable_tenant_rls('KeywordList');
SELECT app_enable_tenant_rls('KeywordListEntry');
SELECT app_enable_tenant_rls('LiftFlight');
SELECT app_enable_tenant_rls('LiftResult');
SELECT app_enable_tenant_rls('LiftSearchTermGroup');
SELECT app_enable_tenant_rls('LiftStudy');
SELECT app_enable_tenant_rls('LiftStudyEntity');
SELECT app_enable_tenant_rls('LineItemFloodlightActivity');
SELECT app_enable_tenant_rls('LineItemInventory');
SELECT app_enable_tenant_rls('LinkedAccount');
SELECT app_enable_tenant_rls('LocationList');
SELECT app_enable_tenant_rls('LocationListEntry');
SELECT app_enable_tenant_rls('Negotiation');
SELECT app_enable_tenant_rls('NegotiationMessage');
SELECT app_enable_tenant_rls('PartnerContact');
SELECT app_enable_tenant_rls('PartnerFeatureAdvertiser');
SELECT app_enable_tenant_rls('PartnerFeatureFlag');
SELECT app_enable_tenant_rls('PinnedItem');
SELECT app_enable_tenant_rls('Plan');
SELECT app_enable_tenant_rls('PlanForecast');
SELECT app_enable_tenant_rls('PlanRow');
SELECT app_enable_tenant_rls('PolicyCertificate');
SELECT app_enable_tenant_rls('RecentlyViewed');
SELECT app_enable_tenant_rls('Recommendation');
SELECT app_enable_tenant_rls('Report');
SELECT app_enable_tenant_rls('ReportRun');
SELECT app_enable_tenant_rls('ReportShare');
SELECT app_enable_tenant_rls('SavedView');
SELECT app_enable_tenant_rls('ScenarioAttempt');
SELECT app_enable_tenant_rls('ScenarioCheckResult');
SELECT app_enable_tenant_rls('SimConversionDaily');
SELECT app_enable_tenant_rls('SimPacingSnapshot');
SELECT app_enable_tenant_rls('SimReachSnapshot');
SELECT app_enable_tenant_rls('SimTickLog');
SELECT app_enable_tenant_rls('ThirdPartyRateCard');
SELECT app_enable_tenant_rls('Upload');
SELECT app_enable_tenant_rls('UserEmailPreference');
SELECT app_enable_tenant_rls('UserPreference');
SELECT app_enable_tenant_rls('Workspace');
SELECT app_enable_tenant_rls('WorkspaceShare');
SELECT app_enable_tenant_rls('YoutubeAsset');

-- >>> prisma/sql/90-extended-grants.sql
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
