# Customer Sync Setup Guide

## Prerequisites

- Node.js 18+ installed
- PostgreSQL database
- Nhanh.vn API credentials
- Shopify Admin API access token

## Step 1: Install Dependencies

```bash
npm install
```

## Step 2: Configure Environment Variables

Copy `.env.local.example` to `.env.local` and fill in your credentials:

```bash
cp .env.local.example .env.local
```

Edit `.env.local`:

```env
# Nhanh.vn API Configuration
NHANH_API_URL=https://open.nhanh.vn
NHANH_API_KEY=your_nhanh_api_key_here
NHANH_STORE_ID=your_store_id_here

# Shopify API Configuration
SHOPIFY_STORE_URL=your-store.myshopify.com
SHOPIFY_ACCESS_TOKEN=shpat_xxxxxxxxxxxxx
SHOPIFY_API_VERSION=2024-01

# Database Configuration
DATABASE_URL=postgresql://user:password@localhost:5432/customers_sync

# App Configuration
NEXT_PUBLIC_APP_URL=http://localhost:3000
WEBHOOK_SECRET=your_random_secret_here
```

## Step 3: Setup PostgreSQL Database

### Option A: Local PostgreSQL

1. Install PostgreSQL if not already installed
2. Create database:

```bash
createdb customers_sync
```

3. Update `DATABASE_URL` in `.env.local`

### Option B: Cloud PostgreSQL (Recommended for Production)

Use services like:
- [Supabase](https://supabase.com) (Free tier available)
- [Neon](https://neon.tech) (Free tier available)
- [Railway](https://railway.app)
- [Vercel Postgres](https://vercel.com/storage/postgres)

## Step 4: Initialize Database

Run Prisma migrations:

```bash
# Generate Prisma Client
npm run db:generate

# Push schema to database
npm run db:push

# Or run migrations (for production)
npm run db:migrate
```

## Step 5: Verify Setup

Check if Prisma Studio works:

```bash
npm run db:studio
```

This will open Prisma Studio at http://localhost:5555

## Step 6: Get API Credentials

### Nhanh.vn API

1. Login to Nhanh.vn
2. Go to Settings > API
3. Generate API Key
4. Copy Store ID and API Key

### Shopify Admin API

1. Login to Shopify Admin
2. Go to Apps > Develop apps
3. Create a new app
4. Configure Admin API scopes:
   - `read_customers`
   - `write_customers`
   - `read_orders`
5. Install app and copy Access Token

Required Shopify API Scopes:
- `read_customers` - Read customer data
- `write_customers` - Update customer metafields
- `read_orders` - Read order data (for total spent)

## Step 7: Run Development Server

```bash
npm run dev
```

Visit http://localhost:3000

## Troubleshooting

### Database Connection Issues

If you get connection errors:

1. Check PostgreSQL is running:
```bash
# macOS/Linux
pg_isready

# Windows
pg_ctl status
```

2. Verify DATABASE_URL format:
```
postgresql://username:password@host:port/database
```

3. Test connection:
```bash
npx prisma db pull
```

### API Connection Issues

Test API connections:

```bash
# Test Nhanh.vn API
curl -X POST https://open.nhanh.vn/api/customer/search \
  -H "Content-Type: application/json" \
  -d '{"storeId":"YOUR_STORE_ID","checksum":"..."}'

# Test Shopify API
curl -X POST https://your-store.myshopify.com/admin/api/2024-01/graphql.json \
  -H "X-Shopify-Access-Token: YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"query":"{ shop { name } }"}'
```

## Next Steps

After setup is complete:

1. Navigate to `/customers-sync` page
2. Load customers from Nhanh.vn
3. Map customers to Shopify
4. Sync customer data
5. Setup webhooks for auto-sync

## Database Schema

The system uses 3 main tables:

1. **customer_mappings** - Stores mapping between Nhanh and Shopify customers
2. **sync_logs** - Tracks all sync operations
3. **webhook_logs** - Logs webhook events

View schema in `prisma/schema.prisma`

## Useful Commands

```bash
# Generate Prisma Client
npm run db:generate

# Push schema changes
npm run db:push

# Create migration
npm run db:migrate

# Open Prisma Studio
npm run db:studio

# Reset database (WARNING: deletes all data)
npx prisma migrate reset
```
