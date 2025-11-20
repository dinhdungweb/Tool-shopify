# Deploy lên Vercel - Quick Guide

## Tại sao cần deploy?
- Ngrok free plan có browser warning → Webhook bị lỗi 400
- URL thay đổi mỗi khi restart
- Không stable cho production

## Deploy lên Vercel (Free, 5 phút)

### Bước 1: Install Vercel CLI
```powershell
npm install -g vercel
```

### Bước 2: Login
```powershell
vercel login
```

### Bước 3: Deploy
```powershell
cd customers-sync
vercel
```

Trả lời các câu hỏi:
- Set up and deploy? **Y**
- Which scope? **Your account**
- Link to existing project? **N**
- Project name? **customers-sync** (hoặc tên khác)
- Directory? **./** (Enter)
- Override settings? **N**

### Bước 4: Setup Environment Variables
```powershell
# Add env variables
vercel env add DATABASE_URL
vercel env add NHANH_APP_ID
vercel env add NHANH_BUSINESS_ID
vercel env add NHANH_ACCESS_TOKEN
vercel env add SHOPIFY_STORE_URL
vercel env add SHOPIFY_ACCESS_TOKEN
vercel env add SHOPIFY_API_VERSION
vercel env add NEXT_PUBLIC_APP_URL
```

Paste giá trị từ file `.env.local` của bạn

### Bước 5: Deploy lại với env vars
```powershell
vercel --prod
```

### Bước 6: Get Production URL
Output sẽ cho bạn URL, ví dụ:
```
https://customers-sync-abc123.vercel.app
```

### Bước 7: Update Webhook trên Nhanh.vn
```
https://customers-sync-abc123.vercel.app/api/sync/webhook
```

## Lợi ích Vercel
- ✅ Free tier generous
- ✅ URL cố định
- ✅ HTTPS tự động
- ✅ Global CDN
- ✅ Auto deploy khi push git
- ✅ Không có browser warning
- ✅ Serverless functions cho API routes

## Alternative: Railway.app

Nếu không thích Vercel, có thể dùng Railway:

```powershell
# Install Railway CLI
npm install -g @railway/cli

# Login
railway login

# Init project
railway init

# Add env vars
railway variables set DATABASE_URL=...

# Deploy
railway up
```

## Alternative: Render.com

Hoặc Render.com (cũng free):

1. Truy cập https://render.com
2. Connect GitHub repo
3. Create Web Service
4. Add environment variables
5. Deploy

## Sau khi deploy

### Test webhook
```bash
curl -X POST https://your-app.vercel.app/api/sync/webhook \
  -H "Content-Type: application/json" \
  -d '{"event":"customer.updated","data":{"customerId":7}}'
```

### Update trên Nhanh.vn
1. Vào Nhanh.vn Admin → Webhook
2. Update URL: `https://your-app.vercel.app/api/sync/webhook`
3. Test webhook
4. ✅ Done!

## Troubleshooting

### Database connection error
Vercel serverless functions cần connection pooling. Update DATABASE_URL:
```
postgresql://user:pass@host:5432/db?pgbouncer=true&connection_limit=1
```

### Build error
Check build logs:
```powershell
vercel logs
```

### Environment variables not working
Verify env vars:
```powershell
vercel env ls
```

## Cost
- Vercel Free: 100GB bandwidth/month, unlimited requests
- Railway Free: $5 credit/month
- Render Free: 750 hours/month

Tất cả đều đủ cho webhook use case!
