-- AlterTable
ALTER TABLE "shopify_customers" ADD COLUMN     "defaultAddressPhone" TEXT;

-- CreateIndex
CREATE INDEX "shopify_customers_defaultAddressPhone_idx" ON "shopify_customers"("defaultAddressPhone");
