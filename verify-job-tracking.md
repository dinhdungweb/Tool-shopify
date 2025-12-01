# Verify Job Tracking - Checklist

## APIs Đã Fix và Cần Test

### ✅ Pull Products APIs (Đã có job tracking)
- [x] **POST /api/nhanh/pull-products**
  - Tạo job type: `PULL_NHANH_PRODUCTS`
  - Updates progress real-time
  - Tracks: speed, pages, created, updated

- [x] **POST /api/shopify/pull-products-sync**
  - Tạo job type: `PULL_SHOPIFY_PRODUCTS`
  - Updates progress real-time
  - Tracks: speed, pages, created, updated, statusFilter

### ✅ Pull Customers APIs (Vừa thêm job tracking)
- [x] **POST /api/nhanh/pull-customers-all**
  - Tạo job type: `PULL_NHANH_CUSTOMERS`
  - Updates progress real-time
  - Tracks: filters, batches, created, updated, skipped

- [x] **POST /api/shopify/pull-customers**
  - Tạo job type: `PULL_SHOPIFY_CUSTOMERS`
  - Updates progress real-time
  - Tracks: query, speed, pages, created, updated

## Cách Test

### 1. Khởi động lại server
```bash
npm run dev
```

### 2. Test Pull Nhanh Products
```bash
# Trigger pull
curl -X POST http://localhost:3000/api/nhanh/pull-products

# Check jobs
node check-background-jobs.js
```

**Expected Result:**
- Job type: `PULL_NHANH_PRODUCTS`
- Status: `RUNNING` → `COMPLETED`
- Progress updates mỗi page
- Metadata có: speed, pages, created, updated

### 3. Test Pull Shopify Products
```bash
# Trigger pull
curl -X POST http://localhost:3000/api/shopify/pull-products-sync \
  -H "Content-Type: application/json" \
  -d '{"status": "active"}'

# Check jobs
node check-background-jobs.js
```

**Expected Result:**
- Job type: `PULL_SHOPIFY_PRODUCTS`
- Status: `RUNNING` → `COMPLETED`
- Progress updates mỗi page
- Metadata có: statusFilter, speed, pages, created, updated

### 4. Test Pull Nhanh Customers
```bash
# Trigger pull
curl -X POST http://localhost:3000/api/nhanh/pull-customers-all \
  -H "Content-Type: application/json" \
  -d '{}'

# Check jobs
node check-background-jobs.js
```

**Expected Result:**
- Job type: `PULL_NHANH_CUSTOMERS`
- Status: `RUNNING` → `COMPLETED`
- Progress updates mỗi batch
- Metadata có: filters, batches, created, updated, skipped

### 5. Test Pull Shopify Customers
```bash
# Trigger pull
curl -X POST http://localhost:3000/api/shopify/pull-customers \
  -H "Content-Type: application/json" \
  -d '{}'

# Check jobs
node check-background-jobs.js
```

**Expected Result:**
- Job type: `PULL_SHOPIFY_CUSTOMERS`
- Status: `RUNNING` → `COMPLETED`
- Progress updates mỗi page
- Metadata có: query, speed, pages, created, updated

### 6. Test UI Job Tracking Table

1. Mở browser: `http://localhost:3000/job-tracking` (hoặc đường dẫn tương ứng)
2. Trigger một pull operation từ UI
3. Verify:
   - ✅ Job xuất hiện ngay lập tức
   - ✅ Progress bar updates real-time
   - ✅ Status badge updates (RUNNING → COMPLETED)
   - ✅ Speed và metadata hiển thị đúng
   - ✅ Auto-refresh hoạt động khi có running jobs

## Job Types Trong System

| Job Type | API Endpoint | Description |
|----------|-------------|-------------|
| `PULL_NHANH_PRODUCTS` | `/api/nhanh/pull-products` | Pull products from Nhanh.vn |
| `PULL_SHOPIFY_PRODUCTS` | `/api/shopify/pull-products-sync` | Pull products from Shopify |
| `PULL_NHANH_CUSTOMERS` | `/api/nhanh/pull-customers-all` | Pull customers from Nhanh.vn |
| `PULL_SHOPIFY_CUSTOMERS` | `/api/shopify/pull-customers` | Pull customers from Shopify |
| `PRODUCT_SYNC` | `/api/sync/bulk-sync-products` | Sync products between systems |
| `CUSTOMER_SYNC` | `/api/sync/bulk-sync` | Sync customers between systems |
| `AUTO_MATCH_PRODUCTS` | `/api/sync/auto-match-products` | Auto-match products |
| `AUTO_MATCH_CUSTOMERS` | `/api/sync/auto-match` | Auto-match customers |

## Troubleshooting

### Jobs không hiển thị
1. Check database connection:
   ```bash
   node test-create-job.js
   ```

2. Check nếu có multiple PrismaClient instances:
   ```bash
   grep -r "new PrismaClient()" src/
   ```

3. Check logs trong console khi trigger pull

### Progress không update
1. Verify job được tạo:
   ```bash
   node check-background-jobs.js
   ```

2. Check logs xem có error khi update job không

3. Verify auto-refresh đang bật trong UI

### Jobs bị stuck ở RUNNING
1. Check server logs xem có error không
2. Manually update job status:
   ```bash
   node -e "const { PrismaClient } = require('@prisma/client'); const p = new PrismaClient(); p.backgroundJob.updateMany({ where: { status: 'RUNNING' }, data: { status: 'FAILED', error: 'Manually stopped', completedAt: new Date() } }).then(() => console.log('Updated')).finally(() => p.$disconnect());"
   ```

## Success Criteria

✅ Tất cả 4 pull APIs tạo jobs thành công
✅ Jobs hiển thị trong Job Tracking table
✅ Progress updates real-time
✅ Status transitions đúng (RUNNING → COMPLETED/FAILED)
✅ Metadata được track đầy đủ
✅ Auto-refresh hoạt động
✅ No connection pool issues
✅ No data inconsistency
