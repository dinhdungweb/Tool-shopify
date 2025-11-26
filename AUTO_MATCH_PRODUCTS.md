# Auto-Match Products Feature

## Overview
Automatically match products between Nhanh.vn and Shopify using SKU matching with SQL JOIN optimization.

## How It Works

### Matching Strategy
1. **SKU Matching**: Products are matched by SKU (case-insensitive, trimmed)
2. **1-to-1 Matching**: Only exact 1-to-1 matches are created (one Nhanh product → one Shopify product)
3. **SQL Optimization**: Uses raw SQL with JOIN for ultra-fast matching

### SQL Query
```sql
SELECT 
  np.id as nhanh_id,
  np.name as nhanh_name,
  np.sku as nhanh_sku,
  sp.id as shopify_id,
  sp.title as shopify_title,
  sp.sku as shopify_sku
FROM nhanh_products np
LEFT JOIN product_mappings pm ON pm."nhanhProductId" = np.id
INNER JOIN shopify_products sp ON (
  LOWER(TRIM(np.sku)) = LOWER(TRIM(sp.sku))
  AND np.sku IS NOT NULL 
  AND sp.sku IS NOT NULL
  AND TRIM(np.sku) != ''
  AND TRIM(sp.sku) != ''
)
WHERE pm.id IS NULL  -- Not yet mapped
```

## Usage

### From UI
1. Go to Products Sync page
2. Click "More Actions" dropdown
3. Click "Auto Match by SKU"
4. Confirm the action
5. View results showing:
   - Total matches found
   - Exact 1-to-1 matches created
   - Skipped (duplicate matches)
   - Duration

### From API
```bash
# Auto-match products
curl -X POST http://localhost:3000/api/sync/auto-match-products \
  -H "Content-Type: application/json" \
  -d '{"dryRun": false}'

# Dry run (preview without creating mappings)
curl -X POST http://localhost:3000/api/sync/auto-match-products \
  -H "Content-Type: application/json" \
  -d '{"dryRun": true}'
```

## Performance

### Optimization Techniques
1. **SQL JOIN**: Direct database join instead of fetching all records
2. **Bulk Insert**: Insert 500 mappings per batch
3. **Duplicate Filtering**: Filter 1-to-1 matches in memory

### Benchmarks
- **Small dataset** (< 1,000 products): ~0.5-1 second
- **Medium dataset** (1,000-10,000 products): ~1-3 seconds
- **Large dataset** (10,000-100,000 products): ~3-10 seconds

## Matching Rules

### Included
✅ Exact SKU match (case-insensitive)
✅ Trimmed whitespace
✅ Not yet mapped products
✅ 1-to-1 matches only

### Excluded
❌ Products without SKU
❌ Empty SKU
❌ Already mapped products
❌ Duplicate matches (1 Nhanh → multiple Shopify or vice versa)

## Example Results

### Success Case
```json
{
  "success": true,
  "data": {
    "total": 150,
    "matched": 120,
    "skipped": 30,
    "failed": 0,
    "duration": "2.5s",
    "method": "SQL JOIN by SKU",
    "message": "Auto-match completed in 2.5s: 120 products matched by SKU",
    "details": [
      {
        "nhanhProduct": {
          "id": "123",
          "name": "Product A",
          "sku": "SKU-001"
        },
        "shopifyProduct": {
          "id": "456",
          "title": "Product A",
          "sku": "SKU-001"
        },
        "status": "matched"
      }
    ]
  }
}
```

### Skipped Cases
Products are skipped when:
1. **Multiple Shopify matches**: One Nhanh SKU matches multiple Shopify products
2. **Multiple Nhanh matches**: One Shopify SKU matches multiple Nhanh products
3. **Ambiguous matches**: Cannot determine correct pairing

## After Auto-Match

### Next Steps
1. **Review Mappings**: Check the mapped products in the UI
2. **Sync Inventory**: Click "Sync" button to sync inventory from Nhanh to Shopify
3. **Manual Mapping**: Map remaining unmapped products manually

### Sync Status
After auto-match, all mappings have status:
- `PENDING`: Ready to sync, but not yet synced

## Troubleshooting

### No Matches Found
**Possible reasons:**
- SKUs don't match between Nhanh and Shopify
- Products already mapped
- SKUs are empty or null
- Case/whitespace differences (should be handled automatically)

**Solutions:**
1. Check SKU format in both systems
2. Ensure products are pulled from both Nhanh and Shopify
3. Verify SKU field is populated

### Fewer Matches Than Expected
**Possible reasons:**
- Duplicate SKUs in either system
- Some products already mapped

**Solutions:**
1. Check for duplicate SKUs: `SELECT sku, COUNT(*) FROM shopify_products GROUP BY sku HAVING COUNT(*) > 1`
2. Review skipped matches in the result details

### Performance Issues
**If auto-match is slow:**
1. Ensure database indexes exist on SKU columns
2. Check database connection
3. Consider running during off-peak hours

## Database Schema

### Product Mappings Table
```sql
CREATE TABLE product_mappings (
  id TEXT PRIMARY KEY,
  "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMP NOT NULL,
  
  -- Nhanh Product
  "nhanhProductId" TEXT UNIQUE NOT NULL,
  "nhanhProductName" TEXT NOT NULL,
  "nhanhSku" TEXT,
  "nhanhBarcode" TEXT,
  "nhanhPrice" DECIMAL(15,2) DEFAULT 0,
  
  -- Shopify Product
  "shopifyProductId" TEXT,
  "shopifyVariantId" TEXT,
  "shopifyProductTitle" TEXT,
  "shopifySku" TEXT,
  "shopifyBarcode" TEXT,
  
  -- Sync Status
  "syncStatus" TEXT DEFAULT 'PENDING',
  "lastSyncedAt" TIMESTAMP,
  "syncError" TEXT,
  "syncAttempts" INTEGER DEFAULT 0
);

CREATE INDEX idx_product_mappings_nhanh ON product_mappings("nhanhProductId");
CREATE INDEX idx_product_mappings_shopify ON product_mappings("shopifyProductId");
CREATE INDEX idx_product_mappings_sync_status ON product_mappings("syncStatus");
```

## API Endpoints

### POST /api/sync/auto-match-products
Auto-match products by SKU

**Request:**
```json
{
  "dryRun": false  // true for preview only
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "total": 150,
    "matched": 120,
    "skipped": 30,
    "failed": 0,
    "dryRun": false,
    "duration": "2.5s",
    "method": "SQL JOIN by SKU",
    "message": "Auto-match completed in 2.5s: 120 products matched by SKU",
    "details": [...]
  }
}
```

## Related Features

- **Pull Shopify Products**: `/api/shopify/pull-products-sync`
- **Pull Nhanh Products**: `/api/nhanh/pull-products`
- **Manual Mapping**: Click "Map" button in UI
- **Sync Inventory**: `/api/sync/sync-product`

## Best Practices

1. **Pull products first**: Ensure both Nhanh and Shopify products are pulled before auto-matching
2. **Review results**: Check the matched products before syncing
3. **Handle skipped**: Manually map products that were skipped
4. **Regular sync**: Run auto-match periodically for new products
5. **Monitor performance**: Check duration and optimize if needed

## Future Enhancements

Potential improvements:
- Match by barcode as fallback
- Fuzzy matching for similar SKUs
- Batch auto-match scheduling
- Email notifications for results
- Match confidence scoring
