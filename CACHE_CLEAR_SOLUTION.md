# 🔧 Cache Clear Solution

## Problem Identified

**Symptom:**
- Speed: 332 customers/sec (expected 600-800)
- Batch size: 100 (expected 1000)
- Code changes not applied

**Root Cause:**
- Next.js using cached/compiled version
- Server not reloaded with new code
- .next folder contained old compiled code (137MB)

## Solution Applied

### Step 1: Clear Next.js Cache ✅
```bash
rm -rf .next
```
- Removed 137MB of cached files
- Forces Next.js to recompile with latest code

### Step 2: Restart Server (Required)
```bash
# Stop current server
Ctrl+C

# Start fresh server
npm run dev

# Wait for "compiled successfully"
```

### Step 3: Test Again
- Pull Nhanh Customers
- Watch Job Tracking
- Verify batch size ~1000
- Verify speed 600-800/sec

## Why This Happens

Next.js caches compiled code in `.next` folder for faster development. When you:
1. Pull code from git
2. Make changes to route files
3. Don't restart server properly

The server might still use old cached version.

## Prevention

Always after pulling code:
1. Stop server (Ctrl+C)
2. Clear cache: `rm -rf .next`
3. Start server: `npm run dev`
4. Wait for full compilation

## Verification

After restart, check:

```powershell
# Start a new pull
Invoke-WebRequest -Method POST -Uri "http://localhost:3000/api/nhanh/pull-customers-all" -ContentType "application/json"

# Wait a bit
Start-Sleep -Seconds 5

# Check batch size
$response = Invoke-WebRequest -Uri "http://localhost:3000/api/logs?limit=1" -UseBasicParsing
$data = ($response.Content | ConvertFrom-Json)
$job = $data.data.logs[0]

$avgBatch = [math]::Round($job.processed / $job.metadata.batches, 0)
Write-Host "Batch Size: $avgBatch (should be ~1000)"
Write-Host "Speed: $($job.metadata.speed) (should be 600-800/sec)"
```

## Expected Results After Fix

### Before (Cached Code)
```
Batches: 420
Avg Batch: 100
Speed: 294.8 customers/sec
Time: ~2 minutes
```

### After (Fresh Code)
```
Batches: ~42
Avg Batch: 1000
Speed: 600-800 customers/sec
Time: ~1 minute
```

## Quick Fix Command

```powershell
# One-liner to clear cache
Remove-Item -Recurse -Force .next -ErrorAction SilentlyContinue
Write-Host "✅ Cache cleared! Now restart server."
```

---

**Status**: ✅ Cache cleared
**Next**: Restart server and test
**Expected**: 2-3x speed improvement
