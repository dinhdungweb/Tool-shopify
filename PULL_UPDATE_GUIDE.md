# Pull mới + Update cũ - Hướng dẫn

## ❓ Câu hỏi

"Tôi muốn pull customers mới + update dữ liệu customers cũ thế nào?"

## ✅ Câu trả lời

**Không cần làm gì thêm!** Mỗi lần pull đã tự động:
- ✅ **CREATE** customers mới
- ✅ **UPDATE** customers cũ với data mới nhất
- ✅ **REFRESH** lastPulledAt timestamp

## 🔄 Cách hoạt động

### Pull Logic (Tự động)

```typescript
// 1. Fetch customers từ Shopify/Nhanh
const customers = await api.getCustomers();

// 2. Check customers nào đã tồn tại
const existingIds = await db.findExisting(customerIds);

// 3. Phân loại
const toCreate = customers.filter(c => !existingIds.has(c.id)); // MỚI
const toUpdate = customers.filter(c => existingIds.has(c.id));  // CŨ

// 4. Create customers mới
await db.createMany(toCreate);

// 5. Update customers cũ
await db.updateMany(toUpdate);
```

**→ Tất cả tự động, không cần config!**

## 📊 Ví dụ thực tế

### Trước khi pull
```
Database:
- Customer A: email@old.com, orders: 5, spent: $100
- Customer B: test@email.com, orders: 10, spent: $500
```

### Shopify hiện tại
```
- Customer A: email@new.com, orders: 8, spent: $200  (CHANGED)
- Customer B: test@email.com, orders: 10, spent: $500 (SAME)
- Customer C: new@email.com, orders: 2, spent: $50   (NEW)
```

### Sau khi pull
```
Database:
- Customer A: email@new.com, orders: 8, spent: $200  ✅ UPDATED
- Customer B: test@email.com, orders: 10, spent: $500 ✅ REFRESHED
- Customer C: new@email.com, orders: 2, spent: $50   ✅ CREATED
```

## 🎯 Workflows

### 1. Daily Sync (Khuyến nghị)

**Mục đích**: Update customers có thay đổi + Thêm customers mới

```bash
# Nhanh
Click "Pull New/Updated"
→ Chỉ pull customers updated trong 24h
→ Nhanh, hiệu quả
→ Update cũ + Create mới

# Shopify
Click "Pull All Customers"
→ Pull tất cả
→ Update cũ + Create mới
```

**Kết quả:**
- ✅ Customers mới → Added
- ✅ Customers có thay đổi → Updated
- ✅ Customers không đổi → Refreshed (lastPulledAt)

### 2. Weekly Full Sync

**Mục đích**: Đảm bảo data đầy đủ và chính xác

```bash
# Cả Nhanh và Shopify
Click "Pull All"
→ Pull TẤT CẢ customers
→ Update toàn bộ database
→ Đảm bảo không miss data
```

**Kết quả:**
- ✅ 100% customers được refresh
- ✅ Data chính xác nhất
- ✅ Phát hiện customers bị xóa (nếu có)

### 3. Filtered Sync

**Mục đích**: Sync một nhóm cụ thể

```bash
# Ví dụ: Customers từ 2024
Click "Pull with Filters"
→ Select: From 2024-01-01
→ Pull customers matching filter
→ Update cũ + Create mới trong filter
```

**Kết quả:**
- ✅ Targeted sync
- ✅ Nhanh hơn Pull All
- ✅ Vẫn update customers cũ trong filter

## 🔍 Verify Update hoạt động

### Test Script
```bash
node test-update-existing.js
```

Script này sẽ:
1. Lấy 1 customer trước khi pull
2. Pull customers
3. Lấy lại customer đó sau pull
4. So sánh BEFORE vs AFTER
5. Hiển thị changes

### Expected Output
```
Sample customer BEFORE:
  Email: old@email.com
  Orders: 5
  Last Pulled: 2025-11-28

Pull customers...

Same customer AFTER:
  Email: new@email.com  ← UPDATED
  Orders: 8             ← UPDATED
  Last Pulled: 2025-11-29 ← UPDATED

✅ Customer WAS UPDATED
```

## 💡 FAQs

### Q: Có cần reset trước khi pull không?
**A: KHÔNG.** Pull tự động update customers cũ.

### Q: Pull có xóa customers cũ không?
**A: KHÔNG.** Pull chỉ CREATE và UPDATE, không DELETE.

### Q: Làm sao biết customer nào được update?
**A: Check `lastPulledAt` field.** Customers được pull sẽ có timestamp mới.

### Q: Pull All vs Pull New/Updated khác gì?
**A:**
- **Pull All**: Pull TẤT CẢ customers (chậm, đầy đủ)
- **Pull New/Updated**: Chỉ pull customers updated gần đây (nhanh, targeted)
- **Cả hai đều**: Update cũ + Create mới

### Q: Có cần pull lại customers đã pull rồi không?
**A: CÓ, nếu muốn update data mới nhất.**
- Daily: Pull New/Updated
- Weekly: Pull All
- On-demand: Pull khi cần

### Q: Pull có conflict với nhau không?
**A: KHÔNG, nếu:**
- Khác system (Nhanh vs Shopify)
- Khác filter
- Xem `PULL_CONFLICT_MATRIX.md` để biết chi tiết

## 🎓 Best Practices

### 1. Daily Maintenance
```
Morning:
- Pull New/Updated (Nhanh) → Fast, update recent changes
- Pull Shopify (if needed) → Update Shopify customers

Afternoon:
- Auto-match → Match new customers
- Sync selected → Sync to Shopify/Nhanh
```

### 2. Weekly Full Sync
```
Weekend:
- Pull All Nhanh → Full refresh
- Pull All Shopify → Full refresh
- Auto-match all → Re-match if needed
- Review & Bulk sync → Sync everything
```

### 3. On-Demand Sync
```
When needed:
- Pull with specific filter → Targeted sync
- Check changes → Verify updates
- Sync selected → Sync only what you need
```

## 📋 Checklist

Trước khi pull:
- [ ] Xác định mục đích (daily, weekly, targeted)
- [ ] Chọn pull type phù hợp (All, New/Updated, Filtered)
- [ ] Check không có pull nào đang chạy (nếu cùng filter)

Sau khi pull:
- [ ] Verify customers được update (check lastPulledAt)
- [ ] Check số lượng created vs updated
- [ ] Auto-match nếu có customers mới
- [ ] Sync nếu cần

## 🚀 Quick Commands

```bash
# Check progress
node check-pull-progress.js

# Test update
node test-update-existing.js

# Test concurrent pulls
node test-concurrent-pulls.js
```

## ✅ Kết luận

**Pull tự động xử lý cả mới và cũ!**

Bạn chỉ cần:
1. Click "Pull Customers"
2. Đợi hoàn thành
3. Done! ✅

Không cần:
- ❌ Reset trước khi pull
- ❌ Pull riêng cho customers mới
- ❌ Pull riêng cho customers cũ
- ❌ Config gì thêm

**Just pull and it works!** 🎉
