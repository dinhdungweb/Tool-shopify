# Environment Variables Cleanup Guide

## Overview

API credentials are now stored **encrypted in the database** instead of plain text in `.env` files. This provides better security and allows runtime configuration via the Settings page.

## What Changed

### Before
```env
# .env file contained plain text credentials
SHOPIFY_STORE_URL=your-store.myshopify.com
SHOPIFY_ACCESS_TOKEN=shpat_xxxxx
NHANH_API_URL=https://pos.open.nhanh.vn
NHANH_APP_ID=12345
NHANH_BUSINESS_ID=67890
NHANH_ACCESS_TOKEN=xxxxx
```

### After
```env
# .env file only contains infrastructure config
DATABASE_URL="postgresql://..."
ENCRYPTION_KEY=your_encryption_key
```

API credentials are configured via **Settings page** at `/settings` and stored encrypted in the database.

## Migration Steps

### 1. Automatic Migration (Recommended)

If you have existing credentials in `.env`:

```bash
# Start the development server
npm run dev

# In another terminal, run migration script
node migrate-env-to-db.js
```

The script will:
- Read credentials from environment variables
- Save them encrypted to database
- Confirm successful migration

### 2. Manual Configuration

If starting fresh or migration fails:

1. Start the app: `npm run dev`
2. Navigate to Settings page: `http://localhost:3000/settings`
3. Enter your API credentials
4. Click "Test Connection" for each API
5. Click "Save Settings"

## Clean Up .env File

After migration, your `.env` should only contain:

```env
# Database URL for Prisma
DATABASE_URL="postgresql://username:password@localhost:5432/database_name?schema=public"

# Encryption key for storing sensitive data in database
ENCRYPTION_KEY=your_64_character_hex_encryption_key

# NOTE: API credentials are now stored encrypted in the database
# Configure them via the Settings page at /settings
```

## Security Benefits

✅ **Encrypted Storage**: Credentials encrypted with AES-256-GCM  
✅ **No Git Exposure**: Credentials never committed to repository  
✅ **Runtime Updates**: Change credentials without redeploying  
✅ **Audit Trail**: Track when settings are updated  
✅ **Masked Display**: Tokens hidden in UI by default  

## Environment Variables Reference

### Required
- `DATABASE_URL` - PostgreSQL connection string
- `ENCRYPTION_KEY` - 64-character hex key for AES-256-GCM encryption

### Generate Encryption Key
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### Optional (Legacy - Not Recommended)
These are still supported as fallback but should be migrated to database:
- `SHOPIFY_STORE_URL`
- `SHOPIFY_ACCESS_TOKEN`
- `NHANH_API_URL`
- `NHANH_APP_ID`
- `NHANH_BUSINESS_ID`
- `NHANH_ACCESS_TOKEN`

## Deployment

### Development
1. Copy `.env.local.example` to `.env.local`
2. Set `DATABASE_URL` and `ENCRYPTION_KEY`
3. Configure API credentials via Settings page

### Production (Vercel)
1. Set environment variables in Vercel dashboard:
   - `DATABASE_URL`
   - `ENCRYPTION_KEY`
2. Deploy application
3. Configure API credentials via Settings page at `your-domain.com/settings`

## Troubleshooting

### "No encryption key found"
- Ensure `ENCRYPTION_KEY` is set in `.env` or environment variables
- Generate a new key: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`

### "Settings not found"
- Configure credentials via Settings page
- Or run migration script if you have credentials in `.env`

### "Invalid credentials"
- Use "Test Connection" buttons in Settings page
- Verify credentials are correct
- Check API documentation for format

## Related Documentation

- [Settings Page Guide](./SETTINGS_PAGE_GUIDE.md)
- [Encrypted Settings Implementation](./ENCRYPTED_SETTINGS_IMPLEMENTATION.md)
- [System Logs](./SYSTEM_LOGS_UI_UPDATE.md)
