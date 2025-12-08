# 📊 So Sánh Các File Webhook

## 🗂️ Tổng Quan Files

```
src/app/api/webhooks/nhanh/
│
├── 📄 route.ts                    ← ROUTER (Điểm vào chính)
│
├── 📁 handlers/                   ← LOGIC (Shared code)
│   ├── inventory.ts               ← Xử lý tồn kho
│   └── customer.ts                ← Xử lý khách hàng
│
├── 📁 inventory/
│   └── route.ts                   ← ENDPOINT riêng (Optional)
│
└── 📁 customer/
    └── route.ts                   ← ENDPOINT riêng (Optional)
```

---

## 🎯 Chi Tiết Từng File

### 1. `route.ts` (Router) - ⭐ QUAN TRỌNG NHẤT

**Vai trò:** Cổng vào chính, nhận TẤT CẢ webhooks

**URL:** `/api/webhooks/nhanh`

**Code đơn giản hóa:**
```typescript
export async function POST(request) {
  // 1. Verify token (security)
  if (token không đúng) return 401;
  
  // 2. Parse JSON
  const payload = await request.json();
  
  // 3. Phân loại event
  switch (payload.event) {
    case "inventoryChange":
      return handleInventoryWebhook(payload);  // Gọi handler
    
    case "customerUpdate":
      return handleCustomerWebhook(payload);   // Gọi handler
    
    case "orderAdd":
      return handleOrderWebhook(payload);      // TODO
    
    default:
      return { message: "Event not handled" };
  }
}
```

**Khi nào dùng:**
- ✅ Setup 1 URL duy nhất trên Nhanh.vn
- ✅ Quản lý tất cả events ở 1 chỗ
- ✅ Có security token

---

### 2. `handlers/inventory.ts` - Logic Xử Lý Tồn Kho

**Vai trò:** Code thực sự xử lý inventory webhook

**Được gọi bởi:**
- `route.ts` (router)
- `inventory/route.ts` (endpoint riêng)

**Code đơn giản hóa:**
```typescript
export async function handleInventoryWebhook(payload) {
  // 1. Validate
  if (!payload.data) return error;
  
  // 2. Loop qua từng product
  for (const product of payload.data) {
    // 3. Tìm mapping
    const mapping = await prisma.productMapping.findUnique({
      where: { nhanhProductId: product.id }
    });
    
    if (!mapping) {
      skip; // Không có mapping → bỏ qua
      continue;
    }
    
    // 4. Sync Shopify
    await shopifyAPI.updateInventory(
      mapping.shopifyProductId,
      product.available
    );
    
    // 5. Update DB
    await prisma.nhanhProduct.update({
      where: { id: product.id },
      data: { quantity: product.available }
    });
    
    // 6. Log
    await prisma.productSyncLog.create({
      data: { action: "INVENTORY_UPDATE", status: "SYNCED" }
    });
  }
  
  return { success: true, synced: count };
}
```

**Tính năng:**
- ✅ Multi-location sync (nếu có setup)
- ✅ Single location sync (default)
- ✅ Error handling
- ✅ Logging

---

### 3. `handlers/customer.ts` - Logic Xử Lý Khách Hàng

**Vai trò:** Code thực sự xử lý customer webhook

**Được gọi bởi:**
- `route.ts` (router)
- `customer/route.ts` (endpoint riêng)

**Code đơn giản hóa:**
```typescript
export async function handleCustomerWebhook(payload) {
  // 1. Validate
  if (!payload.data) return error;
  
  // 2. Loop qua từng customer
  for (const customer of payload.data) {
    // 3. Tìm mapping
    const mapping = await prisma.customerMapping.findUnique({
      where: { nhanhCustomerId: customer.id }
    });
    
    if (!mapping) {
      skip; // Không có mapping → bỏ qua
      continue;
    }
    
    // 4. Sync Shopify
    await shopifyAPI.syncCustomerTotalSpent(
      mapping.shopifyCustomerId,
      customer.totalSpent
    );
    
    // 5. Update DB
    await prisma.nhanhCustomer.update({
      where: { id: customer.id },
      data: { totalSpent: customer.totalSpent }
    });
    
    // 6. Log
    await prisma.syncLog.create({
      data: { action: "WEBHOOK_SYNC", status: "SYNCED" }
    });
  }
  
  return { success: true, synced: count };
}
```

---

### 4. `inventory/route.ts` - Endpoint Riêng (Optional)

**Vai trò:** URL riêng chỉ cho inventory webhooks

**URL:** `/api/webhooks/nhanh/inventory`

**Code đơn giản hóa:**
```typescript
export async function POST(request) {
  // 1. Parse JSON
  const payload = await request.json();
  
  // 2. Validate event
  if (payload.event !== "inventoryChange") {
    return { error: "Wrong event type" };
  }
  
  // 3. Gọi handler (GIỐNG router)
  return handleInventoryWebhook(payload);
}
```

**Khi nào dùng:**
- ⚠️ Nếu muốn URL riêng cho inventory
- ⚠️ Backward compatible với setup cũ
- ⚠️ Không cần thiết nếu đã dùng router

---

### 5. `customer/route.ts` - Endpoint Riêng (Optional)

**Vai trò:** URL riêng chỉ cho customer webhooks

**URL:** `/api/webhooks/nhanh/customer`

**Code đơn giản hóa:**
```typescript
export async function POST(request) {
  // 1. Parse JSON
  const payload = await request.json();
  
  // 2. Validate event
  if (payload.event !== "customerUpdate") {
    return { error: "Wrong event type" };
  }
  
  // 3. Gọi handler (GIỐNG router)
  return handleCustomerWebhook(payload);
}
```

**Khi nào dùng:**
- ⚠️ Nếu muốn URL riêng cho customer
- ⚠️ Backward compatible với setup cũ
- ⚠️ Không cần thiết nếu đã dùng router

---

## 🔄 Luồng Xử Lý So Sánh

### Cách 1: Qua Router (KHUYẾN NGHỊ)

```
Nhanh.vn
   ↓
route.ts (Router)
   ↓
handlers/inventory.ts (Logic)
   ↓
Shopify + Database
```

**Ưu điểm:**
- ✅ 1 URL duy nhất
- ✅ Có security token
- ✅ Dễ quản lý

### Cách 2: Qua Endpoint Riêng

```
Nhanh.vn
   ↓
inventory/route.ts (Endpoint)
   ↓
handlers/inventory.ts (Logic)
   ↓
Shopify + Database
```

**Ưu điểm:**
- ✅ URL tách biệt rõ ràng
- ⚠️ Phải setup nhiều URLs

---

## 📋 Bảng So Sánh

| File | Vai Trò | URL | Bắt Buộc? | Khi Nào Dùng |
|------|---------|-----|-----------|--------------|
| `route.ts` | Router chính | `/api/webhooks/nhanh` | ⭐ Có | Setup 1 URL cho tất cả |
| `handlers/inventory.ts` | Logic inventory | N/A | ⭐ Có | Được gọi bởi router/endpoint |
| `handlers/customer.ts` | Logic customer | N/A | ⭐ Có | Được gọi bởi router/endpoint |
| `inventory/route.ts` | Endpoint riêng | `/api/webhooks/nhanh/inventory` | ⚠️ Không | Muốn URL riêng |
| `customer/route.ts` | Endpoint riêng | `/api/webhooks/nhanh/customer` | ⚠️ Không | Muốn URL riêng |

---

## 🎯 Khuyến Nghị Setup

### ⭐ Cách Đơn Giản Nhất (KHUYẾN NGHỊ)

**Chỉ dùng Router:**

1. **Setup trên Nhanh.vn:**
   ```
   URL: https://your-app.vercel.app/api/webhooks/nhanh
   Events: ✅ inventoryChange, ✅ customerUpdate
   ```

2. **Files cần thiết:**
   - ✅ `route.ts` (router)
   - ✅ `handlers/inventory.ts`
   - ✅ `handlers/customer.ts`
   - ⚠️ `inventory/route.ts` (giữ lại nhưng không setup)
   - ⚠️ `customer/route.ts` (giữ lại nhưng không setup)

3. **Kết quả:**
   - 1 URL duy nhất
   - Tất cả events vào 1 chỗ
   - Dễ quản lý

### ⚠️ Cách Phức Tạp (Không Khuyến Nghị)

**Dùng Endpoints Riêng:**

1. **Setup trên Nhanh.vn:**
   ```
   Inventory URL: https://your-app.vercel.app/api/webhooks/nhanh/inventory
   Customer URL: https://your-app.vercel.app/api/webhooks/nhanh/customer
   Order URL: https://your-app.vercel.app/api/webhooks/nhanh/order
   ...
   ```

2. **Nhược điểm:**
   - Nhiều URLs phải quản lý
   - Khó thêm events mới
   - Không có central security

---

## 💡 Tóm Tắt Cực Ngắn

### Bạn Chỉ Cần Nhớ:

1. **`route.ts`** = Cổng vào chính (setup URL này trên Nhanh.vn)

2. **`handlers/*.ts`** = Logic xử lý thực sự (không cần quan tâm URL)

3. **`inventory/route.ts` & `customer/route.ts`** = Endpoints riêng (không cần thiết)

### Setup:

```
Nhanh.vn → https://your-app.vercel.app/api/webhooks/nhanh
                                              ↑
                                         Chỉ cần URL này!
```

**Xong! Đơn giản vậy thôi!** 🎉
