-- CreateEnum
CREATE TYPE "SyncStatus" AS ENUM ('UNMAPPED', 'PENDING', 'SYNCED', 'FAILED');

-- CreateEnum
CREATE TYPE "SyncAction" AS ENUM ('MANUAL_MAPPING', 'MANUAL_SYNC', 'AUTO_SYNC', 'WEBHOOK_SYNC', 'BULK_SYNC');

-- CreateTable
CREATE TABLE "nhanh_customers" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "email" TEXT,
    "totalSpent" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "address" TEXT,
    "city" TEXT,
    "district" TEXT,
    "ward" TEXT,
    "lastPulledAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "nhanh_customers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customer_mappings" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "nhanhCustomerId" TEXT NOT NULL,
    "nhanhCustomerName" TEXT NOT NULL,
    "nhanhCustomerPhone" TEXT,
    "nhanhCustomerEmail" TEXT,
    "nhanhTotalSpent" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "shopifyCustomerId" TEXT,
    "shopifyCustomerEmail" TEXT,
    "shopifyCustomerName" TEXT,
    "syncStatus" "SyncStatus" NOT NULL DEFAULT 'UNMAPPED',
    "lastSyncedAt" TIMESTAMP(3),
    "syncError" TEXT,
    "syncAttempts" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "customer_mappings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sync_logs" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "mappingId" TEXT NOT NULL,
    "action" "SyncAction" NOT NULL,
    "status" "SyncStatus" NOT NULL,
    "message" TEXT,
    "errorDetail" TEXT,
    "metadata" JSONB,

    CONSTRAINT "sync_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "webhook_logs" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "source" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "processed" BOOLEAN NOT NULL DEFAULT false,
    "processedAt" TIMESTAMP(3),
    "error" TEXT,

    CONSTRAINT "webhook_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "nhanh_customers_name_idx" ON "nhanh_customers"("name");

-- CreateIndex
CREATE INDEX "nhanh_customers_phone_idx" ON "nhanh_customers"("phone");

-- CreateIndex
CREATE INDEX "nhanh_customers_email_idx" ON "nhanh_customers"("email");

-- CreateIndex
CREATE UNIQUE INDEX "customer_mappings_nhanhCustomerId_key" ON "customer_mappings"("nhanhCustomerId");

-- CreateIndex
CREATE INDEX "customer_mappings_nhanhCustomerId_idx" ON "customer_mappings"("nhanhCustomerId");

-- CreateIndex
CREATE INDEX "customer_mappings_shopifyCustomerId_idx" ON "customer_mappings"("shopifyCustomerId");

-- CreateIndex
CREATE INDEX "customer_mappings_syncStatus_idx" ON "customer_mappings"("syncStatus");

-- CreateIndex
CREATE INDEX "sync_logs_mappingId_idx" ON "sync_logs"("mappingId");

-- CreateIndex
CREATE INDEX "sync_logs_createdAt_idx" ON "sync_logs"("createdAt");

-- CreateIndex
CREATE INDEX "webhook_logs_source_idx" ON "webhook_logs"("source");

-- CreateIndex
CREATE INDEX "webhook_logs_processed_idx" ON "webhook_logs"("processed");

-- CreateIndex
CREATE INDEX "webhook_logs_createdAt_idx" ON "webhook_logs"("createdAt");

-- AddForeignKey
ALTER TABLE "customer_mappings" ADD CONSTRAINT "customer_mappings_nhanhCustomerId_fkey" FOREIGN KEY ("nhanhCustomerId") REFERENCES "nhanh_customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sync_logs" ADD CONSTRAINT "sync_logs_mappingId_fkey" FOREIGN KEY ("mappingId") REFERENCES "customer_mappings"("id") ON DELETE CASCADE ON UPDATE CASCADE;
