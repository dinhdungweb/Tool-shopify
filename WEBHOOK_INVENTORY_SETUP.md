# 🔔 Nhanh.vn Inventory Webhook Setup

## Overview
Real-time inventory sync from Nhanh.vn to Shopify using webhooks. When inventory changes in Nhanh, it automatically updates Shopify.

---

## How It Works

```
Nhanh.vn → Webhook → Your Server → Shopify
   (Inventory Change)  →  (Process)  →  (Update Inventory)
```

**Flow:**
1. Inventory changes in Nhanh.vn (sale, restock, adjustment)
2. Nhanh sends webhook to your endpoint
3. Your server receives webhook
4. Find product mapping (Nhanh → Shopify)
5. Update Shopify inventory
6. Log sync result

---

## Setup Instructions

### 1. Get Your Webhook URL

Your webhook endpoint:
```
https://your-domain.com/api/webhooks/nhanh/inventory
```

**For development (using ngrok):**
```bash
# Start ngrok
ngrok http 3000

# Your webhook URL will be:
https://xxxx-xx-xx-xx-xx.ngrok-free.app/api/webhooks/nhanh/inventory
```

### 2. Configure in Nhanh.vn

1. Login to Nhanh.vn
2. Go to **Settings → Webhooks** (Cài đặt → Webhooks)
3. Click **Add Webhook** (Thêm webhook)
4. Fill in:
   - **Event:** `inventoryChange` (Thay đổi tồn kho)
   - **URL:** Your webhook URL
   - **Method:** POST
   - **Status:** Active (Kích hoạt)

### 3. Test Webhook

**Option 1: From Nhanh.vn**
- Make an inventory change (adjust stock, create order, etc.)
- Check your server logs

**Option 2: Manual Test**
```bash
curl -X POST https://your-domain.com/api/webhooks/nhanh/inventory \
  -H "Content-Type: application/json" \
  -d '{
    "event": "inventoryChange",
    "businessId": 12345,
    "data": [
      {
        "id": 123,
        "code": "SKU-001",
        "available": 50,
        "depots": [
          {
            "id": 1,
            "available": 50
          }
        ]
      }
    ]
  }'
```

**Option 3: Health Check**
```bash
curl https://your-domain.com/api/webhooks/nhanh/inventory
```

---

## Webhook Payload

### Request from Nhanh.vn

```json
{
  "event": "inventoryChange",
  "businessId": 12345,
  "data": [
    {
      "id": 123,
      "typeId": 1,
      "code": "SKU-001",
      "remain": 100,
      "shipping": 10,
      "damaged": 5,
      "holding": 15,
      "available": 70,
      "warranty": {
        "remain": 0,
        "holding": 0
      },
      "depots": [
        {
          "id": 1,
          "remain": 50,
          "shipping": 5,
          "damaged": 2,
          "holding": 8,
          "available": 35,
          "warranty": {
            "remain": 0,
            "holding": 0
          }
        },
        {
          "id": 2,
          "remain": 50,
          "shipping": 5,
          "damaged": 3,
          "holding": 7,
          "available": 35,
          "warranty": {
            "remain": 0,
            "holding": 0
          }
        }
      ]
    }
  ]
}
```

### Response to Nhanh.vn

**Success:**
```json
{
  "success": true,
  "data": {
    "total": 1,
    "synced": 1,
    "skipped": 0,
    "failed": 0,
    "details": [
      {
        "nhanhProductId": "123",
        "nhanhSku": "SKU-001",
        "shopifyProductId": "456",
        "quantity": 70,
        "status": "synced"
      }
    ]
  },
  "duration": "1.2s",
  "message": "Processed 1 products: 1 synced, 0 skipped, 0 failed"
}
```

**Error:**
```json
{
  "success": false,
  "error": "Failed to process webhook"
}
```

---

## Configuration

### Environment Variables

```env
# Nhanh.vn Configuration
NHANH_APP_ID=your_app_id
NHANH_BUSINESS_ID=your_business_id
NHANH_ACCESS_TOKEN=your_access_token
NHANH_STORE_ID=1  # Optional: Specific depot/store ID

# Shopify Configuration
SHOPIFY_STORE_URL=your-store.myshopify.com
SHOPIFY_ACCESS_TOKEN=your_access_token
SHOPIFY_API_VERSION=2024-01
```

### Depot Configuration

**Use specific depot:**
```env
NHANH_STORE_ID=1
```
- Webhook will use `depots[0].available` where `depots[0].id === NHANH_STORE_ID`

**Use all depots (default):**
```env
# Leave NHANH_STORE_ID empty or remove it
```
- Webhook will use total `available` across all depots

---

## Processing Logic

### 1. Receive Webhook
```typescript
POST /api/webhooks/nhanh/inventory
```

### 2. Validate Payload
- Check `event === "inventoryChange"`
- Validate `data` array exists

### 3. For Each Product
```typescript
for (const product of payload.data) {
  // 1. Get quantity
  const quantity = storeId 
    ? product.depots.find(d => d.id === storeId).available
    : product.available;
  
  // 2. Find mapping
  const mapping = await prisma.productMapping.findUnique({
    where: { nhanhProductId: product.id }
  });
  
  if (!mapping) {
    skip(); // No mapping found
    continue;
  }
  
  // 3. Update local database
  await prisma.nhanhProduct.update({
    where: { id: product.id },
    data: { quantity }
  });
  
  // 4. Sync to Shopify
  await shopifyAPI.updateInventory(
    mapping.shopifyProductId,
    quantity
  );
  
  // 5. Update mapping status
  await prisma.productMapping.update({
    where: { id: mapping.id },
    data: {
      syncStatus: "SYNCED",
      lastSyncedAt: new Date()
    }
  });
  
  // 6. Log sync
  await prisma.productSyncLog.create({
    data: {
      mappingId: mapping.id,
      action: "INVENTORY_UPDATE",
      status: "SYNCED",
      message: "Webhook: Updated inventory"
    }
  });
}
```

### 4. Return Response
```typescript
return {
  success: true,
  data: {
    total: X,
    synced: Y,
    skipped: Z,
    failed: W
  }
}
```

---

## Monitoring

### Check Webhook Logs

**Database:**
```sql
SELECT * FROM webhook_logs 
WHERE source = 'nhanh' 
  AND event = 'inventoryChange'
ORDER BY "createdAt" DESC 
LIMIT 10;
```

**Sync Logs:**
```sql
SELECT * FROM product_sync_logs 
WHERE action = 'INVENTORY_UPDATE'
  AND metadata->>'source' = 'nhanh_webhook'
ORDER BY "createdAt" DESC 
LIMIT 10;
```

### Server Logs

Look for:
```
📦 Received Nhanh inventory webhook
  📊 Product 123 (SKU-001): 70 available
  🔄 Syncing to Shopify product 456...
  ✅ Synced successfully
✅ Webhook processed in 1.2s
```

---

## Troubleshooting

### Webhook Not Received

**Check:**
1. ✅ Webhook URL is correct and accessible
2. ✅ Webhook is active in Nhanh.vn settings
3. ✅ Server is running and accessible
4. ✅ Firewall allows incoming requests
5. ✅ SSL certificate is valid (if using HTTPS)

**For ngrok:**
```bash
# Check ngrok status
curl http://localhost:4040/api/tunnels

# Restart ngrok if needed
ngrok http 3000
```

### Products Not Syncing

**Check:**
1. ✅ Product mapping exists (Nhanh → Shopify)
2. ✅ Shopify credentials are correct
3. ✅ Shopify product ID is valid
4. ✅ Check sync logs for errors

**Query:**
```sql
-- Check if mapping exists
SELECT * FROM product_mappings 
WHERE "nhanhProductId" = '123';

-- Check sync logs
SELECT * FROM product_sync_logs 
WHERE "mappingId" = 'xxx'
ORDER BY "createdAt" DESC;
```

### Sync Errors

**Common errors:**

1. **"No mapping found"**
   - Product not mapped yet
   - Solution: Map product in UI

2. **"Shopify API error"**
   - Invalid credentials
   - Product not found
   - Rate limit exceeded
   - Solution: Check Shopify settings

3. **"Database error"**
   - Connection issue
   - Solution: Check database connection

---

## Performance

### Benchmarks

| Products | Processing Time | Avg per Product |
|----------|----------------|-----------------|
| 1 | 0.5-1s | 0.5-1s |
| 10 | 2-5s | 0.2-0.5s |
| 100 | 20-50s | 0.2-0.5s |

### Optimization

**Current:**
- Sequential processing (one by one)
- Each product: Find mapping → Update DB → Sync Shopify → Log

**Future improvements:**
1. **Parallel processing:** Process multiple products simultaneously
2. **Batch updates:** Group Shopify API calls
3. **Queue system:** Use Bull/BullMQ for background processing
4. **Caching:** Cache mappings in Redis

---

## Security

### Webhook Verification

**Option 1: IP Whitelist**
```typescript
const allowedIPs = ['nhanh.vn.ip.address'];
const clientIP = request.headers.get('x-forwarded-for');

if (!allowedIPs.includes(clientIP)) {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}
```

**Option 2: Secret Token**
```typescript
const secret = process.env.NHANH_WEBHOOK_SECRET;
const token = request.headers.get('x-webhook-token');

if (token !== secret) {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}
```

**Option 3: Signature Verification**
```typescript
const signature = request.headers.get('x-nhanh-signature');
const payload = await request.text();
const expectedSignature = crypto
  .createHmac('sha256', secret)
  .update(payload)
  .digest('hex');

if (signature !== expectedSignature) {
  return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
}
```

---

## Best Practices

### 1. Always Respond Quickly
- Return 200 OK immediately
- Process in background if needed
- Don't block webhook response

### 2. Handle Errors Gracefully
- Catch all errors
- Log errors for debugging
- Return success even if some products fail

### 3. Idempotency
- Handle duplicate webhooks
- Check if already processed
- Use unique webhook ID if available

### 4. Monitoring
- Log all webhooks
- Track success/failure rates
- Alert on high failure rates

### 5. Testing
- Test with sample payloads
- Test error scenarios
- Test with large batches

---

## Comparison: Webhook vs Scheduled Sync

| Feature | Webhook | Scheduled Sync |
|---------|---------|----------------|
| **Latency** | Real-time (seconds) | Minutes to hours |
| **Accuracy** | Always up-to-date | May be stale |
| **Load** | Event-driven | Periodic bulk |
| **Complexity** | Medium | Low |
| **Reliability** | Depends on network | More reliable |
| **Best for** | Real-time updates | Batch processing |

**Recommendation:** Use both!
- **Webhook:** For real-time updates
- **Scheduled Sync:** As backup (every 6-12 hours)

---

## Next Steps

1. ✅ Setup webhook in Nhanh.vn
2. ✅ Test with sample payload
3. ✅ Monitor logs for first few days
4. ✅ Setup scheduled sync as backup
5. ✅ Add monitoring/alerting
6. ✅ Document for team

---

## Support

**Issues?**
- Check server logs
- Check webhook logs in database
- Check Nhanh.vn webhook settings
- Test with curl command

**Need help?**
- Review this documentation
- Check API documentation: https://apidocs.nhanh.vn/v3/webhooks/inventory
- Contact Nhanh.vn support

---

## Summary

✅ **Real-time inventory sync** from Nhanh to Shopify
✅ **Automatic processing** when inventory changes
✅ **Error handling** and logging
✅ **Monitoring** via database logs
✅ **Scalable** for large product catalogs

🎉 **Your inventory is now synced in real-time!**
