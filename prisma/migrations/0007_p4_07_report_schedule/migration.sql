-- P4-07 reporting: idempotent scheduled runs (one run per report and sim occurrence) and a skipped-run counter.
ALTER TABLE "Report" ADD COLUMN "scheduleSkipped" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "ReportRun" ADD COLUMN "occurrenceSimAt" TIMESTAMP(3);
CREATE UNIQUE INDEX "ReportRun_reportId_occurrenceSimAt_key" ON "ReportRun"("reportId", "occurrenceSimAt");
