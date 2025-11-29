-- Check if Shopify customer has defaultAddressPhone in database

SELECT 
    id,
    "firstName",
    "lastName", 
    phone,
    "defaultAddressPhone",
    email,
    "lastPulledAt"
FROM shopify_customers
WHERE id = 'gid://shopify/Customer/6966281797853'
   OR email = 'phambahung73@gmail.com'
   OR "firstName" LIKE '%Phạm%'
   OR "lastName" LIKE '%Hùng%';

-- Also check if any customer has this phone in defaultAddressPhone
SELECT 
    COUNT(*) as total_with_default_phone,
    COUNT(CASE WHEN "defaultAddressPhone" IS NOT NULL AND "defaultAddressPhone" != '' THEN 1 END) as has_default_phone
FROM shopify_customers;
