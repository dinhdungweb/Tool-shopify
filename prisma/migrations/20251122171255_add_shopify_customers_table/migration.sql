/*
  Warnings:

  - You are about to drop the column `shopifyCustomerNote` on the `customer_mappings` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "customer_mappings" DROP COLUMN "shopifyCustomerNote";

-- CreateTable
CREATE TABLE "shopify_customers" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "email" TEXT,
    "firstName" TEXT,
    "lastName" TEXT,
    "phone" TEXT,
    "totalSpent" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "ordersCount" INTEGER NOT NULL DEFAULT 0,
    "lastPulledAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "shopify_customers_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "shopify_customers_phone_idx" ON "shopify_customers"("phone");

-- CreateIndex
CREATE INDEX "shopify_customers_email_idx" ON "shopify_customers"("email");
