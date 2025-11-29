# Quick Cleanup Guide

Hướng dẫn nhanh để xóa dữ liệu products.

## 🚀 Quick Commands

```bash
# Xóa Nhanh products + mappings
node clear-nhanh-products.js

# Xóa Shopify products
node clear-shopify-products.js

# Xóa chỉ mappings
node clear-product-mappings.js

# Xóa chỉ sync logs
node clear-product-sync-logs.js

# Xóa TẤT CẢ products data
node clear-all-products.js
```

## 📊 Check Current Data

```bash
node test-cleanup-scripts.js
```

## 🔧 Common Workflows

### Reset Mappings
```bash
node clear-product-mappings.js
# Then: UI -> Auto Match by SKU
```

### Fresh Start
```bash
node clear-all-products.js
# Then: UI -> Pull Shopify Products
# Then: UI -> Pull Nhanh Products
# Then: UI -> Auto Match by SKU
```

### Clean Logs Only
```bash
node clear-product-sync-logs.js
```

## 📖 Full Documentation

See `PRODUCT_CLEANUP_SCRIPTS.md` for detailed information.
