# Job Tracking Audit - Tổng Quan Toàn Bộ APIs

## ✅ APIs Đã Có Job Tracking

| API Endpoint | Job Type | Status | Notes |
|-------------|----------|--------|-------|
| `/api/nhanh/pull-products` | `PULL_NHANH_PRODUCTS` | ✅ Fixed | Đã sửa PrismaClient singleton |
| `/api/shopify/pull-products-sync` | `PULL_SHOPIFY_PRODUCTS` | ✅ Fixed | Đã sửa PrismaClient singleton |
| `/api/nhanh/pull-customers-all` | `PULL_NHANH_CUSTOMERS` | ✅ Added | Vừa thêm job tracking |
| `/api/shopify/pull-customers` | `PULL_SHOPIFY_CUSTOMERS` | ✅ Added | Vừa thêm job tracking |
| `/api/sync/bulk-sync-products` | `PRODUCT_SYNC` | ✅ Has | Đã có sẵn job tracking |
| `/api/sync/bulk-sync-background` | `CUSTOMER_SYNC` | ✅ Has | Đã có sẵn job tracking |

## ❌ APIs Chưa Có Job Tracking

### Auto-Match Operations (Nên Thêm)

| API Endpoint | Suggested Job Type | Priority | Reason |
|-------------|-------------------|----------|--------|
| `/api/sync/auto-match-products` | `AUTO_MATCH_PRODUCTS` | 🔴 HIGH | Long-running, processes nhiều products |
| `/api/sync/auto-match` | `AUTO_MATCH_CUSTOMERS` | 🔴 HIGH | Long-running, processes nhiều customers |
| `/api/sync/auto-match-sql` | `AUTO_MATCH_CUSTOMERS` | 🟡 MEDIUM | Fast SQL-based, nhưng vẫn nên track |
| `/api/sync/auto-match-batch` | `AUTO_MATCH_CUSTOMERS` | 🟡 MEDIUM | Batch processing, nên track progress |

### Retry Operations (Có Thể Thêm)

| API Endpoint | Suggested Job Type | Priority | Reason |
|-------------|-------------------|----------|--------|
| `/api/sync/retry-failed` | `RETRY_FAILED_SYNC` | 🟢 LOW | Background retry, có thể track |

### Other Pull Operations (Không Cần)

| API Endpoint | Job Type | Priority | Reason |
|-------------|----------|----------|--------|
| `/api/nhanh/pull-customers` | N/A | ⚪ SKIP | Legacy API, không dùng nữa |
| `/api/nhanh/pull-customers-incremental` | N/A | ⚪ SKIP | Quick incremental, không cần track |

## Phân Tích Chi Tiết

### 1. Auto-Match Products (`/api/sync/auto-match-products`)

**Hiện Tại:**
- Sử dụng SQL JOIN để match products by SKU
- Không có job tracking
- Chỉ log ra console
- Timeout: 300s (5 phút)

**Nên Thêm Vì:**
- ⏱️ Long-running operation (có thể mất vài phút với dataset lớn)
- 📊 User cần biết progress (bao nhiêu products đã matched)
- 🔄 Có thể chạy background
- 📈 Cần track success/failure rate

**Cách Implement:**
```typescript
// Tạo job khi bắt đầu
const job = await prisma.backgroundJob.create({
  data: {
    type: "AUTO_MATCH_PRODUCTS",
    total: 0, // Sẽ update sau khi biết số lượng matches
    status: "RUNNING",
  },
});

// Update progress trong quá trình match
await prisma.backgroundJob.update({
  where: { id: job.id },
  data: {
    total: matches.length,
    processed: matches.length,
    successful: results.matched,
    failed: results.failed,
  },
});

// Complete job
await prisma.backgroundJob.update({
  where: { id: job.id },
  data: {
    status: "COMPLETED",
    completedAt: new Date(),
  },
});
```

### 2. Auto-Match Customers (`/api/sync/auto-match`)

**Hiện Tại:**
- Match customers by phone number
- Load tất cả Shopify customers vào memory
- Không có job tracking
- Timeout: 300s (5 phút)

**Nên Thêm Vì:**
- ⏱️ Very long-running (200k+ customers)
- 💾 Memory-intensive operation
- 📊 User cần biết progress real-time
- 🔄 Có thể chạy background

**Cách Implement:**
```typescript
const job = await prisma.backgroundJob.create({
  data: {
    type: "AUTO_MATCH_CUSTOMERS",
    total: unmappedCustomers.length,
    status: "RUNNING",
  },
});

// Update progress mỗi batch
await prisma.backgroundJob.update({
  where: { id: job.id },
  data: {
    processed: i + 1,
    successful: results.matched,
    failed: results.failed,
    metadata: {
      skipped: results.skipped,
      speed: `${speed} customers/sec`,
    },
  },
});
```

### 3. Auto-Match SQL (`/api/sync/auto-match-sql`)

**Hiện Tại:**
- Ultra-fast SQL-based matching
- Sử dụng raw SQL queries
- Không có job tracking

**Có Thể Thêm:**
- Fast nhưng vẫn có thể mất thời gian với dataset lớn
- Nên track để consistency với các auto-match khác
- Priority thấp hơn vì đã fast

### 4. Auto-Match Batch (`/api/sync/auto-match-batch`)

**Hiện Tại:**
- Batch-based processing cho very large datasets
- Process từng chunks nhỏ
- Không có job tracking

**Nên Thêm:**
- Batch processing rất phù hợp với job tracking
- User cần biết progress của từng batch
- Long-running operation

### 5. Retry Failed (`/api/sync/retry-failed`)

**Hiện Tại:**
- Retry failed syncs in background
- Không có job tracking

**Có Thể Thêm:**
- Priority thấp vì thường ít items
- Nhưng nên track để consistency

## Khuyến Nghị

### Phase 1: Critical (Nên Làm Ngay) 🔴

1. **Auto-Match Products** - High impact, long-running
2. **Auto-Match Customers** - High impact, very long-running

### Phase 2: Nice to Have (Có Thể Làm Sau) 🟡

3. **Auto-Match SQL** - For consistency
4. **Auto-Match Batch** - For better UX

### Phase 3: Optional (Không Bắt Buộc) 🟢

5. **Retry Failed** - Low priority, quick operation

## Tổng Kết

### Đã Có Job Tracking: 6 APIs ✅
- Pull Products (Nhanh & Shopify)
- Pull Customers (Nhanh & Shopify)
- Bulk Sync (Products & Customers)

### Nên Thêm Job Tracking: 2 APIs 🔴
- Auto-Match Products
- Auto-Match Customers

### Có Thể Thêm: 3 APIs 🟡
- Auto-Match SQL
- Auto-Match Batch
- Retry Failed

### Tổng Cộng: 11 Background Operations
- ✅ 6 đã có tracking (55%)
- 🔴 2 nên thêm ngay (18%)
- 🟡 3 có thể thêm sau (27%)

## Next Steps

1. ✅ **DONE**: Fix PrismaClient singleton issues
2. ✅ **DONE**: Add job tracking cho Pull Customers APIs
3. 🔄 **TODO**: Add job tracking cho Auto-Match Products
4. 🔄 **TODO**: Add job tracking cho Auto-Match Customers
5. ⏳ **LATER**: Consider adding tracking cho các APIs còn lại
