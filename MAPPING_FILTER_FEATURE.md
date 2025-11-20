# Mapping Filter Feature ✅

## Tóm tắt
Đã thêm tính năng filter để lọc khách hàng theo trạng thái mapping.

## Các thay đổi

### 1. Frontend (CustomerSyncTable.tsx)
- ✅ Thêm state `mappingFilter` với 3 giá trị: "all", "mapped", "unmapped"
- ✅ Thêm dropdown select để chọn filter
- ✅ UI đẹp, responsive, nằm cạnh search bar
- ✅ Auto reset về page 1 khi thay đổi filter
- ✅ Reload data khi filter thay đổi

### 2. API Client (api-client.ts)
- ✅ Thêm parameter `mappingStatus?: "mapped" | "unmapped"` vào `getLocalCustomers()`
- ✅ Filter out undefined values để không gửi params không cần thiết

### 3. Backend API (local-customers/route.ts)
- ✅ Thêm logic filter theo mapping status:
  - `mapped`: Chỉ lấy customers có mapping (where.mapping = { isNot: null })
  - `unmapped`: Chỉ lấy customers chưa có mapping (where.mapping = null)
  - `all`: Lấy tất cả (không filter)
- ✅ Kết hợp được với search keyword

## Cách sử dụng

### UI
1. Truy cập http://localhost:3000/customers-sync
2. Nhìn thấy dropdown "All Customers" bên cạnh search bar
3. Click dropdown và chọn:
   - **All Customers**: Hiển thị tất cả (2578 customers)
   - **Mapped Only**: Chỉ hiển thị đã mapping (2 customers)
   - **Unmapped Only**: Chỉ hiển thị chưa mapping (2576 customers)

### API
```bash
# All customers
curl "http://localhost:3000/api/nhanh/local-customers?page=1&limit=50"

# Mapped only
curl "http://localhost:3000/api/nhanh/local-customers?page=1&limit=50&mappingStatus=mapped"

# Unmapped only
curl "http://localhost:3000/api/nhanh/local-customers?page=1&limit=50&mappingStatus=unmapped"

# Combine with search
curl "http://localhost:3000/api/nhanh/local-customers?page=1&limit=50&keyword=Minh&mappingStatus=unmapped"
```

## Test Results

### API Tests
```bash
# Unmapped customers
curl "...&mappingStatus=unmapped"
# Result: 2576 customers ✅

# Mapped customers
curl "...&mappingStatus=mapped"
# Result: 2 customers ✅

# All customers
curl "..."
# Result: 2578 customers ✅
```

### UI Tests
- ✅ Dropdown hiển thị đúng
- ✅ Filter "All Customers" hoạt động
- ✅ Filter "Mapped Only" hoạt động
- ✅ Filter "Unmapped Only" hoạt động
- ✅ Kết hợp với search hoạt động
- ✅ Pagination reset về page 1 khi đổi filter
- ✅ Loading state hiển thị đúng

## Statistics
- **Total customers**: 2578
- **Mapped**: 2 (0.08%)
- **Unmapped**: 2576 (99.92%)

## UI Design
```
┌─────────────────────────────────────────────────────────────┐
│ [🔍 Search by name, phone, or email...] [All Customers ▼]  │
└─────────────────────────────────────────────────────────────┘
```

Dropdown options:
- All Customers
- Mapped Only
- Unmapped Only

## Benefits
1. **Easy filtering**: Nhanh chóng tìm customers cần mapping
2. **Better workflow**: Focus vào unmapped customers để mapping
3. **Progress tracking**: Dễ dàng xem có bao nhiêu customers đã/chưa mapping
4. **Combined filters**: Có thể search + filter cùng lúc

## Next Steps (Optional)
1. Thêm badge hiển thị số lượng cho mỗi filter option
2. Thêm filter theo sync status (SYNCED, FAILED, PENDING)
3. Thêm bulk mapping cho unmapped customers
4. Thêm export unmapped customers
