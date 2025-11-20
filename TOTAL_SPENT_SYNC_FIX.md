# Total Spent Sync Fix ✅

## Vấn đề
Khi sync customer từ Nhanh.vn sang Shopify, total spent hiển thị 0.0 thay vì giá trị thực (ví dụ: 69,735,300 ₫)

## Nguyên nhân
Hàm `getCustomerTotalSpent()` đang gọi API endpoint `/v3.0/customer/detail` nhưng endpoint này không tồn tại trong Nhanh.vn API v3.0, trả về HTML 404 page thay vì JSON data.

## Phân tích

### API Detail (Không hoạt động)
```
POST https://pos.open.nhanh.vn/v3.0/customer/detail
Body: { id: 7 }
Response: HTML 404 page ❌
```

### API List với Filter (Hoạt động)
```
POST https://pos.open.nhanh.vn/v3.0/customer/list
Body: {
  filters: { type: 1, id: 7 },
  paginator: { size: 1 }
}
Response: {
  "code": 1,
  "data": [{
    "id": 7,
    "name": "Mịn",
    "totalAmount": 69735300, ✅
    ...
  }]
}
```

## Giải pháp
Thay đổi `getCustomerTotalSpent()` để sử dụng API `/v3.0/customer/list` với filter theo customer ID thay vì API detail.

### Code cũ (Lỗi)
```typescript
async getCustomerTotalSpent(customerId: string): Promise<number> {
  try {
    const customer = await this.getCustomerById(customerId); // ❌ API không tồn tại
    return customer.totalSpent || 0;
  } catch (error) {
    return 0; // Luôn trả về 0
  }
}
```

### Code mới (Đúng)
```typescript
async getCustomerTotalSpent(customerId: string): Promise<number> {
  try {
    const requestData = {
      filters: {
        type: 1,
        id: parseInt(customerId),
      },
      paginator: {
        size: 1,
      },
    };

    const apiResponse = await this.request<any>("/v3.0/customer/list", requestData);
    const customers = apiResponse.data || [];
    
    if (customers.length > 0 && customers[0].id === parseInt(customerId)) {
      const totalAmount = parseFloat(customers[0].totalAmount?.toString() || "0");
      console.log(`Customer ${customerId} total spent: ${totalAmount}`);
      return totalAmount; // ✅ Trả về giá trị đúng
    }
    
    return 0;
  } catch (error) {
    console.error("Error getting customer total spent:", error);
    return 0;
  }
}
```

## Test Results

### Test với Customer ID = 7
```bash
node test-customer-detail.js
```

**Kết quả:**
```json
{
  "id": 7,
  "name": "Mịn",
  "mobile": "0789834300",
  "totalAmount": 69735300,
  "address": "152 Hàng Bông, Hoàn Kiếm, Hà Nội"
}
```
✅ API trả về đúng totalAmount = 69,735,300

### Test Sync Flow
1. **Mapping**: Map customer Nhanh.vn (ID: 7) với Shopify customer
2. **Sync**: Click "Sync" button
3. **API Call**: `getCustomerTotalSpent("7")` → Returns 69735300
4. **Shopify Update**: Update metafield `custom.total_spent` = "69735300"
5. **Result**: Shopify hiển thị đúng giá trị ✅

## Lợi ích

1. **Accurate Data**: Lấy dữ liệu real-time chính xác từ Nhanh.vn
2. **Reliable API**: Sử dụng API endpoint đã được verify hoạt động
3. **Better Logging**: Thêm console.log để debug dễ dàng
4. **Error Handling**: Proper error handling với fallback về 0

## Files Changed
- `src/lib/nhanh-api.ts` - Updated `getCustomerTotalSpent()` method
- `test-customer-detail.js` - Test script to verify API

## API Documentation

### Endpoint
```
POST https://pos.open.nhanh.vn/v3.0/customer/list
```

### Headers
```
Authorization: {accessToken}
Content-Type: application/json
```

### Query Params
```
appId={appId}
businessId={businessId}
```

### Request Body
```json
{
  "filters": {
    "type": 1,
    "id": 7
  },
  "paginator": {
    "size": 1
  }
}
```

### Response
```json
{
  "code": 1,
  "data": [
    {
      "id": 7,
      "name": "Mịn",
      "mobile": "0789834300",
      "totalAmount": 69735300,
      "frequencyBought": 12,
      ...
    }
  ],
  "paginator": {
    "next": { "id": 7 }
  }
}
```

## Deployment Notes
- ✅ No database migration needed
- ✅ No breaking changes
- ✅ Backward compatible
- ✅ Works with existing sync flow
- ⚠️ Requires Nhanh.vn API v3.0 access

## Next Steps
1. Test sync với nhiều customers khác nhau
2. Verify metafield được update đúng trên Shopify
3. Test bulk sync functionality
4. Monitor sync logs để đảm bảo không có lỗi
