-- AlterEnum
ALTER TYPE "SyncAction" ADD VALUE 'INVENTORY_UPDATE';

-- AlterTable
ALTER TABLE "customer_mappings" ALTER COLUMN "nhanhTotalSpent" SET DATA TYPE DECIMAL(18,2);

-- AlterTable
ALTER TABLE "nhanh_customers" ALTER COLUMN "totalSpent" SET DATA TYPE DECIMAL(18,2);

-- AlterTable
ALTER TABLE "pull_progress" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "shopify_customers" ADD COLUMN     "note" TEXT,
ALTER COLUMN "totalSpent" SET DATA TYPE DECIMAL(18,2);

-- CreateTable
CREATE TABLE "nhanh_products" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "name" TEXT NOT NULL,
    "sku" TEXT,
    "barcode" TEXT,
    "price" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "comparePrice" DECIMAL(15,2),
    "quantity" INTEGER NOT NULL DEFAULT 0,
    "categoryId" TEXT,
    "categoryName" TEXT,
    "brandId" TEXT,
    "brandName" TEXT,
    "description" TEXT,
    "images" JSONB,
    "lastPulledAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "nhanh_products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shopify_products" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "title" TEXT NOT NULL,
    "handle" TEXT,
    "productType" TEXT,
    "vendor" TEXT,
    "tags" TEXT[],
    "variantId" TEXT,
    "sku" TEXT,
    "barcode" TEXT,
    "price" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "compareAtPrice" DECIMAL(15,2),
    "inventoryQuantity" INTEGER NOT NULL DEFAULT 0,
    "images" JSONB,
    "lastPulledAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "shopify_products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_mappings" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "nhanhProductId" TEXT NOT NULL,
    "nhanhProductName" TEXT NOT NULL,
    "nhanhSku" TEXT,
    "nhanhBarcode" TEXT,
    "nhanhPrice" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "shopifyProductId" TEXT,
    "shopifyVariantId" TEXT,
    "shopifyProductTitle" TEXT,
    "shopifySku" TEXT,
    "shopifyBarcode" TEXT,
    "syncStatus" "SyncStatus" NOT NULL DEFAULT 'UNMAPPED',
    "lastSyncedAt" TIMESTAMP(3),
    "syncError" TEXT,
    "syncAttempts" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "product_mappings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_sync_logs" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "mappingId" TEXT NOT NULL,
    "action" "SyncAction" NOT NULL,
    "status" "SyncStatus" NOT NULL,
    "message" TEXT,
    "errorDetail" TEXT,
    "metadata" JSONB,

    CONSTRAINT "product_sync_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sync_schedules" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "schedule" TEXT NOT NULL,
    "type" TEXT NOT NULL,

    CONSTRAINT "sync_schedules_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "nhanh_products_name_idx" ON "nhanh_products"("name");

-- CreateIndex
CREATE INDEX "nhanh_products_sku_idx" ON "nhanh_products"("sku");

-- CreateIndex
CREATE INDEX "nhanh_products_barcode_idx" ON "nhanh_products"("barcode");

-- CreateIndex
CREATE INDEX "nhanh_products_lastPulledAt_idx" ON "nhanh_products"("lastPulledAt");

-- CreateIndex
CREATE INDEX "shopify_products_title_idx" ON "shopify_products"("title");

-- CreateIndex
CREATE INDEX "shopify_products_sku_idx" ON "shopify_products"("sku");

-- CreateIndex
CREATE INDEX "shopify_products_barcode_idx" ON "shopify_products"("barcode");

-- CreateIndex
CREATE INDEX "shopify_products_lastPulledAt_idx" ON "shopify_products"("lastPulledAt");

-- CreateIndex
CREATE UNIQUE INDEX "product_mappings_nhanhProductId_key" ON "product_mappings"("nhanhProductId");

-- CreateIndex
CREATE INDEX "product_mappings_nhanhProductId_idx" ON "product_mappings"("nhanhProductId");

-- CreateIndex
CREATE INDEX "product_mappings_shopifyProductId_idx" ON "product_mappings"("shopifyProductId");

-- CreateIndex
CREATE INDEX "product_mappings_syncStatus_idx" ON "product_mappings"("syncStatus");

-- CreateIndex
CREATE INDEX "product_sync_logs_mappingId_idx" ON "product_sync_logs"("mappingId");

-- CreateIndex
CREATE INDEX "product_sync_logs_createdAt_idx" ON "product_sync_logs"("createdAt");

-- CreateIndex
CREATE INDEX "nhanh_customers_totalSpent_idx" ON "nhanh_customers"("totalSpent");

-- CreateIndex
CREATE INDEX "nhanh_customers_lastPulledAt_idx" ON "nhanh_customers"("lastPulledAt");

-- AddForeignKey
ALTER TABLE "product_mappings" ADD CONSTRAINT "product_mappings_nhanhProductId_fkey" FOREIGN KEY ("nhanhProductId") REFERENCES "nhanh_products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_sync_logs" ADD CONSTRAINT "product_sync_logs_mappingId_fkey" FOREIGN KEY ("mappingId") REFERENCES "product_mappings"("id") ON DELETE CASCADE ON UPDATE CASCADE;
