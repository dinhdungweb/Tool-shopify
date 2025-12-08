# 📚 Webhook System - Giải Thích Chi Tiết

## 🤔 Webhook Là Gì?

Webhook = **Nhanh.vn tự động gửi thông báo** khi có thay đổi (tồn kho, khách hàng, đơn hàng...)

---

## 📁 Các File Hiện Tại

```
src/app/api/webhooks/nhanh/
│
├── 📄 route.ts                          # ROUTER - Điểm vào chính
│   └─> Nhận TẤT CẢ events từ Nhanh.vn
│       └─> Phân loại event → gọi handler tương ứng
│
├── 📁 handlers/                         # LOGIC XỬ LÝ (Shared)
│   ├── inventory.ts                     # Logic xử lý tồn kho
│   └── customer.ts                      # Logic xử lý khách hàng
│
├── 📁 inventory/
│   └── route.ts                         # ENDPOINT riêng cho inventory
│       └─> Dùng handler/inventory.ts
│
└── 📁 customer/
    └── route.ts                         # ENDPOINT riêng cho customer
        └─> Dùng handler/customer.ts
```

---

## 🔄 Luồng Hoạt Động

### Cách 1: Qua Router (KHUYẾN NGHỊ) ⭐

```
1. Nhanh.vn có thay đổi tồn kho
   ↓
2. Nhanh.vn gửi POST request:
   URL: https://your-app.vercel.app/api/webhooks/nhanh
   Body: {
     "event": "inventoryChange",
     "data": [{ id: 123, available: 50 }]
   }
   ↓
3. route.ts nhận request
   ↓
4. route.ts kiểm tra event = "inventoryChange"
   ↓
5. route.ts gọi handleInventoryWebhook() từ handlers/inventory.ts
   ↓
6. Handler xử lý:
   - Tìm mapping trong DB
   - Sync tồn kho lên Shopify
   - Update DB
   - Log kết quả
   ↓
7. Trả response về Nhanh.vn: { success: true, synced: 1 }
```

### Cách 2: Trực Tiếp Endpoint (Vẫn hoạt động)

```
1. Nhanh.vn gửi POST request:
   URL: https://your-app.vercel.app/api/webhooks/nhanh/inventory
   ↓
2. inventory/route.ts nhận request
   ↓
3. Gọi handleInventoryWebhook() từ handlers/inventory.ts
   ↓
4. Handler xử lý (giống cách 1)
   ↓
5. Trả response
```

---

## 🎯 Tại Sao Có 2 Cách?

### Router (route.ts) - 1 URL cho tất cả
**Ưu điểm:**
- ✅ Chỉ cần setup 1 URL trên Nhanh.vn
- ✅ Dễ quản lý (tất cả events vào 1 chỗ)
- ✅ Có thể thêm security token
- ✅ Dễ thêm events mới

**Setup trên Nhanh.vn:**
```
URL: https://your-app.vercel.app/api/webhooks/nhanh
Events: ✅ Tất cả (inventory, customer, order...)
```

### Direct Endpoints - Nhiều URLs
**Ưu điểm:**
- ✅ Tách biệt rõ ràng
- ✅ Dễ debug từng loại event

**Setup trên Nhanh.vn:**
```
Inventory URL: https://your-app.vercel.app/api/webhooks/nhanh/inventory
Customer URL: https://your-app.vercel.app/api/webhooks/nhanh/customer
Order URL: https://your-app.vercel.app/api/webhooks/nhanh/order
...
```

---

## 💡 Handlers - Tại Sao Tách Riêng?

**Trước đây (Duplicate Code):**
```typescript
// inventory/route.ts - 200 dòng code
export async function POST() {
  // Logic xử lý inventory...
}

// route.ts - 200 dòng code GIỐNG HỆT
async function handleInventory() {
  // Logic xử lý inventory... (DUPLICATE!)
}
```

**Bây giờ (Shared Handler):**
```typescript
// handlers/inventory.ts - 200 dòng code (CHỈ 1 LẦN)
export async function handleInventoryWebhook(payload) {
  // Logic xử lý inventory...
}

// inventory/route.ts - 10 dòng code
export async function POST() {
  return handleInventoryWebhook(payload); // Gọi handler
}

// route.ts - 10 dòng code
async function handleInventory(payload) {
  return handleInventoryWebhook(payload); // Gọi handler
}
```

**Kết quả:**
- ✅ Không duplicate code
- ✅ Sửa 1 chỗ → tất cả đều update
- ✅ Dễ test

---

## 📊 So Sánh Chi Tiết

### Inventory Webhook Flow

```
┌─────────────────────────────────────────────────────────────┐
│                        NHANH.VN                             │
│  (Có thay đổi tồn kho: Product #123 = 50 cái)              │
└────────────────────┬────────────────────────────────────────┘
                     │
                     │ POST Request
                     ↓
┌─────────────────────────────────────────────────────────────┐
│              /api/webhooks/nhanh (Router)                   │
│  1. Verify token (nếu có NHANH_WEBHOOK_TOKEN)              │
│  2. Parse JSON payload                                      │
│  3. Check event = "inventoryChange"                         │
│  4. Call handleInventoryWebhook(payload)                    │
└────────────────────┬────────────────────────────────────────┘
                     │
                     │ Import & Execute
                     ↓
┌─────────────────────────────────────────────────────────────┐
│         handlers/inventory.ts (Shared Logic)                │
│                                                             │
│  FOR EACH product in payload.data:                          │
│    1. Find ProductMapping (Nhanh ID → Shopify ID)          │
│    2. If no mapping → Skip                                  │
│    3. If has mapping:                                       │
│       a. Check multi-location mode                          │
│       b. Sync inventory to Shopify                          │
│       c. Update NhanhProduct in DB                          │
│       d. Update ProductMapping status                       │
│       e. Create ProductSyncLog                              │
│                                                             │
│  Return: { synced: 1, skipped: 0, failed: 0 }             │
└────────────────────┬────────────────────────────────────────┘
                     │
                     │ Response
                     ↓
┌─────────────────────────────────────────────────────────────┐
│                        NHANH.VN                             │
│  Nhận response: ✅ Webhook processed successfully           │
└─────────────────────────────────────────────────────────────┘
```

---

## 🔐 Security Token

### Không có token:
```typescript
// Bất kỳ ai cũng có thể gửi request
POST /api/webhooks/nhanh
→ ✅ Accepted
```

### Có token:
```typescript
// Phải có Authorization header đúng
POST /api/webhooks/nhanh
Headers: Authorization: Bearer wrong-token
→ ❌ 401 Unauthorized

POST /api/webhooks/nhanh
Headers: Authorization: Bearer correct-token
→ ✅ Accepted
```

**Setup:**
```bash
# .env
NHANH_WEBHOOK_TOKEN=my-secret-token-12345

# Nhanh.vn webhook config
Headers: Authorization: Bearer my-secret-token-12345
```

---

## 🎯 Ví Dụ Thực Tế

### Scenario: Cập nhật tồn kho

**1. Trên Nhanh.vn:**
- Sản phẩm "Áo thun trắng" (ID: 123456)
- Tồn kho thay đổi: 100 → 50 cái

**2. Nhanh.vn tự động gửi:**
```json
POST https://your-app.vercel.app/api/webhooks/nhanh
{
  "event": "inventoryChange",
  "businessId": "your-business-id",
  "data": [
    {
      "id": 123456,
      "code": "AO-THUN-TRANG",
      "available": "50",
      "depots": [
        { "id": "1", "name": "Kho HN", "available": "30" },
        { "id": "2", "name": "Kho HCM", "available": "20" }
      ]
    }
  ]
}
```

**3. App xử lý:**
```
route.ts: Nhận request → Gọi handleInventoryWebhook()
  ↓
handlers/inventory.ts:
  - Tìm mapping: Nhanh #123456 → Shopify #7891234567890
  - Check multi-location:
    * Nếu có: Sync từng depot → từng location
    * Nếu không: Sync tổng 50 → default location
  - Update DB:
    * NhanhProduct.quantity = 50
    * ProductMapping.syncStatus = "SYNCED"
    * ProductSyncLog: "Webhook: Updated inventory to 50"
  ↓
Response: { success: true, synced: 1 }
```

**4. Kết quả:**
- ✅ Shopify product #7891234567890 có tồn kho = 50
- ✅ DB đã update
- ✅ Log đã ghi lại

---

## 🚀 Khuyến Nghị Setup

### Bước 1: Thêm Token (Optional nhưng nên có)
```bash
# .env hoặc Vercel Environment Variables
NHANH_WEBHOOK_TOKEN=your-random-secret-token-here
```

### Bước 2: Setup trên Nhanh.vn
```
Webhook URL: https://your-app.vercel.app/api/webhooks/nhanh

Headers (nếu có token):
Authorization: Bearer your-random-secret-token-here

Events:
✅ Cập nhật tồn kho (inventoryChange)
✅ Thông tin thanh toán (customerUpdate)
```

### Bước 3: Test
```bash
# Test với curl
curl -X POST https://your-app.vercel.app/api/webhooks/nhanh \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your-token" \
  -d '{"event":"webhooksEnabled"}'

# Kết quả mong đợi:
{
  "success": true,
  "message": "Webhook is enabled and ready",
  "supportedEvents": ["inventoryChange", "customerUpdate", ...]
}
```

---

## ❓ FAQ

### Q: Tại sao không xóa inventory/route.ts và customer/route.ts?
**A:** Để backward compatible. Nếu đã setup URLs riêng trên Nhanh.vn, vẫn hoạt động bình thường.

### Q: Nên dùng router hay direct endpoints?
**A:** Dùng **router** (`/api/webhooks/nhanh`) - Dễ quản lý hơn, chỉ cần 1 URL.

### Q: Token có bắt buộc không?
**A:** Không bắt buộc nhưng **nên có** để bảo mật. Nếu không có token, bất kỳ ai cũng có thể gửi fake webhooks.

### Q: Làm sao biết webhook đang hoạt động?
**A:** 
1. Check logs trên Vercel
2. Check ProductSyncLog trong DB
3. Test với Nhanh.vn webhook test tool

### Q: Nếu webhook fail thì sao?
**A:** 
- Nhanh.vn sẽ retry vài lần
- Check logs để debug
- Có thể manual sync từ UI

---

## 📝 Tóm Tắt

| File | Vai Trò | Khi Nào Dùng |
|------|---------|--------------|
| `route.ts` | Router chính | Setup 1 URL trên Nhanh.vn |
| `handlers/inventory.ts` | Logic xử lý inventory | Được gọi bởi router & endpoint |
| `handlers/customer.ts` | Logic xử lý customer | Được gọi bởi router & endpoint |
| `inventory/route.ts` | Endpoint riêng | Nếu muốn URL riêng cho inventory |
| `customer/route.ts` | Endpoint riêng | Nếu muốn URL riêng cho customer |

**Khuyến nghị:** Chỉ cần setup **route.ts** (router) trên Nhanh.vn!
