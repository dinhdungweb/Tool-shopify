-- Search for phone number 0908663055 in all tables

-- Search in Nhanh customers
SELECT 'NHANH CUSTOMERS' as source, id, name, phone, email
FROM nhanh_customers
WHERE phone IN ('0908663055', '84908663055', '908663055')
   OR phone LIKE '%908663055%';

-- Search in Shopify customers
SELECT 'SHOPIFY CUSTOMERS' as source, id, "firstName", "lastName", phone, "defaultAddressPhone", email
FROM shopify_customers
WHERE phone IN ('0908663055', '84908663055', '908663055')
   OR "defaultAddressPhone" IN ('0908663055', '84908663055', '908663055')
   OR phone LIKE '%908663055%'
   OR "defaultAddressPhone" LIKE '%908663055%'
   OR note LIKE '%0908663055%';

-- Search in customer mappings
SELECT 'CUSTOMER MAPPINGS' as source, 
       id, 
       "nhanhCustomerName", 
       "nhanhCustomerPhone",
       "shopifyCustomerName",
       "shopifyCustomerEmail",
       "syncStatus"
FROM customer_mappings
WHERE "nhanhCustomerPhone" IN ('0908663055', '84908663055', '908663055')
   OR "nhanhCustomerPhone" LIKE '%908663055%';
