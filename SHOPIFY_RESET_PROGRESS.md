# ✅ Shopify Pull - Reset Progress Feature

## 🎯 **Feature**

Thêm "Reset Pull Progress" cho Shopify customer pull để có thể restart pull từ đầu.

---

## 🔧 **Implementation**

### **1. UI - Dropdown Option**

Thêm option vào Shopify Pull dropdown:

```tsx
<button onClick={handleResetProgress}>
  <svg>🔄</svg>
  <div>
    <div>Reset Pull Progress</div>
    <div>Start from beginning</div>
  </div>
</button>
```

**Position:** Giữa Saved Filters và Custom Filter

**Dropdown Structure:**
```
┌─────────────────────────────────────┐
│ Pull Shopify Customers         ▼   │
├─────────────────────────────────────┤
│ 👥 All Customers                    │
│ 🔐 Customers with Accounts          │
│ 🛍️  Customers with Orders           │
│ 📧 Customers with Email             │
├─────────────────────────────────────┤
│ Saved Filters (if any)              │
├─────────────────────────────────────┤
│ 🔄 Reset Pull Progress          NEW │
│ ➕ Custom Filter                     │
└─────────────────────────────────────┘
```

---

### **2. API Endpoint**

**Route:** `POST /api/shopify/reset-pull-progress`

**Logic:**
```typescript
// Delete all Shopify pull progress records
const deleted = await prisma.pullProgress.deleteMany({
  where: {
    id: {
      startsWith: "shopify_customers",
    },
  },
});
```

**Response:**
```json
{
  "success": true,
  "message": "Shopify pull progress reset successfully. 2 progress record(s) deleted.",
  "data": {
    "deletedCount": 2
  }
}
```

---

### **3. Handler Function**

```typescript
async () => {
  if (confirm("Reset Shopify pull progress and start from beginning?")) {
    try {
      const response = await fetch("/api/shopify/reset-pull-progress", {
        method: "POST",
      });
      const result = await response.json();
      alert(result.message || "Progress reset successfully");
    } catch (error: any) {
      alert("Failed to reset: " + error.message);
    }
  }
  setShopifyPullDropdownOpen(false);
}
```

---

## 🎯 **Use Cases**

### **1. Pull bị stuck**
```
Problem: Pull stopped at 50,000 customers
Solution: Reset progress → Start fresh pull
Result: Pull from beginning
```

### **2. Change filter mid-pull**
```
Problem: Started pull with wrong filter
Solution: Reset progress → Pull with correct filter
Result: Clean start with new filter
```

### **3. Error recovery**
```
Problem: Pull failed with errors
Solution: Reset progress → Retry from beginning
Result: Fresh start, no corrupted state
```

### **4. Testing**
```
Problem: Need to test pull process
Solution: Reset progress → Test again
Result: Clean test environment
```

---

## 📊 **Progress Records**

### **Progress ID Format:**

```typescript
// All customers (no filter)
"shopify_customers"

// With filter
"shopify_customers_c3RhdGU6RU5BQkxFRA"  // base64 encoded filter
```

### **Reset Behavior:**

```typescript
// Deletes ALL Shopify progress records
WHERE id STARTS WITH "shopify_customers"

// This includes:
- "shopify_customers" (no filter)
- "shopify_customers_c3RhdGU6RU5BQkxFRA" (state:ENABLED)
- "shopify_customers_b3JkZXJzX2NvdW50Oj4w" (orders_count:>0)
- etc.
```

**Result:** All Shopify pulls will restart from beginning

---

## 🔄 **Comparison with Nhanh Reset**

### **Nhanh Reset:**
```typescript
// API: /api/nhanh/reset-pull-progress?type=customers
// Deletes: WHERE id = "nhanh_customers"
// Scope: Only Nhanh customers
```

### **Shopify Reset:**
```typescript
// API: /api/shopify/reset-pull-progress
// Deletes: WHERE id STARTS WITH "shopify_customers"
// Scope: All Shopify pulls (all filters)
```

**Difference:**
- Nhanh: Single progress record
- Shopify: Multiple progress records (one per filter)

---

## 💡 **Workflow**

### **Normal Pull:**
```
1. Click "Pull Shopify Customers"
2. Select filter (or All)
3. Pull starts
4. Progress saved to database
5. If interrupted → Auto-resume from last position
```

### **With Reset:**
```
1. Pull is running or stuck
2. Click "Pull Shopify Customers" dropdown
3. Click "Reset Pull Progress"
4. Confirm reset
5. All progress deleted
6. Next pull starts from beginning
```

---

## 🎨 **UI Details**

### **Button Style:**
```tsx
className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:text-gray-300 dark:hover:bg-gray-700"
```

**Features:**
- ✅ Icon: 🔄 Refresh/Reset icon
- ✅ Title: "Reset Pull Progress"
- ✅ Description: "Start from beginning"
- ✅ Hover effect
- ✅ Disabled state support

### **Confirmation Dialog:**
```
Reset Shopify pull progress and start from beginning?

[Cancel] [OK]
```

### **Success Message:**
```
Shopify pull progress reset successfully. 2 progress record(s) deleted.
```

---

## 📝 **Files Created/Modified**

### **Created:**
1. ✅ `src/app/api/shopify/reset-pull-progress/route.ts`
   - New API endpoint
   - Delete all Shopify progress records

### **Modified:**
2. ✅ `src/components/customers-sync/CustomerSyncTable.tsx`
   - Add Reset button to dropdown
   - Add handler function

### **Documentation:**
3. ✅ `SHOPIFY_RESET_PROGRESS.md` (this file)

---

## 🧪 **Testing**

### **Test 1: Reset with no progress**
```
1. No pull in progress
2. Click "Reset Pull Progress"
3. Confirm
4. Result: "0 progress record(s) deleted"
```

### **Test 2: Reset with active progress**
```
1. Start pull (any filter)
2. Let it run for a bit
3. Click "Reset Pull Progress"
4. Confirm
5. Result: "1 progress record(s) deleted"
6. Next pull starts from beginning
```

### **Test 3: Reset with multiple filters**
```
1. Pull with filter A (partial)
2. Pull with filter B (partial)
3. Click "Reset Pull Progress"
4. Confirm
5. Result: "2 progress record(s) deleted"
6. Both pulls restart from beginning
```

---

## ⚠️ **Important Notes**

### **1. Resets ALL Shopify pulls**
```
⚠️ Warning: This resets ALL Shopify customer pulls, not just one filter.

If you have multiple pulls in progress with different filters,
ALL of them will be reset.
```

### **2. Cannot undo**
```
⚠️ Warning: This action cannot be undone.

Once reset, you'll need to pull from beginning.
Progress cannot be recovered.
```

### **3. Safe to use**
```
✅ Safe: Only deletes progress records
✅ Safe: Does not delete customer data
✅ Safe: Does not affect mappings
✅ Safe: Does not affect syncs
```

---

## 🎉 **Benefits**

### **For Users:**
- ✅ **Easy recovery** from stuck pulls
- ✅ **Clean restart** when needed
- ✅ **Simple UI** - One click
- ✅ **Clear feedback** - Success message

### **For System:**
- ✅ **Clean state** - No corrupted progress
- ✅ **Reliable** - Fresh start
- ✅ **Flexible** - Works with all filters
- ✅ **Safe** - Only deletes progress

---

## 🔮 **Future Enhancements**

### **1. Selective Reset**
```typescript
// Reset specific filter only
POST /api/shopify/reset-pull-progress
{
  "filter": "state:ENABLED"
}
```

### **2. Progress Viewer**
```tsx
<ProgressViewer>
  - All Customers: 50,000 / 100,000 (50%)
  - state:ENABLED: 10,000 / 20,000 (50%)
  - orders_count:>0: Completed
</ProgressViewer>
```

### **3. Auto-Reset on Error**
```typescript
// Auto-reset after X failed attempts
if (failedAttempts > 3) {
  await resetProgress();
  await startPull();
}
```

---

## ✅ **Summary**

**Added:**
- ✅ Reset Pull Progress button in dropdown
- ✅ API endpoint to delete progress
- ✅ Confirmation dialog
- ✅ Success feedback

**Benefits:**
- ✅ Easy recovery from issues
- ✅ Clean restart capability
- ✅ Simple one-click operation
- ✅ Safe and reliable

**Use Cases:**
- ✅ Stuck pulls
- ✅ Wrong filter
- ✅ Error recovery
- ✅ Testing

---

**🎊 Feature complete - Ready to use! 🎊**
