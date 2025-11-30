# UI Test Guide - Concurrent Pull với Same Filter

## Mục đích
Test xem khi pull Nhanh đang chạy với một filter, ấn pull lại với cùng filter đó có hiện dialog "already running" không.

## Test Steps

### Test 1: Pull Nhanh với Filter
1. Mở trang Customer Sync
2. Click nút "Pull Nhanh Customers" dropdown
3. Click "Pull with Custom Filters"
4. Chọn filter: `From Date: 2024-01-01`
5. Click "Pull Customers"
6. ✅ Expect: Alert "Background pull started" với filters applied

### Test 2: Pull lại với cùng Filter (Should Detect Running)
1. Ngay sau khi pull start, click lại "Pull with Custom Filters"
2. Chọn CÙNG filter: `From Date: 2024-01-01`
3. Click "Pull Customers"
4. ✅ Expect: Dialog hiện:
   ```
   ⚠️ Pull is already running with these filters!
   
   Options:
   • Click OK to FORCE RESTART from beginning
   • Click Cancel to wait for current pull to finish
   
   Note: Force restart will lose current progress.
   ```

### Test 3: Cancel (Wait for Current Pull)
1. Trong dialog ở Test 2, click "Cancel"
2. ✅ Expect: Modal đóng, pull hiện tại tiếp tục chạy

### Test 4: Force Restart
1. Lặp lại Test 2
2. Trong dialog, click "OK"
3. ✅ Expect: 
   - Alert "Background pull started (restarting from beginning)"
   - Pull restart từ đầu
   - Modal đóng

### Test 5: Pull với Filter Khác (Should Work in Parallel)
1. Trong khi pull đang chạy với filter `2024-01-01`
2. Click "Pull with Custom Filters"
3. Chọn filter KHÁC: `From Date: 2024-06-01`
4. Click "Pull Customers"
5. ✅ Expect: Pull start thành công (parallel pull)

### Test 6: Pull All Customers
1. Trong khi pull với filter đang chạy
2. Click "Pull All Customers" (no filter)
3. ✅ Expect: Pull start thành công (different progressId)

### Test 7: Pull Shopify (Concurrent)
1. Trong khi pull Nhanh đang chạy
2. Click "Pull Shopify Customers"
3. ✅ Expect: Pull start thành công (parallel system)

## Expected Behavior Summary

| Scenario | Expected Result |
|----------|----------------|
| Same filter, pull running | Show "already running" dialog |
| Same filter, force restart | Restart from beginning |
| Different filter | Start new pull (parallel) |
| No filter vs with filter | Start new pull (different progressId) |
| Nhanh vs Shopify | Start both (parallel systems) |

## Troubleshooting

### Dialog không hiện
- Check browser console for errors
- Check network tab: Should see 409 status
- Verify pull is actually running: `node check-pull-progress.js`

### Pull không start
- Check if previous pull is stale (>2 min no update)
- Try force restart
- Check server logs for errors

### Modal đóng quá sớm
- Fixed: Modal chỉ đóng khi success hoặc user cancel
- Dialog hiện trước khi modal đóng

## API Test (Alternative)

Nếu UI không hoạt động, test trực tiếp API:

```bash
node test-nhanh-same-filter.js
```

Expected output:
```
Test 1: Start pull with filter → 200 OK
Test 2: Same filter again → 409 Conflict
Test 3: Force restart → 200 OK
Test 4: Different filter → 200 OK
```
