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
