# 🗄️ Vercel Database Setup Guide

## ❌ Lỗi hiện tại

```
Failed to load data:
Invalid `prisma.shopifyProduct.count()` invocation:
Can't reach database server at 'localhost:5432'
```

**Nguyên nhân:**
- App trên Vercel đang cố kết nối `localhost:5432`
- Vercel không có database local
- Cần external database (cloud)

---

## 💡 Giải pháp

### **Option 1: Vercel Postgres** ⭐ Khuyến nghị

**Free tier:**
- ✅ 256 MB storage
- ✅ 60 hours compute/month
- ✅ Tích hợp sẵn với Vercel
- ✅ Auto environment variables

**Setup:**

1. **Tạo database:**
   ```
   Vercel Dashboard → Project → Storage → Create Database → Postgres
   ```

2. **Vercel tự động add env vars:**
   - `POSTGRES_URL`
   - `POSTGRES_PRISMA_URL` ← Prisma sẽ dùng cái này
   - `POSTGRES_URL_NON_POOLING`

3. **Push Prisma schema:**
   ```bash
   # Option A: Từ Vercel Dashboard
   Storage → Postgres → Query → Paste SQL từ prisma migrate
   
   # Option B: Từ local (khuyến nghị)
   # Copy POSTGRES_PRISMA_URL từ Vercel
   DATABASE_URL="postgresql://..." npx prisma db push
   ```

4. **Redeploy:**
   ```bash
   git commit --allow-empty -m "trigger redeploy"
   git push origin main
   ```

---

### **Option 2: Supabase** ⭐ Best for FREE

**Free tier:**
- ✅ 500 MB database
- ✅ Unlimited API requests
- ✅ Auto backups
- ✅ Realtime subscriptions
- ✅ Auth built-in

**Setup:**

1. **Tạo project:**
   - https://supabase.com/dashboard
   - New Project
   - Chọn region gần nhất (Singapore cho VN)

2. **Get connection string:**
   ```
   Project Settings → Database → Connection String
   
   Mode: Transaction (cho Prisma)
   URI: postgresql://postgres.[project-ref]:[password]@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres
   ```

3. **Add vào Vercel:**
   ```
   Vercel Dashboard → Project → Settings → Environment Variables
   
   Name: DATABASE_URL
   Value: postgresql://postgres.[project-ref]:[password]@...
   ```

4. **Push schema:**
   ```bash
   # Local
   DATABASE_URL="postgresql://..." npx prisma db push
   ```

5. **Redeploy Vercel**

---

### **Option 3: Neon** ⭐ Serverless

**Free tier:**
- ✅ 512 MB storage
- ✅ Serverless (auto-scale to zero)
- ✅ Instant branching
- ✅ Fast cold starts

**Setup:**

1. **Tạo project:**
   - https://neon.tech
   - New Project

2. **Get connection string:**
   ```
   Dashboard → Connection Details → Pooled connection
   ```

3. **Add vào Vercel** (giống Supabase)

4. **Push schema** (giống Supabase)

---

### **Option 4: Railway** 💰 $5/month

**Free trial:** $5 credit
**After trial:** $5/month minimum

**Setup tương tự Supabase/Neon**

---

## 📊 So sánh Options

| Option | Storage | Cost | Setup | Best for |
|--------|---------|------|-------|----------|
| **Vercel Postgres** | 256 MB | FREE | ⭐ Easy | Vercel projects |
| **Supabase** | 500 MB | FREE | ⭐⭐ Medium | Full-stack apps |
| **Neon** | 512 MB | FREE | ⭐⭐ Medium | Serverless |
| **Railway** | 1 GB | $5/mo | ⭐⭐ Medium | Production |

---

## 🎯 Khuyến nghị

### **Cho Development/Testing:**
```
✅ Vercel Postgres (nếu dùng Vercel)
✅ Supabase (nếu cần nhiều features)
```

### **Cho Production:**
```
✅ Supabase (FREE, reliable)
✅ Neon (serverless, auto-scale)
✅ Railway (nếu cần dedicated resources)
```

---

## 🔧 Step-by-step: Vercel Postgres

### 1. Create Database

```
1. Vào: https://vercel.com/dashboard
2. Chọn project: Tool-shopify
3. Tab: Storage
4. Click: Create Database
5. Chọn: Postgres
6. Region: Washington, D.C. (iad1) - gần nhất
7. Click: Create
```

### 2. Vercel tự động add Environment Variables

Không cần làm gì, Vercel tự động add:
- `POSTGRES_URL`
- `POSTGRES_PRISMA_URL`
- `POSTGRES_URL_NON_POOLING`

### 3. Push Prisma Schema

**Option A: Từ Vercel Dashboard**

```sql
-- Vào: Storage → Postgres → Query
-- Copy paste SQL từ: prisma/migrations hoặc generate từ schema

-- Hoặc dùng Prisma Studio trên Vercel
```

**Option B: Từ Local (Khuyến nghị)**

```bash
# 1. Copy POSTGRES_PRISMA_URL từ Vercel
# Vercel Dashboard → Project → Settings → Environment Variables
# Copy value của POSTGRES_PRISMA_URL

# 2. Push schema
DATABASE_URL="postgresql://..." npx prisma db push

# 3. Verify
DATABASE_URL="postgresql://..." npx prisma studio
```

### 4. Redeploy

```bash
# Trigger redeploy
git commit --allow-empty -m "trigger redeploy after database setup"
git push origin main
```

### 5. Verify

```
1. Vào app: https://tool-shopify-olai.vercel.app
2. Không còn lỗi database
3. Check logs: Vercel Dashboard → Deployments → Logs
```

---

## 🚨 Lưu ý quan trọng

### **Environment Variables**

Vercel có 3 environments:
- **Production** - Branch `main`
- **Preview** - Pull requests
- **Development** - Local

Đảm bảo add `DATABASE_URL` cho đúng environment!

### **Connection Pooling**

Vercel Functions có giới hạn connections. Dùng:
- ✅ Pooled connection (Supabase/Neon)
- ✅ `POSTGRES_PRISMA_URL` (Vercel Postgres)
- ❌ Không dùng direct connection

### **Prisma Generate**

Đã có `postinstall` script trong `package.json`:
```json
{
  "scripts": {
    "postinstall": "prisma generate"
  }
}
```

Vercel sẽ tự động chạy khi deploy.

---

## 📝 Checklist

- [ ] Tạo database (Vercel Postgres/Supabase/Neon)
- [ ] Add `DATABASE_URL` vào Vercel Environment Variables
- [ ] Push Prisma schema: `npx prisma db push`
- [ ] Verify schema: `npx prisma studio`
- [ ] Redeploy Vercel
- [ ] Test app: Không còn lỗi database
- [ ] Check logs: Vercel Dashboard → Logs

---

## 🎉 Kết quả

Sau khi setup:
- ✅ App kết nối được database
- ✅ Không còn lỗi `Can't reach database server`
- ✅ Tất cả API routes hoạt động
- ✅ Ready for production!

---

## 💬 Support

**Nếu gặp vấn đề:**
1. Check Vercel logs: Dashboard → Deployments → Logs
2. Check database connection: Test với Prisma Studio
3. Verify environment variables: Settings → Environment Variables
4. Check Prisma schema: `npx prisma validate`

**Common issues:**
- ❌ Wrong DATABASE_URL format
- ❌ Database not accessible (firewall/IP whitelist)
- ❌ Prisma schema not pushed
- ❌ Environment variable not set for Production
