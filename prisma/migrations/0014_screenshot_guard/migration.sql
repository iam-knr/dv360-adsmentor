-- Screenshot guard: per student switch, suspension state and the Super admin's event list. Additive only.
ALTER TABLE "User"
  ADD COLUMN "screenshotsAllowed" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "accessSuspendedAt" TIMESTAMP(3),
  ADD COLUMN "accessSuspendedReason" TEXT,
  ADD COLUMN "accessSuspendedMethod" TEXT,
  ADD COLUMN "accessSuspendedPath" TEXT,
  ADD COLUMN "accessSuspendedById" TEXT;

CREATE TABLE "SecurityEvent" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'SCREENSHOT',
    "method" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "seenAt" TIMESTAMP(3),
    "restoredAt" TIMESTAMP(3),
    "restoredById" TEXT,

    CONSTRAINT "SecurityEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "SecurityEvent_restoredAt_occurredAt_idx" ON "SecurityEvent"("restoredAt", "occurredAt");
CREATE INDEX "SecurityEvent_userId_occurredAt_idx" ON "SecurityEvent"("userId", "occurredAt");

ALTER TABLE "SecurityEvent" ADD CONSTRAINT "SecurityEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
