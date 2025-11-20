# Webhook Documentation ✅

## Tổng quan
Webhook cho phép tự động sync dữ liệu từ Nhanh.vn sang Shopify khi có thay đổi, không cần sync thủ công.

## Webhook Endpoint

### URL
```
POST https://your-domain.com/api/sync/webhook
```

### Headers
```
Content-Type: application/json
X-Nhanh-Signature: {signature} (optional)
```

### Request Body Format
```json
{
  "event": "customer.updated",
  "data": {
    "customerId": 7,
    "name": "Mịn",
    "mobile": "0789834300",
    "totalAmount": 69735300
  },
  "timestamp": "2025-11-19T10:30:00Z"
}
```

## Supported Events

### 1. customer.updated
Được trigger khi thông tin customer thay đổi trên Nhanh.vn

**Payload:**
```json
{
  "event": "customer.updated",
  "data": {
    "customerId": 7,
    "name": "Mịn",
    "mobile": "0789834300",
    "totalAmount": 69735300
  }
}
```

**Action:** Sync total spent mới nhất lên Shopify

### 2. order.completed
Được trigger khi đơn hàng hoàn thành

**Payload:**
```json
{
  "event": "order.completed",
  "data": {
    "customerId": 7,
    "orderId": 12345,
    "orderAmount": 925000
  }
}
```

**Action:** Cập nhật total spent của customer lên Shopify

### 3. order.paid
Được trigger khi đơn hàng được thanh toán

**Payload:**
```json
{
  "event": "order.paid",
  "data": {
    "customerId": 7,
    "orderId": 12345,
    "orderAmount": 925000
  }
}
```

**Action:** Cập nhật total spent của customer lên Shopify

### 4. customer.deleted
Được trigger khi customer bị xóa

**Payload:**
```json
{
  "event": "customer.deleted",
  "data": {
    "customerId": 7
  }
}
```

**Action:** Đánh dấu mapping là FAILED với error message

## Webhook Flow

```
┌─────────────┐         ┌──────────────┐         ┌─────────────┐
│  Nhanh.vn   │ Webhook │  Your Server │  Sync   │   Shopify   │
│             ├────────>│              ├────────>│             │
│  (Event)    │         │  (Process)   │         │  (Update)   │
└─────────────┘         └──────────────┘         └─────────────┘
```

### Step by Step:

1. **Event occurs** trên Nhanh.vn (customer updated, order completed, etc.)
2. **Nhanh.vn sends webhook** đến endpoint của bạn
3. **Server receives webhook** và log vào database
4. **Verify signature** (nếu có)
5. **Check mapping** - Tìm customer mapping trong database
6. **Get latest data** - Gọi Nhanh.vn API để lấy total spent mới nhất
7. **Update Shopify** - Cập nhật metafield `custom.total_spent`
8. **Update mapping** - Cập nhật sync status và timestamp
9. **Create sync log** - Log lại quá trình sync
10. **Return response** - Trả về success/error cho Nhanh.vn

## Setup Webhook trên Nhanh.vn

### Bước 1: Truy cập Nhanh.vn Admin
1. Đăng nhập vào https://nhanh.vn
2. Vào **Cài đặt** → **Tích hợp** → **Webhook**

### Bước 2: Thêm Webhook URL
1. Click **Thêm webhook mới**
2. Nhập URL: `https://your-domain.com/api/sync/webhook`
3. Chọn events muốn nhận:
   - ✅ Customer Updated
   - ✅ Order Completed
   - ✅ Order Paid
4. Click **Lưu**

### Bước 3: Test Webhook
1. Sử dụng test script:
   ```bash
   node test-webhook.js
   ```
2. Hoặc trigger event thật trên Nhanh.vn:
   - Cập nhật thông tin customer
   - Hoàn thành đơn hàng
3. Kiểm tra logs trong database:
   ```sql
   SELECT * FROM webhook_logs ORDER BY createdAt DESC LIMIT 10;
   ```

## Test Results

### ✅ Test 1: Customer Updated
```bash
POST /api/sync/webhook
Body: {
  "event": "customer.updated",
  "data": { "customerId": 7, ... }
}

Response: 200 OK
{
  "success": true,
  "message": "Webhook processed and customer synced"
}
```

### ✅ Test 2: Order Completed
```bash
POST /api/sync/webhook
Body: {
  "event": "order.completed",
  "data": { "customerId": 7, "orderId": 12345 }
}

Response: 200 OK
{
  "success": true,
  "message": "Webhook processed and customer synced"
}
```

### ✅ Test 3: Invalid Payload
```bash
POST /api/sync/webhook
Body: {
  "event": "customer.updated",
  "data": { "name": "Test" } // Missing customerId
}

Response: 400 Bad Request
{
  "success": false,
  "error": "Invalid webhook payload"
}
```

### ✅ Test 4: Unmapped Customer
```bash
POST /api/sync/webhook
Body: {
  "event": "customer.updated",
  "data": { "customerId": 99999 } // Not mapped
}

Response: 200 OK
{
  "success": true,
  "message": "No mapping found, webhook logged"
}
```

## Database Tables

### webhook_logs
Lưu trữ tất cả webhook events nhận được

```sql
CREATE TABLE webhook_logs (
  id TEXT PRIMARY KEY,
  createdAt TIMESTAMP DEFAULT NOW(),
  source TEXT, -- "nhanh"
  eventType TEXT, -- "customer.updated", "order.completed", etc.
  payload JSON,
  processed BOOLEAN DEFAULT FALSE,
  processedAt TIMESTAMP,
  error TEXT
);
```

### sync_logs
Lưu trữ kết quả sync từ webhook

```sql
CREATE TABLE sync_logs (
  id TEXT PRIMARY KEY,
  createdAt TIMESTAMP DEFAULT NOW(),
  mappingId TEXT,
  action TEXT, -- "WEBHOOK_SYNC"
  status TEXT, -- "SYNCED", "FAILED"
  message TEXT,
  errorDetail TEXT,
  metadata JSON
);
```

## Monitoring

### Check Webhook Logs
```sql
-- Recent webhooks
SELECT 
  id,
  eventType,
  processed,
  error,
  createdAt
FROM webhook_logs
ORDER BY createdAt DESC
LIMIT 20;

-- Failed webhooks
SELECT * FROM webhook_logs
WHERE processed = true AND error IS NOT NULL
ORDER BY createdAt DESC;

-- Unprocessed webhooks
SELECT * FROM webhook_logs
WHERE processed = false
ORDER BY createdAt ASC;
```

### Check Sync Logs
```sql
-- Recent syncs from webhook
SELECT 
  sl.*,
  cm.nhanhCustomerName,
  cm.shopifyCustomerEmail
FROM sync_logs sl
JOIN customer_mappings cm ON sl.mappingId = cm.id
WHERE sl.action = 'WEBHOOK_SYNC'
ORDER BY sl.createdAt DESC
LIMIT 20;

-- Failed webhook syncs
SELECT * FROM sync_logs
WHERE action = 'WEBHOOK_SYNC' AND status = 'FAILED'
ORDER BY createdAt DESC;
```

## Security

### Webhook Signature Verification
Nếu Nhanh.vn cung cấp signature, webhook sẽ verify:

```typescript
const signature = request.headers.get("x-nhanh-signature");
if (signature) {
  const isValid = nhanhAPI.verifyWebhookSignature(
    JSON.stringify(body),
    signature
  );
  
  if (!isValid) {
    return { error: "Invalid webhook signature" };
  }
}
```

### IP Whitelist (Optional)
Có thể thêm IP whitelist để chỉ accept webhooks từ Nhanh.vn:

```typescript
const allowedIPs = ['123.45.67.89', '98.76.54.32'];
const clientIP = request.headers.get('x-forwarded-for') || request.ip;

if (!allowedIPs.includes(clientIP)) {
  return { error: "Unauthorized IP" };
}
```

## Troubleshooting

### Webhook không được nhận
1. Kiểm tra URL có đúng không
2. Kiểm tra server có đang chạy không
3. Kiểm tra firewall/security groups
4. Kiểm tra SSL certificate (nếu dùng HTTPS)

### Webhook nhận được nhưng không sync
1. Kiểm tra webhook_logs table
2. Xem error message trong logs
3. Kiểm tra customer có được mapped chưa
4. Test API Nhanh.vn manually

### Sync chậm
1. Kiểm tra API response time
2. Xem có nhiều webhooks pending không
3. Consider implementing queue system

## Production Deployment

### Requirements
- ✅ HTTPS endpoint (required by most webhook providers)
- ✅ Fast response time (< 5 seconds)
- ✅ Proper error handling
- ✅ Logging and monitoring
- ✅ Retry mechanism (optional)

### Recommended Setup
1. Use production domain với SSL
2. Setup monitoring alerts
3. Implement retry queue cho failed webhooks
4. Regular cleanup của old webhook logs
5. Monitor sync success rate

## Next Steps
1. ✅ Webhook endpoint implemented
2. ✅ Test scripts created
3. ⏳ Setup webhook URL trên Nhanh.vn
4. ⏳ Monitor webhook logs
5. ⏳ Implement retry mechanism (optional)
6. ⏳ Add webhook dashboard UI (optional)
