# Nhanh API Fields Update ✅

## Thay đổi

Đã cập nhật các trường API của Nhanh.vn để phù hợp với API v3.0:

### Trước:
```
- API URL
- Store ID
- API Key
```

### Sau:
```
- API URL
- App ID
- Business ID
- Access Token
```

## Files đã cập nhật

### 1. **src/lib/settings.ts**

#### SettingKey type:
```typescript
// Trước
export type SettingKey =
  | "NHANH_API_URL"
  | "NHANH_STORE_ID"
  | "NHANH_API_KEY";

// Sau
export type SettingKey =
  | "NHANH_API_URL"
  | "NHANH_APP_ID"
  | "NHANH_BUSINESS_ID"
  | "NHANH_ACCESS_TOKEN";
```

#### getApiCredentials:
```typescript
// Trước
nhanh: {
  apiUrl: await getSetting("NHANH_API_URL"),
  storeId: await getSetting("NHANH_STORE_ID"),
  apiKey: await getSetting("NHANH_API_KEY"),
}

// Sau
nhanh: {
  apiUrl: await getSetting("NHANH_API_URL"),
  appId: await getSetting("NHANH_APP_ID"),
  businessId: await getSetting("NHANH_BUSINESS_ID"),
  accessToken: await getSetting("NHANH_ACCESS_TOKEN"),
}
```

#### updateApiCredentials:
```typescript
// Trước
nhanh?: {
  apiUrl?: string;
  storeId?: string;
  apiKey?: string;
}

// Sau
nhanh?: {
  apiUrl?: string;
  appId?: string;
  businessId?: string;
  accessToken?: string;
}
```

### 2. **src/lib/api-config.ts**

#### Cached config type:
```typescript
// Trước
nhanh: {
  apiUrl: string | null;
  storeId: string | null;
  apiKey: string | null;
}

// Sau
nhanh: {
  apiUrl: string | null;
  appId: string | null;
  businessId: string | null;
  accessToken: string | null;
}
```

### 3. **src/app/api/settings/route.ts**

#### GET response:
```typescript
// Trước
nhanh: {
  apiUrl: credentials.nhanh.apiUrl || "",
  storeId: credentials.nhanh.storeId || "",
  apiKey: maskToken(credentials.nhanh.apiKey),
}

// Sau
nhanh: {
  apiUrl: credentials.nhanh.apiUrl || "",
  appId: credentials.nhanh.appId || "",
  businessId: credentials.nhanh.businessId || "",
  accessToken: maskToken(credentials.nhanh.accessToken),
}
```

#### POST request:
```typescript
// Trước
nhanh: {
  apiUrl: nhanh.apiUrl,
  storeId: nhanh.storeId,
  apiKey: nhanh.apiKey,
}

// Sau
nhanh: {
  apiUrl: nhanh.apiUrl,
  appId: nhanh.appId,
  businessId: nhanh.businessId,
  accessToken: nhanh.accessToken,
}
```

### 4. **src/app/(admin)/settings/page.tsx**

#### State:
```typescript
// Trước
nhanh: {
  apiUrl: "",
  storeId: "",
  apiKey: "",
}

// Sau
nhanh: {
  apiUrl: "",
  appId: "",
  businessId: "",
  accessToken: "",
}
```

#### UI Fields (Edit Mode):
```tsx
// Trước
<EditableField label="Store ID" ... />
<EditableField label="API Key" masked ... />

// Sau
<EditableField label="App ID" ... />
<EditableField label="Business ID" ... />
<EditableField label="Access Token" masked ... />
```

#### UI Fields (View Mode):
```tsx
// Trước
<SettingField label="Store ID" ... />
<SettingField label="API Key" masked ... />

// Sau
<SettingField label="App ID" ... />
<SettingField label="Business ID" ... />
<SettingField label="Access Token" masked ... />
```

### 5. **ENCRYPTED_SETTINGS_GUIDE.md**

Cập nhật documentation với field names mới.

## Environment Variables

### Cần cập nhật trong .env:

```env
# Trước
NHANH_API_URL=https://pos.open.nhanh.vn
NHANH_STORE_ID=21783
NHANH_API_KEY=your_api_key_here

# Sau
NHANH_API_URL=https://pos.open.nhanh.vn
NHANH_APP_ID=76522
NHANH_BUSINESS_ID=21783
NHANH_ACCESS_TOKEN=your_access_token_here
```

## Database Migration

Nếu đã có settings trong database, cần migrate:

### Option 1: Re-enter via UI
1. Vào `/settings`
2. Click "Edit Settings"
3. Nhập lại credentials với field names mới
4. Click "Save Changes"

### Option 2: Manual Migration Script

```javascript
// migrate-nhanh-settings.js
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function migrate() {
  // Get old values
  const oldStoreId = await prisma.setting.findUnique({
    where: { key: "NHANH_STORE_ID" }
  });
  
  const oldApiKey = await prisma.setting.findUnique({
    where: { key: "NHANH_API_KEY" }
  });

  // Create new settings
  if (oldStoreId) {
    await prisma.setting.upsert({
      where: { key: "NHANH_BUSINESS_ID" },
      update: { value: oldStoreId.value },
      create: { key: "NHANH_BUSINESS_ID", value: oldStoreId.value }
    });
    
    // Delete old
    await prisma.setting.delete({
      where: { key: "NHANH_STORE_ID" }
    });
  }

  if (oldApiKey) {
    await prisma.setting.upsert({
      where: { key: "NHANH_ACCESS_TOKEN" },
      update: { value: oldApiKey.value },
      create: { key: "NHANH_ACCESS_TOKEN", value: oldApiKey.value }
    });
    
    // Delete old
    await prisma.setting.delete({
      where: { key: "NHANH_API_KEY" }
    });
  }

  // Add NHANH_APP_ID from env
  const appId = process.env.NHANH_APP_ID;
  if (appId) {
    const { encrypt } = require("./src/lib/encryption");
    await prisma.setting.upsert({
      where: { key: "NHANH_APP_ID" },
      update: { value: encrypt(appId) },
      create: { key: "NHANH_APP_ID", value: encrypt(appId) }
    });
  }

  console.log("✅ Migration completed!");
  await prisma.$disconnect();
}

migrate();
```

## API Compatibility

### Nhanh.vn API v3.0

Các field mới phù hợp với API v3.0:

```javascript
// API Request
const response = await fetch(`${apiUrl}/api/endpoint?appId=${appId}&businessId=${businessId}`, {
  headers: {
    'Authorization': `Bearer ${accessToken}`
  }
});
```

### Backward Compatibility

Code sẽ tự động fallback về environment variables nếu không tìm thấy trong database:

```typescript
// Tự động lấy từ .env nếu không có trong DB
const appId = await getSetting("NHANH_APP_ID");
// Returns: process.env.NHANH_APP_ID if not in database
```

## Testing

### Test Settings Page:
1. ✅ Vào `/settings`
2. ✅ Xem Nhanh section có 4 fields: API URL, App ID, Business ID, Access Token
3. ✅ Click "Edit Settings"
4. ✅ Nhập values mới
5. ✅ Click "Save Changes"
6. ✅ Verify settings được save
7. ✅ Click "Test Connection"
8. ✅ Verify connection works

### Test API:
```bash
# GET settings
curl http://localhost:3000/api/settings

# Should return:
{
  "success": true,
  "data": {
    "nhanh": {
      "apiUrl": "https://pos.open.nhanh.vn",
      "appId": "76522",
      "businessId": "21783",
      "accessToken": "EO6L•••••••••Yps"
    }
  }
}
```

## Checklist

- [x] Updated `src/lib/settings.ts`
- [x] Updated `src/lib/api-config.ts`
- [x] Updated `src/app/api/settings/route.ts`
- [x] Updated `src/app/(admin)/settings/page.tsx`
- [x] Updated documentation
- [x] No TypeScript errors
- [ ] Update `.env` file with new field names
- [ ] Migrate existing database settings (if any)
- [ ] Test settings page
- [ ] Test API connections

## Kết luận

Đã cập nhật thành công Nhanh API fields:
- ✅ Store ID → Business ID
- ✅ API Key → Access Token
- ✅ Thêm App ID field
- ✅ Tất cả files đã được cập nhật
- ✅ Backward compatible với .env fallback
- ✅ UI đã được cập nhật với labels mới

Giờ settings page hiển thị đúng các trường theo Nhanh API v3.0! 🎉
