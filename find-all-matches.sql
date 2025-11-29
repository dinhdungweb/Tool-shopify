-- Find ALL Shopify customers that could match phone 0358259084
-- Including phone, defaultAddressPhone, and note

SELECT 
    id,
    "firstName",
    "lastName",
    email,
    phone,
    "defaultAddressPhone",
    CASE 
        WHEN note LIKE '%0358259084%' THEN 'YES'
        ELSE 'NO'
    END as phone_in_note,
    "createdAt"
FROM shopify_customers
WHERE phone IN ('0358259084', '84358259084')
   OR "defaultAddressPhone" IN ('0358259084', '84358259084')
   OR note LIKE '%0358259084%'
   OR note LIKE '%84358259084%'
ORDER BY "createdAt" DESC;

-- Count total
SELECT COUNT(*) as total_matches
FROM shopify_customers
WHERE phone IN ('0358259084', '84358259084')
   OR "defaultAddressPhone" IN ('0358259084', '84358259084')
   OR note LIKE '%0358259084%'
   OR note LIKE '%84358259084%';
