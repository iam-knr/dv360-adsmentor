-- P4-03 audiences (module 14 deltas 14-4, 14-5, 14-10, 14-12): customer match data source, consent flag, external
-- source id and the lookalike expansion factor.
ALTER TABLE "Audience" ADD COLUMN "dataSource" "AudienceDataSource";
ALTER TABLE "Audience" ADD COLUMN "connectedProductKey" TEXT;
ALTER TABLE "Audience" ADD COLUMN "consentAck" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Audience" ADD COLUMN "sourceExternalId" TEXT;
ALTER TABLE "Audience" ADD COLUMN "reachExpansion" DECIMAL(6,2);
