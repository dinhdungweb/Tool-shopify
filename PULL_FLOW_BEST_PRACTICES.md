# Pull Flow - Best Practices & Conflict Prevention

## 📋 Tổng quan hệ thống

### Pull Types

#### 1. Nhanh Customers
- **Pull 5000**: Sync pull, chờ kết quả (max 5000 customers)
- **Pull New/Updated**: Incremental pull, chờ kết quả
- **Pull All**: Background pull, không filter
- **Pull with Filters**: Background pull, có filter (type, date range)

#### 2. Shopify Customers
- **Pull All**: Background pull, không filter
- **Pull with Query**: Background pull, có Shopify query filter

### Progress Tracking

Mỗi pull có một `progressId` unique:

```typescript
// Nhanh
"nhanh_customers"                    // Pull All (no filter)
"nhanh_customers_eyJsYXN0Qm91..."  // Pull with filter (hash)

// Shopify
"shopify_customers"                  // Pull All (no filter)
"shopify_customers_c3RhdGU6RU5B..."  // Pull with query (hash)
```

## ✅ Flow chuẩn - KHÔNG conflict

### Scenario 1: Daily Sync (Recommended)
```
1. Morning: Pull New/Updated (Nhanh) - Fast, only new data
2. Morning: Pull Shopify All - Get all Shopify customers
3. Afternoon: Auto-match - Match by phone
4. Evening: Sync selected customers
```

**Tại sao không conflict?**
- Pull New/Updated: Synchronous, hoàn thành nhanh
- Pull Shopify: Khác system, khác progressId
- Không chạy đồng thời cùng type

### Scenario 2: First Time Setup
```
1. Pull All Nhanh (no filter) - Get all customers
   → Wait to complete (check progress)
2. Pull All Shopify - Get all Shopify customers
   → Can run parallel with step 1 ✅
3. Auto-match all
4. Review and sync
```

**Tại sao không conflict?**
- Nhanh và Shopify: Khác system, khác progressId
- Chạy song song OK

### Scenario 3: Filtered Pull
```
1. Pull Nhanh with filter (e.g., from 2024-01-01)
   → Background pull starts
2. While running, can:
   ✅ Pull Shopify (different system)
   ✅ Pull Nhanh with DIFFERENT filter (different progressId)
   ❌ Pull Nhanh with SAME filter (blocked - 409)
   ⚠️ Pull Nhanh All (allowed but may duplicate work)
```

## ❌ Anti-patterns - CÓ THỂ conflict

### 1. Pull cùng filter nhiều lần
```
❌ BAD:
- Start: Pull Nhanh from 2024-01-01
- 1 min later: Pull Nhanh from 2024-01-01 again
→ Result: 409 Conflict (blocked)

✅ GOOD:
- Wait for first pull to complete
- Or use Force Restart if needed
```

### 2. Pull All trong khi Pull filtered
```
⚠️ CAUTION:
- Running: Pull Nhanh from 2024-01-01 (10,000 customers)
- Start: Pull Nhanh All (100,000 customers)
→ Result: Both run, but duplicate work on 10,000 customers

✅ BETTER:
- Wait for filtered pull to complete
- Then decide if need Pull All
- Or Force Restart filtered pull
```

### 3. Quá nhiều pulls đồng thời
```
❌ BAD:
- Pull Nhanh All
- Pull Nhanh from 2024-01-01
- Pull Nhanh from 2024-06-01
- Pull Shopify All
- Pull Shopify with query
→ Result: Server overload, slow performance

✅ GOOD:
- Max 2-3 pulls đồng thời
- Monitor server resources
```

## 🎯 Recommended Workflows

### Workflow 1: Daily Maintenance (Fastest)
```bash
Time: ~5-10 minutes

1. Pull New/Updated Nhanh
   - Only customers updated in last 24h
   - Fast, no background needed
   
2. Pull Shopify All (if needed)
   - Or skip if Shopify rarely changes
   
3. Auto-match new customers
4. Sync selected
```

**Pros:**
- ✅ Nhanh nhất
- ✅ Không conflict
- ✅ Ít tài nguyên

**Cons:**
- ⚠️ Chỉ sync customers mới/updated

### Workflow 2: Weekly Full Sync
```bash
Time: ~30-60 minutes

1. Pull All Nhanh (background)
   - Start và để chạy
   
2. Pull All Shopify (background)
   - Chạy song song với step 1
   
3. Wait for both to complete
   - Check progress: node check-pull-progress.js
   
4. Auto-match all
5. Bulk sync
```

**Pros:**
- ✅ Đầy đủ nhất
- ✅ Sync tất cả customers

**Cons:**
- ⚠️ Chậm
- ⚠️ Tốn tài nguyên

### Workflow 3: Filtered Sync (Targeted)
```bash
Time: ~10-20 minutes

1. Pull Nhanh with specific filter
   Example: Customers from 2024-01-01
   
2. Pull Shopify with specific query
   Example: Customers with orders
   
3. Auto-match filtered customers
4. Sync selected
```

**Pros:**
- ✅ Targeted, chỉ sync cần thiết
- ✅ Nhanh hơn Pull All

**Cons:**
- ⚠️ Có thể miss một số customers

## 🔒 Conflict Prevention Rules

### Rule 1: Same ProgressId = Blocked
```typescript
// This will be BLOCKED (409)
Pull 1: { lastBoughtDateFrom: "2024-01-01" }
Pull 2: { lastBoughtDateFrom: "2024-01-01" }
// Same progressId → Conflict

// This is ALLOWED
Pull 1: { lastBoughtDateFrom: "2024-01-01" }
Pull 2: { lastBoughtDateFrom: "2024-06-01" }
// Different progressId → OK
```

### Rule 2: Different System = Always OK
```typescript
// Always ALLOWED
Pull Nhanh + Pull Shopify
// Different systems, different tables, different progressIds
```

### Rule 3: Force Restart = Override
```typescript
// If pull is running, you can force restart
Pull 1: Running...
Pull 2: { forceRestart: true }
// Pull 1 progress deleted, Pull 2 starts fresh
```

### Rule 4: 2-Minute Window
```typescript
// Pull is considered "running" if:
lastPulledAt < 2 minutes ago

// After 2 minutes of no update:
// - Considered stale/crashed
// - New pull can start
```

## 📊 Monitoring & Troubleshooting

### Check Current Pulls
```bash
node check-pull-progress.js
```

Output:
```
shopify_customers: In Progress (27,000 customers)
nhanh_customers: In Progress (53,400 customers)
nhanh_customers_eyJ...: Completed (62,700 customers)
```

### Reset Stuck Pull
```bash
# Via API
POST /api/nhanh/reset-pull-progress?type=customers
POST /api/shopify/reset-pull-progress?type=customers

# Or Force Restart in UI
```

### Check Server Load
```bash
# Monitor CPU, Memory
# Check API rate limits
# Review server logs
```

## 🎓 Decision Tree

```
Need to pull customers?
│
├─ Daily update?
│  └─ Use "Pull New/Updated" (Nhanh)
│     + "Pull Shopify All" if needed
│
├─ First time / Full sync?
│  └─ Use "Pull All" for both
│     (Can run parallel)
│
├─ Specific date range?
│  └─ Use "Pull with Filters"
│     (Check no same filter running)
│
└─ Pull already running?
   ├─ Same filter? → Wait or Force Restart
   ├─ Different filter? → Can start new
   └─ Different system? → Always OK
```

## 📝 Checklist trước khi Pull

- [ ] Check xem có pull nào đang chạy không
- [ ] Xác định pull type phù hợp (All, Filtered, Incremental)
- [ ] Nếu pull cùng filter → Chờ hoặc Force Restart
- [ ] Nếu pull khác filter → OK, có thể start
- [ ] Monitor progress sau khi start
- [ ] Không start quá nhiều pulls (max 2-3)

## 🚀 Quick Commands

```bash
# Check progress
node check-pull-progress.js

# Test API
node test-nhanh-same-filter.js
node test-concurrent-pulls.js

# Reset progress
curl -X POST http://localhost:3000/api/nhanh/reset-pull-progress?type=customers
curl -X POST http://localhost:3000/api/shopify/reset-pull-progress?type=customers
```

## 💡 Pro Tips

1. **Use Incremental for daily**: Nhanh nhất, ít conflict nhất
2. **Schedule Full Sync weekly**: Đảm bảo data đầy đủ
3. **Monitor progress**: Dùng check script thường xuyên
4. **Force Restart carefully**: Chỉ dùng khi thực sự cần
5. **Different filters = Different pulls**: Tận dụng để pull parallel
6. **Nhanh + Shopify parallel**: Luôn OK, tận dụng tối đa

## ⚠️ Common Mistakes

1. ❌ Pull cùng filter liên tục → Bị block 409
2. ❌ Không check progress → Không biết pull đã xong chưa
3. ❌ Quá nhiều pulls → Server overload
4. ❌ Ignore "already running" → Lãng phí thời gian
5. ❌ Pull All khi chỉ cần Incremental → Chậm không cần thiết

## ✅ Best Practices Summary

1. **Daily**: Pull New/Updated (Nhanh) + Pull Shopify (if needed)
2. **Weekly**: Pull All both systems (parallel)
3. **Targeted**: Pull with specific filters
4. **Monitor**: Check progress regularly
5. **Respect**: Don't ignore "already running" warnings
6. **Parallel**: Leverage different systems/filters
7. **Force Restart**: Only when necessary
8. **Resource**: Max 2-3 concurrent pulls
