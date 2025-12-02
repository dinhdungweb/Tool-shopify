# 🚀 Speed Test Checklist

## ✅ Code Verification (COMPLETED)

All optimizations verified in code:

- ✅ **API Batch Size**: 500 (Line 130)
- ✅ **Update Batch Size**: 150 (Line 131)
- ✅ **Parallel Processing**: 2 locations (Lines 280, 351)
- ✅ **Reduced Delay**: 50ms (Line 417)

## 📋 Testing Steps

### 1. Restart Server
```bash
# Stop current server (Ctrl+C)
# Start fresh server
npm run dev
```

### 2. Clear Progress (Optional)
If you want to test from scratch:
- Go to Nhanh Customers page
- Click "Reset Progress"

### 3. Start Pull
- Click "Pull All Customers"
- Watch Job Tracking in real-time

### 4. Monitor Performance

Check these metrics:

#### Speed Indicators
- **Target**: 400-450 customers/sec
- **Minimum acceptable**: 350 customers/sec
- **Previous**: 180 customers/sec

#### Batch Size
- **Target**: ~500 customers/batch
- **Calculate**: Total Processed ÷ Batches
- **Example**: 7,500 ÷ 15 = 500 ✅

#### Total Time (7,500 customers)
- **Target**: 17-19 seconds
- **Acceptable**: 20-25 seconds
- **Previous**: 42 seconds

### 5. Verification Commands

Run these to check live stats:

```powershell
# Check current job
Invoke-WebRequest -Uri "http://localhost:3000/api/logs?limit=1" -UseBasicParsing | ConvertFrom-Json

# Calculate batch size
$response = Invoke-WebRequest -Uri "http://localhost:3000/api/logs?limit=1" -UseBasicParsing
$data = ($response.Content | ConvertFrom-Json)
$job = $data.data.logs[0]
$meta = $job.metadata
$avgBatch = [math]::Round($meta.processed / $meta.batches, 0)
Write-Host "Avg Batch Size: $avgBatch"
Write-Host "Speed: $($meta.speed)"
```

## 🎯 Success Criteria

### Must Have
- ✅ Speed ≥ 350 customers/sec
- ✅ Batch size ≥ 400
- ✅ No errors in console
- ✅ All customers pulled successfully

### Nice to Have
- 🎯 Speed ≥ 400 customers/sec
- 🎯 Batch size = 500
- 🎯 Time < 20 seconds (7,500 customers)

## 🐛 Troubleshooting

### If speed is still slow (<300/sec)

1. **Check if server restarted**
   - Look for "compiled successfully" in terminal
   - Check timestamp of last compile

2. **Check batch size**
   ```powershell
   # Should show ~500
   $avgBatch = processed / batches
   ```

3. **Check for errors**
   - Database connection issues
   - Rate limit errors
   - Memory issues

### If batch size is wrong

1. **Verify code changes**
   ```powershell
   # Should show 500 and 150
   Select-String -Path "src/app/api/nhanh/pull-customers-all/route.ts" -Pattern "batchSize"
   ```

2. **Clear browser cache**
   - Hard refresh (Ctrl+Shift+R)
   - Clear application cache

## 📊 Expected Results

### Before Optimization
```
Speed: 180 customers/sec
Batch Size: ~100
Update Batch: 50
Delay: 100ms
Time: 42 seconds
```

### After Optimization
```
Speed: 400-450 customers/sec
Batch Size: ~500
Update Batch: 150
Delay: 50ms
Time: 17-19 seconds
```

### Improvement
```
Speed: 2.5x faster
Time: 2.2x faster
Efficiency: 5x larger batches
```

## 🎉 Success Indicators

You'll know it's working when you see:

1. **Job Tracking shows**:
   - Speed climbing to 400+/sec
   - Batches completing quickly
   - Progress bar moving smoothly

2. **Console logs show**:
   - "Batch X: Fetched 500 customers"
   - Fast batch processing
   - No delays or errors

3. **Final summary shows**:
   - Total time < 20 seconds
   - Speed > 400/sec
   - All customers synced

---

**Ready to test!** 🚀

Restart server → Pull customers → Watch the speed! 🔥
