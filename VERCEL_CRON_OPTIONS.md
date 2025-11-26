# ⏰ Vercel Cron Jobs - Options & Solutions

## 🚫 Vấn đề

**Error:**
```
Hobby accounts are limited to daily cron jobs. 
This cron expression (0 */6 * * *) would run more than once per day.
Upgrade to the Pro plan to unlock all Cron Jobs features on Vercel.
```

**Nguyên nhân:**
- Vercel Hobby (Free) plan chỉ cho phép cron chạy **1 lần/ngày**
- Cron `0 */6 * * *` = mỗi 6 giờ = 4 lần/ngày → ❌ Vượt giới hạn

---

## 💡 Solutions

### **Option 1: Đổi sang Daily Cron (FREE)** ✅ Recommended

**Thay đổi `vercel.json`:**
```json
{
  "crons": [
    {
      "path": "/api/sync/auto-sync",
      "schedule": "0 2 * * *"
    }
  ]
}
```

**Cron expressions cho Hobby plan:**
```bash
# Chạy lúc 2:00 AM mỗi ngày
0 2 * * *

# Chạy lúc 3:00 AM mỗi ngày
0 3 * * *

# Chạy lúc 12:00 PM (trưa) mỗi ngày
0 12 * * *

# Chạy lúc 11:00 PM mỗi ngày
0 23 * * *
```

**Lưu ý:**
- ✅ FREE - Không tốn tiền
- ⚠️ Chỉ sync 1 lần/ngày thay vì 4 lần/ngày
- ⚠️ Dữ liệu có thể stale trong 24 giờ

---

### **Option 2: Upgrade Vercel Pro ($20/tháng)**

**Lợi ích:**
- ✅ Unlimited cron jobs
- ✅ Chạy bao nhiêu lần cũng được (mỗi phút, mỗi giờ, etc.)
- ✅ Nhiều features khác (analytics, monitoring, etc.)

**Cron expressions với Pro plan:**
```bash
# Mỗi 6 giờ (4 lần/ngày)
0 */6 * * *

# Mỗi 3 giờ (8 lần/ngày)
0 */3 * * *

# Mỗi giờ (24 lần/ngày)
0 * * * *

# Mỗi 30 phút (48 lần/ngày)
*/30 * * * *

# Mỗi 15 phút (96 lần/ngày)
*/15 * * * *
```

**Upgrade tại:** https://vercel.com/account/billing

---

### **Option 3: Dùng Webhook thay vì Cron (FREE)** ✅ Best for Real-time

**Ưu điểm:**
- ✅ FREE - Không tốn tiền
- ✅ Real-time sync (< 1 giây)
- ✅ Không phụ thuộc vào cron schedule
- ✅ Chính xác hơn

**Cách setup:**
1. Dùng webhook endpoints đã có:
   - `/api/webhooks/nhanh/customer` - Customer sync
   - `/api/webhooks/nhanh/inventory` - Inventory sync

2. Cấu hình trên Nhanh.vn:
   - Settings → Webhooks
   - Add webhook URL: `https://your-app.vercel.app/api/webhooks/nhanh/customer`
   - Event: `customerUpdate`, `inventoryChange`

3. Kết hợp:
   - **Webhook:** Real-time sync khi có thay đổi
   - **Cron (1x/day):** Backup sync để đảm bảo không miss data

**Xem thêm:**
- `WEBHOOK_CUSTOMER_SETUP.md`
- `WEBHOOK_INVENTORY_SETUP.md`

---

### **Option 4: External Cron Service (FREE/Cheap)**

Dùng service bên ngoài để trigger API endpoint:

#### **4.1. Cron-job.org (FREE)**
- Website: https://cron-job.org
- FREE plan: Unlimited cron jobs
- Setup:
  1. Đăng ký tài khoản
  2. Tạo cron job
  3. URL: `https://your-app.vercel.app/api/sync/auto-sync`
  4. Schedule: `0 */6 * * *` (mỗi 6 giờ)

#### **4.2. EasyCron (FREE)**
- Website: https://www.easycron.com
- FREE plan: 1 cron job
- Tương tự cron-job.org

#### **4.3. GitHub Actions (FREE)**
```yaml
# .github/workflows/sync.yml
name: Auto Sync
on:
  schedule:
    - cron: '0 */6 * * *'  # Mỗi 6 giờ
  workflow_dispatch:  # Manual trigger

jobs:
  sync:
    runs-on: ubuntu-latest
    steps:
      - name: Trigger Sync
        run: |
          curl -X POST https://your-app.vercel.app/api/sync/auto-sync \
            -H "Authorization: Bearer ${{ secrets.SYNC_TOKEN }}"
```

**Lưu ý:** Cần thêm authentication cho API endpoint

---

### **Option 5: Self-hosted Cron (FREE)**

Nếu có VPS/server riêng:

```bash
# Crontab
0 */6 * * * curl -X POST https://your-app.vercel.app/api/sync/auto-sync
```

---

## 📊 So sánh Options

| Option | Cost | Frequency | Real-time | Complexity |
|--------|------|-----------|-----------|------------|
| **Daily Cron** | FREE | 1x/day | ❌ | ⭐ Easy |
| **Vercel Pro** | $20/mo | Unlimited | ❌ | ⭐ Easy |
| **Webhook** | FREE | Real-time | ✅ | ⭐⭐ Medium |
| **External Cron** | FREE | Unlimited | ❌ | ⭐⭐ Medium |
| **GitHub Actions** | FREE | Unlimited | ❌ | ⭐⭐⭐ Hard |
| **Self-hosted** | FREE* | Unlimited | ❌ | ⭐⭐⭐ Hard |

*Cần có VPS/server

---

## 🎯 Khuyến nghị

### **Cho Hobby/Small Business:**
```
✅ Option 3: Webhook (Real-time) + Daily Cron (Backup)
```
- FREE
- Real-time sync
- Reliable với backup

### **Cho Production/Enterprise:**
```
✅ Option 2: Vercel Pro + Webhook
```
- Professional
- Flexible cron schedule
- Real-time sync
- Better support

### **Cho Development/Testing:**
```
✅ Option 1: Daily Cron
```
- FREE
- Simple
- Đủ cho testing

---

## 🔧 Implementation

### **Current Setup (đã fix):**
```json
// vercel.json
{
  "crons": [
    {
      "path": "/api/sync/auto-sync",
      "schedule": "0 2 * * *"  // 2:00 AM daily
    }
  ]
}
```

### **Recommended Setup:**

**1. Deploy với Daily Cron (FREE):**
```bash
git add vercel.json
git commit -m "fix: Change cron to daily for Vercel Hobby plan"
git push origin main
```

**2. Setup Webhooks (FREE):**
- Follow `WEBHOOK_CUSTOMER_SETUP.md`
- Follow `WEBHOOK_INVENTORY_SETUP.md`

**3. Kết quả:**
- ✅ Real-time sync qua webhooks
- ✅ Daily backup sync qua cron
- ✅ Hoàn toàn FREE
- ✅ Reliable và accurate

---

## 📝 Cron Expression Reference

```bash
# Format: minute hour day month weekday
# * * * * *
# │ │ │ │ │
# │ │ │ │ └─── Weekday (0-7, 0=Sunday)
# │ │ │ └───── Month (1-12)
# │ │ └─────── Day (1-31)
# │ └───────── Hour (0-23)
# └─────────── Minute (0-59)

# Examples:
0 2 * * *      # 2:00 AM daily
0 */6 * * *    # Every 6 hours (requires Pro)
*/30 * * * *   # Every 30 minutes (requires Pro)
0 0 * * 0      # Every Sunday at midnight
0 9 1 * *      # 9:00 AM on 1st of every month
```

---

## 🎉 Kết luận

**Đã fix:** Cron expression đổi thành `0 2 * * *` (daily)

**Next steps:**
1. ✅ Deploy lên Vercel (sẽ không còn error)
2. ✅ Setup webhooks cho real-time sync
3. ✅ Test cả 2 methods (cron + webhook)

**Kết quả:**
- ✅ FREE solution
- ✅ Real-time sync (webhook)
- ✅ Backup sync (daily cron)
- ✅ Production ready
