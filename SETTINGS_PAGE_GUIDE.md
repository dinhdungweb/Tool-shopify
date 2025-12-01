# Settings Page - API Configuration Guide

## 📋 Overview

Trang Settings cho phép xem và test API connections cho Nhanh.vn và Shopify.

## 🎯 Features

### 1. View API Credentials
- ✅ Hiển thị thông tin API (masked for security)
- ✅ Show/Hide sensitive tokens
- ✅ Copy to clipboard
- ✅ Organized by service (Nhanh, Shopify, Database)

### 2. Test Connections
- ✅ Test Nhanh.vn API connection
- ✅ Test Shopify API connection
- ✅ Real-time feedback
- ✅ Error details if connection fails

### 3. Setup Instructions
- ✅ Step-by-step guide
- ✅ Code examples
- ✅ Security best practices

## 📁 Files Created

### Pages
- `src/app/(admin)/settings/page.tsx` - Settings page UI

### API Routes
- `src/app/api/settings/route.ts` - Get settings (masked)
- `src/app/api/settings/test-nhanh/route.ts` - Test Nhanh connection
- `src/app/api/settings/test-shopify/route.ts` - Test Shopify connection

### Updates
- `src/layout/AppSidebar.tsx` - Added Settings menu item
- `src/lib/shopify-api.ts` - Added `getShopInfo()` method

## 🔧 API Credentials Managed

### Nhanh.vn
- `NHANH_API_URL` - API endpoint
- `NHANH_APP_ID` - Application ID
- `NHANH_BUSINESS_ID` - Business ID
- `NHANH_ACCESS_TOKEN` - Access token (masked)

### Shopify
- `SHOPIFY_STORE_URL` - Store domain
- `SHOPIFY_ACCESS_TOKEN` - Access token (masked)
- `SHOPIFY_API_VERSION` - API version

### Database
- `DATABASE_URL` - PostgreSQL connection string (masked)

## 🔒 Security Features

### Token Masking
```typescript
const maskToken = (token: string) => {
  if (!token) return "";
  if (token.length <= 8) return "•".repeat(token.length);
  return token.substring(0, 4) + "•".repeat(token.length - 8) + token.substring(token.length - 4);
};

// Example:
// "shpat_xxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
// → "shpa••••••••••••••••••••••••••••••xxxx"
```

### Show/Hide Toggle
- Tokens are hidden by default
- Click eye icon to reveal
- Click again to hide

### Copy Protection
- Only masked values shown in UI
- Full values available for copy
- Clipboard access only on user action

## 🧪 Testing Connections

### Test Nhanh.vn
```typescript
// Endpoint: GET /api/settings/test-nhanh
// Tests by fetching 1 customer
const response = await nhanhAPI.getCustomers({ limit: 1 });
```

**Success Response**:
```json
{
  "success": true,
  "message": "Nhanh.vn connection successful",
  "data": {
    "connected": true,
    "apiUrl": "https://pos.open.nhanh.vn",
    "businessId": "21783"
  }
}
```

**Error Response**:
```json
{
  "success": false,
  "error": "Failed to connect to Nhanh.vn",
  "details": {
    "apiUrl": "https://pos.open.nhanh.vn",
    "hasAppId": true,
    "hasBusinessId": true,
    "hasAccessToken": true
  }
}
```

### Test Shopify
```typescript
// Endpoint: GET /api/settings/test-shopify
// Tests by fetching shop info
const shop = await shopifyAPI.getShopInfo();
```

**Success Response**:
```json
{
  "success": true,
  "message": "Shopify connection successful",
  "data": {
    "connected": true,
    "shopName": "Helios Jewels",
    "shopDomain": "heliosjewels-vn.myshopify.com",
    "email": "contact@heliosjewels.com"
  }
}
```

## 📖 Setup Instructions (In UI)

### 1. Create .env file
```bash
cp .env.local.example .env
```

### 2. Update credentials
Edit `.env` file with your actual credentials:
```env
# Nhanh.vn
NHANH_API_URL=https://pos.open.nhanh.vn
NHANH_APP_ID=your_app_id
NHANH_BUSINESS_ID=your_business_id
NHANH_ACCESS_TOKEN=your_access_token

# Shopify
SHOPIFY_STORE_URL=your-store.myshopify.com
SHOPIFY_ACCESS_TOKEN=shpat_xxxxx
SHOPIFY_API_VERSION=2024-01

# Database
DATABASE_URL=postgresql://user:password@localhost:5432/dbname
```

### 3. Restart server
```bash
npm run dev
```

### 4. Test connections
- Go to Settings page
- Click "Test Connection" buttons
- Verify success messages

## 🎨 UI Components

### SettingField Component
```typescript
<SettingField
  label="Access Token"
  value={settings.nhanh.accessToken}
  masked={true}
  onCopy={() => copyToClipboard(settings.nhanh.accessToken)}
/>
```

**Features**:
- Label display
- Value display (masked or plain)
- Show/Hide toggle (for masked fields)
- Copy to clipboard button
- Responsive layout

### Test Connection Button
```typescript
<button
  onClick={testNhanhConnection}
  disabled={testingNhanh}
  className="..."
>
  {testingNhanh ? (
    <>
      <Spinner />
      Testing...
    </>
  ) : (
    <>
      <CheckIcon />
      Test Connection
    </>
  )}
</button>
```

## 🚀 Usage

### Access Settings Page
1. Click "Settings" in sidebar
2. Or navigate to `/settings`

### View Credentials
- All credentials are displayed (masked)
- Click eye icon to reveal
- Click copy icon to copy

### Test Connections
1. Click "Test Connection" button
2. Wait for response
3. See success/error toast notification

### Update Credentials
1. Edit `.env` file
2. Restart server
3. Test connections to verify

## 🔍 Troubleshooting

### Connection Test Fails

**Nhanh.vn**:
- Check `NHANH_API_URL` is correct
- Verify `NHANH_APP_ID` and `NHANH_BUSINESS_ID`
- Ensure `NHANH_ACCESS_TOKEN` is valid
- Check network connectivity

**Shopify**:
- Check `SHOPIFY_STORE_URL` format (no https://)
- Verify `SHOPIFY_ACCESS_TOKEN` is valid
- Ensure API version is supported
- Check store is accessible

### Credentials Not Showing
- Ensure `.env` file exists
- Check environment variables are loaded
- Restart development server
- Verify no typos in variable names

### Copy Not Working
- Check browser clipboard permissions
- Try different browser
- Ensure HTTPS (for production)

## 📊 Benefits

### For Developers
- ✅ Easy credential management
- ✅ Quick connection testing
- ✅ Clear error messages
- ✅ No need to check .env file manually

### For Users
- ✅ Visual confirmation of settings
- ✅ Test connections without code
- ✅ Copy credentials easily
- ✅ Clear setup instructions

### For Security
- ✅ Tokens are masked by default
- ✅ No credentials in database
- ✅ Environment variables only
- ✅ Secure by design

## 🎯 Best Practices

### Security
1. Never commit `.env` file to git
2. Use `.env.local` for local development
3. Use environment variables in production
4. Rotate tokens regularly

### Configuration
1. Keep `.env.local.example` updated
2. Document all required variables
3. Provide example values
4. Include comments for clarity

### Testing
1. Test connections after setup
2. Test after credential changes
3. Monitor for API errors
4. Keep credentials up to date

## ✨ Future Enhancements

Potential improvements:
- [ ] Edit credentials in UI (with server restart)
- [ ] Multiple environment profiles
- [ ] Credential validation
- [ ] Connection health monitoring
- [ ] API usage statistics
- [ ] Webhook configuration
- [ ] Rate limit monitoring

## 📝 Notes

- Credentials are read from environment variables
- Changes require server restart
- Test connections verify API access
- All sensitive data is masked in UI
- Copy function provides full values
- Setup instructions included in page

## ✅ Conclusion

Settings page provides a secure, user-friendly way to:
- View API credentials
- Test connections
- Manage configuration
- Follow setup instructions

All while maintaining security best practices! 🔒
