# 📋 TODO: Nhanh Filters Backend Integration

## ✅ **Completed**

- [x] UI Modal with filters
- [x] Customer Type dropdown
- [x] Date Range inputs
- [x] Clear user messaging
- [x] Confirmation dialogs
- [x] Success feedback

## ⏳ **Pending: Backend Integration**

### **What Needs to Be Done:**

Update Nhanh API pull endpoints to accept and use filters.

---

## 🔧 **Implementation Steps**

### **1. Update Nhanh API Client**

**File:** `src/lib/nhanh-api.ts`

**Add filter parameters:**
```typescript
async getCustomers(params: {
  page?: number;
  limit?: number;
  type?: number;  // NEW
  lastBoughtDateFrom?: string;  // NEW
  lastBoughtDateTo?: string;  // NEW
  mobile?: string;  // NEW
  id?: number;  // NEW
  updatedAtFrom?: number;  // NEW
  updatedAtTo?: number;  // NEW
  next?: any;
}): Promise<NhanhCustomerListResponse> {
  const filters: any = {};
  
  // Add filters if provided
  if (params.type) filters.type = params.type;
  if (params.lastBoughtDateFrom) filters.lastBoughtDateFrom = params.lastBoughtDateFrom;
  if (params.lastBoughtDateTo) filters.lastBoughtDateTo = params.lastBoughtDateTo;
  if (params.mobile) filters.mobile = params.mobile;
  if (params.id) filters.id = params.id;
  if (params.updatedAtFrom) filters.updatedAtFrom = params.updatedAtFrom;
  if (params.updatedAtTo) filters.updatedAtTo = params.updatedAtTo;
  
  const requestData = {
    filters,
    paginator: { size: params.limit || 50 }
  };
  
  // ... rest of implementation
}
```

---

### **2. Update Pull Customers API**

**File:** `src/app/api/nhanh/pull-customers-all/route.ts`

**Accept filters in request:**
```typescript
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const { type, lastBoughtDateFrom, lastBoughtDateTo } = body;
    
    // Start background pull with filters
    pullAllCustomersBackground({
      type,
      lastBoughtDateFrom,
      lastBoughtDateTo
    });
    
    return NextResponse.json({
      success: true,
      message: "Background pull started with filters!"
    });
  } catch (error: any) {
    // ... error handling
  }
}
```

**Pass filters to API:**
```typescript
async function pullAllCustomersBackground(filters?: {
  type?: number;
  lastBoughtDateFrom?: string;
  lastBoughtDateTo?: string;
}) {
  console.log("🚀 Starting pull with filters:", filters);
  
  while (hasNextPage) {
    const result = await nhanhAPI.getCustomers({
      limit: 250,
      cursor,
      ...filters  // Pass filters to API
    });
    
    // ... process results
  }
}
```

---

### **3. Update UI Handler**

**File:** `src/components/customers-sync/CustomerSyncTable.tsx`

**Already done! Just need to pass filters:**
```typescript
const response = await fetch("/api/nhanh/pull-customers-all", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    type: nhanhFilterType,
    lastBoughtDateFrom: nhanhFilterDateFrom,
    lastBoughtDateTo: nhanhFilterDateTo
  })
});
```

---

## 📝 **Testing Checklist**

### **Test Cases:**

- [ ] Pull with Type filter only
- [ ] Pull with Date From only
- [ ] Pull with Date To only
- [ ] Pull with Type + Date From
- [ ] Pull with Type + Date Range
- [ ] Pull with no filters (all customers)
- [ ] Verify only matching customers are pulled
- [ ] Check progress tracking works
- [ ] Test auto-resume with filters
- [ ] Verify error handling

---

## 🎯 **Expected Behavior**

### **With Filters:**
```
User selects:
- Type: Khách lẻ (1)
- From: 2024-11-01

API calls:
GET /v3.0/customer/list
{
  "filters": {
    "type": 1,
    "lastBoughtDateFrom": "2024-11-01"
  },
  "paginator": { "size": 250 }
}

Result:
Only retail customers who bought since Nov 1 are pulled
```

### **Without Filters:**
```
User selects: (nothing)

API calls:
GET /v3.0/customer/list
{
  "filters": {},
  "paginator": { "size": 250 }
}

Result:
All customers are pulled (current behavior)
```

---

## ⚠️ **Important Notes**

### **1. Progress Tracking:**

Filters should be included in progress ID:
```typescript
const progressId = filters 
  ? `nhanh_customers_${JSON.stringify(filters)}`
  : "nhanh_customers";
```

### **2. Error Handling:**

Handle invalid filter values:
```typescript
if (type && ![1, 2, 3].includes(type)) {
  throw new Error("Invalid customer type");
}

if (lastBoughtDateFrom && !isValidDate(lastBoughtDateFrom)) {
  throw new Error("Invalid date format");
}
```

### **3. Logging:**

Log filters for debugging:
```typescript
console.log("📊 Pull filters:", {
  type,
  lastBoughtDateFrom,
  lastBoughtDateTo,
  expectedCustomers: "~X customers"
});
```

---

## 🔮 **Future Enhancements**

### **1. Add More Filters to UI:**

```tsx
<input 
  type="tel"
  placeholder="Phone number"
  value={nhanhFilterMobile}
  onChange={(e) => setNhanhFilterMobile(e.target.value)}
/>

<input 
  type="number"
  placeholder="Customer ID"
  value={nhanhFilterId}
  onChange={(e) => setNhanhFilterId(e.target.value)}
/>
```

### **2. Filter Validation:**

```typescript
function validateFilters(filters: any) {
  const errors = [];
  
  if (filters.type && ![1, 2, 3].includes(filters.type)) {
    errors.push("Invalid customer type");
  }
  
  if (filters.lastBoughtDateFrom && !isValidDate(filters.lastBoughtDateFrom)) {
    errors.push("Invalid from date");
  }
  
  return errors;
}
```

### **3. Filter Presets:**

```typescript
const presets = {
  "Active Retail": { type: 1, lastBoughtDateFrom: "2024-11-01" },
  "Wholesale Q4": { type: 2, lastBoughtDateFrom: "2024-10-01" }
};
```

---

## ✅ **Summary**

### **Current Status:**
- ✅ UI: Complete
- ⏳ Backend: Needs implementation
- ✅ API Support: Confirmed

### **Next Steps:**
1. Update `nhanh-api.ts` to accept filters
2. Update `pull-customers-all/route.ts` to pass filters
3. Test with various filter combinations
4. Verify performance improvements
5. Document for users

### **Estimated Time:**
- Backend changes: 1-2 hours
- Testing: 30 minutes
- Documentation: 30 minutes
- **Total: 2-3 hours**

---

**📌 Priority: Medium (UI ready, backend pending)**
