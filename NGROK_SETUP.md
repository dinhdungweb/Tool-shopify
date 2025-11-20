# Ngrok Setup for Webhook Testing

## Vấn đề
Nhanh.vn webhook cần một public URL để gửi events đến, nhưng localhost không thể truy cập từ internet.

## Giải pháp: Sử dụng Ngrok

Ngrok tạo một tunnel từ public URL đến localhost của bạn.

## Bước 1: Cài đặt Ngrok

### Windows
```powershell
# Download từ https://ngrok.com/download
# Hoặc dùng chocolatey
choco install ngrok
```

### Hoặc download trực tiếp
1. Truy cập https://ngrok.com/download
2. Download file .zip
3. Giải nén vào folder (ví dụ: C:\ngrok)
4. Thêm vào PATH hoặc chạy trực tiếp

## Bước 2: Đăng ký tài khoản Ngrok (Free)

1. Truy cập https://dashboard.ngrok.com/signup
2. Đăng ký tài khoản miễn phí
3. Lấy authtoken từ https://dashboard.ngrok.com/get-started/your-authtoken

## Bước 3: Setup Authtoken

```powershell
ngrok config add-authtoken YOUR_AUTH_TOKEN
```

## Bước 4: Start Ngrok Tunnel

### Mở terminal mới (KHÔNG đóng terminal đang chạy dev server)

```powershell
# Chạy ngrok để expose port 3000
ngrok http 3000
```

### Output sẽ như này:
```
ngrok

Session Status                online
Account                       your-email@example.com
Version                       3.x.x
Region                        United States (us)
Latency                       -
Web Interface                 http://127.0.0.1:4040
Forwarding                    https://abc123.ngrok-free.app -> http://localhost:3000

Connections                   ttl     opn     rt1     rt5     p50     p90
                              0       0       0.00    0.00    0.00    0.00
```

## Bước 5: Copy Public URL

Từ output trên, copy URL `https://abc123.ngrok-free.app`

**Lưu ý:** URL này sẽ thay đổi mỗi khi restart ngrok (free plan)

## Bước 6: Update Webhook URL trên Nhanh.vn

1. Vào Nhanh.vn Admin
2. Cài đặt → Webhook
3. Update URL thành: `https://abc123.ngrok-free.app/api/sync/webhook`
4. Lưu lại

## Bước 7: Test Webhook

### Test từ Nhanh.vn
1. Cập nhật thông tin customer
2. Hoàn thành đơn hàng
3. Kiểm tra logs

### Test bằng curl
```bash
curl -X POST https://abc123.ngrok-free.app/api/sync/webhook \
  -H "Content-Type: application/json" \
  -d '{
    "event": "customer.updated",
    "data": {
      "customerId": 7,
      "name": "Test Customer"
    }
  }'
```

### Xem requests trong Ngrok Web Interface
Truy cập http://127.0.0.1:4040 để xem tất cả requests đến ngrok tunnel

## Troubleshooting

### Lỗi 404 - Not Found
**Nguyên nhân:**
- Dev server không chạy
- Ngrok tunnel chưa start
- URL không đúng

**Giải pháp:**
1. Kiểm tra dev server: `npm run dev` đang chạy
2. Kiểm tra ngrok: `ngrok http 3000` đang chạy
3. Kiểm tra URL có `/api/sync/webhook` ở cuối

### Lỗi 502 - Bad Gateway
**Nguyên nhân:**
- Dev server bị crash
- Port 3000 không available

**Giải pháp:**
1. Restart dev server
2. Kiểm tra port 3000 có bị chiếm không

### Lỗi 403 - Forbidden (Ngrok Free Plan)
**Nguyên nhân:**
- Ngrok free plan có giới hạn requests
- Browser warning page

**Giải pháp:**
1. Upgrade ngrok plan (paid)
2. Hoặc skip browser warning bằng cách thêm header:
   ```
   ngrok-skip-browser-warning: true
   ```

### URL thay đổi mỗi lần restart
**Nguyên nhân:**
- Ngrok free plan không có static domain

**Giải pháp:**
1. Upgrade lên paid plan ($8/month) để có static domain
2. Hoặc update webhook URL mỗi lần restart ngrok

## Production Setup

Khi deploy production, KHÔNG dùng ngrok. Thay vào đó:

### Option 1: Deploy lên Vercel/Netlify
```bash
# Deploy lên Vercel
vercel deploy

# Webhook URL sẽ là:
https://your-app.vercel.app/api/sync/webhook
```

### Option 2: Deploy lên VPS với domain
```bash
# Setup domain với SSL
https://yourdomain.com/api/sync/webhook
```

### Option 3: Sử dụng Cloudflare Tunnel (Free alternative to ngrok)
```bash
# Install cloudflared
# Setup tunnel
cloudflared tunnel --url http://localhost:3000
```

## Ngrok Commands Cheat Sheet

```powershell
# Start tunnel
ngrok http 3000

# Start with custom subdomain (paid plan)
ngrok http 3000 --subdomain=myapp

# Start with custom domain (paid plan)
ngrok http 3000 --hostname=myapp.example.com

# View web interface
# Open browser: http://127.0.0.1:4040

# Stop tunnel
# Press Ctrl+C in ngrok terminal
```

## Current Setup

Theo screenshot của bạn:
- **Current URL**: `https://marinda-hexaplar-uncompletely.ngrok-free.dev/api/sync/webhook`
- **Status**: ❌ 404 Error

### Cần làm:
1. ✅ Dev server đang chạy (port 3000)
2. ❌ Ngrok tunnel cần start lại
3. ❌ Update webhook URL mới trên Nhanh.vn

### Steps:
```powershell
# Terminal 1: Dev server (đã chạy)
npm run dev

# Terminal 2: Start ngrok
ngrok http 3000

# Copy URL mới từ ngrok output
# Ví dụ: https://xyz789.ngrok-free.app

# Update trên Nhanh.vn:
# https://xyz789.ngrok-free.app/api/sync/webhook
```

## Alternative: Sử dụng localtunnel (Free, no signup)

```bash
# Install
npm install -g localtunnel

# Start tunnel
lt --port 3000

# Output: your url is: https://random-name.loca.lt
```

Webhook URL: `https://random-name.loca.lt/api/sync/webhook`
