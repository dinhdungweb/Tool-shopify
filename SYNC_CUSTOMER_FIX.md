# Sync Customer Bug Fix ✅

## Vấn đề
Lỗi "ReferenceError: body is not defined" xảy ra trong catch block của `/api/sync/sync-customer`

## Nguyên nhân
Trong catch block, code đang cố gắng truy cập biến `body` nhưng biến này chỉ được định nghĩa trong try block scope, không accessible từ catch block.

```typescript
// ❌ Lỗi - body không accessible trong catch
try {
  const body = await request.json();
  // ...
} catch (error: any) {
  if (body.mappingId) { // ReferenceError: body is not defined
    // ...
  }
}
```

## Giải pháp
Di chuyển biến `mappingId` ra ngoài try-catch block để có thể truy cập từ cả hai scopes.

```typescript
// ✅ Đúng - mappingId accessible ở cả try và catch
let mappingId: string | undefined;

try {
  const body = await request.json();
  mappingId = body.mappingId;
  // ...
} catch (error: any) {
  if (mappingId) { // OK - mappingId accessible
    // ...
  }
}
```

## Các thay đổi

### File: `src/app/api/sync/sync-customer/route.ts`

1. **Khai báo mappingId ở function scope**
   ```typescript
   let mappingId: string | undefined;
   ```

2. **Gán giá trị trong try block**
   ```typescript
   const body = await request.json();
   mappingId = body.mappingId;
   ```

3. **Sử dụng mappingId trong catch block**
   ```typescript
   if (mappingId) {
     // Update mapping with error
     // Create error log
   }
   ```

4. **Thêm error handling cho logging**
   ```typescript
   try {
     await prisma.customerMapping.update(...);
     await prisma.syncLog.create(...);
   } catch (logError) {
     console.error("Error logging sync failure:", logError);
   }
   ```

## Lợi ích

1. **Fix crash**: Không còn ReferenceError khi sync fail
2. **Better error handling**: Có thể log errors properly
3. **Graceful degradation**: Nếu logging fail, không crash toàn bộ request
4. **Consistent state**: Mapping status được update đúng khi có lỗi

## Testing

### Test Case 1: Sync thành công
```bash
curl -X POST http://localhost:3000/api/sync/sync-customer \
  -H "Content-Type: application/json" \
  -d '{"mappingId": "valid-mapping-id"}'
```
✅ Expected: Sync thành công, trả về status 200

### Test Case 2: Sync thất bại (invalid Shopify ID)
```bash
curl -X POST http://localhost:3000/api/sync/sync-customer \
  -H "Content-Type: application/json" \
  -d '{"mappingId": "mapping-with-invalid-shopify-id"}'
```
✅ Expected: 
- Trả về error message
- Mapping status = FAILED
- Sync log được tạo với status FAILED
- Không có ReferenceError

### Test Case 3: Missing mappingId
```bash
curl -X POST http://localhost:3000/api/sync/sync-customer \
  -H "Content-Type: application/json" \
  -d '{}'
```
✅ Expected: Trả về 400 Bad Request

## Related Files
- `src/app/api/sync/sync-customer/route.ts` - Fixed
- `src/app/api/sync/bulk-sync/route.ts` - Already correct (no issue)

## Additional Changes

### Metafield Namespace Update
Đã thay đổi namespace của Shopify metafield:
- **Before**: `nhanh.total_spent`
- **After**: `custom.total_spent`

File: `src/lib/shopify-api.ts`
```typescript
async syncCustomerTotalSpent(customerId: string, totalSpent: number) {
  return this.updateCustomerMetafield(customerId, {
    namespace: "custom", // Changed from "nhanh"
    key: "total_spent",
    value: totalSpent.toString(),
    type: "number_decimal",
  });
}
```

## Deployment Notes
- ✅ No database migration needed
- ✅ No breaking changes
- ✅ Backward compatible
- ⚠️ Old metafields with `nhanh.total_spent` will remain (not deleted)
- ℹ️ New syncs will use `custom.total_spent`
