# Quick Reference - Pull Customers

## 🎯 Flow chuẩn KHÔNG conflict

### 1️⃣ Daily Sync (Khuyến nghị)
```
Pull New/Updated (Nhanh) → Pull Shopify → Auto-match → Sync
⏱️ 5-10 phút | ✅ Không conflict | 💪 Nhanh nhất
```

### 2️⃣ Weekly Full Sync
```
Pull All Nhanh + Pull All Shopify (song song) → Wait → Auto-match → Sync
⏱️ 30-60 phút | ✅ Không conflict | 📊 Đầy đủ nhất
```

### 3️⃣ Filtered Sync
```
Pull Nhanh (filter) + Pull Shopify (query) → Auto-match → Sync
⏱️ 10-20 phút | ✅ Không conflict | 🎯 Targeted
```

## ✅ ALLOWED (Không conflict)

| Scenario | Kết quả |
|----------|---------|
| Nhanh + Shopify | ✅ Luôn OK |
| Nhanh Filter A + Nhanh Filter B | ✅ OK |
| Shopify Query A + Shopify Query B | ✅ OK |
| Pull New/Updated + Bất kỳ | ✅ OK |

## ❌ BLOCKED (Có conflict)

| Scenario | Kết quả |
|----------|---------|
| Nhanh All + Nhanh All | ❌ Blocked (409) |
| Nhanh Filter A + Nhanh Filter A | ❌ Blocked (409) |
| Shopify Query A + Shopify Query A | ❌ Blocked (409) |

## ⚠️ CAUTION (Cho phép nhưng cẩn thận)

| Scenario | Lưu ý |
|----------|-------|
| Nhanh Filter + Nhanh All | ⚠️ Duplicate work |
| Quá nhiều pulls (>3) | ⚠️ Server overload |

## 🔑 Key Rules

1. **Same progressId** = Blocked
2. **Different progressId** = OK
3. **Different system** (Nhanh vs Shopify) = Always OK
4. **Force Restart** = Override block

## 📊 Check Progress

```bash
node check-pull-progress.js
```

## 🔄 Reset Stuck Pull

```bash
# UI: Click Force Restart in dialog
# Or API:
POST /api/nhanh/reset-pull-progress?type=customers
POST /api/shopify/reset-pull-progress?type=customers
```

## 💡 Best Practices

1. ✅ Daily: Dùng Pull New/Updated
2. ✅ Weekly: Dùng Pull All
3. ✅ Check progress trước khi pull
4. ✅ Max 2-3 pulls đồng thời
5. ✅ Monitor server logs
6. ❌ Không pull cùng filter liên tục
7. ❌ Không ignore "already running"

## 🚀 Quick Start

### Lần đầu setup:
```
1. Pull All Nhanh
2. Pull All Shopify (có thể song song)
3. Wait to complete
4. Auto-match
5. Review & Sync
```

### Hàng ngày:
```
1. Pull New/Updated (Nhanh)
2. Auto-match
3. Sync
```

### Khi cần data cụ thể:
```
1. Pull with Filters (Nhanh)
2. Pull with Query (Shopify)
3. Auto-match
4. Sync
```

## 📚 Docs

- `PULL_FLOW_BEST_PRACTICES.md` - Chi tiết workflows
- `PULL_CONFLICT_MATRIX.md` - Conflict matrix đầy đủ
- `CONCURRENT_PULL_BEHAVIOR.md` - Giải thích behavior
- `UI_TEST_GUIDE.md` - Hướng dẫn test UI
