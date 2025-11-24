-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "CampaignStatus" ADD VALUE 'APPLYING';
ALTER TYPE "CampaignStatus" ADD VALUE 'REVERTING';

-- AlterTable
ALTER TABLE "price_changes" ADD COLUMN     "originalCompareAtPrice" DECIMAL(10,2);

-- AlterTable
ALTER TABLE "sale_campaigns" ADD COLUMN     "collectionTitle" TEXT;
