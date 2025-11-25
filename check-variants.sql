-- Check how many products and unique titles
SELECT 
  COUNT(*) as total_records,
  COUNT(DISTINCT title) as unique_titles,
  COUNT(DISTINCT "variantId") as unique_variants
FROM shopify_products;

-- Check if we have products with variant titles
SELECT 
  id,
  title,
  sku,
  "variantId",
  "inventoryQuantity"
FROM shopify_products
ORDER BY title
LIMIT 20;

-- Check for products with " - " in title (indicating variant)
SELECT COUNT(*) as products_with_variant_title
FROM shopify_products
WHERE title LIKE '% - %';
