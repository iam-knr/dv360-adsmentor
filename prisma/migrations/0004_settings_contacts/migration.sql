-- P4-09. Sandbox-local colleagues for the DV360 Users page (RC-016) and two nullable Advertiser columns (DELTA-03-3).
-- Additive: two tables, two columns, foreign keys, RLS.

-- AlterTable (DELTA-03-3: restore the status when a scheduled deletion is cancelled)
ALTER TABLE "Advertiser" ADD COLUMN "previousStatus" "EntityStatus",
ADD COLUMN "deletionCancelledAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "SandboxContact" (
    "id" TEXT NOT NULL,
    "sandboxId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SandboxContact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SandboxContactGrant" (
    "id" TEXT NOT NULL,
    "sandboxId" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "partnerId" TEXT,
    "advertiserId" TEXT,
    "role" "DvRole" NOT NULL,

    CONSTRAINT "SandboxContactGrant_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SandboxContact_sandboxId_email_key" ON "SandboxContact"("sandboxId", "email");

-- CreateIndex
CREATE UNIQUE INDEX "SandboxContactGrant_contactId_partnerId_advertiserId_key" ON "SandboxContactGrant"("contactId", "partnerId", "advertiserId");

-- CreateIndex
CREATE INDEX "SandboxContactGrant_sandboxId_idx" ON "SandboxContactGrant"("sandboxId");

-- AddForeignKey
ALTER TABLE "SandboxContact" ADD CONSTRAINT "SandboxContact_sandboxId_fkey" FOREIGN KEY ("sandboxId") REFERENCES "Sandbox"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SandboxContactGrant" ADD CONSTRAINT "SandboxContactGrant_sandboxId_fkey" FOREIGN KEY ("sandboxId") REFERENCES "Sandbox"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SandboxContactGrant" ADD CONSTRAINT "SandboxContactGrant_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "SandboxContact"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Row level security (app_enable_tenant_rls comes from 0001_core)
SELECT app_enable_tenant_rls('SandboxContact');
SELECT app_enable_tenant_rls('SandboxContactGrant');
