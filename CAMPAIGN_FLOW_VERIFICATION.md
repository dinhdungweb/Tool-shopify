# ✅ Kiểm tra hoàn chỉnh 2 chức năng tạo Campaign

## 🔧 **Lỗi đã phát hiện và sửa**

### **Vấn đề:**
PATCH endpoint `/api/sale/campaigns/[id]` **KHÔNG hỗ trợ update field `status`**

Khi click "Schedule Campaign", code gọi:
```typescript
await saleClient.updateCampaign(tempCampaignId, { status: "SCHEDULED" });
```

Nhưng PATCH endpoint bỏ qua field `status` → Campaign vẫn ở trạng thái DRAFT!

### **Giải pháp:**
Đã thêm logic update `status` vào PATCH endpoint:
```typescript
const { ..., status } = body;
if (status !== undefined) updateData.status = status;
```

---

## ✅ **Logic hoàn chỉnh sau khi fix**

### **1. IMMEDIATE Campaign (Apply Now)**

**Flow:**
1. ✅ Tạo campaign → `status = "DRAFT"`
2. ✅ Click "Apply Now" → `saleClient.applyCampaign(tempCampaignId)`
3. ✅ Apply API tự động set → `status = "ACTIVE"`
4. ✅ Set `tempCampaignId = null` → Không bị delete khi đóng modal
5. ✅ Gọi `onSuccess()` → Reload danh sách
6. ✅ Campaign xuất hiện với `status = "ACTIVE"`

**Code:**
```typescript
if (scheduleType === "IMMEDIATE") {
  const result = await saleClient.applyCampaign(tempCampaignId);
  // Apply API internally sets status to ACTIVE
  setTempCampaignId(null); // Prevent deletion
  onSuccess();
  handleClose();
}
```

---

### **2. SCHEDULED Campaign (Schedule Campaign)**

**Flow:**
1. ✅ Tạo campaign → `status = "DRAFT"`
2. ✅ Click "Schedule Campaign" → `saleClient.updateCampaign(tempCampaignId, {status: "SCHEDULED"})`
3. ✅ PATCH API update → `status = "SCHEDULED"` ✅ **ĐÃ FIX**
4. ✅ Set `tempCampaignId = null` → Không bị delete khi đóng modal
5. ✅ Gọi `onSuccess()` → Reload danh sách
6. ✅ Campaign xuất hiện với `status = "SCHEDULED"`

**Code:**
```typescript
else {
  await saleClient.updateCampaign(tempCampaignId, {
    status: "SCHEDULED"
  });
  setTempCampaignId(null); // Prevent deletion
  onSuccess();
  handleClose();
}
```

---

### **3. Đóng modal (handleClose)**

**Logic:**
```typescript
if (tempCampaignId !== null && step === 4) {
  const campaign = await saleClient.getCampaignById(tempCampaignId);
  
  if (campaign.status === "DRAFT") {
    await saleClient.deleteCampaign(tempCampaignId); // ✅ Delete DRAFT
  } else {
    // ✅ Keep SCHEDULED/ACTIVE campaigns
  }
}
```

**Kết quả:**
- ✅ DRAFT campaigns → Bị xóa khi đóng modal
- ✅ SCHEDULED campaigns → Được giữ lại
- ✅ ACTIVE campaigns → Được giữ lại

---

### **4. Scheduler tự động**

**Logic:**
- ✅ SCHEDULED campaigns → Tự động apply khi đến `startDate`
- ✅ ACTIVE campaigns → Tự động revert khi đến `endDate`

**Scheduler service:**
```typescript
// Check SCHEDULED campaigns
const scheduledCampaigns = await prisma.saleCampaign.findMany({
  where: {
    status: "SCHEDULED",
    startDate: { lte: now }
  }
});

for (const campaign of scheduledCampaigns) {
  await saleService.applyCampaign(campaign.id);
}

// Check ACTIVE campaigns for end date
const activeCampaigns = await prisma.saleCampaign.findMany({
  where: {
    status: "ACTIVE",
    endDate: { lte: now }
  }
});

for (const campaign of activeCampaigns) {
  await saleService.revertCampaign(campaign.id);
}
```

---

## 🧪 **Test Results**

Đã chạy test script `test-campaign-flow.js`:

```
✅ Test 1: IMMEDIATE campaign → DRAFT → ACTIVE
✅ Test 2: SCHEDULED campaign → DRAFT → SCHEDULED
✅ Test 3: DRAFT campaigns deleted on close
✅ Test 4: ACTIVE/SCHEDULED campaigns preserved
```

**Tất cả tests đều PASS! ✅**

---

## 🎯 **Tổng kết**

### **Trước khi fix:**
❌ Schedule Campaign không hoạt động → Status vẫn là DRAFT
❌ Campaign bị scheduler bỏ qua vì không có status SCHEDULED

### **Sau khi fix:**
✅ **Apply Now** → Campaign ACTIVE ngay lập tức
✅ **Schedule Campaign** → Campaign SCHEDULED, tự động apply theo lịch
✅ **Không bị mất** sau khi refresh
✅ **Auto cleanup** draft campaigns khi đóng modal
✅ **Scheduler** tự động chạy đúng lịch

---

## 📝 **Cách test thủ công**

### **Test 1: Apply Now**
1. Tạo campaign mới
2. Chọn "Apply Immediately"
3. Click "Apply Now"
4. ✅ Check: Campaign có status = ACTIVE
5. ✅ Check: Refresh page → Campaign vẫn còn

### **Test 2: Schedule Campaign**
1. Tạo campaign mới
2. Chọn "Schedule for Later"
3. Chọn thời gian 10 phút sau
4. Click "Schedule Campaign"
5. ✅ Check: Campaign có status = SCHEDULED
6. ✅ Check: Refresh page → Campaign vẫn còn
7. ✅ Check: Sau 10 phút → Campaign tự động chuyển thành ACTIVE

### **Test 3: Close Modal**
1. Tạo campaign mới
2. Đến step 4 (Preview)
3. Click "Cancel" hoặc đóng modal
4. ✅ Check: Campaign DRAFT bị xóa
5. ✅ Check: Campaigns SCHEDULED/ACTIVE không bị xóa

---

## 🔍 **Files đã sửa**

1. **src/app/api/sale/campaigns/[id]/route.ts**
   - Thêm support update `status` trong PATCH endpoint

---

## ✅ **Kết luận**

**Cả 2 chức năng đã hoạt động đúng logic sau khi fix!** 🎉

- ✅ Apply Now → ACTIVE ngay lập tức
- ✅ Schedule Campaign → SCHEDULED, tự động apply theo lịch
- ✅ Không bị mất sau refresh
- ✅ Auto cleanup drafts
- ✅ Scheduler hoạt động đúng
