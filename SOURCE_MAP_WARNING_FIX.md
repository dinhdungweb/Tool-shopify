# Source Map Warning Fix

## ⚠️ Vấn đề

Khi chạy `npm run dev`, xuất hiện nhiều warnings:

```
Invalid source map. Only conformant source maps can be used to find the original code.
Cause: Error: sourceMapURL could not be parsed
```

## 🔍 Nguyên nhân

- **Turbopack** (Next.js 16) có issue với source maps của một số packages
- Package `node-cron` có source map không tương thích với Turbopack
- Đây là **warning**, không phải error - ứng dụng vẫn chạy bình thường

## ✅ Giải pháp

### Option 1: Suppress Warnings (Đã áp dụng)

Thêm config vào `next.config.ts`:

```typescript
webpack(config, { dev, isServer }) {
  // Suppress source map warnings for node-cron
  if (dev && !isServer) {
    config.ignoreWarnings = [
      { module: /node-cron/ },
      /Failed to parse source map/,
    ];
  }
  return config;
}
```

**Ưu điểm**:
- Giảm noise trong console
- Không ảnh hưởng chức năng
- Vẫn giữ được Turbopack

**Nhược điểm**:
- Vẫn có warnings (nhưng ít hơn)

### Option 2: Tắt Turbopack

Chạy với Webpack thay vì Turbopack:

```bash
# Windows PowerShell
$env:TURBOPACK=0; npm run dev

# Linux/Mac
TURBOPACK=0 npm run dev
```

**Ưu điểm**:
- Không có source map warnings
- Webpack ổn định hơn

**Nhược điểm**:
- Chậm hơn Turbopack
- Mất tính năng mới của Next.js 16

### Option 3: Đợi Next.js Fix

Turbopack đang trong giai đoạn beta. Next.js team sẽ fix issue này trong các version sau.

## 📝 Lưu ý

1. **Warnings không ảnh hưởng chức năng**
   - Ứng dụng vẫn chạy bình thường
   - Auto sync vẫn hoạt động
   - Chỉ là noise trong console

2. **Chỉ xảy ra trong development**
   - Production build không có vấn đề này
   - Vercel deployment không bị ảnh hưởng

3. **Không cần lo lắng**
   - Đây là issue phổ biến với Turbopack
   - Nhiều packages khác cũng gặp tương tự
   - Sẽ được fix trong tương lai

## 🎯 Kết luận

**Đã áp dụng Option 1**: Suppress warnings trong `next.config.ts`

Ứng dụng hoạt động bình thường, chỉ giảm noise trong console.

Nếu vẫn thấy warnings, có thể ignore - không ảnh hưởng gì cả! ✅
