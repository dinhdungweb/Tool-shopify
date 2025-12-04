# 🔍 Debug Nhanh API Size Limit

## Purpose

Test if Nhanh API actually accepts `size: 1000` or limits to 100.

## Changes Made

Added detailed logging to `src/lib/nhanh-api.ts`:

### Before Request
```typescript
console.log(`🔍 Nhanh API Request: size=${limit}, filters=`, JSON.stringify(filters));
```

### After Response
```typescript
console.log("Nhanh API Response:", {
  requestedSize: limit,
  actualReceived: Array.isArray(responseData) ? responseData.length : 0,
  hasNext: !!responsePaginator.next,
  nextCursor: responsePaginator.next ? `{id: ${responsePaginator.next.id}}` : null,
});
```

## How to Test

### Step 1: Restart Server
```bash
# Stop current server
Ctrl+C

# Start fresh
npm run dev
```

### Step 2: Start Pull
- Go to Nhanh Customers page
- Click "Pull All Customers"

### Step 3: Check Console Logs

Look for these patterns:

#### Request Log
```
🔍 Nhanh API Request: size=1000, filters= {"lastBoughtDateFrom":"2024-01-01"}
```

#### Response Log
```
Nhanh API Response: {
  requestedSize: 1000,
  actualReceived: ???,  ← This is the key number!
  hasNext: true,
  nextCursor: {id: 142401158}
}
```

## Interpretation

### If actualReceived = 1000
✅ **API accepts 1000!**
- Our code is correct
- Speed should be 600-800/sec
- Previous issue was server not restarted

### If actualReceived = 100
⚠️ **API limits to 100**
- API has hard limit
- 335/sec is maximum possible
- No further optimization possible

### If actualReceived = something else
🤔 **Need investigation**
- Check API documentation
- Test different sizes
- Contact Nhanh support

## Expected Scenarios

### Scenario A: API Accepts 1000
```
Request: size=1000
Response: actualReceived=1000
Batches: ~43 (for 42,900 customers)
Speed: 600-800/sec ✅
```

### Scenario B: API Limits to 100
```
Request: size=1000
Response: actualReceived=100
Batches: ~429 (for 42,900 customers)
Speed: 335/sec (optimal given limit)
```

### Scenario C: API Has Different Limit
```
Request: size=1000
Response: actualReceived=500
Batches: ~86 (for 42,900 customers)
Speed: 450-550/sec
```

## Next Actions

### If API Accepts 1000
1. ✅ Celebrate - code is working!
2. Update documentation
3. Enjoy 600-800/sec speed

### If API Limits to 100
1. Accept 335/sec as optimal
2. Update expectations
3. Consider alternatives:
   - Parallel requests (risky)
   - Incremental pulls
   - Webhooks

### If API Has Different Limit
1. Adjust `batchSize` to match
2. Recalculate expected speed
3. Update documentation

## Verification Commands

### Check Latest Pull
```powershell
$response = Invoke-WebRequest -Uri "http://localhost:3000/api/logs?limit=1" -UseBasicParsing
$data = ($response.Content | ConvertFrom-Json)
$job = $data.data.logs[0]

Write-Host "Total: $($job.total)"
Write-Host "Batches: $($job.metadata.batches)"
Write-Host "Avg Batch: $([math]::Round($job.total / $job.metadata.batches, 0))"
Write-Host "Speed: $($job.metadata.speed)"
```

### Expected Results

#### If API Accepts 1000
```
Total: 42900
Batches: 43
Avg Batch: 998
Speed: 600-800 customers/sec
```

#### If API Limits to 100
```
Total: 42900
Batches: 429
Avg Batch: 100
Speed: 335 customers/sec
```

---

**Status**: Debug logs added
**Next**: Restart server and test
**Goal**: Determine actual API size limit
