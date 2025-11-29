# ❌ Product Auto Sync - NOT IMPLEMENTED

## 🔍 **Status Check**

### **Result:** ❌ **Product auto sync theo lịch CHƯA được implement!**

---

## 📊 **What Exists**

### **1. Database Table** ✅

**Table:** `sync_schedule`

```sql
CREATE TABLE sync_schedule (
  id VARCHAR PRIMARY KEY,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  enabled BOOLEAN DEFAULT FALSE,
  schedule VARCHAR,
  type VARCHAR
);
```

**Records:**
- `product_auto_sync` - Product sync schedule config
- (Other schedule configs)

---

### **2. API Endpoints** ✅

**File:** `src/app/api/sync/schedule/products/route.ts`

**Endpoints:**
```
GET  /api/sync/schedule/products  - Get product sync schedule config
POST /api/sync/schedule/products  - Update product sync schedule config
```

**Functionality:**
- ✅ Can save schedule configuration
- ✅ Can enable/disable auto sync
- ✅ Can set cron expression

**Example:**
```json
{
  "id": "product_auto_sync",
  "enabled": true,
  "schedule": "0 */6 * * *",
  "type": "PRODUCT"
}
```

---

## ❌ **What's Missing**

### **1. Product Scheduler** ❌

**Expected File:** `src/lib/product-scheduler.ts`

**Status:** Does NOT exist

**Should contain:**
```typescript
class ProductScheduler {
  async initialize() {
    // Load config from database
    // Schedule cron job if enabled
  }
  
  scheduleProductSync(cronExpression: string) {
    // Create cron job
    // Execute product sync on schedule
  }
  
  private async executeProductSync() {
    // Call product sync API
  }
}
```

---

### **2. Scheduler Initialization** ❌

**File:** `src/instrumentation.ts`

**Current:**
```typescript
// Initialize customer sync scheduler ✅
const { cronScheduler } = await import('./lib/cron-scheduler');
await cronScheduler.initialize();

// Initialize sale campaign scheduler ✅
const { saleScheduler } = await import('./lib/sale-scheduler');
await saleScheduler.initialize();

// Initialize product scheduler ❌ MISSING!
```

**Should add:**
```typescript
// Initialize product sync scheduler
try {
  const { productScheduler } = await import('./lib/product-scheduler');
  await productScheduler.initialize();
  console.log('✅ Product sync scheduler initialized');
} catch (error) {
  console.error('❌ Failed to initialize product sync scheduler:', error);
}
```

---

### **3. Product Auto Sync API** ❌

**Expected File:** `src/app/api/sync/products/auto-sync/route.ts`

**Status:** Does NOT exist

**Should contain:**
```typescript
export async function POST() {
  // Get all SYNCED product mappings
  const mappings = await prisma.productMapping.findMany({
    where: { syncStatus: 'SYNCED' },
  });
  
  // Sync each product in batches
  for (const batch of batches) {
    await Promise.all(
      batch.map(mapping => syncProduct(mapping))
    );
  }
}
```

---

## 📋 **Comparison with Customer Auto Sync**

| Feature | Customer Auto Sync | Product Auto Sync |
|---------|-------------------|-------------------|
| **Database Config** | ✅ `auto_sync_config` | ✅ `sync_schedule` |
| **API Endpoints** | ✅ `/api/sync/schedule/global` | ✅ `/api/sync/schedule/products` |
| **Scheduler Class** | ✅ `cron-scheduler.ts` | ❌ Missing |
| **Auto Initialize** | ✅ `instrumentation.ts` | ❌ Missing |
| **Sync API** | ✅ `/api/sync/auto-sync` | ❌ Missing |
| **UI Component** | ✅ `GlobalAutoSyncSettings.tsx` | ❓ Unknown |
| **Status** | ✅ **WORKING** | ❌ **NOT WORKING** |

---

## 🎯 **What Needs to be Done**

### **To Implement Product Auto Sync:**

#### **Step 1: Create Product Scheduler**

**File:** `src/lib/product-scheduler.ts`

```typescript
import cron from 'node-cron';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

class ProductScheduler {
  private task: cron.ScheduledTask | null = null;
  private isInitialized = false;

  async initialize() {
    console.log('Initializing product sync scheduler...');

    // Get config from database
    let config = await prisma.syncSchedule.findUnique({
      where: { id: 'product_auto_sync' },
    });

    // Create default if not exists
    if (!config) {
      config = await prisma.syncSchedule.create({
        data: {
          id: 'product_auto_sync',
          enabled: false,
          schedule: '0 */6 * * *',
          type: 'PRODUCT',
        },
      });
    }

    // Schedule if enabled
    if (config.enabled) {
      this.scheduleProductSync(config.schedule);
    }

    this.isInitialized = true;
  }

  scheduleProductSync(cronExpression: string) {
    if (!cron.validate(cronExpression)) {
      throw new Error(`Invalid cron expression: ${cronExpression}`);
    }

    this.stopAll();

    this.task = cron.schedule(
      cronExpression,
      async () => {
        console.log('Running scheduled product sync...');
        await this.executeProductSync();
      },
      {
        scheduled: true,
        timezone: 'Asia/Ho_Chi_Minh',
      }
    );

    console.log(`Product sync scheduled with cron: ${cronExpression}`);
  }

  private async executeProductSync() {
    try {
      console.log('Executing product auto sync...');

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/sync/products/auto-sync`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        }
      );

      const result = await response.json();

      if (result.success) {
        console.log('Product auto sync completed:', result.results);
      } else {
        console.error('Product auto sync failed:', result.error);
      }
    } catch (error) {
      console.error('Error executing product sync:', error);
    }
  }

  stopAll() {
    if (this.task) {
      this.task.stop();
      this.task = null;
    }
  }

  getStatus() {
    return {
      isInitialized: this.isInitialized,
      isScheduled: this.task !== null,
    };
  }
}

export const productScheduler = new ProductScheduler();
```

---

#### **Step 2: Create Product Auto Sync API**

**File:** `src/app/api/sync/products/auto-sync/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function POST(request: NextRequest) {
  try {
    console.log('Starting product auto sync...');

    // Get all SYNCED product mappings
    const mappings = await prisma.productMapping.findMany({
      where: { syncStatus: 'SYNCED' },
      orderBy: { lastSyncedAt: 'asc' },
    });

    console.log(`Found ${mappings.length} SYNCED product mappings`);

    const results = {
      total: mappings.length,
      successful: 0,
      failed: 0,
      errors: [],
    };

    // Sync in parallel batches
    const BATCH_SIZE = 5;
    const BATCH_DELAY = 2000;

    for (let i = 0; i < mappings.length; i += BATCH_SIZE) {
      const batch = mappings.slice(i, i + BATCH_SIZE);
      
      const batchPromises = batch.map(async (mapping) => {
        try {
          const response = await fetch(
            `${process.env.NEXT_PUBLIC_APP_URL}/api/sync/products/sync-product`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ mappingId: mapping.id }),
            }
          );

          const result = await response.json();

          if (result.success) {
            return { success: true, mapping };
          } else {
            return { success: false, mapping, error: result.error };
          }
        } catch (error: any) {
          return { success: false, mapping, error: error.message };
        }
      });

      const batchResults = await Promise.all(batchPromises);

      batchResults.forEach((result) => {
        if (result.success) {
          results.successful++;
        } else {
          results.failed++;
          results.errors.push({
            mappingId: result.mapping.id,
            productName: result.mapping.nhanhProductName,
            error: result.error,
          });
        }
      });

      if (i + BATCH_SIZE < mappings.length) {
        await new Promise(resolve => setTimeout(resolve, BATCH_DELAY));
      }
    }

    console.log('Product auto sync completed:', results);

    return NextResponse.json({
      success: true,
      message: 'Product auto sync completed',
      results,
    });
  } catch (error: any) {
    console.error('Error in product auto sync:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
```

---

#### **Step 3: Update Instrumentation**

**File:** `src/instrumentation.ts`

Add after customer sync scheduler:

```typescript
// Initialize product sync scheduler
try {
  const { productScheduler } = await import('./lib/product-scheduler');
  await productScheduler.initialize();
  console.log('✅ Product sync scheduler initialized');
} catch (error) {
  console.error('❌ Failed to initialize product sync scheduler:', error);
}
```

---

#### **Step 4: Update Schedule API to Reinitialize**

**File:** `src/app/api/sync/schedule/products/route.ts`

Add after saving config:

```typescript
// Reinitialize scheduler with new config
try {
  const { productScheduler } = await import('@/lib/product-scheduler');
  await productScheduler.initialize();
} catch (error) {
  console.error('Error reinitializing product scheduler:', error);
}
```

---

## 🎯 **Summary**

### **Current Status:**

❌ **Product auto sync theo lịch CHƯA hoạt động**

**Có:**
- ✅ Database table (`sync_schedule`)
- ✅ Config API endpoints
- ✅ UI có thể save config (nếu có)

**Thiếu:**
- ❌ Product scheduler class
- ❌ Scheduler initialization
- ❌ Product auto sync API
- ❌ Cron job execution

### **So với Customer Auto Sync:**

**Customer:** ✅ Hoàn chỉnh và hoạt động
**Product:** ❌ Chỉ có config, không có scheduler

### **Để implement:**

Cần tạo 3 files:
1. `src/lib/product-scheduler.ts` - Scheduler class
2. `src/app/api/sync/products/auto-sync/route.ts` - Auto sync API
3. Update `src/instrumentation.ts` - Initialize scheduler

Estimated time: 2-3 hours

---

**❌ Product auto sync is NOT implemented yet! ❌**
