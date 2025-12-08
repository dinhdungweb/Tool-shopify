# 🎯 Webhook - Hướng Dẫn Đơn Giản

## 1️⃣ Webhook Là Gì?

**Ví dụ thực tế:**
- Bạn bán hàng trên Nhanh.vn
- Khách mua → tồn kho giảm từ 100 → 99
- Nhanh.vn **TỰ ĐỘNG** gửi thông báo cho app của bạn
- App **TỰ ĐỘNG** cập nhật tồn kho trên Shopify

**Không có webhook:**
```
Bạn phải:
1. Vào Nhanh.vn → Check tồn kho
2. Vào Shopify → Update tồn kho thủ công
3. Lặp lại mỗi khi có thay đổi
```

**Có webhook:**
```
Tự động:
1. Nhanh.vn thay đổi → Gửi thông báo
2. App nhận → Tự động sync Shopify
3. Xong! Không cần làm gì
```

---

## 2️⃣ Các File Trong Project

### 🎯 Chỉ Cần Hiểu 3 File Chính:

```
📄 route.ts (Router)
   ↓ gọi
📄 handlers/inventory.ts (Logic xử lý tồn kho)
📄 handlers/customer.ts (Logic xử lý khách hàng)
```

### Chi Tiết:

#### 📄 `route.ts` - Cổng Vào Chính
```typescript
// Nhận TẤT CẢ webhooks từ Nhanh.vn
// Phân loại: inventory? customer? order?
// Gọi handler tương ứng

Ví dụ:
- Nhận event "inventoryChange" → Gọi handleInventoryWebhook()
- Nhận event "customerUpdate" → Gọi handleCustomerWebhook()
```

#### 📄 `handlers/inventory.ts` - Xử Lý Tồn Kho
```typescript
// Logic thực sự:
1. Nhận data từ Nhanh.vn
2. Tìm mapping (Nhanh product → Shopify product)
3. Sync tồn kho lên Shopify
4. Update database
5. Ghi log
```

#### 📄 `handlers/customer.ts` - Xử Lý Khách Hàng
```typescript
// Logic thực sự:
1. Nhận data từ Nhanh.vn
2. Tìm mapping (Nhanh customer → Shopify customer)
3. Sync totalSpent lên Shopify
4. Update database
5. Ghi log
```

---

## 3️⃣ Luồng Hoạt Động (Đơn Giản)

### Ví Dụ: Cập Nhật Tồn Kho

```
┌──────────────┐
│  NHANH.VN    │  Tồn kho thay đổi: 100 → 50
└──────┬───────┘
       │
       │ Gửi webhook
       ↓
┌──────────────────────────────────────┐
│  route.ts (Router)                   │
│  - Nhận request                      │
│  - Check: event = "inventoryChange"  │
│  - Gọi handleInventoryWebhook()      │
└──────┬───────────────────────────────┘
       │
       │ Gọi handler
       ↓
┌──────────────────────────────────────┐
│  handlers/inventory.ts               │
│  1. Tìm mapping trong DB             │
│  2. Sync Shopify (50 cái)            │
│  3. Update DB                        │
│  4. Ghi log                          │
└──────┬───────────────────────────────┘
       │
       │ Trả kết quả
       ↓
┌──────────────┐
│  NHANH.VN    │  Nhận: ✅ Success
└──────────────┘
```

---

## 4️⃣ Setup Trên Nhanh.vn

### Bước 1: Vào Nhanh.vn → Cài đặt → Webhooks

### Bước 2: Thêm Webhook Mới

**URL:**
```
https://your-app-name.vercel.app/api/webhooks/nhanh
```

**Events (Chọn những cái cần):**
- ✅ Cập nhật tồn kho (inventoryChange)
- ✅ Thông tin thanh toán (customerUpdate)
- ⬜ Thêm đơn hàng (orderAdd) - Chưa làm
- ⬜ Cập nhật đơn hàng (orderUpdate) - Chưa làm

### Bước 3: Test
- Click "Test" trên Nhanh.vn
- Xem kết quả: ✅ Success

---

## 5️⃣ Kiểm Tra Webhook Hoạt Động

### Cách 1: Xem Logs Trên Vercel
```
1. Vào Vercel Dashboard
2. Chọn project
3. Tab "Logs"
4. Tìm: "📦 Received Nhanh inventory webhook"
```

### Cách 2: Xem Database
```sql
-- Xem logs sync
SELECT * FROM ProductSyncLog 
WHERE metadata->>'source' = 'nhanh_webhook'
ORDER BY createdAt DESC
LIMIT 10;
```

### Cách 3: Test Thủ Công
```bash
curl -X POST https://your-app.vercel.app/api/webhooks/nhanh \
  -H "Content-Type: application/json" \
  -d '{"event":"webhooksEnabled"}'
```

---

## 6️⃣ Các File Khác (Không Cần Quan Tâm Nhiều)

### `inventory/route.ts` & `customer/route.ts`
- Là endpoints riêng (URL riêng cho từng loại)
- Vẫn dùng **cùng handlers** với router
- Giữ lại để backward compatible
- **Không cần setup** nếu đã dùng router

**Tóm tắt:**
```
Router (route.ts):        1 URL cho tất cả events ⭐ KHUYẾN NGHỊ
Direct endpoints:         Nhiều URLs cho từng event (không cần thiết)
```

---

## 7️⃣ Tóm Tắt Cực Kỳ Đơn Giản

### Bạn Chỉ Cần Biết:

1. **Webhook = Thông báo tự động** từ Nhanh.vn khi có thay đổi

2. **Setup 1 URL duy nhất:**
   ```
   https://your-app.vercel.app/api/webhooks/nhanh
   ```

3. **App tự động xử lý:**
   - Nhận thông báo
   - Sync Shopify
   - Update database
   - Ghi log

4. **Không cần làm gì thêm!**

---

## 8️⃣ Troubleshooting

### ❌ Webhook không hoạt động?

**Check 1: URL đúng chưa?**
```
✅ https://your-app.vercel.app/api/webhooks/nhanh
❌ https://your-app.vercel.app/api/webhook/nhanh (thiếu 's')
```

**Check 2: App đã deploy chưa?**
```bash
# Vào Vercel Dashboard → Deployments
# Phải có deployment "Ready"
```

**Check 3: Xem logs**
```
Vercel Dashboard → Logs
Tìm error messages
```

**Check 4: Test thủ công**
```bash
curl -X POST https://your-app.vercel.app/api/webhooks/nhanh \
  -H "Content-Type: application/json" \
  -d '{"event":"webhooksEnabled"}'

# Phải trả về:
{"success":true,"message":"Webhook is enabled and ready"}
```

---

## 9️⃣ Câu Hỏi Thường Gặp

### Q: Tôi có cần làm gì sau khi setup?
**A:** Không! Webhook tự động chạy. Chỉ cần check logs thỉnh thoảng.

### Q: Nếu webhook fail thì sao?
**A:** Nhanh.vn sẽ retry. Nếu vẫn fail, có thể manual sync từ UI.

### Q: Tốn tiền không?
**A:** Không. Webhook là free trên cả Nhanh.vn và Vercel (trong giới hạn).

### Q: Có thể tắt webhook không?
**A:** Có. Vào Nhanh.vn → Webhooks → Xóa hoặc disable.

### Q: Làm sao biết webhook đang chạy?
**A:** Check logs hoặc xem `lastSyncedAt` trong database.

---

## 🎉 Kết Luận

**Webhook = Tự động hóa hoàn toàn!**

```
Trước:  Nhanh.vn thay đổi → Bạn phải update Shopify thủ công
Sau:   Nhanh.vn thay đổi → App tự động sync Shopify
```

**Setup 1 lần, chạy mãi mãi!** 🚀
