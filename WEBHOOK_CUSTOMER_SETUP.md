# 🔔 Nhanh.vn Customer Webhook Setup

## Overview
Real-time customer totalSpent sync from Nhanh.vn to Shopify using webhooks.

---

## How It Works

```
Nhanh.vn → Webhook → Your Server → Shopify
(Customer totalSpent Change) → (Process) → (Update Metafield)
```

**What syncs:**
- ✅ `totalSpent` only (tổng tiền đã chi tiêu)
- ❌ NOT name, phone, email, address (use scheduled sync for these)

**Why metafield?**
- Shopify doesn't have native `totalSpent` field for customers
- We store it in metafield: `nhanh.nhanh_total_spent`
- Can be used in Shopify admin, reports, and apps

---

## Setup Instructions

### 1. Webhook URL

```
https://your-domain.com/api/webhooks/nhanh/customer
```

### 2. Configure in Nhanh.vn

1. Go to **Settings → Webhooks**
2. Add webhook:
   - **Event:** `customerUpdate`
   - **URL:** Your webhook URL
   - **Method:** POST
   - **Status:** Active

### 3. Test

```bash
# Health check
curl https://your-domain.com/api/webhooks/nhanh/customer

# Manual test
curl -X POST https://your-domain.com/api/webhooks/nhanh/customer \
  -H "Content-Type: application/json" \
  -d '{
    "event": "customerUpdate",
    "businessId": 12345,
    "data": [
      {
        "id": 123,
        "totalSpent": 5000000
      }
    ]
  }'
```

---

## Webhook Payload

### Request from Nhanh.vn

```json
{
  "event": "customerUpdate",
  "businessId": 12345,
  "data": [
    {
      "id": 123,
      "name": "Nguyen Van A",
      "phone": "0901234567",
      "email": "customer@example.com",
      "totalSpent": 5000000
    }
  ]
}
```

**Note:** Webhook chỉ sync `totalSpent`, các fields khác bị ignore.

### Response

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
        "nhanhCustomerId": "123",
        "shopifyCustomerId": "456",
        "totalSpent": 5000000,
        "status": "synced"
      }
    ]
  },
  "duration": "0.8s",
  "message": "Processed 1 customers: 1 synced, 0 skipped, 0 failed"
}
```

---

## Processing Logic

```typescript
1. Receive webhook
2. Validate event === "customerUpdate"
3. For each customer:
   - Get totalSpent from payload
   - Find customer mapping (Nhanh → Shopify)
   - If no mapping: skip
   - Update local database (nhanhCustomer.totalSpent)
   - Update Shopify metafield (nhanh.nhanh_total_spent)
   - Update mapping status (SYNCED)
   - Log sync result
4. Return response
```

---

## Shopify Metafield

**Location:** Customer metafield
**Namespace:** `custom`
**Key:** `total_spent`
**Type:** `number_integer`
**Value:** Total spent amount (e.g., `5000000`)

**View in Shopify Admin:**
1. Go to customer detail page
2. Scroll to "Metafields" section
3. Look for `custom.total_spent`

**Use in Liquid:**
```liquid
{{ customer.metafields.custom.total_spent }}
```

---

## Monitoring

### Database Logs

```sql
-- Webhook logs
SELECT * FROM webhook_logs 
WHERE source = 'nhanh' 
  AND "eventType" = 'customerUpdate'
ORDER BY "createdAt" DESC;

-- Sync logs
SELECT * FROM sync_logs 
WHERE action = 'WEBHOOK_SYNC'
  AND metadata->>'source' = 'nhanh_webhook'
ORDER BY "createdAt" DESC;
```

### Server Logs

```
👤 Received Nhanh customer webhook
  💰 Customer 123: totalSpent = 5000000
  🔄 Syncing to Shopify customer 456...
  ✅ Synced successfully
✅ Webhook processed in 0.8s
```

---

## Comparison: Webhook vs Scheduled Sync

| Feature | Webhook (totalSpent) | Scheduled Sync (all fields) |
|---------|---------------------|----------------------------|
| **Fields** | totalSpent only | name, phone, email, address, totalSpent |
| **Speed** | Real-time (seconds) | Every 6-12 hours |
| **Use case** | Track spending | Full customer data |
| **Complexity** | Simple | Medium |

**Recommendation:** Use both!
- **Webhook:** For real-time totalSpent updates
- **Scheduled Sync:** For full customer data sync

---

## Troubleshooting

### Customer Not Syncing

**Check:**
1. ✅ Customer mapping exists
2. ✅ Shopify customer ID is valid
3. ✅ Shopify credentials are correct
4. ✅ Check sync logs for errors

```sql
-- Check mapping
SELECT * FROM customer_mappings 
WHERE "nhanhCustomerId" = '123';
```

### Metafield Not Showing

**Possible reasons:**
1. Sync failed (check logs)
2. Shopify API error
3. Metafield definition not created

**Solution:**
- Check sync logs
- Verify Shopify API access
- Metafield will be created automatically on first sync

---

## Summary

✅ **Real-time totalSpent sync** from Nhanh to Shopify
✅ **Simple:** Only 1 field, 1-way sync
✅ **Fast:** < 1s per customer
✅ **Stored in metafield:** `nhanh.nhanh_total_spent`
✅ **Logged:** All syncs tracked in database

🎉 **Customer spending is now synced in real-time!**
