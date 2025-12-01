# Job Tracking Fix - Background Jobs Không Hiển Thị

## Vấn Đề

Có 2 background jobs đang chạy nhưng không hiển thị trong Job Tracking table.

## Nguyên Nhân

Sau khi kiểm tra, phát hiện **vấn đề chính**: Nhiều API routes và services đang tạo **PrismaClient instances mới** thay vì sử dụng **singleton instance** từ `@/lib/prisma`.

### Tại Sao Đây Là Vấn Đề?

1. **Multiple Connection Pools**: Mỗi `new PrismaClient()` tạo một connection pool riêng
2. **Data Inconsistency**: Jobs được tạo trong một connection có thể không visible ngay lập tức cho connections khác
3. **Resource Waste**: Nhiều connection pools không cần thiết
4. **Transaction Issues**: Có thể gây ra vấn đề với transactions và data consistency

### Code Có Vấn Đề

```typescript
// ❌ SAI - Tạo PrismaClient mới
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

// ✅ ĐÚNG - Sử dụng singleton
import { prisma } from "@/lib/prisma";
```

## Giải Pháp

### Files Đã Sửa

#### 1. Fixed PrismaClient Singleton Issues

1. **src/app/api/nhanh/pull-products/route.ts**
   - Thay `new PrismaClient()` bằng `import { prisma } from "@/lib/prisma"`

2. **src/app/api/shopify/pull-products-sync/route.ts**
   - Thay `new PrismaClient()` bằng `import { prisma } from "@/lib/prisma"`

3. **src/lib/cron-scheduler.ts**
   - Thay `new PrismaClient()` bằng `import { prisma } from './prisma'`

4. **src/lib/product-scheduler.ts**
   - Thay `new PrismaClient()` bằng `import { prisma } from './prisma'`

5. **src/lib/sale-scheduler.ts**
   - Thay `new PrismaClient()` bằng `import { prisma } from './prisma'`

6. **src/app/api/sync/sync-product/route.ts**
   - Thay `new PrismaClient()` bằng `import { prisma } from "@/lib/prisma"`

#### 2. Added Job Tracking for Customer Pull APIs

7. **src/app/api/nhanh/pull-customers-all/route.ts**
   - ✅ Thêm tạo BackgroundJob khi bắt đầu pull
   - ✅ Thêm update job progress sau mỗi batch
   - ✅ Thêm update job status khi completed/failed
   - ✅ Thêm metadata tracking (filters, created, updated, skipped)

8. **src/app/api/shopify/pull-customers/route.ts**
   - ✅ Thêm tạo BackgroundJob khi bắt đầu pull
   - ✅ Thêm update job progress sau mỗi page
   - ✅ Thêm update job status khi completed/failed
   - ✅ Thêm metadata tracking (query, speed, pages, created, updated)

### Files Còn Lại Cần Sửa (Không Ảnh Hưởng Trực Tiếp Đến Job Tracking)

Các files sau cũng đang sử dụng `new PrismaClient()` và nên được sửa để consistency:

- `src/app/api/sync/schedule/global/route.ts`
- `src/app/api/sync/products/auto-sync/route.ts`
- `src/app/api/sync/product-mapping/route.ts`
- `src/app/api/sync/fix-variant-ids/route.ts`
- `src/app/api/sync/auto-sync/route.ts`
- `src/app/api/shopify/search-products/route.ts`
- `src/app/api/shopify/local-products/route.ts`
- `src/app/api/nhanh/local-products/route.ts`

## Cách Test

1. **Xóa tất cả jobs cũ** (nếu có):
   ```bash
   node -e "const { PrismaClient } = require('@prisma/client'); const p = new PrismaClient(); p.backgroundJob.deleteMany().then(() => console.log('Deleted')).finally(() => p.$disconnect());"
   ```

2. **Khởi động lại server**:
   ```bash
   npm run dev
   ```

3. **Trigger một pull operation**:
   - Vào UI và click "Pull Nhanh Products" hoặc "Pull Shopify Products"

4. **Kiểm tra Job Tracking**:
   - Vào trang Job Tracking
   - Bạn sẽ thấy job mới xuất hiện ngay lập tức
   - Job sẽ update progress real-time

5. **Verify trong database**:
   ```bash
   node check-background-jobs.js
   ```

## Kết Quả Mong Đợi

- ✅ Jobs được tạo sẽ hiển thị ngay lập tức trong Job Tracking table
- ✅ Progress updates real-time
- ✅ Không còn vấn đề về connection pool
- ✅ Data consistency được đảm bảo

## Best Practices

### Luôn Sử Dụng Singleton PrismaClient

```typescript
// ✅ ĐÚNG
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest) {
  const job = await prisma.backgroundJob.create({
    data: { ... }
  });
  // ...
}
```

### Tại Sao Singleton Pattern?

1. **Single Connection Pool**: Tất cả requests share cùng một connection pool
2. **Better Performance**: Reuse connections thay vì tạo mới
3. **Data Consistency**: Tất cả operations thấy cùng một state
4. **Resource Efficiency**: Giảm memory và connection overhead

### Singleton Implementation

File `src/lib/prisma.ts`:

```typescript
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
```

## Scripts Hỗ Trợ

### check-background-jobs.js
Kiểm tra tất cả jobs trong database:
```bash
node check-background-jobs.js
```

### test-create-job.js
Test việc tạo và verify jobs:
```bash
node test-create-job.js
```

### simulate-api-call.js
Simulate API call để tạo jobs và query:
```bash
node simulate-api-call.js
```

## Vấn Đề Thứ 2: Customer Pull APIs Không Tạo Jobs

### Phát Hiện

Sau khi kiểm tra, phát hiện thêm vấn đề:
- ❌ `pull-customers-all` (Nhanh) không tạo BackgroundJob
- ❌ `pull-customers` (Shopify) không tạo BackgroundJob
- ✅ `pull-products` (cả Nhanh và Shopify) đã tạo BackgroundJob

### Nguyên Nhân

Các API pull customers chỉ sử dụng `PullProgress` để track progress nhưng **không tạo job trong bảng `background_jobs`**. Điều này khiến:
- Jobs không hiển thị trong Job Tracking table
- Không có real-time progress updates trong UI
- Không có centralized job monitoring

### Giải Pháp

Đã thêm job tracking cho cả 2 APIs:

1. **Tạo BackgroundJob khi bắt đầu pull**
   ```typescript
   const job = await prisma.backgroundJob.create({
     data: {
       type: "PULL_NHANH_CUSTOMERS", // hoặc "PULL_SHOPIFY_CUSTOMERS"
       total: 0,
       status: "RUNNING",
       metadata: { filters/query },
     },
   });
   ```

2. **Update progress sau mỗi batch/page**
   ```typescript
   await prisma.backgroundJob.update({
     where: { id: jobId },
     data: {
       total: totalProcessed,
       processed: totalProcessed,
       successful: created + updated,
       failed,
       metadata: { speed, pages, created, updated },
     },
   });
   ```

3. **Update status khi hoàn thành hoặc lỗi**
   ```typescript
   await prisma.backgroundJob.update({
     where: { id: jobId },
     data: {
       status: "COMPLETED", // hoặc "FAILED"
       completedAt: new Date(),
       metadata: { final stats },
     },
   });
   ```

## Tóm Tắt

### Vấn Đề 1: Multiple PrismaClient Instances
- **Nguyên nhân**: Nhiều files tạo `new PrismaClient()` thay vì dùng singleton
- **Hậu quả**: Data inconsistency, connection pool exhaustion
- **Giải pháp**: Sử dụng `import { prisma } from "@/lib/prisma"` cho tất cả files

### Vấn Đề 2: Customer Pull APIs Thiếu Job Tracking
- **Nguyên nhân**: APIs chỉ dùng PullProgress, không tạo BackgroundJob
- **Hậu quả**: Jobs không hiển thị trong Job Tracking table
- **Giải pháp**: Thêm job creation, progress updates, và status updates

### Kết Quả
✅ Tất cả pull operations (products + customers) giờ đây đều:
- Tạo BackgroundJob khi bắt đầu
- Update progress real-time
- Hiển thị trong Job Tracking table
- Track metadata chi tiết (speed, pages, created, updated, etc.)
