-- Debug why phone 0358259084 is not matched

-- 1. Check Nhanh customers
SELECT '=== NHANH CUSTOMERS ===' as section;
SELECT id, name, phone, email,
       CASE WHEN EXISTS (SELECT 1 FROM customer_mappings WHERE "nhanhCustomerId" = nhanh_customers.id) 
            THEN 'MAPPED' 
            ELSE 'NOT MAPPED' 
       END as mapping_status
FROM nhanh_customers
WHERE phone IN ('0358259084', '84358259084', '358259084')
   OR phone LIKE '%358259084%';

-- 2. Check Shopify customers
SELECT '=== SHOPIFY CUSTOMERS ===' as section;
SELECT id, "firstName", "lastName", phone, "defaultAddressPhone", email
FROM shopify_customers
WHERE phone IN ('0358259084', '84358259084', '358259084')
   OR "defaultAddressPhone" IN ('0358259084', '84358259084', '358259084')
   OR phone LIKE '%358259084%'
   OR "defaultAddressPhone" LIKE '%358259084%';

-- 3. Check if mapping exists
SELECT '=== EXISTING MAPPINGS ===' as section;
SELECT id, "nhanhCustomerName", "nhanhCustomerPhone", "shopifyCustomerName", "syncStatus"
FROM customer_mappings
WHERE "nhanhCustomerPhone" IN ('0358259084', '84358259084', '358259084')
   OR "nhanhCustomerPhone" LIKE '%358259084%';

-- 4. Count duplicates
SELECT '=== DUPLICATE CHECK ===' as section;
SELECT 
    'Nhanh' as source,
    COUNT(*) as count
FROM nhanh_customers
WHERE phone IN ('0358259084', '84358259084', '358259084')
UNION ALL
SELECT 
    'Shopify' as source,
    COUNT(*) as count
FROM shopify_customers
WHERE phone IN ('0358259084', '84358259084', '358259084')
   OR "defaultAddressPhone" IN ('0358259084', '84358259084', '358259084');
