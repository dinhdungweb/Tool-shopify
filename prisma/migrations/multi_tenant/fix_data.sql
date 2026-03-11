-- Fix duplicate storeId+type in sync_schedules before unique constraint
-- Keep only one row per storeId+type combination
DELETE FROM sync_schedules a USING sync_schedules b 
WHERE a.ctid < b.ctid 
AND a."storeId" = b."storeId" 
AND a.type = b.type;

-- Also fix PullProgress: ensure unique storeId+type
-- First update type based on id pattern
UPDATE pull_progress SET "type" = CASE 
  WHEN "id" LIKE '%product%' THEN 'products' 
  ELSE 'customers' 
END;

-- Remove duplicates from pull_progress
DELETE FROM pull_progress a USING pull_progress b 
WHERE a.ctid < b.ctid 
AND a."storeId" = b."storeId" 
AND a."type" = b."type";

-- Fix NhanhCustomer: old rows use id as primary key, nhanhId should be same as id
-- for existing data (already done in main migration, but make sure NOT NULL)
UPDATE nhanh_customers SET "nhanhId" = "id" WHERE "nhanhId" IS NULL;
UPDATE nhanh_products SET "nhanhId" = "id" WHERE "nhanhId" IS NULL;
UPDATE shopify_customers SET "shopifyId" = "id" WHERE "shopifyId" IS NULL;
UPDATE shopify_products SET "shopifyId" = "id" WHERE "shopifyId" IS NULL;

-- Set storeId NOT NULL where still null
UPDATE nhanh_customers SET "storeId" = 'default_store' WHERE "storeId" IS NULL;
UPDATE shopify_customers SET "storeId" = 'default_store' WHERE "storeId" IS NULL;
UPDATE customer_mappings SET "storeId" = 'default_store' WHERE "storeId" IS NULL;
UPDATE sync_logs SET "storeId" = 'default_store' WHERE "storeId" IS NULL;
UPDATE nhanh_products SET "storeId" = 'default_store' WHERE "storeId" IS NULL;
UPDATE shopify_products SET "storeId" = 'default_store' WHERE "storeId" IS NULL;
UPDATE product_mappings SET "storeId" = 'default_store' WHERE "storeId" IS NULL;
UPDATE product_sync_logs SET "storeId" = 'default_store' WHERE "storeId" IS NULL;
UPDATE webhook_logs SET "storeId" = 'default_store' WHERE "storeId" IS NULL;
UPDATE background_jobs SET "storeId" = 'default_store' WHERE "storeId" IS NULL;
UPDATE sale_campaigns SET "storeId" = 'default_store' WHERE "storeId" IS NULL;
UPDATE location_mappings SET "storeId" = 'default_store' WHERE "storeId" IS NULL;
UPDATE sync_rules SET "storeId" = 'default_store' WHERE "storeId" IS NULL;
UPDATE point_expiration_schedules SET "storeId" = 'default_store' WHERE "storeId" IS NULL;
UPDATE auto_sync_config SET "storeId" = 'default_store' WHERE "storeId" IS NULL;
UPDATE sync_schedules SET "storeId" = 'default_store' WHERE "storeId" IS NULL;
UPDATE pull_progress SET "storeId" = 'default_store' WHERE "storeId" IS NULL;

-- Fix auto_sync_config: old id was 'global', need unique storeId
-- Remove duplicate storeId entries
DELETE FROM auto_sync_config a USING auto_sync_config b 
WHERE a.ctid < b.ctid 
AND a."storeId" = b."storeId";

-- Remove location_mappings duplicate constraint issue
-- Drop the old unique constraint if exists
ALTER TABLE location_mappings DROP CONSTRAINT IF EXISTS "location_mappings_nhanhDepotId_shopifyLocationId_key";
