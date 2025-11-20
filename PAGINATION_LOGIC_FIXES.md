# Pagination Logic Fixes

## Vấn đề đã phát hiện

### 1. Cursor Pagination không hoạt động đúng
- **Vấn đề**: Khi chuyển trang, `next` cursor bị stringify 2 lần, dẫn đến API nhận được `[object Object]` string
- **Nguyên nhân**: 
  - Frontend stringify cursor trước khi gửi: `params.next = JSON.stringify(nextCursor)`
  - API client lại stringify thêm lần nữa khi convert sang string
- **Giải pháp**: Truyền cursor object trực tiếp, để API client xử lý stringify

### 2. Load All không reset pagination state đúng
- **Vấn đề**: Sau khi load all, pagination controls vẫn hiển thị và có thể click
- **Nguyên nhân**: Không có state để track khi đang ở chế độ "load all"
- **Giải pháp**: Thêm state `isAllLoaded` để ẩn pagination controls khi đã load all

### 3. Refresh không reset về trang đầu
- **Vấn đề**: Khi click Refresh sau khi load all, không quay về chế độ pagination
- **Giải pháp**: Reset tất cả pagination state khi click Refresh

### 4. Total count không chính xác
- **Vấn đề**: API chỉ trả về số lượng customers trong page hiện tại, không phải tổng số
- **Giải pháp**: Sử dụng `paginator.total` từ Nhanh API response

## Các thay đổi đã thực hiện

### 1. CustomerSyncTable.tsx

#### Thêm state tracking
```typescript
const [isAllLoaded, setIsAllLoaded] = useState(false);
```

#### Sửa loadData() - Truyền cursor trực tiếp
```typescript
// Before
if (page > 1 && nextCursor) {
  params.next = JSON.stringify(nextCursor);
}

// After
if (page > 1 && nextCursor) {
  params.next = nextCursor; // Pass object directly
}
```

#### Sửa loadAllCustomers() - Set isAllLoaded và load mappings
```typescript
setIsAllLoaded(true);
setNextCursor(undefined);

// Load existing mappings
const mappingsData = await syncClient.getMappings({ page: 1, limit: 10000 });
// ...
```

#### Sửa Refresh button - Reset pagination state
```typescript
onClick={() => {
  setIsAllLoaded(false);
  setPage(1);
  setNextCursor(undefined);
  setHasMore(true);
  loadData();
}}
```

#### Sửa Pagination display - Ẩn controls khi load all
```typescript
{isAllLoaded ? (
  <>Showing all {total} customers</>
) : (
  <>Page {page} • Showing {customers.length} customers • {hasMore ? "More available" : "All loaded"}</>
)}

{!isAllLoaded && (
  <div className="flex gap-2">
    {/* Previous/Next buttons */}
  </div>
)}
```

### 2. api-client.ts

#### Sửa getCustomers() - Xử lý cursor object
```typescript
Object.entries(params).forEach(([key, value]) => {
  if (value !== undefined && value !== null) {
    // Handle next cursor - stringify if it's an object
    if (key === 'next' && typeof value === 'object') {
      cleanParams[key] = JSON.stringify(value);
    } else if (key !== 'next') {
      cleanParams[key] = String(value);
    } else {
      cleanParams[key] = value as string;
    }
  }
});
```

### 3. nhanh-api.ts

#### Sửa getCustomers() - Sử dụng paginator.total
```typescript
return {
  customers: filteredCustomers,
  total: responsePaginator.total || filteredCustomers.length, // Use API total
  page: page,
  limit: limit,
  next: responsePaginator.next,
  hasMore: !!responsePaginator.next,
};
```

#### Thêm logging để debug
```typescript
console.log("Nhanh API Response:", {
  dataLength: Array.isArray(responseData) ? responseData.length : 0,
  hasNext: !!responsePaginator.next,
  paginatorTotal: responsePaginator.total,
});
```

### 4. route.ts

#### Thêm logging để debug cursor
```typescript
if (nextCursor && nextCursor !== "undefined" && nextCursor !== "null") {
  try {
    parsedNext = JSON.parse(nextCursor);
    console.log("Parsed next cursor:", parsedNext);
  } catch (e) {
    console.error("Error parsing next cursor:", e);
    console.error("Next cursor value:", nextCursor);
  }
}

console.log("API Response:", {
  customersCount: result.customers.length,
  hasMore: result.hasMore,
  hasNext: !!result.next,
});
```

## Cách hoạt động sau khi sửa

### Pagination bình thường
1. Page 1: Load 50 customers đầu tiên, nhận `next` cursor
2. Click Next: Gửi `next` cursor, load 50 customers tiếp theo
3. Tiếp tục cho đến khi `hasMore = false`

### Load All
1. Click "Load All": Fetch tất cả customers qua nhiều requests
2. Set `isAllLoaded = true`: Ẩn pagination controls
3. Hiển thị "Showing all X customers"

### Refresh
1. Click "Refresh": Reset về page 1
2. Reset `isAllLoaded = false`: Hiện lại pagination controls
3. Clear cursor và load lại từ đầu

## Testing

Để test các fixes:

1. **Test pagination**:
   - Load trang đầu tiên
   - Click Next nhiều lần
   - Kiểm tra console logs để xem cursor được truyền đúng
   - Verify không có duplicate customers

2. **Test load all**:
   - Click "Load All"
   - Verify tất cả customers được load
   - Verify pagination controls bị ẩn
   - Verify total count chính xác

3. **Test refresh**:
   - Load all customers
   - Click "Refresh"
   - Verify quay về chế độ pagination
   - Verify load lại từ page 1

## Notes

- Nhanh API v3.0 sử dụng cursor-based pagination với `paginator.next` object
- Cursor object chứa thông tin để fetch page tiếp theo
- `paginator.total` chứa tổng số records trong database
- Không nên stringify cursor nhiều lần, chỉ stringify 1 lần khi gửi qua URL
