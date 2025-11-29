# Product Cleanup Scripts

Các scripts để xóa nhanh dữ liệu products trong database.

## Scripts Available

### 1. clear-nhanh-products.js
Xóa tất cả Nhanh products và product mappings liên quan.

```bash
node clear-nhanh-products.js
```

**Xóa:**
- ✅ Tất cả Nhanh products
- ✅ Tất cả product mappings (cascade delete)

**Giữ lại:**
- ✅ Shopify products
- ✅ Product sync logs

---

### 2. clear-shopify-products.js
Xóa tất cả Shopify products.

```bash
node clear-shopify-products.js
```

**Xóa:**
- ✅ Tất cả Shopify products

**Giữ lại:**
- ✅ Nhanh products
- ✅ Product mappings (nhưng sẽ không sync được vì thiếu Shopify products)
- ✅ Product sync logs

**Note:** Script có delay 3 giây để bạn có thể cancel (Ctrl+C)

---

### 3. clear-product-mappings.js
Xóa tất cả product mappings.

```bash
node clear-product-mappings.js
```

**Xóa:**
- ✅ Tất cả product mappings
- ✅ Tất cả product sync logs (cascade delete)

**Giữ lại:**
- ✅ Nhanh products
- ✅ Shopify products

---

### 4. clear-product-sync-logs.js
Xóa chỉ product sync logs.

```bash
node clear-product-sync-logs.js
```

**Xóa:**
- ✅ Tất cả product sync logs

**Giữ lại:**
- ✅ Nhanh products
- ✅ Shopify products
- ✅ Product mappings

---

### 5. clear-all-products.js
Xóa TẤT CẢ dữ liệu products (nuclear option).

```bash
node clear-all-products.js
```

**Xóa:**
- ✅ Tất cả Nhanh products
- ✅ Tất cả Shopify products
- ✅ Tất cả product mappings
- ✅ Tất cả product sync logs

**Giữ lại:**
- ✅ Customers data
- ✅ Customer mappings
- ✅ Sale campaigns

---

## Use Cases

### Scenario 1: Reset và pull lại Nhanh products
```bash
# Xóa Nhanh products và mappings
node clear-nhanh-products.js

# Pull lại từ Nhanh
# Vào UI -> Click "Pull Nhanh Products"
```

### Scenario 2: Reset và pull lại Shopify products
```bash
# Xóa Shopify products
node clear-shopify-products.js

# Pull lại từ Shopify
# Vào UI -> Click "Pull Shopify Products"
```

### Scenario 3: Reset tất cả mappings
```bash
# Xóa chỉ mappings, giữ lại products
node clear-product-mappings.js

# Tạo lại mappings
# Vào UI -> Click "Auto Match by SKU"
```

### Scenario 4: Clean up sync logs
```bash
# Xóa chỉ sync logs để giảm database size
node clear-product-sync-logs.js
```

### Scenario 5: Reset hoàn toàn products system
```bash
# Xóa tất cả
node clear-all-products.js

# Pull lại từ đầu
# 1. Pull Shopify Products
# 2. Pull Nhanh Products
# 3. Auto Match by SKU
```

---

## Safety Features

### Confirmation Messages
Tất cả scripts đều hiển thị:
- 📊 Số lượng records sẽ bị xóa
- ⚠️ Warning message
- ✅ Kết quả sau khi xóa

### No Confirmation Required
Scripts chạy ngay lập tức (trừ `clear-shopify-products.js` có delay 3s).

**Lý do:** Scripts này dùng cho development/testing, cần chạy nhanh.

### Cascade Deletes
Database schema có cascade deletes:
- Xóa `NhanhProduct` → tự động xóa `ProductMapping`
- Xóa `ProductMapping` → tự động xóa `ProductSyncLog`

---

## Related Scripts

### Customer Cleanup Scripts
- `clear-nhanh-customers.js` - Xóa Nhanh customers
- `clear-shopify-customers.js` - Xóa Shopify customers
- `clear-all-mappings.js` - Xóa tất cả customer mappings

### Verification Scripts
- `check-variant-id.js` - Kiểm tra variant IDs
- `test-product-sync.js` - Test product sync

### Fix Scripts
- `fix-missing-variant-ids.js` - Fix missing variant IDs

---

## Database Schema Reference

```prisma
model NhanhProduct {
  id      String          @id
  mapping ProductMapping? // One-to-one
}

model ShopifyProduct {
  id        String @id
  variantId String?
}

model ProductMapping {
  id               String           @id
  nhanhProductId   String           @unique
  shopifyProductId String?
  shopifyVariantId String?
  nhanhProduct     NhanhProduct     @relation(onDelete: Cascade)
  syncLogs         ProductSyncLog[] // One-to-many
}

model ProductSyncLog {
  id        String         @id
  mappingId String
  mapping   ProductMapping @relation(onDelete: Cascade)
}
```

---

## Tips

### Before Running Scripts
```bash
# Backup database (optional)
pg_dump your_database > backup.sql

# Check current data
node check-variant-id.js
```

### After Running Scripts
```bash
# Verify deletion
node check-variant-id.js

# Check database size
# SELECT pg_size_pretty(pg_database_size('your_database'));
```

### Performance
- Scripts sử dụng `deleteMany()` - rất nhanh
- Không cần batch processing
- Cascade deletes tự động xử lý foreign keys

---

## Troubleshooting

### Error: Foreign key constraint
```
Error: Foreign key constraint failed
```

**Solution:** Xóa theo thứ tự đúng:
1. ProductSyncLog
2. ProductMapping
3. NhanhProduct / ShopifyProduct

Hoặc dùng `clear-all-products.js` để xóa theo thứ tự đúng.

### Error: Cannot connect to database
```
Error: Can't reach database server
```

**Solution:** 
- Check `.env` file có `DATABASE_URL` đúng không
- Check database server đang chạy
- Check network connection

---

## Summary

| Script | Nhanh Products | Shopify Products | Mappings | Sync Logs |
|--------|----------------|------------------|----------|-----------|
| clear-nhanh-products.js | ❌ | ✅ | ❌ | ✅ |
| clear-shopify-products.js | ✅ | ❌ | ✅ | ✅ |
| clear-product-mappings.js | ✅ | ✅ | ❌ | ❌ |
| clear-product-sync-logs.js | ✅ | ✅ | ✅ | ❌ |
| clear-all-products.js | ❌ | ❌ | ❌ | ❌ |

✅ = Giữ lại | ❌ = Xóa
