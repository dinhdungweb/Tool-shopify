# Pagination Improvements

## ✅ Implemented Features

### 1. Cursor-Based Pagination

**Before:**
- Only loaded 20 customers per page
- Simple page-based pagination
- No way to load all customers

**After:**
- ✅ Cursor-based pagination using Nhanh.vn API v3.0 `paginator.next`
- ✅ Efficient pagination that follows API best practices
- ✅ Increased default page size to 50 customers
- ✅ Proper handling of `hasMore` flag

### 2. Load All Customers Feature

Added "Load All" button that:
- ✅ Fetches all customers from Nhanh.vn in batches
- ✅ Shows loading indicator during fetch
- ✅ Confirms with user before loading (to prevent accidental clicks)
- ✅ Displays total count after loading
- ✅ Safety limit of 10,000 customers to prevent infinite loops

### 3. API Improvements

**nhanh-api.ts:**
```typescript
// New method to get all customers
async getAllCustomers(limit: number = 100): Promise<NhanhCustomer[]> {
  const allCustomers: NhanhCustomer[] = [];
  let nextCursor: any = undefined;
  let hasMore = true;

  while (hasMore) {
    const response = await this.getCustomers({
      limit,
      next: nextCursor,
    });

    allCustomers.push(...response.customers);
    nextCursor = response.next;
    hasMore = response.hasMore;

    // Safety limit
    if (allCustomers.length > 10000) {
      console.warn("Reached safety limit of 10000 customers");
      break;
    }
  }

  return allCustomers;
}
```

**API Route:**
```typescript
// Support fetchAll parameter
if (fetchAll) {
  const allCustomers = await nhanhAPI.getAllCustomers(100);
  return NextResponse.json({
    success: true,
    data: {
      customers: allCustomers,
      total: allCustomers.length,
      hasMore: false,
    },
  });
}
```

### 4. UI Improvements

**CustomerSyncTable:**
- ✅ "Load All" button with loading state
- ✅ Better pagination info (shows "Page X • Showing Y customers")
- ✅ Disabled state for buttons during loading
- ✅ Next button disabled when no more data
- ✅ Confirmation dialog before loading all

**Pagination Display:**
```
Before: "Page 1 of 10"
After:  "Page 1 • Showing 50 customers" (when hasMore)
        "Showing all 234 customers" (when all loaded)
```

### 5. Performance Optimizations

1. **Batch Loading:**
   - Loads 100 customers per API call when fetching all
   - Reduces number of API requests

2. **Safety Limits:**
   - Maximum 10,000 customers to prevent memory issues
   - Warning logged if limit reached

3. **Efficient State Management:**
   - Cursor stored in state for next page
   - Mappings loaded once with high limit (10,000)

4. **Loading States:**
   - Separate loading states for normal load vs load all
   - Prevents UI conflicts

### 6. Type Safety

Updated TypeScript interfaces:

```typescript
export interface NhanhCustomerListResponse {
  customers: NhanhCustomer[];
  total: number;
  page: number;
  limit: number;
  next?: any; // Next cursor for pagination
  hasMore: boolean;
}

export interface NhanhCustomerSearchParams {
  name?: string;
  phone?: string;
  email?: string;
  page?: number;
  limit?: number;
  next?: any; // Cursor for pagination
}
```

## Usage

### Normal Pagination:
1. Page loads with 50 customers
2. Click "Next" to load next 50
3. Click "Previous" to go back
4. Cursor automatically managed

### Load All Customers:
1. Click "Load All" button
2. Confirm dialog appears
3. System fetches all customers in batches
4. Shows success message with total count
5. Pagination hidden (all data loaded)

## API Endpoints

### Get Customers (Paginated):
```
GET /api/nhanh/customers?page=1&limit=50&next={cursor}
```

### Get All Customers:
```
GET /api/nhanh/customers?fetchAll=true
```

## Benefits

1. **Better UX:**
   - Users can load all customers at once
   - Clear indication of loading state
   - Better pagination info

2. **Performance:**
   - Efficient cursor-based pagination
   - Batch loading reduces API calls
   - Safety limits prevent issues

3. **Flexibility:**
   - Choose between paginated or full load
   - Adjustable page size
   - Easy to extend

4. **Reliability:**
   - Proper error handling
   - Confirmation dialogs
   - Loading indicators

## Testing

1. **Normal Pagination:**
   - Navigate to /customers-sync
   - Click Next/Previous buttons
   - Verify cursor-based pagination works

2. **Load All:**
   - Click "Load All" button
   - Confirm dialog
   - Wait for loading
   - Verify all customers loaded

3. **Performance:**
   - Monitor network requests
   - Check memory usage
   - Verify no infinite loops

## Future Enhancements

Possible improvements:
- [ ] Virtual scrolling for large datasets
- [ ] Search/filter across all customers
- [ ] Export all customers to CSV
- [ ] Background sync for all customers
- [ ] Progress bar for load all operation
- [ ] Cache loaded customers in localStorage
