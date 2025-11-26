# 🚀 Webhook Queue Implementation Guide

## Tại sao cần Queue System?

### Vấn đề với > 50 webhooks/phút:
```
50 webhooks/phút = ~1 webhook/giây
Nếu mỗi webhook có 10 items = 10 Shopify API calls/giây
→ Vượt quá rate limit của Shopify (2 REST calls/s hoặc 50 GraphQL points/s)
→ Nhiều 429 errors, retry storms, timeout
```

### Giải pháp: Queue System
```
Webhook → Queue → Worker (rate-limited) → Shopify
  (Fast)   (Buffer)   (Controlled speed)    (Happy)
```

---

## 📦 Implementation với BullMQ

### Step 1: Install Dependencies

```bash
npm install bullmq ioredis
npm install --save-dev @types/ioredis
```

**Yêu cầu:** Redis server (local hoặc cloud)

```bash
# Install Redis (Windows)
# Download từ: https://github.com/microsoftarchive/redis/releases
# Hoặc dùng Docker:
docker run -d -p 6379:6379 redis:alpine

# Install Redis (Mac)
brew install redis
brew services start redis

# Install Redis (Linux)
sudo apt-get install redis-server
sudo systemctl start redis
```

---

### Step 2: Create Queue Configuration

```typescript
// src/lib/queue.ts
import { Queue, Worker, QueueEvents } from 'bullmq';
import Redis from 'ioredis';

// Redis connection
const connection = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  maxRetriesPerRequest: null,
});

// Customer sync queue
export const customerSyncQueue = new Queue('customer-sync', {
  connection,
  defaultJobOptions: {
    attempts: 3, // Retry 3 lần nếu fail
    backoff: {
      type: 'exponential',
      delay: 2000, // 2s, 4s, 8s
    },
    removeOnComplete: {
      age: 3600, // Xóa job thành công sau 1 giờ
      count: 1000, // Giữ tối đa 1000 jobs
    },
    removeOnFail: {
      age: 86400, // Giữ job failed 24 giờ
    },
  },
});

// Inventory sync queue
export const inventorySyncQueue = new Queue('inventory-sync', {
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000,
    },
    removeOnComplete: {
      age: 3600,
      count: 1000,
    },
    removeOnFail: {
      age: 86400,
    },
  },
});

// Queue events for monitoring
export const customerQueueEvents = new QueueEvents('customer-sync', {
  connection,
});

export const inventoryQueueEvents = new QueueEvents('inventory-sync', {
  connection,
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  await customerSyncQueue.close();
  await inventorySyncQueue.close();
  await connection.quit();
});
```

---

### Step 3: Update Webhook Endpoints

```typescript
// src/app/api/webhooks/nhanh/customer/route.ts
import { NextRequest, NextResponse } from "next/server";
import { customerSyncQueue } from "@/lib/queue";

export const dynamic = "force-dynamic";
export const maxDuration = 10; // Giảm xuống 10s vì chỉ push vào queue

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    const payload = await request.json();
    
    console.log("👤 Received Nhanh customer webhook:", {
      event: payload.event,
      businessId: payload.businessId,
      customersCount: payload.data?.length || 0,
    });

    // Validate webhook
    if (payload.event !== "customerUpdate") {
      return NextResponse.json(
        { success: false, error: "Invalid event type" },
        { status: 400 }
      );
    }

    if (!payload.data || !Array.isArray(payload.data)) {
      return NextResponse.json(
        { success: false, error: "Invalid payload data" },
        { status: 400 }
      );
    }

    // Push each customer to queue
    const jobs = [];
    for (const customer of payload.data) {
      const job = await customerSyncQueue.add(
        'sync-customer',
        {
          nhanhCustomerId: customer.id.toString(),
          totalSpent: parseFloat(customer.totalSpent || "0"),
          webhookTimestamp: Date.now(),
        },
        {
          jobId: `customer-${customer.id}-${Date.now()}`, // Unique ID
          priority: 1, // Higher priority = processed first
        }
      );
      jobs.push(job.id);
    }

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    
    console.log(`✅ Queued ${jobs.length} customers in ${duration}s`);

    return NextResponse.json({
      success: true,
      data: {
        queued: jobs.length,
        jobIds: jobs,
      },
      duration: `${duration}s`,
      message: `Queued ${jobs.length} customers for processing`,
    });

  } catch (error: any) {
    console.error("❌ Webhook error:", error);
    
    return NextResponse.json(
      {
        success: false,
        error: error.message || "Failed to process webhook",
      },
      { status: 500 }
    );
  }
}
```

```typescript
// src/app/api/webhooks/nhanh/inventory/route.ts
import { NextRequest, NextResponse } from "next/server";
import { inventorySyncQueue } from "@/lib/queue";

export const dynamic = "force-dynamic";
export const maxDuration = 10;

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    const payload = await request.json();
    
    console.log("📦 Received Nhanh inventory webhook:", {
      event: payload.event,
      businessId: payload.businessId,
      productsCount: payload.data?.length || 0,
    });

    // Validate webhook
    if (payload.event !== "inventoryChange") {
      return NextResponse.json(
        { success: false, error: "Invalid event type" },
        { status: 400 }
      );
    }

    if (!payload.data || !Array.isArray(payload.data)) {
      return NextResponse.json(
        { success: false, error: "Invalid payload data" },
        { status: 400 }
      );
    }

    const storeId = process.env.NHANH_STORE_ID;

    // Push each product to queue
    const jobs = [];
    for (const product of payload.data) {
      let quantity = 0;
      if (storeId && product.depots) {
        const depot = product.depots.find((d: any) => d.id.toString() === storeId);
        quantity = depot ? parseFloat(depot.available || "0") : 0;
      } else {
        quantity = parseFloat(product.available || "0");
      }

      const job = await inventorySyncQueue.add(
        'sync-inventory',
        {
          nhanhProductId: product.id.toString(),
          quantity: Math.floor(quantity),
          sku: product.code,
          webhookTimestamp: Date.now(),
        },
        {
          jobId: `product-${product.id}-${Date.now()}`,
          priority: 1,
        }
      );
      jobs.push(job.id);
    }

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    
    console.log(`✅ Queued ${jobs.length} products in ${duration}s`);

    return NextResponse.json({
      success: true,
      data: {
        queued: jobs.length,
        jobIds: jobs,
      },
      duration: `${duration}s`,
      message: `Queued ${jobs.length} products for processing`,
    });

  } catch (error: any) {
    console.error("❌ Webhook error:", error);
    
    return NextResponse.json(
      {
        success: false,
        error: error.message || "Failed to process webhook",
      },
      { status: 500 }
    );
  }
}
```

---

### Step 4: Create Workers

```typescript
// src/workers/customer-sync-worker.ts
import { Worker, Job } from 'bullmq';
import Redis from 'ioredis';
import { prisma } from '@/lib/prisma';
import { shopifyAPI } from '@/lib/shopify-api';

const connection = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  maxRetriesPerRequest: null,
});

interface CustomerSyncJob {
  nhanhCustomerId: string;
  totalSpent: number;
  webhookTimestamp: number;
}

const worker = new Worker<CustomerSyncJob>(
  'customer-sync',
  async (job: Job<CustomerSyncJob>) => {
    const { nhanhCustomerId, totalSpent } = job.data;
    
    console.log(`🔄 Processing customer ${nhanhCustomerId}...`);

    try {
      // Find mapping
      const mapping = await prisma.customerMapping.findUnique({
        where: { nhanhCustomerId },
      });

      if (!mapping || !mapping.shopifyCustomerId) {
        console.log(`⏭️  Skipped: No mapping for customer ${nhanhCustomerId}`);
        return { status: 'skipped', reason: 'No mapping found' };
      }

      // Update local database
      await prisma.nhanhCustomer.update({
        where: { id: nhanhCustomerId },
        data: {
          totalSpent,
          lastPulledAt: new Date(),
        },
      });

      // Sync to Shopify
      const shopifyGid = mapping.shopifyCustomerId.startsWith('gid://')
        ? mapping.shopifyCustomerId
        : `gid://shopify/Customer/${mapping.shopifyCustomerId}`;
      
      await shopifyAPI.syncCustomerTotalSpent(shopifyGid, totalSpent);

      // Update mapping
      await prisma.customerMapping.update({
        where: { id: mapping.id },
        data: {
          syncStatus: "SYNCED",
          lastSyncedAt: new Date(),
          syncError: null,
          syncAttempts: 0,
          nhanhTotalSpent: totalSpent,
        },
      });

      // Log sync
      await prisma.syncLog.create({
        data: {
          mappingId: mapping.id,
          action: "WEBHOOK_SYNC",
          status: "SYNCED",
          message: `Queue: Updated totalSpent to ${totalSpent}`,
          metadata: {
            source: "queue_worker",
            nhanhCustomerId,
            shopifyCustomerId: mapping.shopifyCustomerId,
            totalSpent,
            jobId: job.id,
          },
        },
      });

      console.log(`✅ Synced customer ${nhanhCustomerId}`);
      
      return { 
        status: 'synced',
        nhanhCustomerId,
        shopifyCustomerId: mapping.shopifyCustomerId,
        totalSpent,
      };

    } catch (error: any) {
      console.error(`❌ Error syncing customer ${nhanhCustomerId}:`, error.message);
      
      // Log error
      try {
        const mapping = await prisma.customerMapping.findUnique({
          where: { nhanhCustomerId },
        });

        if (mapping) {
          await prisma.customerMapping.update({
            where: { id: mapping.id },
            data: {
              syncStatus: "FAILED",
              syncError: error.message,
              syncAttempts: { increment: 1 },
            },
          });

          await prisma.syncLog.create({
            data: {
              mappingId: mapping.id,
              action: "WEBHOOK_SYNC",
              status: "FAILED",
              message: `Queue: Failed to update totalSpent`,
              errorDetail: error.message,
              metadata: {
                source: "queue_worker",
                nhanhCustomerId,
                jobId: job.id,
              },
            },
          });
        }
      } catch (logError) {
        console.error("Failed to log error:", logError);
      }

      throw error; // Re-throw để BullMQ retry
    }
  },
  {
    connection,
    concurrency: 5, // Process 5 jobs đồng thời
    limiter: {
      max: 10, // Max 10 jobs
      duration: 1000, // per 1 second
    },
  }
);

// Event listeners
worker.on('completed', (job) => {
  console.log(`✅ Job ${job.id} completed`);
});

worker.on('failed', (job, err) => {
  console.error(`❌ Job ${job?.id} failed:`, err.message);
});

worker.on('error', (err) => {
  console.error('Worker error:', err);
});

console.log('👷 Customer sync worker started');

export default worker;
```

```typescript
// src/workers/inventory-sync-worker.ts
import { Worker, Job } from 'bullmq';
import Redis from 'ioredis';
import { prisma } from '@/lib/prisma';
import { shopifyAPI } from '@/lib/shopify-api';
import { SyncStatus, SyncAction } from '@prisma/client';

const connection = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  maxRetriesPerRequest: null,
});

interface InventorySyncJob {
  nhanhProductId: string;
  quantity: number;
  sku: string;
  webhookTimestamp: number;
}

const worker = new Worker<InventorySyncJob>(
  'inventory-sync',
  async (job: Job<InventorySyncJob>) => {
    const { nhanhProductId, quantity, sku } = job.data;
    
    console.log(`🔄 Processing product ${nhanhProductId} (${sku})...`);

    try {
      // Find mapping
      const mapping = await prisma.productMapping.findUnique({
        where: { nhanhProductId },
      });

      if (!mapping || !mapping.shopifyProductId) {
        console.log(`⏭️  Skipped: No mapping for product ${nhanhProductId}`);
        return { status: 'skipped', reason: 'No mapping found' };
      }

      // Update local database
      await prisma.nhanhProduct.update({
        where: { id: nhanhProductId },
        data: {
          quantity,
          lastPulledAt: new Date(),
        },
      });

      // Sync to Shopify
      await shopifyAPI.updateInventory(mapping.shopifyProductId, quantity);

      // Update mapping
      await prisma.productMapping.update({
        where: { id: mapping.id },
        data: {
          syncStatus: "SYNCED",
          lastSyncedAt: new Date(),
          syncError: null,
          syncAttempts: 0,
        },
      });

      // Log sync
      await prisma.productSyncLog.create({
        data: {
          mappingId: mapping.id,
          action: SyncAction.INVENTORY_UPDATE,
          status: SyncStatus.SYNCED,
          message: `Queue: Updated inventory to ${quantity}`,
          metadata: {
            source: "queue_worker",
            nhanhProductId,
            shopifyProductId: mapping.shopifyProductId,
            quantity,
            jobId: job.id,
          },
        },
      });

      console.log(`✅ Synced product ${nhanhProductId}`);
      
      return { 
        status: 'synced',
        nhanhProductId,
        shopifyProductId: mapping.shopifyProductId,
        quantity,
      };

    } catch (error: any) {
      console.error(`❌ Error syncing product ${nhanhProductId}:`, error.message);
      
      // Log error
      try {
        const mapping = await prisma.productMapping.findUnique({
          where: { nhanhProductId },
        });

        if (mapping) {
          await prisma.productMapping.update({
            where: { id: mapping.id },
            data: {
              syncStatus: "FAILED",
              syncError: error.message,
              syncAttempts: { increment: 1 },
            },
          });

          await prisma.productSyncLog.create({
            data: {
              mappingId: mapping.id,
              action: SyncAction.INVENTORY_UPDATE,
              status: SyncStatus.FAILED,
              message: `Queue: Failed to update inventory`,
              errorDetail: error.message,
              metadata: {
                source: "queue_worker",
                nhanhProductId,
                jobId: job.id,
              },
            },
          });
        }
      } catch (logError) {
        console.error("Failed to log error:", logError);
      }

      throw error;
    }
  },
  {
    connection,
    concurrency: 5,
    limiter: {
      max: 10,
      duration: 1000,
    },
  }
);

// Event listeners
worker.on('completed', (job) => {
  console.log(`✅ Job ${job.id} completed`);
});

worker.on('failed', (job, err) => {
  console.error(`❌ Job ${job?.id} failed:`, err.message);
});

worker.on('error', (err) => {
  console.error('Worker error:', err);
});

console.log('👷 Inventory sync worker started');

export default worker;
```

---

### Step 5: Start Workers

```typescript
// src/workers/index.ts
import customerWorker from './customer-sync-worker';
import inventoryWorker from './inventory-sync-worker';

console.log('🚀 Starting all workers...');

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('Shutting down workers...');
  await customerWorker.close();
  await inventoryWorker.close();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('Shutting down workers...');
  await customerWorker.close();
  await inventoryWorker.close();
  process.exit(0);
});
```

```json
// package.json - Add script
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "worker": "tsx watch src/workers/index.ts"
  }
}
```

**Chạy workers:**
```bash
# Terminal 1: Next.js server
npm run dev

# Terminal 2: Workers
npm run worker
```

---

### Step 6: Environment Variables

```env
# .env
# Redis Configuration
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=  # Nếu có

# Existing configs...
DATABASE_URL=...
SHOPIFY_STORE_URL=...
```

---

## 📊 Performance với Queue System

### Before (Direct Processing):
```
50 webhooks/phút × 10 items = 500 Shopify calls/phút
= 8.3 calls/second
→ ❌ Vượt rate limit, nhiều 429 errors
```

### After (Queue System):
```
50 webhooks/phút → Queue (instant response)
Workers: 5 concurrent × 10 jobs/second = 50 jobs/second
= Controlled rate, no 429 errors
→ ✅ Smooth processing
```

---

## 🎯 Lợi ích

1. **Rate Limiting** - Tự động giới hạn tốc độ gọi Shopify API
2. **Retry Logic** - Tự động retry khi fail (3 lần với exponential backoff)
3. **Scalability** - Dễ dàng scale bằng cách tăng số workers
4. **Monitoring** - Dashboard để xem queue status
5. **Priority** - Xử lý jobs quan trọng trước
6. **Reliability** - Jobs không bị mất khi server restart

---

## 📈 Monitoring Dashboard

```typescript
// src/app/api/queue/stats/route.ts
import { NextResponse } from 'next/server';
import { customerSyncQueue, inventorySyncQueue } from '@/lib/queue';

export async function GET() {
  const [customerCounts, inventoryCounts] = await Promise.all([
    customerSyncQueue.getJobCounts(),
    inventorySyncQueue.getJobCounts(),
  ]);

  return NextResponse.json({
    customer: {
      waiting: customerCounts.waiting,
      active: customerCounts.active,
      completed: customerCounts.completed,
      failed: customerCounts.failed,
    },
    inventory: {
      waiting: inventoryCounts.waiting,
      active: inventoryCounts.active,
      completed: inventoryCounts.completed,
      failed: inventoryCounts.failed,
    },
  });
}
```

**Access:** `http://localhost:3000/api/queue/stats`

---

## 🧪 Testing

```bash
# Test với 100 webhooks đồng thời
for i in {1..100}; do
  curl -X POST http://localhost:3000/api/webhooks/nhanh/customer \
    -H "Content-Type: application/json" \
    -d '{"event":"customerUpdate","data":[{"id":7,"totalSpent":70000000}]}' &
done
wait

# Check queue stats
curl http://localhost:3000/api/queue/stats
```

---

## 💰 Cost Estimate

**Redis Cloud (Free tier):**
- 30MB storage
- Đủ cho ~10,000 jobs
- FREE

**Redis Cloud (Paid):**
- $5-10/month
- 250MB-1GB storage
- Đủ cho production

**Alternative:** Self-hosted Redis (FREE)

---

## 🎉 Kết luận

Với Queue System:
- ✅ Xử lý được **1000+ webhooks/phút**
- ✅ Không bị rate limit
- ✅ Tự động retry khi fail
- ✅ Dễ monitor và debug
- ✅ Scale dễ dàng

**Khuyến nghị:** Implement ngay nếu > 50 webhooks/phút!
