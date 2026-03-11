-- Migration: Convert single-tenant to multi-tenant
-- This migration creates new multi-tenant tables, migrates existing data, and drops old tables.

-- Step 1: Create new enum types
DO $$ BEGIN
  CREATE TYPE "UserRole" AS ENUM ('SUPER_ADMIN', 'USER');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "OrgRole" AS ENUM ('OWNER', 'ADMIN', 'MEMBER');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Step 2: Create core multi-tenant tables
CREATE TABLE IF NOT EXISTS "organizations" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "organizations_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "organizations_slug_key" ON "organizations"("slug");

CREATE TABLE IF NOT EXISTS "store_connections" (
  "id" TEXT NOT NULL,
  "orgId" TEXT NOT NULL,
  "name" TEXT NOT NULL DEFAULT 'Default Store',
  "shopifyStoreUrl" TEXT,
  "shopifyAccessToken" TEXT,
  "nhanhApiUrl" TEXT,
  "nhanhAppId" TEXT,
  "nhanhBusinessId" TEXT,
  "nhanhAccessToken" TEXT,
  "webhookSecret" TEXT NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "store_connections_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "store_connections_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "store_connections_webhookSecret_key" ON "store_connections"("webhookSecret");
CREATE INDEX IF NOT EXISTS "store_connections_orgId_idx" ON "store_connections"("orgId");

CREATE TABLE IF NOT EXISTS "org_members" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "orgId" TEXT NOT NULL,
  "role" "OrgRole" NOT NULL DEFAULT 'OWNER',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "org_members_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "org_members_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "org_members_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "org_members_userId_orgId_key" ON "org_members"("userId", "orgId");

-- Step 3: Add new columns to User table
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "role" "UserRole" NOT NULL DEFAULT 'USER';
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "activeStoreId" TEXT;

-- Step 4: Create default organization and store from existing settings
-- This uses DO block to reference existing settings data
DO $$
DECLARE
  v_org_id TEXT := 'default_org';
  v_store_id TEXT := 'default_store';
  v_user_id TEXT;
  v_shopify_url TEXT;
  v_shopify_token TEXT;
  v_nhanh_url TEXT;
  v_nhanh_app TEXT;
  v_nhanh_biz TEXT;
  v_nhanh_token TEXT;
BEGIN
  -- Get existing credentials from settings
  SELECT value INTO v_shopify_url FROM settings WHERE key = 'SHOPIFY_STORE_URL' LIMIT 1;
  SELECT value INTO v_shopify_token FROM settings WHERE key = 'SHOPIFY_ACCESS_TOKEN' LIMIT 1;
  SELECT value INTO v_nhanh_url FROM settings WHERE key = 'NHANH_API_URL' LIMIT 1;
  SELECT value INTO v_nhanh_app FROM settings WHERE key = 'NHANH_APP_ID' LIMIT 1;
  SELECT value INTO v_nhanh_biz FROM settings WHERE key = 'NHANH_BUSINESS_ID' LIMIT 1;
  SELECT value INTO v_nhanh_token FROM settings WHERE key = 'NHANH_ACCESS_TOKEN' LIMIT 1;

  -- Create default organization
  INSERT INTO "organizations" ("id", "name", "slug", "createdAt", "updatedAt")
  VALUES (v_org_id, 'Default Organization', 'default', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
  ON CONFLICT ("id") DO NOTHING;

  -- Create default store connection with existing credentials
  INSERT INTO "store_connections" ("id", "orgId", "name", "shopifyStoreUrl", "shopifyAccessToken", "nhanhApiUrl", "nhanhAppId", "nhanhBusinessId", "nhanhAccessToken", "webhookSecret", "createdAt", "updatedAt")
  VALUES (v_store_id, v_org_id, 'Default Store', v_shopify_url, v_shopify_token, v_nhanh_url, v_nhanh_app, v_nhanh_biz, v_nhanh_token, 'webhook_' || v_store_id, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
  ON CONFLICT ("id") DO NOTHING;

  -- Make first user the org owner + SUPER_ADMIN
  SELECT id INTO v_user_id FROM users ORDER BY "createdAt" ASC LIMIT 1;
  IF v_user_id IS NOT NULL THEN
    INSERT INTO "org_members" ("id", "userId", "orgId", "role", "createdAt", "updatedAt")
    VALUES ('default_member', v_user_id, v_org_id, 'OWNER', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    ON CONFLICT ("userId", "orgId") DO NOTHING;

    UPDATE "users" SET "role" = 'SUPER_ADMIN', "activeStoreId" = v_store_id WHERE "id" = v_user_id;
  END IF;
END $$;

-- Step 5: Add storeId columns to existing tables
-- Note: We add them as NULLABLE first, populate data, then make NOT NULL where needed

-- Customer tables
ALTER TABLE "nhanh_customers" ADD COLUMN IF NOT EXISTS "storeId" TEXT;
ALTER TABLE "nhanh_customers" ADD COLUMN IF NOT EXISTS "nhanhId" TEXT;
UPDATE "nhanh_customers" SET "storeId" = 'default_store', "nhanhId" = "id" WHERE "storeId" IS NULL;

ALTER TABLE "shopify_customers" ADD COLUMN IF NOT EXISTS "storeId" TEXT;
ALTER TABLE "shopify_customers" ADD COLUMN IF NOT EXISTS "shopifyId" TEXT;
UPDATE "shopify_customers" SET "storeId" = 'default_store', "shopifyId" = "id" WHERE "storeId" IS NULL;

ALTER TABLE "customer_mappings" ADD COLUMN IF NOT EXISTS "storeId" TEXT;
UPDATE "customer_mappings" SET "storeId" = 'default_store' WHERE "storeId" IS NULL;

ALTER TABLE "sync_logs" ADD COLUMN IF NOT EXISTS "storeId" TEXT;
UPDATE "sync_logs" SET "storeId" = 'default_store' WHERE "storeId" IS NULL;

-- Product tables
ALTER TABLE "nhanh_products" ADD COLUMN IF NOT EXISTS "storeId" TEXT;
ALTER TABLE "nhanh_products" ADD COLUMN IF NOT EXISTS "nhanhId" TEXT;
UPDATE "nhanh_products" SET "storeId" = 'default_store', "nhanhId" = "id" WHERE "storeId" IS NULL;

ALTER TABLE "shopify_products" ADD COLUMN IF NOT EXISTS "storeId" TEXT;
ALTER TABLE "shopify_products" ADD COLUMN IF NOT EXISTS "shopifyId" TEXT;
UPDATE "shopify_products" SET "storeId" = 'default_store', "shopifyId" = "id" WHERE "storeId" IS NULL;

ALTER TABLE "product_mappings" ADD COLUMN IF NOT EXISTS "storeId" TEXT;
UPDATE "product_mappings" SET "storeId" = 'default_store' WHERE "storeId" IS NULL;

ALTER TABLE "product_sync_logs" ADD COLUMN IF NOT EXISTS "storeId" TEXT;
UPDATE "product_sync_logs" SET "storeId" = 'default_store' WHERE "storeId" IS NULL;

-- Operational tables
ALTER TABLE "webhook_logs" ADD COLUMN IF NOT EXISTS "storeId" TEXT;
UPDATE "webhook_logs" SET "storeId" = 'default_store' WHERE "storeId" IS NULL;

ALTER TABLE "background_jobs" ADD COLUMN IF NOT EXISTS "storeId" TEXT;
UPDATE "background_jobs" SET "storeId" = 'default_store' WHERE "storeId" IS NULL;

ALTER TABLE "sale_campaigns" ADD COLUMN IF NOT EXISTS "storeId" TEXT;
UPDATE "sale_campaigns" SET "storeId" = 'default_store' WHERE "storeId" IS NULL;

ALTER TABLE "location_mappings" ADD COLUMN IF NOT EXISTS "storeId" TEXT;
UPDATE "location_mappings" SET "storeId" = 'default_store' WHERE "storeId" IS NULL;

ALTER TABLE "sync_rules" ADD COLUMN IF NOT EXISTS "storeId" TEXT;
UPDATE "sync_rules" SET "storeId" = 'default_store' WHERE "storeId" IS NULL;

ALTER TABLE "point_expiration_schedules" ADD COLUMN IF NOT EXISTS "storeId" TEXT;
UPDATE "point_expiration_schedules" SET "storeId" = 'default_store' WHERE "storeId" IS NULL;

-- Config tables: migrate AutoSyncConfig
ALTER TABLE "auto_sync_config" ADD COLUMN IF NOT EXISTS "storeId" TEXT;
UPDATE "auto_sync_config" SET "storeId" = 'default_store' WHERE "storeId" IS NULL;

-- Config tables: migrate SyncSchedule
ALTER TABLE "sync_schedules" ADD COLUMN IF NOT EXISTS "storeId" TEXT;
UPDATE "sync_schedules" SET "storeId" = 'default_store' WHERE "storeId" IS NULL;

-- Config tables: migrate PullProgress
ALTER TABLE "pull_progress" ADD COLUMN IF NOT EXISTS "storeId" TEXT;
ALTER TABLE "pull_progress" ADD COLUMN IF NOT EXISTS "type" TEXT DEFAULT 'customers';
UPDATE "pull_progress" SET "storeId" = 'default_store' WHERE "storeId" IS NULL;
UPDATE "pull_progress" SET "type" = CASE 
  WHEN "id" LIKE '%product%' THEN 'products' 
  ELSE 'customers' 
END WHERE "type" IS NULL OR "type" = 'customers';

-- Step 6: Add storeId indexes
CREATE INDEX IF NOT EXISTS "nhanh_customers_storeId_idx" ON "nhanh_customers"("storeId");
CREATE INDEX IF NOT EXISTS "shopify_customers_storeId_idx" ON "shopify_customers"("storeId");
CREATE INDEX IF NOT EXISTS "customer_mappings_storeId_idx" ON "customer_mappings"("storeId");
CREATE INDEX IF NOT EXISTS "sync_logs_storeId_idx" ON "sync_logs"("storeId");
CREATE INDEX IF NOT EXISTS "nhanh_products_storeId_idx" ON "nhanh_products"("storeId");
CREATE INDEX IF NOT EXISTS "shopify_products_storeId_idx" ON "shopify_products"("storeId");
CREATE INDEX IF NOT EXISTS "product_mappings_storeId_idx" ON "product_mappings"("storeId");
CREATE INDEX IF NOT EXISTS "product_sync_logs_storeId_idx" ON "product_sync_logs"("storeId");
CREATE INDEX IF NOT EXISTS "webhook_logs_storeId_idx" ON "webhook_logs"("storeId");
CREATE INDEX IF NOT EXISTS "background_jobs_storeId_idx" ON "background_jobs"("storeId");
CREATE INDEX IF NOT EXISTS "sale_campaigns_storeId_idx" ON "sale_campaigns"("storeId");
CREATE INDEX IF NOT EXISTS "location_mappings_storeId_idx" ON "location_mappings"("storeId");
CREATE INDEX IF NOT EXISTS "sync_rules_storeId_idx" ON "sync_rules"("storeId");
CREATE INDEX IF NOT EXISTS "point_expiration_schedules_storeId_idx" ON "point_expiration_schedules"("storeId");

-- Step 7: Log migration completion
DO $$
BEGIN
  RAISE NOTICE 'Multi-tenant migration completed successfully!';
  RAISE NOTICE 'Default org: default_org, Default store: default_store';
END $$;
