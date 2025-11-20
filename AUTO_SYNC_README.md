# ⏰ Tính năng Đồng bộ tự động

## Tổng quan

Tính năng cho phép tự động đồng bộ dữ liệu khách hàng từ Nhanh.vn sang Shopify theo lịch đã cài đặt.

## 🚀 Quick Start

### 1. Khởi động ứng dụng

```bash
npm run dev
```

### 2. Khởi động Scheduler (Development)

```bash
# Gọi API để khởi động scheduler
curl http://localhost:3000/api/sync/schedule/init
```

Hoặc mở trình duyệt: http://localhost:3000/api/sync/schedule/init

### 3. Cài đặt Auto Sync cho khách hàng

1. Vào trang **Customer Sync**: http://localhost:3000/customers-sync
2. Tìm khách hàng đã **mapped** và **synced** (trạng thái = SYNCED)
3. Click nút **⏰** ở cột Actions
4. Trong modal:
   - Bật toggle "Bật đồng bộ tự động"
   - Chọn lịch (ví dụ: "Mỗi 6 giờ")
   - Click "Lưu cài đặt"

### 4. Kiểm tra

```bash
# Xem danh sách mappings có auto sync enabled
curl http://localhost:3000/api/sync/auto-sync

# Xem trạng thái scheduler
curl http://localhost:3000/api/sync/schedule/init
```

## 📋 Các lịch có sẵn

- **Mỗi giờ**: `0 * * * *`
- **Mỗi 2 giờ**: `0 */2 * * *`
- **Mỗi 6 giờ**: `0 */6 * * *` ⭐ Khuyến nghị
- **Mỗi 12 giờ**: `0 */12 * * *`
- **Hàng ngày lúc 2h sáng**: `0 2 * * *`
- **Hàng ngày lúc 0h**: `0 0 * * *`
- **Hàng tuần (Chủ nhật)**: `0 0 * * 0`
- **Hàng tháng (ngày 1)**: `0 0 1 * *`

## 🧪 Test

```bash
# Chạy test script
node test-auto-sync.js
```

## 📚 Tài liệu chi tiết

- **Hướng dẫn sử dụng**: [AUTO_SYNC_GUIDE.md](./AUTO_SYNC_GUIDE.md)
- **Chi tiết kỹ thuật**: [AUTO_SYNC_IMPLEMENTATION.md](./AUTO_SYNC_IMPLEMENTATION.md)

## 🌐 Deploy lên Vercel

### Cách 1: Sử dụng Node-cron (Hiện tại)

```bash
vercel --prod
```

Scheduler sẽ tự động khởi động khi app start.

### Cách 2: Sử dụng Vercel Cron Jobs (Khuyến nghị)

File `vercel.json` đã được cấu hình sẵn:

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

**Lưu ý**: Vercel Cron Jobs chỉ hoạt động trên **Production** deployment.

## ⚙️ API Endpoints

| Endpoint | Method | Mô tả |
|----------|--------|-------|
| `/api/sync/schedule` | GET | Lấy cài đặt lịch |
| `/api/sync/schedule` | POST | Bật/cập nhật lịch |
| `/api/sync/schedule` | DELETE | Tắt auto sync |
| `/api/sync/schedule/init` | GET | Khởi động scheduler |
| `/api/sync/schedule/init` | POST | Khởi động lại scheduler |
| `/api/sync/auto-sync` | GET | Xem trạng thái |
| `/api/sync/auto-sync` | POST | Chạy sync thủ công |

## 🔍 Monitoring

### Xem logs trong database

```sql
SELECT * FROM sync_logs 
WHERE action = 'AUTO_SYNC' 
ORDER BY created_at DESC 
LIMIT 50;
```

### Xem mappings có auto sync enabled

```sql
SELECT 
  id,
  nhanh_customer_name,
  auto_sync_enabled,
  sync_schedule,
  last_synced_at
FROM customer_mappings
WHERE auto_sync_enabled = true;
```

## ❓ Troubleshooting

### Scheduler không chạy

```bash
# Khởi động lại
curl -X POST http://localhost:3000/api/sync/schedule/init
```

### TypeScript errors

```bash
npm run db:generate
```

Sau đó restart TypeScript server trong VS Code.

### Xem logs

Logs sẽ hiển thị trong console khi chạy `npm run dev`.

## 📝 Notes

- Múi giờ: **Asia/Ho_Chi_Minh (GMT+7)**
- Chỉ sync mappings có trạng thái **SYNCED**
- Scheduler tự động load lại khi thay đổi cài đặt
- Trong development, cần khởi động scheduler thủ công
- Trong production, scheduler tự động khởi động

## 🎉 Done!

Tính năng đồng bộ tự động đã sẵn sàng sử dụng!
