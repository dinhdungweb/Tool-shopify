# Bulk Sync Products - Background Processing

## Problem
Bulk sync products chạy foreground trong browser. Khi reload trang, sync bị dừng.

## Solution
Tạo API endpoint `/api/sync/bulk-sync-products` để chạy background trên server.

## How It Works

### Before (Foreground)
```typescript
// ❌ OLD: Runs in browser, stops on page reload
for (const mappingId of mappingIds) {
  await productSyncClient.syncProduct(mappingId);
}
```

### After (Background)
```typescript
// ✅ NEW: Runs on server, continues even if page closed
const result = await productSyncClient.bulkSyncProducts(mappingIds);
// Returns immediately, sync continues in background
```

## API Endpoint

### POST /api/sync/bulk-sync-products

**Request:**
```json
{
  "mappingIds": ["id1", "id2", "id3", ...]
}
```

**Response:**
```json
{
  "success": true,
  "message": "Background sync started for 100 products. Check server logs for progress.",
  "data": {
    "total": 100
  }
}
```

## Features

### 1. Background Processing
- Returns immediately after starting
- Continues running even if browser closed
- Progress logged to server console

### 2. Batch Processing
- Processes 10 products per batch
- 1 second delay between batches
- Prevents API rate limiting

### 3. Parallel Processing
- Each batch processes products in parallel
- Faster than sequential processing
- Respects rate limits

### 4. Error Handling
- Individual product failures don't stop the batch
- Errors logged and counted
- Failed products marked as FAILED in database

### 5. Real-time Data
- Uses Nhanh Inventory API for real-time data
- Gets latest inventory before syncing
- Updates Shopify with accurate quantities

## Server Logs

```
🚀 Starting background bulk sync for 100 products...

📦 Bulk syncing 100 products in background...

📦 Processing batch 1/10 (10 products)...
  ✅ Batch 1 completed: 10 successful, 0 failed
📦 Processing batch 2/10 (10 products)...
  ✅ Batch 2 completed: 20 successful, 0 failed
...

✅ Bulk sync completed in 45.23s
📊 Results:
   - Total: 100
   - Successful: 98
   - Failed: 2

❌ Errors:
   - mapping123: Product not found in inventory
   - mapping456: Shopify API error
```

## Files Changed

1. **src/app/api/sync/bulk-sync-products/route.ts** (NEW)
   - Background bulk sync endpoint
   - Batch processing with parallel execution
   - Error handling and logging

2. **src/lib/api-client.ts**
   - Added `bulkSyncProducts()` function

3. **src/components/products-sync/ProductSyncTable.tsx**
   - Updated `handleBulkSync()` to use background API
   - Shows confirmation message about background processing

## Usage

### From UI
1. Select products to sync (checkboxes)
2. Click "Sync Selected" button
3. Confirm background sync
4. Check server logs for progress

### From Code
```typescript
import { productSyncClient } from "@/lib/api-client";

// Start background sync
const result = await productSyncClient.bulkSyncProducts(mappingIds);
console.log(result.message);

// Check progress in server logs
```

## Performance

### Batch Size: 10 products
- Parallel processing within batch
- ~1-2 seconds per batch
- 1 second delay between batches

### Example: 100 products
- 10 batches
- ~20-30 seconds total
- Continues in background

### Example: 1000 products
- 100 batches
- ~3-5 minutes total
- Safe to close browser

## Rate Limiting

### Nhanh API
- 10 parallel requests per batch
- 1 second delay between batches
- ~600 requests/minute max

### Shopify API
- 10 parallel requests per batch
- Well within rate limits
- No throttling needed

## Error Recovery

### Individual Product Fails
- Marked as FAILED in database
- Error message saved
- Other products continue

### Batch Fails
- Logged to console
- Next batch continues
- Summary at end

### Retry Failed
- Use "Retry Failed" button in UI
- Or run bulk sync again
- Only FAILED products will be retried

## Summary

✅ **Background Processing:** Continues even if browser closed
✅ **Batch Processing:** 10 products per batch with delays
✅ **Parallel Execution:** Fast processing within batches
✅ **Error Handling:** Individual failures don't stop sync
✅ **Real-time Data:** Uses Nhanh Inventory API
✅ **Progress Logging:** Check server console for status

**Status:** COMPLETE - Bulk sync now runs in background!
