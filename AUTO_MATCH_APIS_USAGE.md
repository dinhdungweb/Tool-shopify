# Auto-Match APIs - Usage Analysis

## 📊 Tổng Quan

Hệ thống có **4 auto-match APIs**, nhưng chỉ **2 APIs đang được sử dụng** trong UI.

## ✅ APIs Đang Được Sử Dụng (2/4)

### 1. Auto-Match Products (`/api/sync/auto-match-products`)

**Status**: ✅ **ĐANG DÙNG** + ✅ **CÓ JOB TRACKING**

**Được gọi từ**: `ProductSyncTable.tsx`

**Method trong api-client**: `syncClient.autoMatchProducts(dryRun)`

**Chức năng**:
- Match products giữa Nhanh và Shopify bằng SKU
- Sử dụng SQL JOIN để tìm matches nhanh
- Chỉ tạo mappings cho 1-to-1 matches (exact matches)

**UI Flow**:
```
Products Sync Page 
  → More Actions dropdown 
    → "Auto-Match by SKU" button
      → Calls syncClient.autoMatchProducts()
        → POST /api/sync/auto-match-products
```

**Features**:
- ✅ Job tracking enabled
- ✅ Progress updates per batch
- ✅ Metadata: potentialMatches, exactMatches, created, skipped, speed
- ✅ Dry run support

### 2. Auto-Match Batch (`/api/sync/auto-match-batch`)

**Status**: ✅ **ĐANG DÙNG** + ❌ **CHƯA CÓ JOB TRACKING**

**Được gọi từ**: `CustomerSyncTable.tsx`

**Method trong api-client**: `syncClient.autoMatchBatch(dryRun, batchSize)`

**Chức năng**:
- Match customers giữa Nhanh và Shopify bằng phone number
- Batch-based processing cho large datasets (200k+)
- Match bằng 3 nguồn phone:
  - Primary phone
  - Default address phone
  - Phone numbers trong notes

**UI Flow**:
```
Customers Sync Page 
  → More Actions dropdown 
    → "Auto-Match by Phone" button
      → Calls syncClient.autoMatchBatch()
        → POST /api/sync/auto-match-batch
```

**Features**:
- ❌ No job tracking (should add!)
- ✅ Batch processing
- ✅ Multiple phone sources
- ✅ Dry run support

## ❌ APIs KHÔNG Được Sử Dụng (2/4)

### 3. Auto-Match (`/api/sync/auto-match`)

**Status**: ❌ **KHÔNG DÙNG** + ✅ **CÓ JOB TRACKING** (vừa thêm)

**Method trong api-client**: Không có! (Không được expose)

**Chức năng**:
- Match customers bằng phone number
- Load tất cả Shopify customers vào memory
- Build phone lookup map (O(1) lookup)
- Process in batches

**Tại sao không dùng?**:
- UI đang dùng `autoMatchBatch` thay vì API này
- `autoMatchBatch` có vẻ là phiên bản cải tiến
- API này có thể là legacy code

**Recommendation**: 
- ⚠️ **Có thể XÓA** hoặc deprecate
- Hoặc update UI để dùng API này thay vì autoMatchBatch
- Vì API này **đã có job tracking** rồi!

### 4. Auto-Match SQL (`/api/sync/auto-match-sql`)

**Status**: ❌ **KHÔNG DÙNG** + ❌ **CHƯA CÓ JOB TRACKING**

**Method trong api-client**: `syncClient.autoMatchSQL(dryRun)`

**Chức năng**:
- Ultra-fast SQL-based matching cho customers
- Sử dụng raw SQL queries
- Perfect cho large datasets (200k+)

**Tại sao không dùng?**:
- Không có button trong UI
- Có thể là experimental/alternative implementation
- UI đang dùng `autoMatchBatch` thay thế

**Recommendation**: 
- ⚠️ **Có thể XÓA** nếu không cần
- Hoặc thêm vào UI như một option "Fast SQL Match"

## 🎯 Khuyến Nghị

### Option 1: Giữ Nguyên (Recommended)

**Giữ 2 APIs đang dùng, xóa 2 APIs không dùng**

✅ **Keep**:
- `auto-match-products` (đang dùng, có job tracking)
- `auto-match-batch` (đang dùng, cần thêm job tracking)

❌ **Remove**:
- `auto-match` (không dùng, duplicate với auto-match-batch)
- `auto-match-sql` (không dùng, experimental)

**Actions**:
1. Add job tracking cho `auto-match-batch`
2. Remove `auto-match` và `auto-match-sql` APIs
3. Remove methods từ api-client
4. Update documentation

### Option 2: Consolidate (Alternative)

**Thay thế auto-match-batch bằng auto-match**

Vì `auto-match` **đã có job tracking** rồi!

**Actions**:
1. Update `CustomerSyncTable.tsx` để dùng `auto-match` thay vì `auto-match-batch`
2. Add method `autoMatch()` vào api-client
3. Remove `auto-match-batch` và `auto-match-sql`
4. Test thoroughly

### Option 3: Keep All (Not Recommended)

**Giữ tất cả 4 APIs**

**Actions**:
1. Add job tracking cho `auto-match-batch`
2. Add job tracking cho `auto-match-sql`
3. Add UI buttons cho `auto-match` và `auto-match-sql`
4. Document differences

**Cons**:
- Confusing có nhiều options
- Maintenance overhead
- User không biết chọn cái nào

## 📋 Comparison Table

| API | Used in UI | Job Tracking | Speed | Best For |
|-----|-----------|--------------|-------|----------|
| `auto-match-products` | ✅ Yes | ✅ Yes | Fast (SQL) | Products by SKU |
| `auto-match-batch` | ✅ Yes | ❌ No | Medium | Customers (current) |
| `auto-match` | ❌ No | ✅ Yes | Medium | Customers (alternative) |
| `auto-match-sql` | ❌ No | ❌ No | Very Fast | Customers (experimental) |

## 🔧 Implementation Details

### Current Usage in UI

**Products Sync** (`ProductSyncTable.tsx`):
```typescript
async function handleAutoMatch() {
  const result = await syncClient.autoMatchProducts(false);
  // Shows: Total, Matched, Skipped, Failed
}
```

**Customers Sync** (`CustomerSyncTable.tsx`):
```typescript
async function handleAutoMatch() {
  const result = await syncClient.autoMatchBatch(false);
  // Shows: Total, Matched, Skipped
}
```

### API Client Methods

**Exposed** (có trong api-client):
- ✅ `autoMatchProducts(dryRun)` → `/api/sync/auto-match-products`
- ✅ `autoMatchBatch(dryRun, batchSize)` → `/api/sync/auto-match-batch`
- ✅ `autoMatchSQL(dryRun)` → `/api/sync/auto-match-sql`

**Not Exposed**:
- ❌ No method for `/api/sync/auto-match`

## 🎬 Recommended Action Plan

### Phase 1: Quick Fix (Recommended)

1. **Add job tracking cho auto-match-batch** (đang dùng)
   - File: `src/app/api/sync/auto-match-batch/route.ts`
   - Job Type: `AUTO_MATCH_CUSTOMERS`
   - Estimated: 15-20 phút

2. **Update documentation**
   - Mark `auto-match` và `auto-match-sql` as deprecated
   - Document that only 2 APIs are actively used

### Phase 2: Cleanup (Optional)

3. **Remove unused APIs** (sau khi confirm không cần)
   - Delete `src/app/api/sync/auto-match/route.ts`
   - Delete `src/app/api/sync/auto-match-sql/route.ts`
   - Remove methods từ `api-client.ts`

4. **Update tests and docs**

## 💡 Decision Matrix

| Scenario | Recommendation |
|----------|---------------|
| **Need quick fix** | Add job tracking to `auto-match-batch` only |
| **Want clean codebase** | Remove unused APIs (`auto-match`, `auto-match-sql`) |
| **Want best performance** | Switch to `auto-match-sql` (fastest) |
| **Want consistency** | Use `auto-match` (already has job tracking) |
| **Unsure** | Keep current setup, add job tracking to `auto-match-batch` |

## ✅ Current Status

**After recent changes**:
- ✅ `auto-match-products`: Has job tracking, actively used
- ✅ `auto-match`: Has job tracking, **NOT used in UI**
- ❌ `auto-match-batch`: **NO job tracking**, actively used
- ❌ `auto-match-sql`: NO job tracking, NOT used

**Recommendation**: Add job tracking to `auto-match-batch` để complete coverage cho APIs đang được sử dụng.
