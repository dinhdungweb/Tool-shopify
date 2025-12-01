# Next Steps Checklist - Job Tracking

## ✅ Đã Hoàn Thành

- [x] Fix PrismaClient singleton issues (6 files)
- [x] Add job tracking cho Pull Nhanh Products
- [x] Add job tracking cho Pull Shopify Products  
- [x] Add job tracking cho Pull Nhanh Customers
- [x] Add job tracking cho Pull Shopify Customers
- [x] Verify Bulk Sync Products có job tracking
- [x] Verify Bulk Sync Customers có job tracking
- [x] Tạo documentation (JOB_TRACKING_FIX.md)
- [x] Tạo audit report (JOB_TRACKING_AUDIT.md)
- [x] Tạo test scripts (check-background-jobs.js, etc.)

## ✅ Vừa Hoàn Thành (Auto-Match Tracking)

- [x] **Add job tracking cho Auto-Match Products**
  - File: `src/app/api/sync/auto-match-products/route.ts`
  - Job Type: `AUTO_MATCH_PRODUCTS`
  - ✅ DONE - Thêm job creation, progress updates, completion tracking

- [x] **Add job tracking cho Auto-Match Customers**
  - File: `src/app/api/sync/auto-match/route.ts`
  - Job Type: `AUTO_MATCH_CUSTOMERS`
  - ✅ DONE - Thêm job creation, batch progress updates, completion tracking

- [x] **Update JobTrackingTable UI**
  - Thêm filter options cho AUTO_MATCH_PRODUCTS và AUTO_MATCH_CUSTOMERS
  - Labels đã có sẵn trong JOB_TYPE_LABELS

## 🔄 Cần Làm Tiếp (Optional)

### Priority MEDIUM 🟡 - Nice to Have (Giờ là optional)

### Priority MEDIUM 🟡 - Nice to Have

- [ ] **Add job tracking cho Auto-Match SQL**
  - File: `src/app/api/sync/auto-match-sql/route.ts`
  - Job Type: `AUTO_MATCH_CUSTOMERS`
  - Estimated Time: 10-15 phút
  - Impact: MEDIUM - Fast nhưng nên track cho consistency

- [ ] **Add job tracking cho Auto-Match Batch**
  - File: `src/app/api/sync/auto-match-batch/route.ts`
  - Job Type: `AUTO_MATCH_CUSTOMERS`
  - Estimated Time: 15-20 phút
  - Impact: MEDIUM - Batch processing benefits from tracking

### Priority LOW 🟢 - Optional

- [ ] **Add job tracking cho Retry Failed**
  - File: `src/app/api/sync/retry-failed/route.ts`
  - Job Type: `RETRY_FAILED_SYNC`
  - Estimated Time: 10 phút
  - Impact: LOW - Quick operation, ít khi dùng

### Cleanup & Optimization 🧹

- [ ] **Fix remaining PrismaClient instances**
  - Files còn lại: 5 files (xem JOB_TRACKING_FIX.md)
  - Không ảnh hưởng trực tiếp đến job tracking
  - Nên fix để consistency

- [ ] **Add job type labels to JobTrackingTable**
  - Update `JOB_TYPE_LABELS` trong `JobTrackingTable.tsx`
  - Thêm labels cho các job types mới

## 📊 Progress Tracking

### Current Coverage ✅ UPDATED
- **Pull Operations**: 4/4 (100%) ✅
- **Bulk Sync Operations**: 2/2 (100%) ✅
- **Auto-Match Operations**: 2/4 (50%) ✅ (Main ones done!)
- **Retry Operations**: 0/1 (0%) ⏸️
- **Overall**: 8/11 (73%)

### If Complete All (Optional)
- **Pull Operations**: 4/4 (100%) ✅
- **Bulk Sync Operations**: 2/2 (100%) ✅
- **Auto-Match Operations**: 4/4 (100%) ✅
- **Retry Operations**: 1/1 (100%) ✅
- **Overall**: 11/11 (100%)

## 🎯 Recommended Action Plan

### Option 1: Minimal (Current State)
**Status**: ✅ DONE
- All pull operations tracked
- All bulk sync operations tracked
- **Coverage**: 55%
- **Good for**: Basic monitoring

### Option 2: Recommended (Add Auto-Match) ✅ DONE
**Effort**: ~30-40 phút
- ✅ Added tracking cho 2 auto-match APIs (products & customers)
- **Coverage**: 73%
- **Good for**: Complete visibility of long-running operations
- **Status**: COMPLETED!

### Option 3: Complete (Add Everything)
**Effort**: ~60-80 phút
- Add tracking cho tất cả APIs
- **Coverage**: 100%
- **Good for**: Perfect monitoring, consistency

## 🚀 Quick Start Guide

### Nếu Muốn Thêm Auto-Match Products Tracking

1. Mở file: `src/app/api/sync/auto-match-products/route.ts`

2. Thêm job creation ở đầu POST handler:
```typescript
const job = await prisma.backgroundJob.create({
  data: {
    type: "AUTO_MATCH_PRODUCTS",
    total: 0,
    status: "RUNNING",
  },
});
```

3. Pass jobId vào background function:
```typescript
autoMatchProductsBackground(dryRun, job.id);
```

4. Update progress trong background function:
```typescript
await prisma.backgroundJob.update({
  where: { id: jobId },
  data: {
    total: matches.length,
    processed: matches.length,
    successful: results.matched,
    failed: results.failed,
  },
});
```

5. Complete job khi xong:
```typescript
await prisma.backgroundJob.update({
  where: { id: jobId },
  data: {
    status: "COMPLETED",
    completedAt: new Date(),
  },
});
```

### Nếu Muốn Thêm Auto-Match Customers Tracking

Tương tự như trên, nhưng:
- File: `src/app/api/sync/auto-match/route.ts`
- Job Type: `AUTO_MATCH_CUSTOMERS`
- Update progress mỗi batch (không phải mỗi customer)

## 📝 Notes

- Tất cả các thay đổi đã được document trong `JOB_TRACKING_FIX.md`
- Test scripts đã sẵn sàng: `check-background-jobs.js`, `test-create-job.js`
- Verify guide: `verify-job-tracking.md`
- Audit report: `JOB_TRACKING_AUDIT.md`

## ✅ Completed!

**Status**: Auto-match tracking đã được thêm thành công!

### What Was Added:
- ✅ Auto-Match Products job tracking
- ✅ Auto-Match Customers job tracking
- ✅ Progress updates mỗi batch
- ✅ Metadata tracking (matches, skipped, speed, etc.)
- ✅ UI filter options updated

### Coverage: 73% (8/11 APIs)
Tất cả **long-running operations** giờ đã có job tracking. Các APIs còn lại (auto-match-sql, auto-match-batch, retry-failed) là optional và có thể thêm sau nếu cần.
