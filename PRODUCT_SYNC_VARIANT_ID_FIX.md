# Product Sync Variant ID Fix

## Problem
UI hiển thị products đã mapped, nhưng khi ấn sync lại báo lỗi:
```
Failed to sync: Shopify product not mapped
```

## Root Cause
Trong database có **365 product mappings** có `shopifyProductId` nhưng **KHÔNG CÓ** `shopifyVariantId`.

API endpoint `/api/sync/sync-product` yêu cầu **CẢ HAI** fields:
```typescript
if (!mapping.shopifyProductId || !mapping.shopifyVariantId) {
  return NextResponse.json({
    success: false,
    error: "Shopify product not mapped",
  }, { status: 400 });
}
```

## Why This Happened
1. Trong Shopify, mỗi variant được lưu như một product riêng trong database
2. Khi pull products từ Shopify, `variantId` được lưu đúng
3. Nhưng khi tạo mapping, có thể `product.variantId` từ UI bị undefined
4. Dẫn đến `shopifyVariantId` trong mapping bị NULL

## Solution

### 1. Fixed Existing Data (365 mappings)
Chạy script `fix-missing-variant-ids.js` để cập nhật:
```javascript
// Set shopifyVariantId = shopifyProductId
// (Vì trong hệ thống, mỗi variant là 1 product riêng)
await prisma.productMapping.update({
  where: { id: mapping.id },
  data: {
    shopifyVariantId: mapping.shopifyProductId,
  },
});
```

**Result:** ✅ Fixed 365 mappings successfully

### 2. Fixed Code to Prevent Future Issues
Updated `ProductMappingModal.tsx`:
```typescript
shopifyVariantId: product.variantId || product.id, // Fallback to product.id
```

## Verification
```bash
node check-variant-id.js
```

Output:
```
⚠️  Mappings with shopifyProductId but NO shopifyVariantId: 0
```

## Testing
1. Refresh trang Product Sync
2. Chọn một product đã mapped
3. Click "Sync" button
4. Kết quả: ✅ Sync thành công, không còn lỗi "Shopify product not mapped"

## Files Changed
- `src/components/products-sync/ProductMappingModal.tsx` - Added fallback for variantId
- `src/app/api/sync/auto-match-products/route.ts` - **CRITICAL FIX:** Set shopifyVariantId = shopifyProductId in auto-match
- `src/app/api/sync/fix-variant-ids/route.ts` - API endpoint to check and fix variant IDs
- `src/lib/api-client.ts` - Added checkVariantIds() and fixVariantIds() functions
- `fix-missing-variant-ids.js` - Script to fix existing data (run after auto-match)
- `check-variant-id.js` - Script to verify data integrity
- `test-product-sync.js` - Script to test if a mapping is ready to sync
- `debug-sync-issue.js` - Script to debug sync issues in detail

## API Endpoints Added

### GET /api/sync/fix-variant-ids
Check how many mappings need fixing:
```bash
curl http://localhost:3000/api/sync/fix-variant-ids
```

Response:
```json
{
  "success": true,
  "data": {
    "needsFix": 0,
    "message": "All mappings are OK"
  }
}
```

### POST /api/sync/fix-variant-ids
Fix all mappings with missing variantIds:
```bash
curl -X POST http://localhost:3000/api/sync/fix-variant-ids
```

Response:
```json
{
  "success": true,
  "message": "Fixed 365 mappings",
  "data": {
    "fixed": 365,
    "failed": 0,
    "total": 365
  }
}
```

## Usage in Code
```typescript
// Check if any mappings need fixing
const result = await productSyncClient.checkVariantIds();
console.log(result.message); // "All mappings are OK"

// Fix mappings if needed
if (result.needsFix > 0) {
  const fixResult = await productSyncClient.fixVariantIds();
  console.log(`Fixed ${fixResult.fixed} mappings`);
}
```

## Root Cause Analysis

### The Bug
Auto-match function (`auto-match-products/route.ts`) was setting `shopifyVariantId` to **NULL**:
```sql
'${match.shopify_id}',  -- shopifyProductId
NULL,                   -- shopifyVariantId ❌ BUG!
```

### The Fix
Changed to set `shopifyVariantId` = `shopifyProductId`:
```sql
'${match.shopify_id}',  -- shopifyProductId
'${match.shopify_id}',  -- shopifyVariantId ✅ FIXED!
```

### Why This Works
- In our system, each Shopify variant is stored as a separate `ShopifyProduct`
- The `id` field in `ShopifyProduct` is actually the variant ID
- So `shopifyProductId` and `shopifyVariantId` should be the same value
- This simplifies mapping and inventory sync

## Workflow After Fix

### For New Mappings (After Code Fix)
1. Pull Shopify Products
2. Pull Nhanh Products
3. Auto Match by SKU → ✅ Will now save shopifyVariantId correctly
4. Sync → ✅ Works!

### For Existing Mappings (Before Code Fix)
1. Run `node fix-missing-variant-ids.js` to fix existing data
2. Sync → ✅ Works!

## Notes
- Trong hệ thống này, `shopifyProductId` và `shopifyVariantId` thường giống nhau
- Vì mỗi Shopify variant được lưu như một ShopifyProduct riêng
- Điều này đơn giản hóa việc mapping và sync inventory
- API endpoint có thể được gọi bất cứ lúc nào để kiểm tra và fix data integrity
- **IMPORTANT:** Always run `fix-missing-variant-ids.js` after auto-match until all users update their code
