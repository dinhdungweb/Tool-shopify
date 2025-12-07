-- CreateEnum
CREATE TYPE "RuleTargetType" AS ENUM ('PRODUCT', 'CUSTOMER', 'ALL');

-- AlterEnum
ALTER TYPE "SyncAction" ADD VALUE 'RULE_TRIGGERED';

-- AlterEnum
ALTER TYPE "SyncStatus" ADD VALUE 'PENDING_APPROVAL';

-- CreateTable
CREATE TABLE "location_mappings" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "nhanhDepotId" TEXT NOT NULL,
    "nhanhDepotName" TEXT NOT NULL,
    "shopifyLocationId" TEXT NOT NULL,
    "shopifyLocationName" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "location_mappings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sync_rules" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "targetType" "RuleTargetType" NOT NULL DEFAULT 'PRODUCT',
    "conditions" JSONB NOT NULL,
    "conditionOperator" TEXT NOT NULL DEFAULT 'AND',
    "actions" JSONB NOT NULL,
    "triggerCount" INTEGER NOT NULL DEFAULT 0,
    "lastTriggered" TIMESTAMP(3),

    CONSTRAINT "sync_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sync_rule_logs" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ruleId" TEXT NOT NULL,
    "mappingId" TEXT,
    "mappingType" TEXT,
    "triggered" BOOLEAN NOT NULL,
    "actionsExecuted" JSONB,
    "result" TEXT,
    "message" TEXT,

    CONSTRAINT "sync_rule_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "location_mappings_nhanhDepotId_shopifyLocationId_key" ON "location_mappings"("nhanhDepotId", "shopifyLocationId");

-- CreateIndex
CREATE INDEX "sync_rules_enabled_idx" ON "sync_rules"("enabled");

-- CreateIndex
CREATE INDEX "sync_rules_priority_idx" ON "sync_rules"("priority");

-- CreateIndex
CREATE INDEX "sync_rules_targetType_idx" ON "sync_rules"("targetType");

-- CreateIndex
CREATE INDEX "sync_rule_logs_ruleId_idx" ON "sync_rule_logs"("ruleId");

-- CreateIndex
CREATE INDEX "sync_rule_logs_createdAt_idx" ON "sync_rule_logs"("createdAt");

-- CreateIndex
CREATE INDEX "sync_rule_logs_mappingType_idx" ON "sync_rule_logs"("mappingType");

-- AddForeignKey
ALTER TABLE "sync_rule_logs" ADD CONSTRAINT "sync_rule_logs_ruleId_fkey" FOREIGN KEY ("ruleId") REFERENCES "sync_rules"("id") ON DELETE CASCADE ON UPDATE CASCADE;
