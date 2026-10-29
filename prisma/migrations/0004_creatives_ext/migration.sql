-- P4-01. Creative extension table (module 12 3.2). Additive: one table, composite foreign key to "Creative", RLS.

-- CreateTable
CREATE TABLE "CreativeExt" (
    "id" TEXT NOT NULL,
    "sandboxId" TEXT NOT NULL,
    "creativeId" TEXT NOT NULL,
    "skippable" BOOLEAN NOT NULL DEFAULT false,
    "skipOffsetSec" INTEGER,
    "nativeFields" JSONB,
    "youtubeVideoId" TEXT,
    "thumbnailAssetId" TEXT,
    "reviewRequestedAt" TIMESTAMP(3),
    "dv360DecideAt" TIMESTAMP(3),
    "plannedVerdict" TEXT,
    "plannedReason" TEXT,

    CONSTRAINT "CreativeExt_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CreativeExt_creativeId_key" ON "CreativeExt"("creativeId");

-- AddForeignKey
ALTER TABLE "CreativeExt" ADD CONSTRAINT "CreativeExt_creativeId_sandboxId_fkey" FOREIGN KEY ("creativeId", "sandboxId") REFERENCES "Creative"("id", "sandboxId") ON DELETE CASCADE ON UPDATE CASCADE;

-- Row level security (app_enable_tenant_rls comes from 0001_core)
SELECT app_enable_tenant_rls('CreativeExt');
