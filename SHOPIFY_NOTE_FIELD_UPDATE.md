# Cập nhật trường Note cho Shopify Customer

## Tổng quan
Đã thêm trường `note` vào Shopify Customer và cập nhật logic auto-match để tìm số điện thoại trong note nếu trường phone mặc định không có.

## Các thay đổi

### 1. Database Schema (prisma/schema.prisma)
- Thêm trường `note` (Text) vào model `ShopifyCustomer`
- Migration đã được tạo và áp dụng: `20251127024114_add_note_to_shopify_customer`

### 2. Shopify API (src/lib/shopify-api.ts)
- Cập nhật GraphQL query `getAllCustomers` để lấy trường `note`
- Cập nhật hàm `formatCustomer` để include `note` trong response

### 3. Pull Customers API (src/app/api/shopify/pull-customers/route.ts)
- Cập nhật logic create và update để lưu trường `note` vào database
- Note sẽ được pull về cùng với các thông tin khác của customer

### 4. Auto-Match Logic (src/app/api/sync/auto-match/route.ts)
- Thêm hàm `extractPhonesFromNote()` để trích xuất số điện thoại từ note
- Cập nhật logic build phone lookup map để index cả số điện thoại từ note
- Auto-match giờ sẽ tìm kiếm theo thứ tự:
  1. Số điện thoại trong trường `phone` chính
  2. Số điện thoại trong trường `note` (nếu có)

### 5. TypeScript Types (src/types/shopify.ts)
- Trường `note` đã có sẵn trong interface `ShopifyCustomer`

## Cách hoạt động

### Trích xuất số điện thoại từ Note
Hàm `extractPhonesFromNote()` sử dụng regex để tìm số điện thoại Việt Nam:
- Hỗ trợ format: 0123456789, +84123456789, 84123456789
- Tự động normalize về format 0xxx và 84xxx
- Loại bỏ các ký tự đặc biệt: dấu cách, dấu gạch ngang, dấu chấm, dấu ngoặc

### Auto-Match với Note
1. Load tất cả Shopify customers (bao gồm cả note)
2. Build phone lookup map với:
   - Số điện thoại từ trường `phone`
   - Số điện thoại trích xuất từ trường `note`
3. Khi match Nhanh customer:
   - Tìm trong map với tất cả variations của số điện thoại
   - Chỉ auto-match nếu tìm thấy đúng 1 customer
   - Skip nếu không tìm thấy hoặc tìm thấy nhiều hơn 1

## Scripts hỗ trợ

### Xóa Nhanh Customers
```bash
node clear-nhanh-customers.js
```

## Lưu ý
- Cần pull lại Shopify customers để có dữ liệu note
- Auto-match sẽ hiệu quả hơn với customers có số điện thoại trong note
- Regex phone detection hỗ trợ format số điện thoại Việt Nam (10-11 số)
