# Hướng Dẫn Deploy Lên Vercel - Chi Tiết

## Bước 1: Chuẩn Bị Database (PostgreSQL)

### Option A: Sử dụng Vercel Postgres (Khuyến nghị - Dễ nhất)

1. **Đăng nhập Vercel**
   - Truy cập: https://vercel.com
   - Đăng nhập bằng GitHub account

2. **Tạo Postgres Database**
   - Vào Dashboard → Storage → Create Database
   - Chọn **Postgres**
   - Chọn region gần bạn nhất (Singapore cho VN)
   - Đặt tên database: `shopify-sync-db`
   - Click **Create**

3. **Lấy Connection String**
   - Sau khi tạo xong, vào tab **Settings**
   - Copy **POSTGRES_PRISMA_URL** (dùng cho Prisma)
   - Lưu lại để dùng sau

### Option B: Sử dụng Neon (Free tier tốt hơn)

1. **Tạo tài khoản Neon**
   - Truy cập: https://neon.tech
   - Sign up với GitHub

2. **Tạo Project**
   - Click **New Project**
   - Chọn region: Singapore
   - Đặt tên: `shopify-sync`
   - Click **Create Project**

3. **Lấy Connection String**
   - Copy **Connection string** (Prisma format)
   - Format: `postgresql://user:password@host/database?sslmode=require`

### Option C: Sử dụng Supabase (Free + nhiều tính năng)

1. **Tạo tài khoản Supabase**
   - Truy cập: https://supabase.com
   - Sign up với GitHub

2. **Tạo Project**
   - Click **New Project**
   - Organization: Tạo mới hoặc chọn có sẵn
   - Name: `shopify-sync`
   - Database Password: Tạo password mạnh (lưu lại!)
   - Region: Southeast Asia (Singapore)
   - Click **Create new project**

3. **Lấy Connection String**
   - Vào **Settings** → **Database**
   - Scroll xuống **Connection string**
   - Chọn tab **URI** → Copy
   - Thay `[YOUR-PASSWORD]` bằng password bạn đã tạo

## Bước 2: Setup Database Schema

### 2.1. Cài đặt Prisma CLI (nếu chưa có)

```bash
npm install -g prisma
```

### 2.2. Tạo file .env.production

```bash
# Tạo file mới
echo DATABASE_URL="your-postgres-connection-string-here" > .env.production
```

Thay `your-postgres-connection-string-here` bằng connection string từ bước 1.

### 2.3. Run Migrations

```bash
# Set environment
$env:DATABASE_URL="your-connection-string"

# Run migrations
npx prisma migrate deploy

# Generate Prisma Client
npx prisma generate
```

### 2.4. Verify Database

```bash
# Mở Prisma Studio để xem database
npx prisma studio
```

Kiểm tra xem các tables đã được tạo chưa:
- users
- sessions
- password_resets
- nhanhCustomers
- shopifyCustomers
- customerMappings
- nhanhProducts
- shopifyProducts
- productMappings
- locationMappings
- ... và các tables khác

## Bước 3: Deploy Lên Vercel

### 3.1. Cài đặt Vercel CLI (Optional)

```bash
npm install -g vercel
```

### 3.2. Deploy qua Vercel Dashboard (Khuyến nghị)

1. **Import Project**
   - Vào https://vercel.com/new
   - Click **Import Git Repository**
   - Chọn repository: `dinhdungweb/Tool-shopify`
   - Click **Import**

2. **Configure Project**
   - **Framework Preset**: Next.js (tự động detect)
   - **Root Directory**: `./` (giữ nguyên)
   - **Build Command**: `npm run build` (mặc định)
   - **Output Directory**: `.next` (mặc định)

3. **Environment Variables**
   
   Click **Environment Variables** và thêm các biến sau:

   ```env
   # Database
   DATABASE_URL=your-postgres-connection-string
   
   # Encryption Key (tạo mới)
   ENCRYPTION_KEY=your-64-character-hex-key
   
   # App URL
   NEXT_PUBLIC_APP_URL=https://your-app.vercel.app
   
   # SMTP (Optional - cho forgot password)
   SMTP_HOST=smtp.gmail.com
   SMTP_PORT=587
   SMTP_SECURE=false
   SMTP_USER=your-email@gmail.com
   SMTP_PASS=your-app-password
   SMTP_FROM=Your App <noreply@yourapp.com>
   ```

   **Cách tạo ENCRYPTION_KEY:**
   ```bash
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```

4. **Deploy**
   - Click **Deploy**
   - Đợi 2-3 phút để build và deploy
   - Vercel sẽ tự động chạy `prisma generate` trong quá trình build

### 3.3. Deploy qua CLI (Alternative)

```bash
# Login
vercel login

# Deploy
vercel

# Thêm environment variables
vercel env add DATABASE_URL
vercel env add ENCRYPTION_KEY
vercel env add NEXT_PUBLIC_APP_URL

# Deploy production
vercel --prod
```

## Bước 4: Post-Deployment Setup

### 4.1. Tạo User Admin Đầu Tiên

**Option 1: Qua Prisma Studio**

```bash
# Connect to production database
$env:DATABASE_URL="your-production-connection-string"
npx prisma studio
```

Vào table `users` → Add record:
- email: `admin@yourapp.com`
- password: Hash của password (dùng bcrypt)
- firstName: `Admin`
- lastName: `User`

**Option 2: Qua Script**

Tạo file `create-admin.ts`:

```typescript
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL
    }
  }
});

async function createAdmin() {
  const hashedPassword = await bcrypt.hash('admin123', 10);
  
  const user = await prisma.user.create({
    data: {
      email: 'admin@yourapp.com',
      password: hashedPassword,
      firstName: 'Admin',
      lastName: 'User',
    },
  });

  console.log('Admin user created:', user.email);
}

createAdmin()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
```

Chạy:
```bash
$env:DATABASE_URL="your-production-connection-string"
npx tsx create-admin.ts
```

**Option 3: Đăng ký qua UI**

- Truy cập: `https://your-app.vercel.app/signup`
- Đăng ký tài khoản đầu tiên

### 4.2. Configure API Credentials

1. **Truy cập Settings**
   - Vào: `https://your-app.vercel.app/settings`
   - Đăng nhập với admin account

2. **Nhập Shopify Credentials**
   - Store URL: `your-store.myshopify.com`
   - Access Token: `shpat_xxxxx`
   - Click **Test Connection**
   - Click **Save**

3. **Nhập Nhanh.vn Credentials**
   - Store ID: `12345`
   - API Key: `xxxxx`
   - Secret Key: `xxxxx`
   - Click **Test Connection**
   - Click **Save**

### 4.3. Setup Webhooks (Optional)

Nếu muốn real-time sync, setup webhooks:

**Shopify Webhooks:**
- URL: `https://your-app.vercel.app/api/webhooks/shopify/inventory`
- Topics: `inventory_levels/update`

**Nhanh.vn Webhooks:**
- URL: `https://your-app.vercel.app/api/webhooks/nhanh/inventory`
- Events: Inventory updates

## Bước 5: Verify Deployment

### 5.1. Health Checks

```bash
# Test database connection
curl https://your-app.vercel.app/api/test-db

# Test Shopify connection
curl https://your-app.vercel.app/api/settings/test-shopify

# Test Nhanh connection
curl https://your-app.vercel.app/api/settings/test-nhanh
```

### 5.2. Test Authentication

1. Truy cập: `https://your-app.vercel.app/signin`
2. Đăng nhập với admin account
3. Kiểm tra dashboard load được không

### 5.3. Test Sync

1. Vào **Products Sync**
2. Click **Pull from Nhanh**
3. Kiểm tra products được pull về
4. Map 1 product với Shopify
5. Click **Sync** để test

## Bước 6: Monitoring & Maintenance

### 6.1. View Logs

```bash
# Vercel CLI
vercel logs

# Hoặc qua Dashboard
# https://vercel.com/your-project/deployments → Click deployment → Logs
```

### 6.2. Database Monitoring

**Vercel Postgres:**
- Dashboard → Storage → Your Database → Insights

**Neon:**
- Dashboard → Monitoring

**Supabase:**
- Dashboard → Database → Logs

### 6.3. Setup Alerts (Optional)

**Vercel:**
- Project Settings → Integrations → Add monitoring service

**Recommended:**
- Sentry (Error tracking)
- LogRocket (Session replay)
- Better Stack (Uptime monitoring)

## Troubleshooting

### Lỗi: "Prisma Client not found"

**Fix:**
```bash
# Thêm vào package.json
"scripts": {
  "postinstall": "prisma generate"
}
```

Redeploy:
```bash
vercel --prod
```

### Lỗi: "Database connection failed"

**Check:**
1. DATABASE_URL đúng format chưa
2. Database có allow connections từ Vercel không
3. SSL mode: Thêm `?sslmode=require` vào connection string

### Lỗi: "Environment variables not found"

**Fix:**
1. Vào Vercel Dashboard → Project → Settings → Environment Variables
2. Kiểm tra tất cả variables đã được add chưa
3. Redeploy để apply changes

### Lỗi: "Build failed"

**Check:**
1. `npm run build` chạy được local không
2. Xem build logs trên Vercel
3. Kiểm tra dependencies trong package.json

### Lỗi: "Function timeout"

**Fix:**
- Vercel free tier: 10s timeout
- Upgrade to Pro: 60s timeout
- Hoặc optimize code để chạy nhanh hơn

## Best Practices

### 1. Security

- ✅ Không commit `.env` vào git
- ✅ Dùng strong passwords
- ✅ Enable 2FA cho Vercel account
- ✅ Rotate API keys định kỳ
- ✅ Limit database access by IP (nếu có thể)

### 2. Performance

- ✅ Enable caching cho static assets
- ✅ Optimize images với Next.js Image
- ✅ Use database indexes
- ✅ Implement pagination
- ✅ Use connection pooling

### 3. Backup

- ✅ Enable automatic backups (Neon/Supabase có sẵn)
- ✅ Export database định kỳ
- ✅ Backup environment variables

### 4. Monitoring

- ✅ Setup error tracking (Sentry)
- ✅ Monitor database performance
- ✅ Track API usage
- ✅ Setup uptime monitoring

## Cost Estimation

### Free Tier (Đủ cho testing)

**Vercel:**
- Bandwidth: 100GB/month
- Builds: 6,000 minutes/month
- Serverless Functions: 100GB-hours

**Neon (Recommended):**
- Storage: 3GB
- Compute: 191.9 hours/month
- Projects: 1

**Supabase:**
- Database: 500MB
- Bandwidth: 5GB
- API requests: 50,000/month

### Paid Plans (Cho production)

**Vercel Pro ($20/month):**
- Unlimited bandwidth
- 100 team members
- Advanced analytics

**Neon Pro ($19/month):**
- 10GB storage
- Unlimited compute hours
- Point-in-time restore

**Supabase Pro ($25/month):**
- 8GB database
- 250GB bandwidth
- Daily backups

## Next Steps

1. ✅ Deploy thành công
2. ✅ Tạo admin user
3. ✅ Configure API credentials
4. ✅ Test sync functionality
5. ⏭️ Setup custom domain (optional)
6. ⏭️ Enable monitoring
7. ⏭️ Setup backups
8. ⏭️ Invite team members

## Support

Nếu gặp vấn đề:
1. Check Vercel logs
2. Check database logs
3. Test local với production DATABASE_URL
4. Google error message
5. Ask on Vercel Discord/Forum

---

**Chúc bạn deploy thành công! 🚀**
