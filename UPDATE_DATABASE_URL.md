# 🔄 Update Database URL for Vercel Postgres

## 📋 Bước 1: Connect Database với Custom Prefix

Ở màn hình Vercel:
1. Xóa `STORAGE` trong ô "Custom Prefix"
2. Điền: `POSTGRES`
3. Check tất cả 3 environments: ✅ Development, ✅ Preview, ✅ Production
4. Click **Connect**

Vercel sẽ tạo:
- `POSTGRES_URL`
- `POSTGRES_PRISMA_URL` ← Dùng cái này
- `POSTGRES_URL_NON_POOLING`

---

## 📋 Bước 2: Update Prisma để dùng POSTGRES_PRISMA_URL

### **File: `prisma/schema.prisma`**

Không cần thay đổi! Prisma tự động detect `POSTGRES_PRISMA_URL` nếu có.

Nhưng để chắc chắn, có thể update:

```prisma
datasource db {
  provider = "postgresql"
  url      = env("POSTGRES_PRISMA_URL") // Thay đổi từ DATABASE_URL
}
```

---

## 📋 Bước 3: Update Local .env

### **File: `.env`**

Thêm dòng mới (giữ nguyên DATABASE_URL cũ cho local):

```env
# Local Database (PostgreSQL local)
DATABASE_URL="postgresql://postgres:Dinhdung12345@localhost:5432/nhanh_shopify_sync?schema=public"

# Vercel Postgres (for production)
# Copy từ Vercel Dashboard → Settings → Environment Variables
POSTGRES_PRISMA_URL="postgresql://default:xxx@xxx.postgres.vercel-storage.com:5432/verceldb?sslmode=require"
```

---

## 📋 Bước 4: Push Schema lên Vercel Postgres

```bash
# Copy POSTGRES_PRISMA_URL từ Vercel Dashboard
# Settings → Environment Variables → POSTGRES_PRISMA_URL → Copy

# Push schema
POSTGRES_PRISMA_URL="postgresql://..." npx prisma db push

# Verify
POSTGRES_PRISMA_URL="postgresql://..." npx prisma studio
```

---

## 📋 Bước 5: Update prisma/schema.prisma (Optional)

Nếu muốn dùng `POSTGRES_PRISMA_URL` thay vì `DATABASE_URL`:

```prisma
datasource db {
  provider = "postgresql"
  url      = env("POSTGRES_PRISMA_URL")
  directUrl = env("POSTGRES_URL_NON_POOLING")
}
```

**Hoặc giữ nguyên và dùng fallback:**

```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}
```

Prisma sẽ tự động dùng `POSTGRES_PRISMA_URL` nếu có trên Vercel.

---

## 📋 Bước 6: Redeploy

```bash
git add .
git commit -m "docs: Add database setup guide"
git push origin main
```

Vercel sẽ tự động redeploy với database mới.

---

## ✅ Verify

1. **Check Vercel Logs:**
   - Dashboard → Deployments → Latest → Logs
   - Không còn lỗi `Can't reach database server`

2. **Test App:**
   - Vào: https://tool-shopify-olai.vercel.app
   - Không còn lỗi database

3. **Check Database:**
   - Vercel Dashboard → Storage → Postgres
   - Xem tables đã được tạo

---

## 🎯 Tóm tắt

**Đã làm:**
- ✅ Connect Vercel Postgres với prefix `POSTGRES`
- ✅ Vercel tạo `POSTGRES_PRISMA_URL`
- ✅ Push schema lên Vercel Postgres
- ✅ Redeploy

**Kết quả:**
- ✅ App kết nối được database
- ✅ Không còn lỗi
- ✅ Ready to use!

---

## 💡 Lưu ý

**Local development:**
- Vẫn dùng `DATABASE_URL` (localhost)
- Prisma sẽ dùng `DATABASE_URL` khi chạy local

**Vercel production:**
- Prisma tự động dùng `POSTGRES_PRISMA_URL`
- Không cần thay đổi code

**Best practice:**
- Giữ cả 2 env vars
- Local: `DATABASE_URL`
- Production: `POSTGRES_PRISMA_URL`
