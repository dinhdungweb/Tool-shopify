# Pull Conflict Matrix - Quick Reference

## 🎯 Conflict Matrix

| Pull đang chạy | Pull mới muốn start | Kết quả | Lý do |
|----------------|---------------------|---------|-------|
| Nhanh All | Nhanh All | ❌ **BLOCKED** (409) | Same progressId |
| Nhanh All | Nhanh Filter A | ✅ **ALLOWED** | Different progressId |
| Nhanh Filter A | Nhanh Filter A | ❌ **BLOCKED** (409) | Same progressId |
| Nhanh Filter A | Nhanh Filter B | ✅ **ALLOWED** | Different progressId |
| Nhanh Filter A | Nhanh All | ⚠️ **ALLOWED** (caution) | Different progressId, but duplicate work |
| Nhanh Any | Shopify Any | ✅ **ALLOWED** | Different systems |
| Shopify All | Shopify All | ❌ **BLOCKED** (409) | Same progressId |
| Shopify Query A | Shopify Query A | ❌ **BLOCKED** (409) | Same progressId |
| Shopify Query A | Shopify Query B | ✅ **ALLOWED** | Different progressId |
| Pull New/Updated | Any | ✅ **ALLOWED** | Synchronous, completes fast |

## 📊 ProgressId Examples

### Nhanh
```
No filter:
  progressId: "nhanh_customers"

Filter: { lastBoughtDateFrom: "2024-01-01" }
  progressId: "nhanh_customers_eyJsYXN0Qm91Z2h0RGF0ZUZyb20iOiIyMDI0LTAxLTAxIn0="

Filter: { type: 1 }
  progressId: "nhanh_customers_eyJ0eXBlIjoxfQ=="

Filter: { lastBoughtDateFrom: "2024-01-01", type: 1 }
  progressId: "nhanh_customers_eyJsYXN0Qm91Z2h0RGF0ZUZyb20iOiIyMDI0LTAxLTAxIiwidHlwZSI6MX0="
```

### Shopify
```
No query:
  progressId: "shopify_customers"

Query: "state:ENABLED"
  progressId: "shopify_customers_c3RhdGU6RU5BQkxFRA=="

Query: "orders_count:>0"
  progressId: "shopify_customers_b3JkZXJzX2NvdW50Oj4w"
```

## 🔄 Flow Diagrams

### Flow 1: Daily Sync (Recommended)
```
┌─────────────────────────────────────────────────┐
│ 1. Pull New/Updated (Nhanh)                    │
│    ├─ Synchronous                              │
│    ├─ Fast (~2-5 min)                          │
│    └─ ✅ No conflict                           │
└─────────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────┐
│ 2. Pull Shopify All (if needed)                │
│    ├─ Background                               │
│    ├─ Can start immediately                    │
│    └─ ✅ No conflict (different system)        │
└─────────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────┐
│ 3. Auto-match & Sync                           │
└─────────────────────────────────────────────────┘
```

### Flow 2: Full Sync (Weekly)
```
┌─────────────────────────────────────────────────┐
│ 1. Pull All Nhanh (background)                 │
│    ├─ progressId: "nhanh_customers"            │
│    └─ Status: Running...                       │
└─────────────────────────────────────────────────┘
                    ║
                    ║ (Parallel)
                    ║
┌─────────────────────────────────────────────────┐
│ 2. Pull All Shopify (background)               │
│    ├─ progressId: "shopify_customers"          │
│    └─ Status: Running...                       │
└─────────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────┐
│ 3. Wait for both to complete                   │
│    └─ Check: node check-pull-progress.js       │
└─────────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────┐
│ 4. Auto-match & Bulk Sync                      │
└─────────────────────────────────────────────────┘
```

### Flow 3: Filtered Sync
```
┌─────────────────────────────────────────────────┐
│ 1. Pull Nhanh with Filter A                    │
│    ├─ Filter: from 2024-01-01                  │
│    ├─ progressId: "nhanh_customers_eyJ..."     │
│    └─ Status: Running...                       │
└─────────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────┐
│ 2. Options while running:                      │
│                                                 │
│ ✅ Pull Nhanh Filter B (from 2024-06-01)       │
│    └─ Different progressId → OK                │
│                                                 │
│ ✅ Pull Shopify                                 │
│    └─ Different system → OK                    │
│                                                 │
│ ❌ Pull Nhanh Filter A again                    │
│    └─ Same progressId → BLOCKED                │
│                                                 │
│ ⚠️ Pull Nhanh All                               │
│    └─ Different progressId → OK but duplicate  │
└─────────────────────────────────────────────────┘
```

## 🚦 Decision Tree

```
Want to start a pull?
│
├─ Check: Is same pull already running?
│  │
│  ├─ YES (same progressId)
│  │  │
│  │  ├─ Wait for completion? → ✅ Wait
│  │  │
│  │  └─ Need to restart? → ⚠️ Force Restart
│  │
│  └─ NO (different progressId or system)
│     │
│     └─ ✅ Start pull (safe)
│
└─ After starting:
   │
   ├─ Monitor progress
   │
   └─ Don't start same pull again
```

## 📋 Quick Check Commands

### Before starting a pull:
```bash
# 1. Check current pulls
node check-pull-progress.js

# 2. Identify progressId
# - Same filter = Same progressId = Will be blocked
# - Different filter = Different progressId = OK
# - Different system = Always OK

# 3. Decide:
# - If same progressId running → Wait or Force Restart
# - If different progressId → Safe to start
```

### During pull:
```bash
# Monitor progress every few minutes
node check-pull-progress.js

# Check server logs
# Look for errors or stalls
```

### After pull:
```bash
# Verify completion
node check-pull-progress.js
# Should show: isCompleted: true

# Check data
# Verify customers were pulled correctly
```

## 🎓 Examples

### Example 1: Safe Parallel Pulls
```bash
# Start Nhanh pull with filter
POST /api/nhanh/pull-customers-all
Body: { "lastBoughtDateFrom": "2024-01-01" }
→ progressId: "nhanh_customers_eyJ..."
→ Status: 200 OK

# Start Shopify pull (different system)
POST /api/shopify/pull-customers
Body: {}
→ progressId: "shopify_customers"
→ Status: 200 OK

# Both running in parallel ✅
```

### Example 2: Blocked Pull
```bash
# Start Nhanh pull
POST /api/nhanh/pull-customers-all
Body: { "lastBoughtDateFrom": "2024-01-01" }
→ Status: 200 OK

# Try same pull again (within 2 minutes)
POST /api/nhanh/pull-customers-all
Body: { "lastBoughtDateFrom": "2024-01-01" }
→ Status: 409 Conflict
→ Error: "Pull is already running!"

# User sees dialog:
# "Click OK to Force Restart or Cancel to wait"
```

### Example 3: Force Restart
```bash
# Pull is running but stuck
# User clicks Force Restart

POST /api/nhanh/pull-customers-all
Body: { 
  "lastBoughtDateFrom": "2024-01-01",
  "forceRestart": true 
}
→ Status: 200 OK
→ Message: "Background pull started (restarting from beginning)"

# Old progress deleted, new pull starts ✅
```

## 💡 Pro Tips

1. **Check before pull**: Always run `check-pull-progress.js` first
2. **Different filters = Safe**: Leverage this for parallel pulls
3. **Nhanh + Shopify = Always safe**: Different systems never conflict
4. **Force Restart = Last resort**: Only use when pull is stuck
5. **2-minute rule**: After 2 min no update, pull considered stale
6. **Monitor regularly**: Don't start and forget

## ⚠️ Warning Signs

Watch out for these:
- ❌ Multiple 409 errors → Same pull being triggered repeatedly
- ❌ Pull not updating (>5 min) → May be stuck, consider Force Restart
- ❌ Server slow → Too many concurrent pulls
- ❌ API rate limit errors → Slow down pulls
- ❌ Memory errors → Too much data, need to optimize

## ✅ Success Indicators

Good signs:
- ✅ Progress updates regularly (every 30-60 sec)
- ✅ No 409 errors
- ✅ Server responsive
- ✅ Pulls complete successfully
- ✅ Data appears in database
