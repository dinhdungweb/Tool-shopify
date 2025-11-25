# Hướng Dẫn Đồng Bộ Sản Phẩm (Product Sync)

## Tổng Quan

Tính năng đồng bộ sản phẩm cho phép bạn **cập nhật tồn kho** từ Nhanh.vn sang Shopify một cách tự động.

## Mục Đích

- **Đồng bộ tồn kho**: Cập nhật số lượng tồn kho từ Nhanh sang Shopify
- **Đồng bộ giá**: Cập nhật giá bán và giá so sánh
- **Mapping sản phẩm**: Liên kết sản phẩm Nhanh với sản phẩm Shopify

## Các Bước Sử Dụng

### 1. Pull Sản Phẩm từ Shopify

Trước tiên, bạn cần pull tất cả sản phẩm từ Shopify về database local để tìm kiếm nhanh hơn:

1. Vào trang **Products Sync** (`/products-sync`)
2. Click nút **"Pull Sản Phẩm"** → **"Pull từ Shopify"**
3. Xác nhận và đợi quá trình hoàn tất

### 2. Pull Sản Phẩm từ Nhanh.vn

Pull sản phẩm từ Nhanh.vn về database:

1. Click nút **"Pull Sản Phẩm"** → **"Pull từ Nhanh.vn"**
2. Xác nhận và đợi quá trình hoàn tất

### 3. Mapping Sản Phẩm

Liên kết sản phẩm Nhanh với sản phẩm Shopify:

1. Tìm sản phẩm cần map trong danh sách
2. Click nút **"Map"**
3. Trong modal:
   - Nhập tên sản phẩm, SKU hoặc barcode để tìm kiếm trên Shopify
   - Click **"Tìm kiếm"**
   - Chọn sản phẩm Shopify tương ứng
   - Click **"Lưu Mapping"**

### 4. Đồng Bộ Tồn Kho

Sau khi đã map, bạn có thể đồng bộ tồn kho:

1. Click nút **"Đồng bộ"** ở sản phẩm đã map
2. Hệ thống sẽ:
   - Lấy số lượng tồn kho mới nhất từ Nhanh
   - Cập nhật tồn kho trên Shopify
   - Cập nhật giá nếu có thay đổi

## Các Cột Trong Bảng

| Cột | Mô Tả |
|-----|-------|
| **Sản phẩm** | Tên và ID sản phẩm từ Nhanh |
| **SKU / Barcode** | Mã SKU và barcode |
| **Tồn kho** | Số lượng tồn kho hiện tại trên Nhanh |
| **Giá** | Giá bán trên Nhanh |
| **Trạng thái** | Trạng thái mapping và đồng bộ |
| **Sản phẩm Shopify** | Sản phẩm Shopify đã được map |
| **Thao tác** | Nút Map và Đồng bộ |

## Trạng Thái Đồng Bộ

- **UNMAPPED** (Chưa map): Chưa liên kết với sản phẩm Shopify
- **PENDING** (Chờ đồng bộ): Đã map nhưng chưa đồng bộ
- **SYNCED** (Đã đồng bộ): Đã đồng bộ thành công
- **FAILED** (Lỗi): Đồng bộ thất bại

## Tính Năng Lọc

- **Tất cả**: Hiển thị tất cả sản phẩm
- **Đã map**: Chỉ hiển thị sản phẩm đã map
- **Chưa map**: Chỉ hiển thị sản phẩm chưa map
- **Chờ đồng bộ**: Sản phẩm đã map nhưng chưa đồng bộ
- **Đã đồng bộ**: Sản phẩm đã đồng bộ thành công
- **Lỗi**: Sản phẩm đồng bộ thất bại

## Tìm Kiếm

Bạn có thể tìm kiếm sản phẩm theo:
- Tên sản phẩm
- SKU
- Barcode

## Lưu Ý

1. **Mapping chính xác**: Đảm bảo map đúng sản phẩm để tránh cập nhật sai tồn kho
2. **Kiểm tra trước khi đồng bộ**: Xem lại thông tin trước khi click "Đồng bộ"
3. **Tồn kho sẽ được ghi đè**: Tồn kho trên Shopify sẽ được thay thế bằng tồn kho từ Nhanh
4. **Pull định kỳ**: Nên pull sản phẩm từ Nhanh định kỳ để có dữ liệu mới nhất

## API Endpoints

### Nhanh Products
- `GET /api/nhanh/products` - Lấy danh sách sản phẩm từ Nhanh API
- `POST /api/nhanh/pull-products` - Pull tất cả sản phẩm từ Nhanh
- `GET /api/nhanh/local-products` - Lấy sản phẩm từ database local
- `POST /api/nhanh/search-products` - Tìm kiếm sản phẩm trên Nhanh

### Shopify Products
- `POST /api/shopify/pull-products-sync` - Pull tất cả sản phẩm từ Shopify
- `POST /api/shopify/search-products` - Tìm kiếm sản phẩm trên Shopify

### Product Mapping & Sync
- `GET /api/sync/product-mapping` - Lấy danh sách mapping
- `POST /api/sync/product-mapping` - Tạo mapping mới
- `PATCH /api/sync/product-mapping` - Cập nhật mapping
- `DELETE /api/sync/product-mapping` - Xóa mapping
- `POST /api/sync/sync-product` - Đồng bộ sản phẩm

## Database Schema

### NhanhProduct
- Lưu trữ sản phẩm từ Nhanh.vn
- Bao gồm: tên, SKU, barcode, giá, tồn kho, hình ảnh

### ShopifyProduct
- Lưu trữ sản phẩm từ Shopify
- Bao gồm: title, SKU, barcode, giá, tồn kho, variant ID

### ProductMapping
- Liên kết giữa NhanhProduct và ShopifyProduct
- Theo dõi trạng thái đồng bộ
- Lưu lịch sử đồng bộ

### ProductSyncLog
- Lưu lịch sử các lần đồng bộ
- Ghi lại lỗi nếu có

## Troubleshooting

### Không tìm thấy sản phẩm Shopify
- Đảm bảo đã pull sản phẩm từ Shopify
- Kiểm tra từ khóa tìm kiếm (tên, SKU, barcode)

### Đồng bộ thất bại
- Kiểm tra kết nối API Shopify
- Xem log lỗi trong database (ProductSyncLog)
- Đảm bảo variant ID còn tồn tại trên Shopify

### Tồn kho không cập nhật
- Kiểm tra quyền API Shopify (cần quyền write_inventory)
- Xem lại mapping có đúng variant không
