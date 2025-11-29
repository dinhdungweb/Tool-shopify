# ✅ Fix: Bulk Sync chỉ sync 50 customers khi chọn "All"

## 🐛 **Vấn đề**

Khi chọn "Select all customers" và click "Sync Selected", hệ thống chỉ sync **50 customers** thay vì tất cả customers đã chọn.

### **Nguyên nhân:**

1. **Select All logic:** ✅ Hoạt động đúng
   ```typescript
   // Fetch all customer IDs
   const params: any = { page: 1, limit: total };
   const allCustomers = await nhanhClient.getLocalCustomers(params);
   setSelectedCustomers(new Set(allCustomers.customers.map(c => c.id)));
   ```
   → Đã select đúng tất cả customer IDs

2. **Mappings cache:** ❌ **Đây là vấn đề!**
   ```typescript
   // Load mappings only for current page customers (more efficient)
   const customerIds = nhanhData.customers.map(c => c.id);
   const mappingsData = await syncClient.getMappingsByCustomerIds(customerIds);
   ```
   → `mappings` Map chỉ chứa mappings của **50 customers trên trang hiện tại**

3. **Bulk Sync logic:** ❌ **Sử dụng cached mappings**
   ```typescript
   const mappingIds = Array.from(selectedCustomers)
     .map((id) => mappings.get(id)?.id)  // ❌ mappings chỉ có 50 items!
     .filter((id): id is string => !!id);
   ```
   → Chỉ tìm được mappings của 50 customers trên trang hiện tại!

---

## ✅ **Giải pháp**

Khi số lượng selected customers > số customers trên trang hiện tại, fetch tất cả mappings tương ứng:

```typescript
async function handleBulkSync() {
  try {
    setLoading(true);
    
    const selectedCustomerIds = Array.from(selectedCustomers);
    let mappingIds: string[];
    
    if (selectedCustomerIds.length > customers.length) {
      // ✅ Selected across multiple pages - fetch all mappings
      console.log(`Fetching mappings for ${selectedCustomerIds.length} selected customers...`);
      const allMappings = await syncClient.getMappingsByCustomerIds(selectedCustomerIds);
      mappingIds = allMappings
        .map((m) => m.id)
        .filter((id): id is string => !!id);
    } else {
      // ✅ Selected only from current page - use cached mappings
      mappingIds = selectedCustomerIds
        .map((id) => mappings.get(id)?.id)
        .filter((id): id is string => !!id);
    }

    if (mappingIds.length === 0) {
      alert("Please select mapped customers to sync");
      return;
    }

    // ... rest of sync logic
  }
}
```

---

## 🎯 **Logic sau khi fix**

### **Case 1: Select customers trên trang hiện tại**
- Selected: 10 customers
- Current page: 50 customers
- Logic: Sử dụng cached `mappings` Map ✅ (Efficient)

### **Case 2: Select all customers**
- Selected: 1000 customers
- Current page: 50 customers
- Logic: Fetch tất cả mappings từ API ✅ (Correct)

---

## 🧪 **Test**

### **Before fix:**
1. Có 1000 customers trong database
2. Click "Select all 1000 customers"
3. Click "Sync Selected"
4. ❌ Chỉ sync 50 customers (customers trên trang hiện tại)

### **After fix:**
1. Có 1000 customers trong database
2. Click "Select all 1000 customers"
3. Click "Sync Selected"
4. ✅ Sync tất cả 1000 customers

---

## 📝 **Files đã sửa**

1. **src/components/customers-sync/CustomerSyncTable.tsx**
   - Thêm logic detect selected across multiple pages
   - Fetch all mappings khi cần thiết

---

## ⚡ **Performance**

### **Trước:**
- ❌ Sai kết quả: Chỉ sync 50 customers
- ✅ Nhanh: Không cần fetch thêm mappings

### **Sau:**
- ✅ Đúng kết quả: Sync tất cả selected customers
- ✅ Tối ưu: Chỉ fetch khi cần (selected > current page)
- ⚡ Trade-off: Thêm 1 API call khi select all (acceptable)

---

## 🎉 **Kết luận**

Đã fix lỗi bulk sync chỉ sync 50 customers khi chọn "All"!

**Root cause:** Cached mappings chỉ chứa data của trang hiện tại
**Solution:** Fetch all mappings khi selected customers > current page
**Result:** ✅ Sync đúng tất cả selected customers
