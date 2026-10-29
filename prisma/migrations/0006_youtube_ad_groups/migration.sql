-- P4-06. YouTube module deltas (module 09 3.3: Δ-09-1 target frequency, Δ-09-6 ad trackers, Δ-09-8 ad review plan,
-- 4.6 Demand Gen image ads). Additive: nullable columns only; the video of an ad becomes optional.

-- AlterTable
ALTER TABLE "LineItem" ADD COLUMN "targetFreqExposures" INTEGER,
ADD COLUMN "targetFreqUnit" "FrequencyUnit",
ADD COLUMN "targetFreqUnitCount" INTEGER;

-- AlterTable
ALTER TABLE "Ad" ADD COLUMN "impressionTrackerUrl" TEXT,
ADD COLUMN "urlSuffix" TEXT,
ADD COLUMN "reviewDecideAt" TIMESTAMP(3),
ADD COLUMN "plannedVerdict" "AdReviewStatus";

-- AlterTable
ALTER TABLE "Ad" ALTER COLUMN "youtubeVideoId" DROP NOT NULL,
ADD COLUMN "imageAssetIds" TEXT[];
