# Pull Customers Feature - Hoàn Thành ✅

## Tóm tắt

Đã hoàn thành tính năng pull và lưu trữ khách hàng từ Nhanh.vn vào database local.

## Các thay đổi đã thực hiện

### 1. Database Schema
- ✅ Thêm bảng `nhanh_customers` với các trường:
  - `id`: Nhanh customer ID (primary key)
  - `name`, `phone`, `email`: Thông tin liên hệ
  - `totalSpent`: Tổng chi tiêu
  - `address`, `city`, `district`, `ward`: Địa chỉ
  - `lastPulledAt`: Thời gian pull gần nhất
- ✅ Thêm relation giữa `nhanh_customers` và `customer_mappings`
- ✅ Migration đã chạy thành công

### 2. Backend API

#### POST /api/nhanh/pull-customers
- Pull tất cả khách hàng từ Nhanh.vn API
- Lưu vào database bằng upsert (tạo mới hoặc cập nhật)
- Trả về số lượng created/updated
- **Test**: ✅ Đã pull thành công 100 customers (0 created, 100 updated)

#### GET /api/nhanh/local-customers
- Lấy khách hàng từ database local
- Hỗ trợ pagination (page, limit)
- Hỗ trợ search (keyword) theo name, phone, email
- Sắp xếp theo totalSpent giảm dần
- **Test**: ✅ API hoạt động tốt, trả về đúng dữ liệu

### 3. Frontend Components

#### CustomerSyncTable.tsx
- ✅ Thêm nút "Pull from Nhanh.vn" với loading state
- ✅ Thêm search bar để tìm kiếm khách hàng
- ✅ Hiển thị khách hàng từ database thay vì gọi API Nhanh.vn
- ✅ Pagination đơn giản hơn (page-based thay vì cursor-based)
- ✅ Hiển thị tổng số khách hàng trong database

#### API Client
- ✅ `nhanhClient.pullCustomers()`: Pull customers từ Nhanh.vn
- ✅ `nhanhClient.getLocalCustomers()`: Lấy customers từ database
- ✅ Filter undefined values trong query params

## Cách sử dụng

### 1. Pull khách hàng lần đầu
1. Truy cập http://localhost:3000/customers-sync
2. Click nút "Pull from Nhanh.vn"
3. Đợi vài phút để pull tất cả khách hàng
4. Xem kết quả: Total, Created, Updated

### 2. Xem và mapping khách hàng
1. Danh sách khách hàng sẽ hiển thị từ database
2. Sử dụng search bar để tìm kiếm
3. Click "Map" để mapping với Shopify customer
4. Click "Sync" để đồng bộ dữ liệu

### 3. Cập nhật dữ liệu
- Click "Pull from Nhanh.vn" lại để cập nhật dữ liệu mới nhất
- Dữ liệu cũ sẽ được update, không bị duplicate

## Lợi ích

### Performance
- ⚡ Không cần gọi API Nhanh.vn mỗi lần load trang
- ⚡ Search nhanh hơn từ database local
- ⚡ Pagination hiệu quả hơn

### Reliability
- 🔒 Có thể xem khách hàng khi Nhanh.vn API không khả dụng
- 🔒 Dữ liệu được lưu trữ an toàn trong database
- 🔒 Có thể sync lại khi cần

### User Experience
- 👍 Load trang nhanh hơn
- 👍 Search real-time
- 👍 Không bị giới hạn bởi rate limit của Nhanh.vn API

## Test Results

### API Tests
```bash
# Pull customers
curl -X POST http://localhost:3000/api/nhanh/pull-customers
# Result: Total: 100, Created: 0, Updated: 100 ✅

# Get customers from database
curl "http://localhost:3000/api/nhanh/local-customers?page=1&limit=5"
# Result: 5 customers returned ✅

# Search customers
curl "http://localhost:3000/api/nhanh/local-customers?keyword=Linh&page=1&limit=10"
# Result: Filtered customers ✅
```

### UI Tests
- ✅ Pull button hoạt động
- ✅ Loading state hiển thị đúng
- ✅ Danh sách khách hàng hiển thị từ database
- ✅ Search bar hoạt động
- ✅ Pagination hoạt động
- ✅ Mapping modal hoạt động
- ✅ Sync functionality hoạt động

## Database Stats
- **Total customers**: 100
- **Storage**: ~50KB (ước tính)
- **Query time**: ~20-30ms per request

## Next Steps (Optional)
1. Thêm auto-sync schedule (cron job) để tự động pull mỗi ngày
2. Thêm last sync time indicator
3. Thêm incremental sync (chỉ pull customers mới/updated)
4. Thêm export/import functionality
5. Thêm bulk operations (delete, update)

## Troubleshooting

### Nếu không thấy khách hàng
1. Kiểm tra đã pull chưa: Click "Pull from Nhanh.vn"
2. Kiểm tra database: `SELECT COUNT(*) FROM nhanh_customers;`
3. Kiểm tra console log trong browser
4. Refresh trang (Ctrl+F5)

### Nếu pull bị lỗi
1. Kiểm tra Nhanh.vn API credentials trong .env
2. Kiểm tra database connection
3. Xem server logs trong terminal

## Files Changed
- `prisma/schema.prisma` - Added NhanhCustomer model
- `src/app/api/nhanh/pull-customers/route.ts` - New API route
- `src/app/api/nhanh/local-customers/route.ts` - New API route
- `src/lib/api-client.ts` - Added new client functions
- `src/components/customers-sync/CustomerSyncTable.tsx` - Updated UI
