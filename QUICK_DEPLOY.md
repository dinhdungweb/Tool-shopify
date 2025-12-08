# Quick Deploy Guide - 10 Phút

## 1. Tạo Database (2 phút)

**Chọn 1 trong 3:**

### Neon (Khuyến nghị - Free tier tốt)
1. Vào https://neon.tech → Sign up
2. New Project → Region: Singapore
3. Copy **Connection string**

### Vercel Postgres (Dễ nhất)
1. Vào https://vercel.com/storage
2. Create Database → Postgres
3. Copy **POSTGRES_PRISMA_URL**

### Supabase (Nhiều tính năng)
1. Vào https://supabase.com → Sign up
2. New Project → Region: Singapore
3. Copy **Connection string** (thay password)

## 2. Run Migrations (1 phút)

```bash
# Set DATABASE_URL
$env:DATABASE_URL="your-connection-string-here"

# Run migrations
npx prisma migrate deploy

# Generate client
npx prisma generate
```

## 3. Deploy to Vercel (3 phút)

1. **Import Project**
   - Vào https://vercel.com/new
   - Import `dinhdungweb/Tool-shopify`

2. **Add Environment Variables**
   ```env
   DATABASE_URL=your-postgres-connection-string
   ENCRYPTION_KEY=run: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   NEXT_PUBLIC_APP_URL=https://your-app.vercel.app
   ```

3. **Deploy**
   - Click Deploy
   - Đợi 2-3 phút

## 4. Create Admin User (2 phút)

**Option 1: Qua UI (Dễ nhất)**
- Vào `https://your-app.vercel.app/signup`
- Đăng ký tài khoản

**Option 2: Qua Script**
```bash
# Tạo file create-admin.ts
cat > create-admin.ts << 'EOF'
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const password = await bcrypt.hash('admin123', 10);
  const user = await prisma.user.create({
    data: {
      email: 'admin@test.com',
      password,
      firstName: 'Admin',
      lastName: 'User',
    },
  });
  console.log('Created:', user.email);
}

main().finally(() => prisma.$disconnect());
EOF

# Run
$env:DATABASE_URL="your-connection-string"
npx tsx create-admin.ts
```

## 5. Configure APIs (2 phút)

1. Vào `https://your-app.vercel.app/settings`
2. Nhập Shopify credentials → Test → Save
3. Nhập Nhanh credentials → Test → Save

## Done! 🎉

App đã sẵn sàng tại: `https://your-app.vercel.app`

---

## Troubleshooting

**Build failed?**
```bash
# Test local
npm run build
```

**Database error?**
```bash
# Test connection
npx prisma db push
```

**Can't login?**
```bash
# Check user exists
npx prisma studio
```

## Next Steps

- [ ] Setup custom domain
- [ ] Configure SMTP for forgot password
- [ ] Setup webhooks
- [ ] Enable monitoring
- [ ] Backup database

---

**Chi tiết đầy đủ:** Xem `VERCEL_DEPLOYMENT_GUIDE.md`
