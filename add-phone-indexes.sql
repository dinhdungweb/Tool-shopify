-- Add indexes for faster phone matching
-- Run this if auto-match is slow

-- Index on Nhanh customer phone
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_nhanh_customers_phone_not_null 
ON nhanh_customers(phone) WHERE phone IS NOT NULL AND phone != '';

-- Index on Shopify customer phones
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_shopify_customers_phone_not_null 
ON shopify_customers(phone) WHERE phone IS NOT NULL AND phone != '';

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_shopify_customers_default_address_phone 
ON shopify_customers("defaultAddressPhone") WHERE "defaultAddressPhone" IS NOT NULL AND "defaultAddressPhone" != '';

-- Index on customer mappings for faster lookup
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_customer_mappings_nhanh_customer_id 
ON customer_mappings("nhanhCustomerId");

-- Show index status
SELECT 
    schemaname,
    tablename,
    indexname,
    indexdef
FROM pg_indexes
WHERE tablename IN ('nhanh_customers', 'shopify_customers', 'customer_mappings')
ORDER BY tablename, indexname;
