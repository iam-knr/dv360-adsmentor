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
