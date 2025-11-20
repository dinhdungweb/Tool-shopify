# Hướng dẫn sử dụng tính năng Đồng bộ tự động

## Tổng quan

Tính năng đồng bộ tự động cho phép bạn cài đặt lịch để tự động đồng bộ dữ liệu khách hàng từ Nhanh.vn sang Shopify theo định kỳ.

## Cách sử dụng

### 1. Điều kiện để bật Auto Sync

Để bật đồng bộ tự động cho một khách hàng, cần đảm bảo:
- ✅ Khách hàng đã được **mapping** (liên kết) với khách hàng Shopify
- ✅ Đã **đồng bộ thành công** ít nhất 1 lần (trạng thái = SYNCED)

### 2. Cài đặt lịch đồng bộ

1. Vào trang **Customer Sync**
2. Tìm khách hàng đã được mapping và synced
3. Click nút **⏰** (Auto Sync) ở cột Actions
4. Trong modal cài đặt:
   - Bật/tắt đồng bộ tự động
   - Chọn lịch có sẵn hoặc tùy chỉnh

### 3. Các lịch có sẵn

- **Mỗi giờ**: Đồng bộ mỗi giờ
- **Mỗi 2 giờ**: Đồng bộ mỗi 2 giờ
- **Mỗi 6 giờ**: Đồng bộ mỗi 6 giờ (khuyến nghị)
- **Mỗi 12 giờ**: Đồng bộ mỗi 12 giờ
- **Hàng ngày lúc 2h sáng**: Đồng bộ mỗi ngày lúc 2:00 AM
- **Hàng ngày lúc 0h**: Đồng bộ mỗi ngày lúc 12:00 AM
- **Hàng tuần (Chủ nhật)**: Đồng bộ mỗi Chủ nhật lúc 0:00 AM
- **Hàng tháng (ngày 1)**: Đồng bộ ngày 1 hàng tháng lúc 0:00 AM

### 4. Tùy chỉnh lịch (Cron Expression)

Nếu muốn tùy chỉnh lịch, bạn có thể nhập Cron expression:

**Format**: `phút giờ ngày tháng thứ`

**Ví dụ**:
- `0 */6 * * *` - Mỗi 6 giờ
- `0 2 * * *` - Mỗi ngày lúc 2:00 AM
- `0 0 * * 0` - Mỗi Chủ nhật lúc 0:00 AM
- `0 0 1 * *` - Ngày 1 hàng tháng lúc 0:00 AM
- `*/30 * * * *` - Mỗi 30 phút

**Lưu ý**: Múi giờ sử dụng là **Asia/Ho_Chi_Minh (GMT+7)**

## Khởi động Scheduler

### Development

Scheduler sẽ **KHÔNG** tự động khởi động trong môi trường development để tránh chạy background tasks không mong muốn.

Để khởi động thủ công:

```bash
# Gọi API để khởi động scheduler
curl http://localhost:3000/api/sync/schedule/init
```

Hoặc truy cập: http://localhost:3000/api/sync/schedule/init

### Production

Scheduler sẽ **tự động khởi động** khi deploy lên production.

Để khởi động lại scheduler (sau khi thay đổi cài đặt):

```bash
# POST để reinitialize
curl -X POST https://your-domain.com/api/sync/schedule/init
```

## API Endpoints

### 1. Lấy cài đặt lịch

```bash
GET /api/sync/schedule?mappingId=xxx
```

### 2. Cập nhật lịch đồng bộ

```bash
POST /api/sync/schedule
Content-Type: application/json

{
  "mappingId": "xxx",
  "autoSyncEnabled": true,
  "syncSchedule": "0 */6 * * *"
}
```

### 3. Tắt đồng bộ tự động

```bash
DELETE /api/sync/schedule?mappingId=xxx
```

### 4. Khởi động/Khởi động lại Scheduler

```bash
# Khởi động
GET /api/sync/schedule/init

# Khởi động lại (reload tất cả schedules)
POST /api/sync/schedule/init
```

## Monitoring

### Kiểm tra trạng thái Scheduler

```bash
GET /api/sync/schedule/init
```

Response:
```json
{
  "success": true,
  "message": "Cron scheduler initialized successfully",
  "activeTasks": 5,
  "tasks": ["mapping-id-1", "mapping-id-2", ...]
}
```

### Xem logs

Logs sẽ được ghi vào:
- Console logs (development)
- Application logs (production)
- Database: Bảng `sync_logs` với `action = AUTO_SYNC`

## Troubleshooting

### Scheduler không chạy

1. Kiểm tra scheduler đã được khởi động chưa:
   ```bash
   curl http://localhost:3000/api/sync/schedule/init
   ```

2. Kiểm tra logs trong console

3. Khởi động lại scheduler:
   ```bash
   curl -X POST http://localhost:3000/api/sync/schedule/init
   ```

### Đồng bộ không thành công

1. Kiểm tra bảng `sync_logs` để xem lỗi
2. Kiểm tra mapping vẫn còn hợp lệ
3. Kiểm tra API credentials (Nhanh.vn và Shopify)

### Thay đổi lịch không có hiệu lực

Sau khi thay đổi lịch qua UI, scheduler sẽ tự động cập nhật. Nếu không, khởi động lại:

```bash
curl -X POST http://localhost:3000/api/sync/schedule/init
```

## Best Practices

1. **Chọn lịch phù hợp**: 
   - Dữ liệu thay đổi thường xuyên → Mỗi 2-6 giờ
   - Dữ liệu ít thay đổi → Hàng ngày

2. **Tránh quá tải API**:
   - Không nên đặt lịch quá dày (< 1 giờ)
   - Cân nhắc giới hạn API của Nhanh.vn và Shopify

3. **Monitoring**:
   - Thường xuyên kiểm tra logs
   - Theo dõi số lượng sync thất bại

4. **Backup**:
   - Luôn có backup dữ liệu trước khi bật auto sync
   - Test kỹ với một vài khách hàng trước khi bật hàng loạt

## Vercel Deployment

Nếu deploy trên Vercel, bạn có thể sử dụng **Vercel Cron Jobs** thay vì node-cron:

1. Tạo file `vercel.json`:
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

2. Tạo endpoint `/api/sync/auto-sync` để sync tất cả mappings có `autoSyncEnabled = true`

Xem thêm: https://vercel.com/docs/cron-jobs
