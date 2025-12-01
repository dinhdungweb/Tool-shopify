# Encrypted Settings System

## Overview

The application now supports storing API credentials in the database with encryption, allowing you to update credentials through the UI without needing to edit `.env` files or restart the server.

## How It Works

### 1. **Encryption Layer**
- All sensitive credentials are encrypted using AES-256-GCM before being stored in the database
- The encryption key is stored in `.env` file as `ENCRYPTION_KEY`
- Each encrypted value includes: salt, IV (initialization vector), auth tag, and encrypted data

### 2. **Settings Storage**
- Credentials are stored in the `settings` table in PostgreSQL
- Each setting has a unique key (e.g., `SHOPIFY_ACCESS_TOKEN`)
- Values are encrypted before storage and decrypted when retrieved

### 3. **Fallback Mechanism**
- If a setting is not found in the database, the system falls back to environment variables
- This ensures backward compatibility with existing `.env` configurations

### 4. **Caching**
- API configurations are cached for 1 minute to improve performance
- Cache is automatically cleared when settings are updated

## Setup

### 1. Generate Encryption Key

Generate a secure random encryption key:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 2. Add to .env File

Add the generated key to your `.env` file:

```env
ENCRYPTION_KEY=your_generated_key_here
```

⚠️ **IMPORTANT**: Keep this key secure! If you lose it, you won't be able to decrypt stored credentials.

### 3. Run Database Migration

The `settings` table should already be created. If not, run:

```bash
npx prisma migrate dev
```

## Usage

### Update Settings via UI

1. Navigate to **Settings** page (`/settings`)
2. Click **Edit Settings** button
3. Update the credentials you want to change
4. Click **Save Changes**

The new credentials will be:
- Encrypted using AES-256-GCM
- Stored in the database
- Immediately available (cache is cleared)
- Used for all subsequent API calls

### Update Settings via Code

```typescript
import { setSetting } from "@/lib/settings";

// Update a single setting
await setSetting("SHOPIFY_ACCESS_TOKEN", "new_token_here");

// Update multiple settings
import { updateApiCredentials } from "@/lib/settings";

await updateApiCredentials({
  shopify: {
    storeUrl: "your-store.myshopify.com",
    accessToken: "new_token",
  },
  nhanh: {
    apiUrl: "https://pos.open.nhanh.vn",
    storeId: "12345",
    apiKey: "new_key",
  },
});
```

### Get Settings in Code

```typescript
import { getSetting, getApiCredentials } from "@/lib/settings";

// Get a single setting
const shopifyToken = await getSetting("SHOPIFY_ACCESS_TOKEN");

// Get all API credentials
const credentials = await getApiCredentials();
console.log(credentials.shopify.storeUrl);
console.log(credentials.nhanh.apiKey);
```

## Security Features

### ✅ What's Protected

1. **Encryption at Rest**: All credentials are encrypted in the database
2. **Strong Encryption**: Uses AES-256-GCM with PBKDF2 key derivation
3. **Unique Salts**: Each encrypted value has a unique salt
4. **Authentication Tags**: Ensures data integrity and authenticity
5. **Secure Key Storage**: Encryption key is stored in `.env` (not in database)

### ⚠️ Security Best Practices

1. **Never commit `.env` file** to version control
2. **Use different encryption keys** for different environments (dev, staging, production)
3. **Rotate encryption keys periodically** (requires re-encrypting all settings)
4. **Limit database access** to authorized personnel only
5. **Use HTTPS** in production to protect data in transit
6. **Enable database encryption** at rest if available (e.g., AWS RDS encryption)

## Migration from .env to Database

If you're currently using `.env` file and want to migrate to database storage:

1. Go to Settings page
2. Click "Edit Settings"
3. Enter your current credentials (they will be saved to database)
4. Test the connections
5. (Optional) Remove credentials from `.env` file

The system will automatically use database credentials once they're saved.

## Troubleshooting

### Settings not working after update

1. Check if `ENCRYPTION_KEY` is set in `.env`
2. Verify database connection
3. Check browser console for errors
4. Try clearing cache: restart the server

### Cannot decrypt settings

This usually means:
- Encryption key has changed
- Database was restored from a backup with different encryption key
- Data corruption

**Solution**: Re-enter credentials through the Settings UI

### Performance issues

The system caches API config for 1 minute. If you need to clear cache manually:

```typescript
import { clearApiConfigCache } from "@/lib/api-config";
clearApiConfigCache();
```

## Database Schema

```sql
CREATE TABLE "settings" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "key" TEXT NOT NULL UNIQUE,
  "value" TEXT NOT NULL,  -- Encrypted value
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL
);

CREATE INDEX "settings_key_idx" ON "settings"("key");
```

## Supported Settings

Currently, the following settings can be stored in the database:

### Shopify
- `SHOPIFY_STORE_URL`
- `SHOPIFY_ACCESS_TOKEN`

### Nhanh.vn
- `NHANH_API_URL`
- `NHANH_APP_ID`
- `NHANH_BUSINESS_ID`
- `NHANH_ACCESS_TOKEN`

## API Endpoints

### GET /api/settings
Get current settings (credentials are masked)

**Response:**
```json
{
  "success": true,
  "data": {
    "shopify": {
      "storeUrl": "your-store.myshopify.com",
      "accessToken": "shpa•••••••••1234"
    },
    "nhanh": {
      "apiUrl": "https://pos.open.nhanh.vn",
      "appId": "76522",
      "businessId": "21783",
      "accessToken": "EO6L•••••••••Yps"
    },
    "source": "database"
  }
}
```

### POST /api/settings
Update settings

**Request:**
```json
{
  "shopify": {
    "storeUrl": "your-store.myshopify.com",
    "accessToken": "new_token"
  },
  "nhanh": {
    "apiUrl": "https://pos.open.nhanh.vn",
    "appId": "76522",
    "businessId": "21783",
    "accessToken": "new_token"
  }
}
```

**Response:**
```json
{
  "success": true,
  "message": "Settings updated successfully"
}
```

## Files Structure

```
src/
├── lib/
│   ├── encryption.ts          # Encryption/decryption utilities
│   ├── settings.ts            # Settings management (get/set)
│   └── api-config.ts          # API config with caching
├── app/
│   ├── api/
│   │   └── settings/
│   │       ├── route.ts       # GET/POST settings
│   │       ├── test-nhanh/
│   │       │   └── route.ts   # Test Nhanh connection
│   │       └── test-shopify/
│   │           └── route.ts   # Test Shopify connection
│   └── (admin)/
│       └── settings/
│           └── page.tsx       # Settings UI
└── prisma/
    └── schema.prisma          # Database schema
```

## Benefits

✅ **No Server Restart Required**: Update credentials without restarting
✅ **Secure Storage**: Encrypted at rest in database
✅ **Easy Management**: Update through UI instead of editing files
✅ **Backward Compatible**: Falls back to `.env` if not in database
✅ **Performance**: Caching reduces database queries
✅ **Audit Trail**: Track when settings were updated
✅ **Multi-Environment**: Different credentials per environment

## Limitations

⚠️ **Encryption Key**: Must be stored in `.env` (can't be in database)
⚠️ **Key Rotation**: Requires re-encrypting all settings
⚠️ **Cache Delay**: Up to 1 minute for changes to propagate
⚠️ **Database Dependency**: Requires database connection to get settings

## Future Enhancements

- [ ] Encryption key rotation tool
- [ ] Settings history/audit log
- [ ] Role-based access control for settings
- [ ] Settings backup/restore
- [ ] Environment-specific settings
- [ ] Settings validation before save
- [ ] Webhook notifications on settings change
