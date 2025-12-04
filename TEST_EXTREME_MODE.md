# 🧪 Test Extreme Mode - Quick Guide

## Current Status

✅ **Code is ready** - All optimizations are in place:
- Batch size: 1000
- Update batch: 200
- Delay: 30ms
- Parallel processing: Active

## Why Speed Shows 200/sec?

The job you're looking at is likely:
1. **Old job** (before code update)
2. **Shopify Pull** (not Nhanh Pull)
3. **Different job type**

## How to Test Properly

### Step 1: Verify Server is Running Latest Code

```bash
# Check if server is running
# Look for "compiled successfully" with recent timestamp
```

### Step 2: Start a New Nhanh Pull

**Option A: Via UI**
1. Go to http://localhost:3000/nhanh-customers
2. Click "Pull All Customers"
3. Go to Job Tracking page
4. Watch the speed in real-time

**Option B: Via API**
```powershell
Invoke-WebRequest -Method POST -Uri "http://localhost:3000/api/nhanh/pull-customers-all" -ContentType "application/json"
```

### Step 3: Monitor Job Tracking

Watch for these metrics:
- **Speed**: Should show 600-800 customers/sec
- **Batch Size**: Calculate (Processed ÷ Batches) ≈ 1000
- **Duration**: Should be much faster

## Expected vs Actual

### Before Optimization
```
Speed: 180 customers/sec
Batch Size: ~100
Time: 42 seconds (7,500 customers)
```

### After Optimization (Expected)
```
Speed: 600-800 customers/sec
Batch Size: ~1000
Time: 10-13 seconds (7,500 customers)
```

## Verification Commands

### Check Latest Job
```powershell
$response = Invoke-WebRequest -Uri "http://localhost:3000/api/logs?limit=1" -UseBasicParsing
$data = ($response.Content | ConvertFrom-Json)
$job = $data.data.logs[0]

Write-Host "Type: $($job.type)"
Write-Host "Speed: $($job.metadata.speed)"
Write-Host "Batches: $($job.metadata.batches)"
Write-Host "Avg Batch: $([math]::Round($job.processed / $job.metadata.batches, 0))"
```

### Check Batch Size
```powershell
# Should show ~1000
$avgBatch = $job.processed / $job.metadata.batches
Write-Host "Average Batch Size: $avgBatch"
```

## Troubleshooting

### If Speed is Still Low (<300/sec)

1. **Server Not Restarted**
   - Stop server (Ctrl+C)
   - Start server (npm run dev)
   - Wait for "compiled successfully"
   - Try pull again

2. **Looking at Old Job**
   - Check job timestamp
   - Start a NEW pull
   - Watch the NEW job

3. **Wrong Job Type**
   - Make sure it's "Pull Nhanh Customers"
   - Not "Pull Shopify Customers"
   - Not "Auto Match" or other types

4. **Database Bottleneck**
   - Check database connection
   - Check disk I/O
   - Check memory usage

5. **Network Issues**
   - Check Nhanh API response time
   - Check internet connection
   - Check for rate limiting

## Success Indicators

You'll know it's working when you see:

✅ **Job Tracking shows:**
- Type: "Pull Nhanh Customers"
- Speed: 600-800 customers/sec
- Progress bar moving very fast
- Completes in 10-15 seconds

✅ **Console logs show:**
- "Fetched 1000 customers" (not 100 or 500)
- Fast batch processing
- No delays or errors

✅ **Metadata shows:**
- batches: ~8 (for 7,500 customers)
- speed: "600-800 customers/sec"
- duration: "10-13s"

## Quick Test Script

```powershell
# 1. Start a new pull
Write-Host "Starting Nhanh Pull..." -ForegroundColor Cyan
Invoke-WebRequest -Method POST -Uri "http://localhost:3000/api/nhanh/pull-customers-all" -ContentType "application/json"

# 2. Wait a bit
Start-Sleep -Seconds 3

# 3. Check progress
$response = Invoke-WebRequest -Uri "http://localhost:3000/api/logs?limit=1" -UseBasicParsing
$data = ($response.Content | ConvertFrom-Json)
$job = $data.data.logs[0]

Write-Host ""
Write-Host "Current Job:" -ForegroundColor Yellow
Write-Host "  Type: $($job.type)"
Write-Host "  Status: $($job.status)"
Write-Host "  Processed: $($job.processed) / $($job.total)"
Write-Host "  Speed: $($job.metadata.speed)"

if ($job.metadata.batches) {
    $avgBatch = [math]::Round($job.processed / $job.metadata.batches, 0)
    Write-Host "  Avg Batch: $avgBatch"
    
    if ($avgBatch -gt 800) {
        Write-Host ""
        Write-Host "✅ EXTREME MODE ACTIVE!" -ForegroundColor Green
    } else {
        Write-Host ""
        Write-Host "⚠️  Still using old code" -ForegroundColor Red
    }
}
```

## Notes

- First pull after restart might be slightly slower (cold start)
- Subsequent pulls should be at full speed
- Database performance affects overall speed
- Network latency to Nhanh API matters
- Batch 1000 is the maximum, API might return less

---

**Ready to test!** 🚀

Just restart server and run a new Nhanh Pull to see the extreme speed!
