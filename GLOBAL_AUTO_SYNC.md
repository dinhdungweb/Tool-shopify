# ⏰ Đồng bộ tự động Global - Hướng dẫn

## 🎯 Tổng quan

Tính năng đồng bộ tự động **Global** cho phép bạn cài đặt **một lịch chung** để tự động đồng bộ **tất cả khách hàng đã mapping** từ Nhanh.vn sang Shopify.

### Khác biệt với phiên bản trước

**Trước**: Mỗi khách hàng có lịch riêng → Phức tạp, khó quản lý
**Sau**: Một lịch chung cho tất cả → Đơn giản, dễ quản lý

## 🚀 Quick Start

### 1. Khởi động ứng dụng

```bash
npm run dev
```

### 2. Khởi động Scheduler (Development)

```bash
curl http://localhost:3000/api/sync/schedule/init
```

### 3. Cài đặt lịch đồng bộ

1. Vào trang **Customer Sync**: http://localhost:3000/customers-sync
2. Tìm phần **"Đồng bộ tự động"** (màu tím)
3. Click mũi tên để mở rộng
4. Bật toggle "Bật đồng bộ tự động"
5. Chọn lịch (ví dụ: "Mỗi 6 giờ")
6. Click "Lưu cài đặt"

✅ Done! Tất cả khách hàng đã mapping sẽ được đồng bộ tự động theo lịch.

## 📋 Các lịch có sẵn

- **Mỗi giờ**: `0 * * * *`
- **Mỗi 2 giờ**: `0 */2 * * *`
- **Mỗi 6 giờ**: `0 */6 * * *` ⭐ Khuyến nghị
- **Mỗi 12 giờ**: `0 */12 * * *`
- **Hàng ngày lúc 2h sáng**: `0 2 * * *`
- **Hàng ngày lúc 0h**: `0 0 * * *`
- **Hàng tuần (Chủ nhật)**: `0 0 * * 0`
- **Hàng tháng (ngày 1)**: `0 0 1 * *`

## 🔧 API Endpoints

### 1. Lấy cấu hình global

```bash
GET /api/sync/schedule/global
```

Response:
```json
{
  "success": true,
  "data": {
    "id": "global",
    "enabled": true,
    "schedule": "0 */6 * * *",
    "createdAt": "...",
    "updatedAt": "..."
  }
}
```

### 2. Cập nhật cấu hình

```bash
POST /api/sync/schedule/global
Content-Type: application/json

{
  "enabled": true,
  "schedule": "0 */6 * * *"
}
```

### 3. Khởi động scheduler

```bash
GET /api/sync/schedule/init
```

### 4. Chạy sync thủ công

```bash
POST /api/sync/auto-sync
```

Endpoint này sẽ đồng bộ tất cả khách hàng có trạng thái SYNCED.

### 5. Xem trạng thái

```bash
GET /api/sync/auto-sync
```

Response:
```json
{
  "success": true,
  "data": {
    "config": {
      "enabled": true,
      "schedule": "0 */6 * * *"
    },
    "syncedMappingsCount": 25,
    "recentMappings": [...]
  }
}
```

## 🧪 Test

```bash
# Chạy test script
node test-auto-sync.js
```

## 🌐 Deploy lên Vercel

### Cách 1: Node-cron (Hiện tại)

```bash
vercel --prod
```

Scheduler tự động khởi động khi app start.

⚠️ **Lưu ý**: Node-cron không hoạt động tốt trên Vercel serverless. Khuyến nghị dùng Vercel Cron Jobs.

### Cách 2: Vercel Cron Jobs (Khuyến nghị)

File `vercel.json` đã được cấu hình:

```json
{
  "crons": [
    {
      "path": "/api/sync/auto-sync",
      "schedule": "0 */6 * * *"
    }
  ]
}
```

Vercel sẽ tự động gọi endpoint `/api/sync/auto-sync` mỗi 6 giờ.

**Lưu ý**: 
- Vercel Cron chỉ hoạt động trên **Production**
- Bạn có thể thay đổi schedule trong `vercel.json`
- Không cần bật toggle trong UI khi dùng Vercel Cron

## 📊 Monitoring

### Xem logs trong database

```sql
SELECT 
  sl.*,
  cm.nhanh_customer_name
FROM sync_logs sl
JOIN customer_mappings cm ON sl.mapping_id = cm.id
WHERE sl.action = 'AUTO_SYNC'
ORDER BY sl.created_at DESC
LIMIT 50;
```

### Xem cấu hình hiện tại

```sql
SELECT * FROM auto_sync_config WHERE id = 'global';
```

### Xem số lượng khách hàng sẽ được sync

```sql
SELECT COUNT(*) FROM customer_mappings WHERE sync_status = 'SYNCED';
```

## ❓ Troubleshooting

### Scheduler không chạy

```bash
# Khởi động lại
curl -X POST http://localhost:3000/api/sync/schedule/init
```

### Kiểm tra cấu hình

```bash
curl http://localhost:3000/api/sync/schedule/global
```

### Test sync thủ công

```bash
curl -X POST http://localhost:3000/api/sync/auto-sync
```

### TypeScript errors

```bash
npm run db:generate
```

Sau đó restart TypeScript server trong VS Code.

## 🎯 Best Practices

1. **Chọn lịch phù hợp**:
   - Dữ liệu thay đổi thường xuyên → Mỗi 2-6 giờ
   - Dữ liệu ít thay đổi → Hàng ngày

2. **Tránh quá tải API**:
   - Không nên đặt lịch quá dày (< 1 giờ)
   - Cân nhắc giới hạn API của Nhanh.vn và Shopify

3. **Monitoring**:
   - Thường xuyên kiểm tra logs
   - Theo dõi số lượng sync thất bại

4. **Testing**:
   - Test với một vài khách hàng trước
   - Chạy sync thủ công để kiểm tra

## 📝 Database Schema

### Bảng `auto_sync_config`

```sql
CREATE TABLE auto_sync_config (
  id VARCHAR PRIMARY KEY DEFAULT 'global',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  enabled BOOLEAN DEFAULT FALSE,
  schedule VARCHAR DEFAULT '0 */6 * * *'
);
```

Chỉ có **một record duy nhất** với `id = 'global'`.

## 🔄 Workflow

1. User bật auto sync trong UI
2. Cấu hình được lưu vào database (`auto_sync_config`)
3. Scheduler được khởi động lại với lịch mới
4. Theo lịch, scheduler gọi `/api/sync/auto-sync`
5. API tìm tất cả mappings có `syncStatus = 'SYNCED'`
6. Đồng bộ từng mapping
7. Logs được ghi vào database

## ✨ Tính năng

✅ **Đơn giản**: Một lịch cho tất cả
✅ **Linh hoạt**: 8 lịch có sẵn + tùy chỉnh
✅ **Tự động**: Không cần can thiệp thủ công
✅ **Monitoring**: Logs đầy đủ trong database
✅ **Vercel-ready**: Hỗ trợ Vercel Cron Jobs

## 🎉 Kết luận

Tính năng đồng bộ tự động global giúp bạn:
- Quản lý lịch đồng bộ dễ dàng
- Tự động cập nhật dữ liệu cho tất cả khách hàng
- Tiết kiệm thời gian và công sức

**Múi giờ**: Asia/Ho_Chi_Minh (GMT+7)
**Khuyến nghị**: Đồng bộ mỗi 6 giờ
