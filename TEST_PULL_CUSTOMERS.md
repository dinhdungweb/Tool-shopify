# Test Pull Customers Feature

## Các bước test:

### 1. Khởi động dev server
```bash
npm run dev
```

### 2. Test Pull Customers API
Mở browser và truy cập: http://localhost:3000/customers-sync

Hoặc test bằng curl:
```bash
# Pull customers từ Nhanh.vn
curl -X POST http://localhost:3000/api/nhanh/pull-customers

# Lấy customers từ database
curl http://localhost:3000/api/nhanh/local-customers?page=1&limit=50

# Search customers
curl "http://localhost:3000/api/nhanh/local-customers?keyword=test&page=1&limit=50"
```

### 3. Test UI
1. Truy cập http://localhost:3000/customers-sync
2. Click nút "Pull from Nhanh.vn" để pull tất cả khách hàng
3. Sau khi pull xong, danh sách khách hàng sẽ hiển thị từ database
4. Thử search khách hàng bằng tên, số điện thoại hoặc email
5. Thử phân trang (Previous/Next)
6. Click "Map" để mapping khách hàng với Shopify
7. Click "Sync" để đồng bộ dữ liệu

## Các thay đổi đã thực hiện:

### 1. Database Schema
- Thêm bảng `nhanh_customers` để lưu trữ khách hàng từ Nhanh.vn
- Thêm relation giữa `nhanh_customers` và `customer_mappings`

### 2. API Routes
- `POST /api/nhanh/pull-customers`: Pull tất cả khách hàng từ Nhanh.vn và lưu vào database
- `GET /api/nhanh/local-customers`: Lấy khách hàng từ database với pagination và search

### 3. API Client
- Thêm `nhanhClient.pullCustomers()`: Gọi API pull customers
- Thêm `nhanhClient.getLocalCustomers()`: Lấy customers từ database

### 4. UI Components
- Thêm nút "Pull from Nhanh.vn" để pull khách hàng
- Thêm search bar để tìm kiếm khách hàng
- Cập nhật pagination để sử dụng database pagination
- Hiển thị số lượng khách hàng trong database
- Loading state khi đang pull customers

## Lợi ích:

1. **Performance**: Không cần gọi API Nhanh.vn mỗi lần load trang
2. **Offline**: Có thể xem và mapping khách hàng khi Nhanh.vn API không khả dụng
3. **Search**: Tìm kiếm nhanh hơn từ database local
4. **Pagination**: Phân trang hiệu quả hơn với database
5. **Data consistency**: Dữ liệu được lưu trữ và có thể sync lại khi cần
