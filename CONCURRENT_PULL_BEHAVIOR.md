# Concurrent Pull Behavior - Explained

## Question
"Đang pull customer Nhanh với filter nhưng vẫn pull all được, có đúng không?"

## Answer: ✅ Đúng! Đây là behavior mong muốn.

## Tại sao?

### 1. ProgressId khác nhau

Mỗi pull có một `progressId` riêng dựa trên filters:

```javascript
// Pull ALL (no filter)
progressId = "nhanh_customers"

// Pull with filter: lastBoughtDateFrom = "2024-01-01"
progressId = "nhanh_customers_eyJsYXN0Qm91Z2h0RGF0..."

// Pull with filter: type = 1
progressId = "nhanh_customers_eyJ0eXBlIjoxfQ=="
```

→ **Khác progressId = Có thể chạy song song**

### 2. Use Cases hợp lệ

**Scenario 1: Pull filtered trước, sau đó muốn pull all**
- Đang pull customers từ 2024 (filtered)
- Nhận ra cần pull tất cả customers
- Start pull all → Chạy song song, không conflict

**Scenario 2: Pull all chậm, muốn pull một phần trước**
- Pull all đang chạy (chậm, nhiều data)
- Cần customers mới nhất ngay
- Start pull với filter "từ hôm nay" → Lấy data nhanh hơn

**Scenario 3: Testing**
- Pull all đang chạy production
- Muốn test pull với filter khác
- Có thể test mà không ảnh hưởng pull chính

### 3. Không có Data Conflict

Cả hai pulls đều:
- Upsert vào cùng bảng `nhanhCustomer`
- Dùng `id` làm unique key
- Update `lastPulledAt` timestamp

→ **Không gây duplicate hoặc conflict**

## Behavior Matrix

| Pull đang chạy | Pull mới | Kết quả |
|----------------|----------|---------|
| Pull All | Pull All | ❌ Blocked (409) |
| Pull All | Pull với Filter A | ✅ Allowed (parallel) |
| Pull với Filter A | Pull với Filter A | ❌ Blocked (409) |
| Pull với Filter A | Pull với Filter B | ✅ Allowed (parallel) |
| Pull với Filter A | Pull All | ✅ Allowed (parallel) |
| Pull Nhanh | Pull Shopify | ✅ Allowed (parallel) |

## UI Messages

### Pull All
```
Pull ALL customers from Nhanh.vn in background?

💡 This will pull ALL customers without any filters.

Note: This can run in parallel with filtered pulls.

This will continue running even if you close this page.
```

### Pull với Filter
```
Pull with filters:
- From: 2024-01-01

✅ Nhanh API supports these filters!
Filters will be applied during pull.

This will run in background. Continue?
```

## Recommendations

### ✅ Nên làm
- Pull All khi cần sync toàn bộ database
- Pull với filter khi cần data cụ thể
- Chạy song song nếu có use case hợp lý

### ⚠️ Cẩn thận
- Nhiều pulls song song → Tốn tài nguyên (CPU, memory, API rate limit)
- Pull All + Pull filtered → Có thể pull duplicate data
- Monitor server logs để đảm bảo không quá tải

### ❌ Không nên
- Start quá nhiều pulls cùng lúc (>3-4)
- Pull All nhiều lần liên tiếp
- Ignore "already running" warnings

## Technical Details

### Progress Tracking
```typescript
// Each pull has its own progress record
{
  id: "nhanh_customers_[hash]",
  nextCursor: "...",
  totalPulled: 10000,
  lastPulledAt: "2025-11-29T22:44:00Z",
  isCompleted: false,
  metadata: '{"lastBoughtDateFrom":"2024-01-01"}'
}
```

### Already Running Detection
- Check `lastPulledAt` < 2 minutes → Running
- Same `progressId` → Block
- Different `progressId` → Allow

### Force Restart
- Delete progress record
- Start from beginning
- Works even if pull is running

## Conclusion

**Behavior hiện tại là ĐÚNG và MONG MUỐN.**

Lý do:
- ✅ Flexibility: Cho phép nhiều use cases
- ✅ No conflicts: Không gây data corruption
- ✅ Clear separation: Mỗi pull có progressId riêng
- ✅ User control: User quyết định chạy song song hay không

Nếu muốn thay đổi behavior (block tất cả Nhanh pulls), cần:
1. Thêm API endpoint check "any Nhanh pull running"
2. Update UI để check trước khi start
3. Có thể làm phức tạp UX
