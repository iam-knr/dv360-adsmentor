-- P3-08b. Engine runtime tables (engine.md 1.7). Additive: two enums, two tables, foreign keys to "Sandbox", RLS.

-- CreateEnum
CREATE TYPE "SimJobKind" AS ENUM ('FAST_FORWARD', 'RESET');

-- CreateEnum
CREATE TYPE "SimJobStatus" AS ENUM ('QUEUED', 'RUNNING', 'DONE', 'FAILED', 'CANCELLED');

-- CreateTable
CREATE TABLE "SimState" (
    "id" TEXT NOT NULL,
    "sandboxId" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "nextTick" BIGINT NOT NULL DEFAULT 0,
    "data" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SimState_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SimJob" (
    "id" TEXT NOT NULL,
    "sandboxId" TEXT NOT NULL,
    "kind" "SimJobKind" NOT NULL,
    "status" "SimJobStatus" NOT NULL DEFAULT 'QUEUED',
    "params" JSONB NOT NULL,
    "progress" JSONB,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),

    CONSTRAINT "SimJob_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SimState_sandboxId_scope_entityId_key" ON "SimState"("sandboxId", "scope", "entityId");

-- CreateIndex
CREATE INDEX "SimJob_sandboxId_status_idx" ON "SimJob"("sandboxId", "status");

-- AddForeignKey
ALTER TABLE "SimState" ADD CONSTRAINT "SimState_sandboxId_fkey" FOREIGN KEY ("sandboxId") REFERENCES "Sandbox"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SimJob" ADD CONSTRAINT "SimJob_sandboxId_fkey" FOREIGN KEY ("sandboxId") REFERENCES "Sandbox"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Row level security (app_enable_tenant_rls comes from 0001_core)
SELECT app_enable_tenant_rls('SimState');
SELECT app_enable_tenant_rls('SimJob');
