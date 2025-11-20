# Pagination Fixes

## Issues Fixed

### 1. JSON Parse Error with "undefined" String

**Problem:**
```
Error: Syntax error: Unexpected token 'undefined'
GET /api/nhanh/customers?page=1&limit=50&next=undefined
```

**Root Cause:**
- When `nextCursor` was `undefined`, it was being converted to string "undefined"
- `JSON.parse("undefined")` throws a syntax error
- URLSearchParams was including `next=undefined` in query string

**Solutions Applied:**

#### A. API Route (`src/app/api/nhanh/customers/route.ts`)
```typescript
// Before:
next: nextCursor ? JSON.parse(nextCursor) : undefined

// After:
let parsedNext = undefined;
if (nextCursor && nextCursor !== "undefined" && nextCursor !== "null") {
  try {
    parsedNext = JSON.parse(nextCursor);
  } catch (e) {
    console.error("Error parsing next cursor:", e);
  }
}
```

**Changes:**
- ✅ Check if nextCursor is not "undefined" or "null" string
- ✅ Wrap JSON.parse in try-catch for safety
- ✅ Default to undefined if parsing fails

#### B. API Client (`src/lib/api-client.ts`)
```typescript
// Before:
const query = new URLSearchParams(params as any).toString();

// After:
const cleanParams: Record<string, string> = {};
if (params) {
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      cleanParams[key] = String(value);
    }
  });
}
const query = new URLSearchParams(cleanParams).toString();
```

**Changes:**
- ✅ Filter out undefined and null values before creating URLSearchParams
- ✅ Only include parameters that have actual values
- ✅ Prevents `next=undefined` in query string

#### C. CustomerSyncTable Component
```typescript
// Before:
next: page > 1 ? JSON.stringify(nextCursor) : undefined

// After:
const params: any = { page, limit };
if (page > 1 && nextCursor) {
  params.next = JSON.stringify(nextCursor);
}
const nhanhData = await nhanhClient.getCustomers(params);
```

**Changes:**
- ✅ Only add `next` parameter if it exists
- ✅ Check both page > 1 AND nextCursor exists
- ✅ Cleaner conditional logic

### 2. Result

**Before:**
```
❌ GET /api/nhanh/customers?page=1&limit=50&next=undefined 500
❌ Error: Syntax error: Unexpected token 'undefined'
```

**After:**
```
✅ GET /api/nhanh/customers?page=1&limit=50 200
✅ GET /api/nhanh/customers?page=2&limit=50&next={"id":2550} 200
✅ GET /api/nhanh/customers?fetchAll=true 200
```

## Testing

### Test Cases:

1. **First Page Load:**
   ```
   ✅ No 'next' parameter in URL
   ✅ Loads 50 customers
   ✅ Returns hasMore flag
   ```

2. **Next Page:**
   ```
   ✅ Includes 'next' cursor in URL
   ✅ Loads next 50 customers
   ✅ Cursor properly parsed
   ```

3. **Load All:**
   ```
   ✅ Uses fetchAll=true parameter
   ✅ Loads all customers in batches
   ✅ No pagination parameters
   ```

## Code Quality Improvements

1. **Error Handling:**
   - Try-catch around JSON.parse
   - Graceful fallback to undefined
   - Console logging for debugging

2. **Type Safety:**
   - Proper type checking before parsing
   - String validation before JSON.parse
   - Clean parameter filtering

3. **Clean URLs:**
   - No undefined/null in query strings
   - Only necessary parameters included
   - Better readability

## Lessons Learned

1. **URLSearchParams Behavior:**
   - Converts all values to strings
   - `undefined` becomes "undefined"
   - Need to filter before creating params

2. **JSON.parse Safety:**
   - Always validate input before parsing
   - Check for string "undefined" and "null"
   - Use try-catch for robustness

3. **Cursor Pagination:**
   - Only send cursor when needed
   - First page doesn't need cursor
   - Validate cursor exists before using

## Related Files

- `src/app/api/nhanh/customers/route.ts` - API route handler
- `src/lib/api-client.ts` - Client-side API wrapper
- `src/components/customers-sync/CustomerSyncTable.tsx` - UI component
- `src/lib/nhanh-api.ts` - Nhanh.vn API wrapper

## Status: ✅ FIXED

All pagination issues resolved. System now properly handles:
- First page without cursor
- Subsequent pages with cursor
- Load all functionality
- Error cases gracefully
