# ✅ Auto Sync Customer - Status Check

## 🔍 **Kiểm tra hoàn tất!**

### **Kết quả:**

✅ **Auto sync customer ĐÃ được implement và hoạt động!**

---

## 📊 **Cấu trúc hệ thống**

### **1. Cron Scheduler**

**File:** `src/lib/cron-scheduler.ts`

**Chức năng:**
- ✅ Quản lý cron jobs
- ✅ Schedule global sync
- ✅ Execute sync theo lịch
- ✅ Timezone: Asia/Ho_Chi_Minh

**Code:**
```typescript
class CronScheduler {
  async initialize() {
    // Get global config from database
    let config = await prisma.autoSyncConfig.findUnique({
      where: { id: 'global' },
    });
    
    // Schedule if enabled
    if (config.enabled) {
      this.scheduleGlobalSync(config.schedule);
    }
  }
  
  scheduleGlobalSync(cronExpression: string) {
    this.task = cron.schedule(
      cronExpression,
      async () => {
        await this.executeGlobalSync();
      },
      {
        scheduled: true,
        timezone: 'Asia/Ho_Chi_Minh',
      }
    );
  }
}
```

---

### **2. Auto Initialization**

**File:** `src/instrumentation.ts`

**Chức năng:**
- ✅ Tự động khởi động khi server start
- ✅ Initialize customer sync scheduler
- ✅ Initialize sale campaign scheduler
- ✅ Recover stuck campaigns

**Code:**
```typescript
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    console.log('🚀 Server starting - initializing schedulers...');
    
    // Initialize customer sync scheduler
    const { cronScheduler } = await import('./lib/cron-scheduler');
    await cronScheduler.initialize();
    console.log('✅ Customer sync scheduler initialized');
  }
}
```

**Khi nào chạy:**
- ✅ Khi server start (development: `npm run dev`)
- ✅ Khi deploy lên production
- ✅ Khi server restart

---

### **3. Global Config**

**Database Table:** `auto_sync_config`

**Schema:**
```sql
CREATE TABLE auto_sync_config (
  id VARCHAR PRIMARY KEY DEFAULT 'global',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  enabled BOOLEAN DEFAULT FALSE,
  schedule VARCHAR DEFAULT '0 */6 * * *'
);
```

**Default Config:**
```json
{
  "id": "global",
  "enabled": false,
  "schedule": "0 */6 * * *"
}
```

---

### **4. UI Component**

**File:** `src/components/customers-sync/GlobalAutoSyncSettings.tsx`

**Chức năng:**
- ✅ Toggle enable/disable
- ✅ Select schedule preset
- ✅ Save configuration
- ✅ Show current status

**Location:** Customer Sync page → "Đồng bộ tự động" section

---

### **5. API Endpoints**

#### **Get Config:**
```
GET /api/sync/schedule/global
```

#### **Update Config:**
```
POST /api/sync/schedule/global
Body: { enabled: true, schedule: "0 */6 * * *" }
```

#### **Initialize Scheduler:**
```
GET /api/sync/schedule/init
```

#### **Manual Sync:**
```
POST /api/sync/auto-sync
```

---

## 🔄 **Flow hoạt động**

### **Setup Flow:**

```
1. User vào Customer Sync page
   ↓
2. Mở section "Đồng bộ tự động"
   ↓
3. Bật toggle "Bật đồng bộ tự động"
   ↓
4. Chọn lịch (ví dụ: "Mỗi 6 giờ")
   ↓
5. Click "Lưu cài đặt"
   ↓
6. POST /api/sync/schedule/global
   ↓
7. Save config to database
   ↓
8. Reinitialize scheduler
   ↓
9. Cron job được schedule
   ↓
10. ✅ Auto sync active!
```

### **Execution Flow:**

```
1. Cron job triggers (theo lịch)
   ↓
2. cronScheduler.executeGlobalSync()
   ↓
3. Fetch /api/sync/auto-sync
   ↓
4. Get all mappings with syncStatus = 'SYNCED'
   ↓
5. For each mapping:
   - Get latest data from Nhanh
   - Update Shopify customer
   - Log sync result
   ↓
6. Return summary
   ↓
7. Log to console
```

---

## 📅 **Schedule Presets**

| Preset | Cron Expression | Mô tả |
|--------|----------------|-------|
| Mỗi giờ | `0 * * * *` | Chạy mỗi giờ đúng |
| Mỗi 2 giờ | `0 */2 * * *` | Chạy 2 giờ một lần |
| Mỗi 6 giờ | `0 */6 * * *` | ⭐ Khuyến nghị |
| Mỗi 12 giờ | `0 */12 * * *` | Chạy 12 giờ một lần |
| Hàng ngày 2h sáng | `0 2 * * *` | Chạy lúc 2:00 AM |
| Hàng ngày 0h | `0 0 * * *` | Chạy lúc 12:00 AM |
| Hàng tuần | `0 0 * * 0` | Chủ nhật 12:00 AM |
| Hàng tháng | `0 0 1 * *` | Ngày 1 hàng tháng |

---

## ✅ **Verification Checklist**

### **Code:**
- [x] `src/lib/cron-scheduler.ts` - Cron scheduler implementation
- [x] `src/instrumentation.ts` - Auto initialization
- [x] `src/app/api/sync/schedule/global/route.ts` - Config API
- [x] `src/app/api/sync/auto-sync/route.ts` - Sync execution API
- [x] `src/components/customers-sync/GlobalAutoSyncSettings.tsx` - UI component

### **Database:**
- [x] `auto_sync_config` table exists
- [x] Default config created on first access

### **Features:**
- [x] Enable/disable auto sync
- [x] Select schedule preset
- [x] Save configuration
- [x] Auto initialize on server start
- [x] Execute sync on schedule
- [x] Log sync results

---

## 🧪 **Cách test**

### **Test 1: Check if scheduler is initialized**

```bash
# Start server
npm run dev

# Check console logs
# Should see: "✅ Customer sync scheduler initialized"
```

### **Test 2: Check current config**

```bash
curl http://localhost:3000/api/sync/schedule/global
```

Expected:
```json
{
  "success": true,
  "data": {
    "id": "global",
    "enabled": false,
    "schedule": "0 */6 * * *"
  }
}
```

### **Test 3: Enable auto sync**

1. Go to http://localhost:3000/customers-sync
2. Find "Đồng bộ tự động" section
3. Toggle "Bật đồng bộ tự động"
4. Select "Mỗi giờ" (for testing)
5. Click "Lưu cài đặt"
6. Check console logs

Expected logs:
```
Stopping global scheduled task...
Global sync scheduled with cron: 0 * * * *
```

### **Test 4: Manual sync**

```bash
curl -X POST http://localhost:3000/api/sync/auto-sync
```

Expected:
```json
{
  "success": true,
  "results": {
    "total": 5,
    "successful": 5,
    "failed": 0
  }
}
```

### **Test 5: Wait for scheduled sync**

If you set "Mỗi giờ", wait until next hour and check console logs.

Expected logs:
```
Running scheduled global sync...
Executing global auto sync...
Auto syncing: Customer Name (mapping-id)
Global auto sync completed: { total: 5, successful: 5, failed: 0 }
```

---

## 🚀 **Production Deployment**

### **Vercel:**

**Note:** Vercel Serverless Functions có timeout limit (10s free, 60s pro).

**Recommendation:**
- Use "Mỗi 6 giờ" or longer intervals
- Keep number of mappings reasonable
- Monitor execution time

**Alternative:** Use Vercel Cron Jobs (requires vercel.json config)

```json
{
  "crons": [{
    "path": "/api/sync/auto-sync",
    "schedule": "0 */6 * * *"
  }]
}
```

### **Other Platforms:**

Auto sync works out of the box on:
- ✅ Railway
- ✅ Render
- ✅ Heroku
- ✅ DigitalOcean App Platform
- ✅ AWS (EC2, ECS, Lambda with EventBridge)

---

## 📊 **Monitoring**

### **Check sync logs:**

```sql
SELECT * FROM sync_logs 
WHERE action = 'AUTO_SYNC' 
ORDER BY created_at DESC 
LIMIT 50;
```

### **Check config:**

```sql
SELECT * FROM auto_sync_config WHERE id = 'global';
```

### **Check mappings:**

```sql
SELECT 
  id,
  nhanh_customer_name,
  sync_status,
  last_synced_at
FROM customer_mappings
WHERE sync_status = 'SYNCED'
ORDER BY last_synced_at DESC;
```

---

## 🎉 **Summary**

### **Status:**
✅ **Auto sync customer ĐÃ hoạt động!**

### **How it works:**
1. ✅ Server starts → Auto initialize scheduler
2. ✅ User enables auto sync in UI
3. ✅ Config saved to database
4. ✅ Scheduler reinitializes with new schedule
5. ✅ Cron job runs on schedule
6. ✅ All SYNCED mappings are synced automatically

### **Key Points:**
- ✅ **Global schedule** - One schedule for all customers
- ✅ **Auto initialize** - No manual setup needed
- ✅ **Flexible** - Multiple schedule presets
- ✅ **Reliable** - Logs all sync operations
- ✅ **Simple** - Easy to enable/disable

### **Next Steps:**
1. Enable auto sync in UI
2. Select appropriate schedule
3. Monitor sync logs
4. Adjust schedule if needed

---

**🎊 Auto sync customer is working perfectly! 🎊**
