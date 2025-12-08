# 🎬 Demo: Thêm Order Webhook (6 Phút)

## 🎯 Mục Tiêu: Thêm xử lý Order webhooks

**Thời gian:** 6 phút  
**Độ khó:** Dễ  
**Files cần sửa:** 2 files (1 tạo mới, 1 sửa)

---

## ⏱️ Bước 1: Tạo Handler (5 phút)

### File: `src/app/api/webhooks/nhanh/handlers/order.ts`

```typescript
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { shopifyAPI } from "@/lib/shopify-api";

/**
 * Handle order webhook from Nhanh.vn
 * Events: orderAdd, orderUpdate
 */
export async function handleOrderWebhook(payload: any) {
  const startTime = Date.now();

  try {
    if (!payload.data || !Array.isArray(payload.data)) {
      return NextResponse.json(
        { success: false, error: "Invalid payload data" },
        { status: 400 }
      );
    }

    console.log("📦 Processing order webhook:", {
      event: payload.event,
      ordersCount: payload.data.length,
    });

    const results = {
      total: payload.data.length,
      synced: 0,
      skipped: 0,
      failed: 0,
      details: [] as any[],
    };

    for (const order of payload.data) {
      try {
        const nhanhOrderId = order.id.toString();

        // Find order mapping
        const mapping = await prisma.orderMapping.findUnique({
          where: { nhanhOrderId },
        });

        if (!mapping || !mapping.shopifyOrderId) {
          console.log(`  ⏭️  Skipped: No mapping for order ${nhanhOrderId}`);
          results.skipped++;
          results.details.push({
            nhanhOrderId,
            status: "skipped",
            reason: "No mapping found",
          });
          continue;
        }

        // Sync order status to Shopify
        console.log(`  🔄 Syncing order ${nhanhOrderId} → ${mapping.shopifyOrderId}...`);
        
        await shopifyAPI.updateOrderStatus(
          mapping.shopifyOrderId,
          order.status
        );

        // Update mapping
        await prisma.orderMapping.update({
          where: { id: mapping.id },
          data: {
            syncStatus: "SYNCED",
            lastSyncedAt: new Date(),
            syncError: null,
          },
        });

        results.synced++;
        results.details.push({
          nhanhOrderId,
          shopifyOrderId: mapping.shopifyOrderId,
          status: "synced",
        });

        console.log(`  ✅ Synced successfully`);

      } catch (orderError: any) {
        console.error(`  ❌ Error processing order ${order.id}:`, orderError.message);
        results.failed++;
        results.details.push({
          nhanhOrderId: order.id.toString(),
          status: "failed",
          error: orderError.message,
        });
      }
    }

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);

    console.log(`\n✅ Order webhook processed in ${duration}s:`);
    console.log(`   - Total: ${results.total}`);
    console.log(`   - Synced: ${results.synced}`);
    console.log(`   - Skipped: ${results.skipped}`);
    console.log(`   - Failed: ${results.failed}`);

    return NextResponse.json({
      success: true,
      data: results,
      duration: `${duration}s`,
      message: `Processed ${results.total} orders`,
    });

  } catch (error: any) {
    console.error("❌ Order webhook error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
```

---

## ⏱️ Bước 2: Update Router (1 phút)

### File: `src/app/api/webhooks/nhanh/route.ts`

**Thêm import:**
```typescript
import { handleOrderWebhook } from "./handlers/order";
```

**Thêm case trong switch:**
```typescript
switch (event) {
  case "inventoryChange":
    return handleInventoryChange(request, payload);
  
  case "customerUpdate":
    return handleCustomerUpdate(request, payload);
  
  // ← THÊM 3 DÒNG NÀY
  case "orderAdd":
  case "orderUpdate":
    return handleOrderWebhook(payload);
  
  default:
    console.log(`⚠️ Unhandled event: ${event}`);
    return NextResponse.json({
      success: true,
      message: `Event ${event} received but not handled`,
    });
}
```

**Update supportedEvents:**
```typescript
supportedEvents: [
  "inventoryChange",
  "customerUpdate",
  "orderAdd",        // ← THÊM
  "orderUpdate",     // ← THÊM
  "productAdd",
  "productUpdate",
]
```

---

## ✅ Xong! Deploy & Test

### Deploy:
```bash
git add .
git commit -m "feat: add order webhook handler"
git push
```

### Test:
```bash
curl -X POST https://your-app.vercel.app/api/webhooks/nhanh \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your-token" \
  -d '{
    "event": "orderAdd",
    "businessId": "123",
    "data": [
      {
        "id": 456789,
        "code": "DH001",
        "status": "completed"
      }
    ]
  }'
```

**Response:**
```json
{
  "success": true,
  "data": {
    "total": 1,
    "synced": 1,
    "skipped": 0,
    "failed": 0
  },
  "duration": "0.12s",
  "message": "Processed 1 orders"
}
```

---

## 📊 Tổng Kết

**Thời gian thực tế:**
- Tạo handler: 5 phút
- Update router: 1 phút
- **Tổng: 6 phút** ✅

**Files thay đổi:**
- ✅ Tạo mới: `handlers/order.ts` (100 dòng)
- ✅ Sửa: `route.ts` (thêm 5 dòng)

**Không cần sửa:**
- ✅ `handlers/inventory.ts` - Không đụng
- ✅ `handlers/customer.ts` - Không đụng
- ✅ Database - Không cần migration
- ✅ Config - Không cần thay đổi

**Kết quả:**
- ✅ Order webhooks hoạt động
- ✅ Không ảnh hưởng code cũ
- ✅ Dễ rollback nếu cần
- ✅ Scalable cho events tiếp theo

---

## 🚀 Tiếp Theo: Thêm Product Webhook (6 phút nữa)

Làm tương tự:
1. Copy `handlers/order.ts` → `handlers/product.ts`
2. Sửa logic cho product
3. Thêm 3 dòng vào router
4. Done!

**Pattern lặp lại, cực kỳ dễ!** 🎉
