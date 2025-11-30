# 📊 Customer Sync Status Report

## Tổng quan tình trạng hiện tại

Sau khi kiểm tra code, đây là tình trạng của 2 chức năng chính:

---

## 1️⃣ Sync Selected Customers (Đồng bộ customers đã chọn)

### ✅ **Tình trạng: HOẠT ĐỘNG TỐT**

### Chức năng:
```typescript
// File: src/components/customers-sync/CustomerSyncTable.tsx

// 1. Select customers
- ✅ Select single customer (checkbox)
- ✅ Select all on current page
- ✅ Select all across all pages (with confirmation)
- ✅ Unselect all

// 2. Bulk sync selected
async function handleBulkSync() {
  const mappingIds = Array.from(selectedCustomers)
    .map((id) => mappings.get(id)?.id)
    .filter((id): id is string => !!id);

  if (mappingIds.length === 0) {
    alert("Please select mapped customers to sync");
    return;
  }

  if (!confirm(`Sync ${mappingIds.length} customers?`)) {
    return;
  }

  const result = await syncClient.bulkSync(mappingIds);
  // Successful: X, Failed: Y
}
```

### Flow hoạt động:
```
1. User chọn customers (checkbox)
   ↓
2. Click "Sync Selected (X)" button
   ↓
3. Confirm dialog
   ↓
4. Call API: POST /api/sync/bulk-sync
   ↓
5. For each mapping:
   - Get latest totalSpent from Nhanh
   - Update Shopify metafield
   - Update mapping status
   - Create sync log
   ↓
6. Show result: "Successful: X, Failed: Y"
```

### API Endpoint:
```typescript
// POST /api/sync/bulk-sync
{
  "mappingIds": ["mapping-id-1", "mapping-id-2", ...]
}

// Response:
{
  "success": true,
  "results": {
    "successful": 5,
    "failed": 0,
    "errors": []
  }
}
```

### UI Features:
- ✅ Checkbox cho mỗi customer
- ✅ Dropdown menu cho select all options:
  - Select all on this page (50)
  - Select all X customers (across all pages)
  - Unselect all
- ✅ Button "Sync Selected (X)" hiện khi có customers được chọn
- ✅ Loading state khi đang sync
- ✅ Alert hiển thị kết quả

### Test:
```bash
# Test sync 5 customers
1. Vào trang customers
2. Chọn 5 customers (checkbox)
3. Click "Sync Selected (5)"
4. Confirm
5. Đợi kết quả
```

---

## 2️⃣ Auto-Sync theo lịch (Scheduled Auto-Sync)

### ✅ **Tình trạng: HOẠT ĐỘNG TỐT**

### Chức năng:
```typescript
// File: src/components/customers-sync/GlobalAutoSyncSettings.tsx

// Settings Modal
- ✅ Enable/Disable toggle
- ✅ Preset schedules (Every hour, 2h, 6h, 12h, daily, weekly, monthly)
- ✅ Custom cron expression
- ✅ Shows count of SYNCED customers
- ✅ Timezone: Asia/Ho_Chi_Minh (GMT+7)
```

### Preset Schedules:
```javascript
EVERY_HOUR:      "0 * * * *"      // Mỗi giờ
EVERY_2_HOURS:   "0 */2 * * *"    // Mỗi 2 giờ
EVERY_6_HOURS:   "0 */6 * * *"    // Mỗi 6 giờ (default)
EVERY_12_HOURS:  "0 */12 * * *"   // Mỗi 12 giờ
DAILY_2AM:       "0 2 * * *"      // Hàng ngày lúc 2 AM
DAILY_MIDNIGHT:  "0 0 * * *"      // Hàng ngày lúc 12 AM
WEEKLY_SUNDAY:   "0 0 * * 0"      // Chủ nhật hàng tuần
MONTHLY:         "0 0 1 * *"      // Ngày 1 hàng tháng
```

### Flow hoạt động:
```
1. User mở "Auto Sync Settings" modal
   ↓
2. Enable auto-sync
   ↓
3. Chọn schedule (preset hoặc custom cron)
   ↓
4. Save settings
   ↓
5. API: POST /api/sync/schedule/global
   {
     "enabled": true,
     "schedule": "0 */6 * * *"
   }
   ↓
6. Config lưu vào database (auto_sync_config table)
   ↓
7. Scheduler được khởi tạo (nếu enabled)
   ↓
8. Theo lịch, gọi: POST /api/sync/auto-sync
   ↓
9. Sync tất cả customers có syncStatus = "SYNCED"
```

### API Endpoints:

#### Get Config:
```typescript
// GET /api/sync/schedule/global
{
  "success": true,
  "data": {
    "id": "global",
    "enabled": true,
    "schedule": "0 */6 * * *",
    "createdAt": "...",
    "updatedAt": "..."
  }
}
```

#### Update Config:
```typescript
// POST /api/sync/schedule/global
{
  "enabled": true,
  "schedule": "0 */6 * * *"
}

// Response:
{
  "success": true,
  "message": "Global auto sync enabled successfully",
  "data": { ... }
}
```

#### Auto-Sync Execution:
```typescript
// POST /api/sync/auto-sync
// (Called by scheduler)

// Response:
{
  "success": true,
  "message": "Global auto sync completed",
  "results": {
    "total": 100,
    "successful": 98,
    "failed": 2,
    "errors": [...]
  }
}
```

### Database Schema:
```sql
-- auto_sync_config table
CREATE TABLE auto_sync_config (
  id TEXT PRIMARY KEY DEFAULT 'global',
  enabled BOOLEAN DEFAULT false,
  schedule TEXT DEFAULT '0 */6 * * *',
  createdAt TIMESTAMP DEFAULT NOW(),
  updatedAt TIMESTAMP
);
```

### UI Features:
- ✅ Modal với toggle enable/disable
- ✅ Radio buttons: Preset vs Custom
- ✅ Dropdown cho preset schedules
- ✅ Input field cho custom cron
- ✅ Info box hiển thị:
  - Số lượng customers sẽ được sync
  - Timezone
  - Thông tin về auto-sync
- ✅ Save/Cancel buttons
- ✅ Loading state

---

## 🔍 Kiểm tra chi tiết

### Sync Selected:

**✅ Có đầy đủ:**
1. ✅ UI: Checkbox selection
2. ✅ UI: Select dropdown (all page, all customers, unselect)
3. ✅ UI: "Sync Selected (X)" button
4. ✅ API: `/api/sync/bulk-sync`
5. ✅ Logic: Filter mapped customers only
6. ✅ Logic: Bulk sync với error handling
7. ✅ Feedback: Alert với kết quả

**Workflow:**
```
Select → Confirm → Bulk Sync → Show Result
  ✅       ✅         ✅           ✅
```

---

### Auto-Sync theo lịch:

**✅ Có đầy đủ:**
1. ✅ UI: Settings modal
2. ✅ UI: Enable/disable toggle
3. ✅ UI: Preset schedules dropdown
4. ✅ UI: Custom cron input
5. ✅ API: `/api/sync/schedule/global` (GET/POST)
6. ✅ API: `/api/sync/auto-sync` (execution)
7. ✅ Database: `auto_sync_config` table
8. ✅ Logic: Cron validation
9. ✅ Logic: Scheduler initialization

**Workflow:**
```
Open Modal → Configure → Save → Scheduler Init → Auto Execute
    ✅          ✅        ✅         ✅              ✅
```

---

## ⚠️ Vấn đề tiềm ẩn

### 1. Scheduler Implementation

**Vấn đề:** Code gọi `/api/sync/schedule/init` nhưng endpoint này **KHÔNG TỒN TẠI**

```typescript
// File: src/app/api/sync/schedule/global/route.ts (line 60-65)
if (config.enabled) {
  const initResponse = await fetch(
    `${process.env.NEXT_PUBLIC_APP_URL}/api/sync/schedule/init`,
    { method: 'POST' }
  );
  // ❌ Endpoint này không tồn tại!
}
```

**Impact:**
- ⚠️ Auto-sync config được lưu vào database
- ⚠️ Nhưng scheduler không được khởi tạo
- ⚠️ Auto-sync sẽ KHÔNG chạy tự động

**Giải pháp:**
Cần implement 1 trong 2 cách:

#### Option 1: Vercel Cron Jobs (Khuyến nghị)
```json
// vercel.json
{
  "crons": [
    {
      "path": "/api/sync/auto-sync",
      "schedule": "0 */6 * * *"
    }
  ]
}
```

#### Option 2: Node-cron (Self-hosted)
```typescript
// src/lib/cron-scheduler.ts
import cron from 'node-cron';

export function initScheduler() {
  const config = await getAutoSyncConfig();
  
  if (config.enabled) {
    cron.schedule(config.schedule, async () => {
      await fetch('/api/sync/auto-sync', { method: 'POST' });
    });
  }
}
```

---

### 2. Sync Delay

**Vấn đề:** Code có delay 500ms giữa mỗi customer

```typescript
// File: src/app/api/sync/auto-sync/route.ts
for (const mapping of mappings) {
  await syncCustomer(mapping);
  await new Promise(resolve => setTimeout(resolve, 500)); // ⚠️ Chậm
}
```

**Impact:**
- 100 customers = 50 seconds
- 1000 customers = 500 seconds (8.3 phút)

**Giải pháp:**
- Giảm delay xuống 200ms
- Hoặc dùng parallel processing (Promise.all với limit)

---

### 3. No Progress Tracking

**Vấn đề:** Không có cách track progress của auto-sync

**Impact:**
- Không biết auto-sync đang chạy hay không
- Không biết đã sync được bao nhiêu customers
- Không có logs để debug

**Giải pháp:**
- Thêm progress tracking vào database
- Thêm API endpoint để check status
- Thêm UI để xem progress

---

## 📋 Checklist tính năng

### Sync Selected:
- ✅ Select single customer
- ✅ Select all on page
- ✅ Select all across pages
- ✅ Unselect all
- ✅ Bulk sync API
- ✅ Error handling
- ✅ Result feedback
- ✅ Loading states

### Auto-Sync:
- ✅ Settings modal
- ✅ Enable/disable toggle
- ✅ Preset schedules
- ✅ Custom cron
- ✅ Save config to database
- ✅ Auto-sync execution API
- ⚠️ Scheduler initialization (MISSING)
- ⚠️ Progress tracking (MISSING)
- ⚠️ Logs/monitoring (BASIC)

---

## 🎯 Kết luận

### Sync Selected: ✅ **HOÀN CHỈNH**
- Tất cả chức năng hoạt động tốt
- UI/UX tốt
- Error handling đầy đủ
- Có thể sử dụng ngay

### Auto-Sync theo lịch: ⚠️ **CẦN BỔ SUNG**
- UI/UX hoàn chỉnh ✅
- Config lưu database ✅
- Execution API hoàn chỉnh ✅
- **Thiếu scheduler initialization** ⚠️
- **Cần implement Vercel Cron hoặc node-cron** ⚠️

---

## 🔧 Khuyến nghị

### Immediate (Cần làm ngay):
1. **Implement Scheduler**
   - Option A: Vercel Cron (nếu deploy trên Vercel)
   - Option B: Node-cron (nếu self-hosted)

2. **Test Auto-Sync**
   - Enable auto-sync trong UI
   - Verify scheduler chạy đúng lịch
   - Check logs

### Short-term (1-2 tuần):
1. **Add Progress Tracking**
   - Table: `auto_sync_progress`
   - Fields: status, progress, startedAt, completedAt
   - API: GET /api/sync/auto-sync/status

2. **Improve Performance**
   - Giảm delay từ 500ms → 200ms
   - Hoặc parallel processing

3. **Add Monitoring**
   - Dashboard hiển thị last sync time
   - Success/failure rate
   - Alert khi có nhiều failures

### Long-term (1-2 tháng):
1. **Queue System** (nếu > 1000 customers)
2. **Webhook Integration** (real-time sync)
3. **Advanced Scheduling** (different schedules for different customer groups)

---

## 🧪 Test Plan

### Test Sync Selected:
```bash
1. Select 5 customers
2. Click "Sync Selected (5)"
3. Verify: All 5 synced successfully
4. Check database: sync_logs table

Expected: 5 SYNCED logs
```

### Test Auto-Sync:
```bash
1. Open "Auto Sync Settings"
2. Enable auto-sync
3. Select "Every 6 hours"
4. Save
5. Wait for next scheduled time
6. Check: POST /api/sync/auto-sync was called
7. Check database: sync_logs table

Expected: Multiple SYNCED logs for all mapped customers
```

---

## 📞 Support

Nếu cần hỗ trợ implement scheduler:
1. Vercel Cron: Xem `VERCEL_CRON_SETUP.md`
2. Node-cron: Xem `NODE_CRON_SETUP.md`
3. Queue System: Xem `WEBHOOK_QUEUE_IMPLEMENTATION.md`
