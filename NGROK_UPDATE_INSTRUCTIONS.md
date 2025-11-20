# Ngrok Update Instructions

## Vấn đề
Ngrok version 3.3.1 quá cũ. Cần version >= 3.7.0

## Giải pháp: Update Ngrok

### Option 1: Update bằng ngrok command (Nhanh nhất)
```powershell
ngrok update
```

### Option 2: Download manual
1. Truy cập: https://ngrok.com/download
2. Download Windows 64-bit version mới nhất
3. Giải nén và thay thế file ngrok.exe cũ

### Option 3: Sử dụng Chocolatey
```powershell
choco upgrade ngrok
```

## Sau khi update

### 1. Verify version
```powershell
ngrok version
# Should show: ngrok version 3.7.0 or higher
```

### 2. Start tunnel
```powershell
ngrok http 3000
```

### 3. Copy public URL
Từ output, copy URL (ví dụ: `https://abc123.ngrok-free.app`)

### 4. Update webhook trên Nhanh.vn
```
https://abc123.ngrok-free.app/api/sync/webhook
```

## Alternative: Sử dụng localtunnel (Không cần update)

Nếu không muốn update ngrok, có thể dùng localtunnel:

```powershell
# Install
npm install -g localtunnel

# Start tunnel
lt --port 3000

# Output: your url is: https://random-name.loca.lt
```

Webhook URL: `https://random-name.loca.lt/api/sync/webhook`

**Lưu ý:** Lần đầu truy cập localtunnel URL sẽ có trang xác nhận, click "Continue" để bypass.
