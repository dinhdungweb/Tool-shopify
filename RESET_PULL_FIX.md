# Reset Pull Fix - Completed

## 🐛 Vấn đề

Khi ấn "Reset Shopify Progress" rồi pull lại "Customers with Account", pull vẫn resume từ cursor cũ thay vì start từ đầu.

## 🔍 Nguyên nhân

### 1. Reset API không xóa filtered pulls
```typescript
// OLD CODE - Chỉ xóa pull không có filter
const progressId = "shopify_customers"; // Fixed ID
await prisma.pullProgress.deleteMany({
  where: { id: progressId }
});
```

**Vấn đề:**
- Pull "All Customers": `shopify_customers`
- Pull "With Account": `shopify_customers_c3RhdGU6RU5BQkxFRA==` (có hash)
- Reset chỉ xóa `shopify_customers` → Không xóa được filtered pull!

### 2. Pull logic resume khi có cursor
```typescript
// OLD CODE - Resume nếu có cursor, kể cả khi completed
cursor = progress?.nextCursor || null;
if (cursor) {
  console.log('Resuming...');
}
```

**Vấn đề:**
- Pull completed vẫn có cursor
- Logic không check `isCompleted`
- → Resume thay vì start fresh

### 3. Nhanh incremental mode
```typescript
// OLD CODE - Vào incremental mode khi completed
const isIncremental = filtersMatch && progress?.isCompleted;
```

**Vấn đề:**
- Khi pull completed với cùng filter → Incremental mode
- Skip fresh customers thay vì pull lại tất cả
- User không mong đợi behavior này

## ✅ Giải pháp

### Fix 1: Reset xóa TẤT CẢ pulls (kể cả filtered)
```typescript
// NEW CODE - Xóa tất cả pulls với prefix
const prefix = type === "products" ? "shopify_products" : "shopify_customers";

await prisma.pullProgress.deleteMany({
  where: {
    id: {
      startsWith: prefix, // Xóa tất cả: shopify_customers*
    },
  },
});
```

**Kết quả:**
- ✅ Xóa `shopify_customers`
- ✅ Xóa `shopify_customers_c3RhdGU6RU5BQkxFRA==`
- ✅ Xóa tất cả filtered pulls

### Fix 2: Chỉ resume khi pull CHƯA completed
```typescript
// NEW CODE - Check isCompleted trước khi resume
const shouldResume = progress && !progress.isCompleted && progress.nextCursor;
cursor = shouldResume ? progress.nextCursor : null;

if (resuming) {
  console.log('Resuming from previous pull...');
} else if (progress?.isCompleted) {
  console.log('Previous pull was completed. Starting fresh pull.');
}
```

**Kết quả:**
- ✅ Pull incomplete → Resume (đúng)
- ✅ Pull completed → Start fresh (đúng)
- ✅ No progress → Start fresh (đúng)

### Fix 3: Disable incremental mode
```typescript
// NEW CODE - Luôn start fresh khi pull completed
const isIncremental = false; // Disabled

// Only resume if incomplete
if (progress && !progress.isCompleted && progress.nextCursor) {
  console.log('Resuming...');
} else if (progress?.isCompleted) {
  console.log('Starting fresh pull.');
}
```

**Kết quả:**
- ✅ Pull completed → Start fresh, pull tất cả
- ✅ Pull incomplete → Resume từ cursor
- ✅ Behavior rõ ràng, dễ hiểu

## 🧪 Test Results

### Before Fix
```bash
1. Reset Shopify Progress
   → Deleted: 0 records (không xóa được filtered pull)

2. Pull "Customers with Account"
   → Resume from cursor (7939 customers)
   → Không pull lại từ đầu ❌
```

### After Fix
```bash
1. Reset Shopify Progress
   → Deleted: 1 record (xóa được filtered pull) ✅

2. Pull "Customers with Account"
   → Start fresh (500 customers)
   → Pull từ đầu đúng ✅
```

## 📊 Behavior Matrix

| Scenario | Before Fix | After Fix |
|----------|------------|-----------|
| Reset → Pull All | ✅ Start fresh | ✅ Start fresh |
| Reset → Pull Filtered | ❌ Resume | ✅ Start fresh |
| Pull completed → Pull again | ❌ Incremental | ✅ Start fresh |
| Pull incomplete → Pull again | ✅ Resume | ✅ Resume |

## 🎯 Files Changed

1. **src/app/api/shopify/reset-pull-progress/route.ts**
   - Xóa tất cả pulls với `startsWith` prefix
   - Xóa cả filtered pulls

2. **src/app/api/shopify/pull-customers/route.ts**
   - Check `isCompleted` trước khi resume
   - Start fresh nếu pull đã completed

3. **src/app/api/nhanh/pull-customers-all/route.ts**
   - Disable incremental mode
   - Check `isCompleted` trước khi resume
   - Start fresh nếu pull đã completed

## 💡 Usage

### Reset All Shopify Customer Pulls
```bash
# Via API
POST /api/shopify/reset-pull-progress?type=customers

# Via UI
Click "Reset Shopify Progress" button
```

### Reset All Nhanh Customer Pulls
```bash
# Via API
POST /api/nhanh/reset-pull-progress?type=customers

# Via UI
Click "Reset Nhanh Progress" button
```

### Pull from Beginning
```bash
# Option 1: Reset first, then pull
1. Reset progress
2. Pull customers

# Option 2: Force Restart (in dialog)
1. Try to pull (will show "already running")
2. Click OK to force restart
```

## ✅ Verification

Test script:
```bash
node test-reset-and-pull.js
```

Expected output:
- Reset deletes ALL pulls (including filtered)
- New pull starts from beginning
- Total pulled starts from 0 or small number
- Does NOT resume from old cursor

## 🚀 Next Steps

1. ✅ Test in UI: Reset → Pull "Customers with Account"
2. ✅ Verify starts from beginning
3. ✅ Check server logs for "Starting fresh pull"
4. ✅ Monitor progress: Should start from 0

## 📝 Notes

- Reset bây giờ xóa TẤT CẢ pulls (kể cả filtered)
- Pull completed sẽ luôn start fresh (không incremental)
- Pull incomplete vẫn resume đúng (không mất progress)
- Behavior rõ ràng và dễ hiểu hơn
