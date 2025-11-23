-- CreateEnum
CREATE TYPE "CampaignStatus" AS ENUM ('DRAFT', 'SCHEDULED', 'ACTIVE', 'COMPLETED', 'CANCELLED', 'FAILED');

-- CreateEnum
CREATE TYPE "DiscountType" AS ENUM ('PERCENTAGE', 'FIXED_AMOUNT');

-- CreateEnum
CREATE TYPE "TargetType" AS ENUM ('PRODUCT', 'COLLECTION', 'PRODUCT_TYPE', 'ALL');

-- CreateEnum
CREATE TYPE "ScheduleType" AS ENUM ('IMMEDIATE', 'SCHEDULED');

-- CreateTable
CREATE TABLE "sale_campaigns" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "status" "CampaignStatus" NOT NULL DEFAULT 'DRAFT',
    "discountType" "DiscountType" NOT NULL,
    "discountValue" DECIMAL(10,2) NOT NULL,
    "targetType" "TargetType" NOT NULL,
    "targetIds" TEXT[],
    "productType" TEXT,
    "scheduleType" "ScheduleType" NOT NULL DEFAULT 'IMMEDIATE',
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "appliedAt" TIMESTAMP(3),
    "revertedAt" TIMESTAMP(3),
    "affectedCount" INTEGER NOT NULL DEFAULT 0,
    "errorMessage" TEXT,

    CONSTRAINT "sale_campaigns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "price_changes" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "campaignId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "variantId" TEXT NOT NULL,
    "productTitle" TEXT NOT NULL,
    "variantTitle" TEXT,
    "sku" TEXT,
    "originalPrice" DECIMAL(10,2) NOT NULL,
    "salePrice" DECIMAL(10,2) NOT NULL,
    "currentPrice" DECIMAL(10,2) NOT NULL,
    "applied" BOOLEAN NOT NULL DEFAULT false,
    "appliedAt" TIMESTAMP(3),
    "reverted" BOOLEAN NOT NULL DEFAULT false,
    "revertedAt" TIMESTAMP(3),
    "error" TEXT,

    CONSTRAINT "price_changes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "sale_campaigns_status_idx" ON "sale_campaigns"("status");

-- CreateIndex
CREATE INDEX "sale_campaigns_scheduleType_idx" ON "sale_campaigns"("scheduleType");

-- CreateIndex
CREATE INDEX "sale_campaigns_startDate_idx" ON "sale_campaigns"("startDate");

-- CreateIndex
CREATE INDEX "sale_campaigns_endDate_idx" ON "sale_campaigns"("endDate");

-- CreateIndex
CREATE INDEX "price_changes_campaignId_idx" ON "price_changes"("campaignId");

-- CreateIndex
CREATE INDEX "price_changes_productId_idx" ON "price_changes"("productId");

-- CreateIndex
CREATE INDEX "price_changes_variantId_idx" ON "price_changes"("variantId");

-- CreateIndex
CREATE INDEX "price_changes_applied_idx" ON "price_changes"("applied");

-- CreateIndex
CREATE INDEX "price_changes_reverted_idx" ON "price_changes"("reverted");

-- AddForeignKey
ALTER TABLE "price_changes" ADD CONSTRAINT "price_changes_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "sale_campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;
