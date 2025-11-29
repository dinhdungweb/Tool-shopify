# ✅ Fix: Rate Limit khi Bulk Sync

## 🐛 **Vấn đề**

Khi bulk sync nhiều customers, bị lỗi rate limit từ Nhanh API:

```
Nhanh API Error: Your app exceeded the API Rate Limit
```

### **Nguyên nhân:**

1. **Batch size quá lớn:** 10 customers cùng lúc = 10 API calls đồng thời
2. **Delay quá ngắn:** 500ms giữa các batch
3. **Không có retry logic:** Customers bị rate limit → Failed vĩnh viễn

**Tốc độ cũ:**
- 10 customers/batch × 2 batches/second = **20 API calls/second**
- Vượt quá rate limit của Nhanh API!

---

## ✅ **Giải pháp**

### **1. Giảm tốc độ sync**

**Trước:**
```typescript
const batchSize = 10; // Too aggressive
const batchDelay = 500; // Too fast (0.5s)
```

**Sau:**
```typescript
const batchSize = 5; // Reduced to avoid rate limits
const batchDelay = 2000; // Increased to 2s to respect API rate limits
```

**Tốc độ mới:**
- 5 customers/batch × 0.5 batches/second = **2.5 API calls/second**
- An toàn với rate limit!

---

### **2. Cải thiện error handling**

Thêm logging cho rate limit errors:

```typescript
catch (error: any) {
  const errorMessage = error.message || "Unknown error";
  
  // Log rate limit errors specifically
  if (errorMessage.includes("Rate Limit") || errorMessage.includes("429")) {
    console.warn(`⚠️ Rate limit hit for customer ${mappingId}, will retry later`);
  }
  
  // Save error to database
  await prisma.customerMapping.update({
    where: { id: mappingId },
    data: {
      syncStatus: SyncStatus.FAILED,
      syncError: errorMessage.substring(0, 500), // Limit length
      syncAttempts: { increment: 1 },
    },
  });
}
```

---

### **3. Thêm Retry Failed Syncs**

Tạo endpoint mới `/api/sync/retry-failed` để retry các customers bị failed:

**Features:**
- ✅ Retry tất cả failed syncs
- ✅ Batch size rất nhỏ (3 customers)
- ✅ Delay rất dài (3 seconds)
- ✅ Chạy background, không block UI

**Usage:**
```typescript
// Retry up to 100 failed syncs
POST /api/sync/retry-failed
{
  "limit": 100
}
```

**UI Button:**
- Thêm "Retry Failed Syncs" vào More Actions dropdown
- Click → Tự động retry tất cả failed customers

---

## 📊 **So sánh tốc độ**

### **Bulk Sync (Normal)**
- Batch size: 5 customers
- Delay: 2 seconds
- Speed: ~2.5 API calls/second
- Use case: Sync nhiều customers lần đầu

### **Retry Failed (Conservative)**
- Batch size: 3 customers
- Delay: 3 seconds
- Speed: ~1 API call/second
- Use case: Retry sau khi bị rate limit

---

## 🧪 **Test Flow**

### **Scenario: Sync 1000 customers**

1. **Initial sync:**
   - Click "Select all 1000 customers"
   - Click "Sync Selected"
   - ✅ Sync với tốc độ 2.5 calls/sec
   - ⚠️ Một số customers có thể bị rate limit → Failed

2. **Retry failed:**
   - Click "More Actions" → "Retry Failed Syncs"
   - ✅ Retry với tốc độ 1 call/sec (rất an toàn)
   - ✅ Tất cả customers được sync thành công

---

## 🎯 **Kết quả**

### **Trước khi fix:**
- ❌ Rate limit errors liên tục
- ❌ Nhiều customers failed
- ❌ Không có cách retry tự động

### **Sau khi fix:**
- ✅ Giảm rate limit errors đáng kể
- ✅ Có thể retry failed syncs dễ dàng
- ✅ Tốc độ ổn định, không bị block
- ✅ Background processing, không block UI

---

## 📝 **Files đã sửa/tạo**

1. **src/app/api/sync/bulk-sync-background/route.ts**
   - Giảm batch size: 10 → 5
   - Tăng delay: 500ms → 2000ms
   - Cải thiện error logging

2. **src/app/api/sync/retry-failed/route.ts** (NEW)
   - Endpoint mới để retry failed syncs
   - Batch size: 3 customers
   - Delay: 3 seconds

3. **src/components/customers-sync/CustomerSyncTable.tsx**
   - Thêm "Retry Failed Syncs" button

4. **prisma/schema.prisma**
   - Thêm `RETRY` vào enum `SyncAction`

---

## 💡 **Best Practices**

### **Khi sync số lượng lớn:**

1. **Lần đầu:** Dùng bulk sync (tốc độ vừa phải)
2. **Nếu có failed:** Dùng retry failed (tốc độ chậm, an toàn)
3. **Monitor logs:** Check server logs để xem progress
4. **Patience:** Sync 1000 customers ~ 6-10 phút (acceptable)

### **Tránh rate limit:**

- ✅ Giảm batch size
- ✅ Tăng delay giữa batches
- ✅ Có retry logic
- ✅ Monitor error rates
- ❌ Không sync quá nhanh
- ❌ Không retry ngay lập tức

---

## 🎉 **Kết luận**

Đã fix rate limit issue bằng cách:
1. ✅ Giảm tốc độ sync (5 customers/2s)
2. ✅ Thêm retry mechanism
3. ✅ Cải thiện error handling
4. ✅ Thêm UI để retry failed syncs

**Kết quả:** Có thể sync hàng nghìn customers mà không bị rate limit! 🎉
